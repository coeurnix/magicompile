import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const tinyccDir = resolve(root, "vendor", "tinycc-official");
const tinyccWin32Dir = resolve(tinyccDir, "win32");
const outputDir = resolve(root, "public", "tcc-wasm");
const system32Dir = resolve(process.env.SystemRoot ?? "C:\\Windows", "System32");
const emsdkDir = process.env.EMSDK;
const emccPath = emsdkDir
	? resolve(emsdkDir, "upstream", "emscripten", "emcc.bat")
	: "emcc.bat";
const extraImportDlls = [
	"advapi32",
	"comctl32",
	"comdlg32",
	"gdiplus",
	"ole32",
	"oleaut32",
	"shell32",
	"shlwapi",
	"winmm",
	"ws2_32",
	"xinput1_4",
];

function run(command, args, options = {}) {
	const printable = [command, ...args].join(" ");
	console.log(`> ${printable}`);

	const result = spawnSync(command, args, {
		cwd: root,
		stdio: "inherit",
		...options,
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

if (!existsSync(tinyccDir)) {
	console.error(
		"Missing vendor/tinycc-official. Clone TinyCC before building the WASM client."
	);
	process.exit(1);
}

if (emsdkDir && !existsSync(emccPath)) {
	console.error(`EMSDK is set, but emcc was not found at ${emccPath}`);
	process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

run("cmd", ["/c", "build-tcc.bat", "-c", "cl", "-x"], {
	cwd: tinyccWin32Dir,
});

copyFileSync(
	resolve(tinyccWin32Dir, "lib", "libtcc1.a"),
	resolve(tinyccWin32Dir, "lib", "libtcc1-64.a"),
);
copyFileSync(
	resolve(tinyccWin32Dir, "lib", "i386-win32-libtcc1.a"),
	resolve(tinyccWin32Dir, "lib", "libtcc1-32.a"),
);

for (const dll of extraImportDlls) {
	const dllPath = resolve(system32Dir, `${dll}.dll`);
	if (!existsSync(dllPath)) {
		continue;
	}

	run("cmd", ["/c", "tcc.exe", "-impdef", dllPath, "-o", `lib\\${dll}.def`], {
		cwd: tinyccWin32Dir,
	});
}

run(
	"cmd",
	[
		"/c",
		emccPath,
		resolve(root, "wasm", "tcc_browser.c"),
		resolve(tinyccDir, "libtcc.c"),
		"-I",
		tinyccDir,
		"-include",
		resolve(root, "wasm", "tcc_wasm_config.h"),
		"-DTCC_TARGET_I386",
		"-DTCC_TARGET_PE",
		"-O2",
		"-s",
		"ENVIRONMENT=web,node",
		"-s",
		"FORCE_FILESYSTEM=1",
		"-s",
		"MODULARIZE=1",
		"-s",
		"EXPORT_ES6=1",
		"-s",
		"ALLOW_MEMORY_GROWTH=1",
		"-s",
		"INITIAL_MEMORY=134217728",
		'-sEXPORTED_FUNCTIONS=["_tcc_compile_to_exe","_tcc_last_error"]',
		'-sEXPORTED_RUNTIME_METHODS=["FS","ccall"]',
		"--preload-file",
		`${resolve(tinyccDir, "win32", "include")}@/tcc/win32/include`,
		"--preload-file",
		`${resolve(tinyccDir, "win32", "lib")}@/tcc/win32/lib`,
		"-o",
		resolve(outputDir, "tcc.mjs"),
	],
);
