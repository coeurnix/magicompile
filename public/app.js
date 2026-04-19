import createTinyCCModule from "/tcc-wasm/tcc.mjs";

const OUTPUT_PATH = "/tmp/out/generated-app.exe";

const PRESETS = {
	calculator:
		"Make a small Win32 calculator with a display, digit buttons, + - * /, equals, clear, and keyboard input.",
	guessing:
		"Create a Win32 number guessing game with a text box, Guess button, New Game button, hints, and an attempt counter.",
	"bouncing-ball":
		"Build a Win32 GDI animation with one bouncing ball that leaves soft trailing circles and has Start and Pause buttons.",
	"http-server":
		"Make a tiny Win32 HTTP server with a Start button, Stop button, port field, request log area, and graceful shutdown. Keep networking simple and local.",
	xinput:
		"Create a Win32 gamepad viewer that uses XInput to show connection state, thumbstick values, trigger values, and button highlights.",
};

const promptElement = document.getElementById("prompt");
const presetElement = document.getElementById("preset");
const generateButton = document.getElementById("generate");
const downloadButton = document.getElementById("download");
const statusHeadline = document.getElementById("status-headline");
const statusDetail = document.getElementById("status-detail");
const activityLog = document.getElementById("activity-log");
const lineCountElement = document.getElementById("line-count");
const exeSizeElement = document.getElementById("exe-size");
const packageStateElement = document.getElementById("package-state");
const buildNoteElement = document.getElementById("build-note");
const spinnerPanelElement = document.getElementById("spinner-panel");
const errorBoxElement = document.getElementById("error-box");
const errorLogElement = document.getElementById("error-log");

const state = {
	modulePromise: undefined,
	activity: [],
	sourceCode: "",
	exeBytes: undefined,
	fileBaseName: "magicompile-app",
};

promptElement.value = PRESETS.calculator;
presetElement.value = "calculator";

function formatBytes(byteLength) {
	return `${new Intl.NumberFormat().format(byteLength)} bytes`;
}

function slugify(value) {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);

	return slug || "magicompile-app";
}

function countLines(source) {
	if (!source.trim()) {
		return 0;
	}

	return source.replace(/\r\n/g, "\n").split("\n").length;
}

function clearError() {
	errorBoxElement.hidden = true;
	errorLogElement.textContent = "";
}

function showError(message) {
	errorLogElement.textContent = message;
	errorBoxElement.hidden = false;
}

function appendActivity(message) {
	state.activity.unshift(message);
	state.activity = state.activity.slice(0, 6);
	activityLog.innerHTML = "";

	for (const item of state.activity) {
		const entry = document.createElement("li");
		entry.textContent = item;
		activityLog.append(entry);
	}
}

function setStatus(headline, detail) {
	statusHeadline.textContent = headline;
	statusDetail.textContent = detail;
}

function resetArtifact() {
	state.sourceCode = "";
	state.exeBytes = undefined;
	lineCountElement.textContent = "0";
	exeSizeElement.textContent = "Not built";
	packageStateElement.textContent = "Waiting";
	downloadButton.disabled = true;
	buildNoteElement.textContent = "Generated source and build notes appear here.";
}

function setBusy(isBusy) {
	generateButton.disabled = isBusy;
	downloadButton.disabled = isBusy || !state.exeBytes;
	presetElement.disabled = isBusy;
	promptElement.disabled = isBusy;
	spinnerPanelElement.hidden = !isBusy;
}

async function getCompiler() {
	if (!state.modulePromise) {
		appendActivity("Waking up the builder.");
		state.modulePromise = createTinyCCModule({
			locateFile(path) {
				return `/tcc-wasm/${path}`;
			},
		});
	}

	return state.modulePromise;
}

function ensureDir(module, path) {
	try {
		module.FS.mkdir(path);
	} catch {
	}
}

async function compileSource(sourceCode) {
	const module = await getCompiler();
	ensureDir(module, "/tmp");
	ensureDir(module, "/tmp/out");

	try {
		module.FS.unlink(OUTPUT_PATH);
	} catch {
	}

	const result = module.ccall(
		"tcc_compile_to_exe",
		"number",
		["string", "string"],
		[sourceCode, OUTPUT_PATH]
	);

	if (result !== 1) {
		return {
			ok: false,
			error:
				module.ccall("tcc_last_error", "string") ||
				"The builder could not finish this draft.",
		};
	}

	return {
		ok: true,
		bytes: module.FS.readFile(OUTPUT_PATH),
	};
}

async function requestGeneratedSource(payload) {
	const response = await fetch("/api/generate", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.error || "Generation failed.");
	}

	return data.sourceCode;
}

async function generateZip() {
	const zip = new window.JSZip();
	zip.file(`${state.fileBaseName}.c`, state.sourceCode);
	zip.file(`${state.fileBaseName}.exe`, state.exeBytes);
	return zip.generateAsync({ type: "blob" });
}

async function runWorkflow() {
	const prompt = promptElement.value.trim();
	if (!prompt) {
		setStatus("A short idea helps the most.", "Write a prompt before generating.");
		appendActivity("Waiting for a prompt.");
		return;
	}

	clearError();
	resetArtifact();
	state.fileBaseName = slugify(prompt);
	setBusy(true);
	setStatus("Reading your idea.", "Turning it into one small Windows program.");
	appendActivity("Reading your idea.");

	try {
		let sourceCode = await requestGeneratedSource({
			mode: "generate",
			prompt,
		});

		state.sourceCode = sourceCode;
		lineCountElement.textContent = new Intl.NumberFormat().format(
			countLines(sourceCode)
		);
		setStatus("Writing the window.", "The first draft is ready and heading into a build.");
		appendActivity("The first draft is ready.");

		let compileResult = await compileSource(sourceCode);
		if (!compileResult.ok) {
			showError(compileResult.error);
			setStatus(
				"Giving it one more pass.",
				"The first draft needs a small repair before it can ship."
			);
			appendActivity("The first draft needs one cleanup pass.");

			sourceCode = await requestGeneratedSource({
				mode: "repair",
				prompt,
				previousSource: sourceCode,
				compileError: compileResult.error,
			});

			state.sourceCode = sourceCode;
			lineCountElement.textContent = new Intl.NumberFormat().format(
				countLines(sourceCode)
			);
			compileResult = await compileSource(sourceCode);
		}

		if (!compileResult.ok) {
			showError(compileResult.error);
			setStatus(
				"This one did not come together.",
				"The app stayed close, but it still would not build after one repair."
			);
			appendActivity("This draft still needs manual attention.");
			buildNoteElement.textContent = "The source was generated, but the build still needs work.";
			return;
		}

		state.exeBytes = compileResult.bytes;
		exeSizeElement.textContent = formatBytes(compileResult.bytes.byteLength);
		packageStateElement.textContent = "Ready for download";
		buildNoteElement.textContent = "The source compiled cleanly and the ZIP is ready.";
		downloadButton.disabled = false;
		setStatus(
			"Ready to download.",
			"The source compiled cleanly and the package can be saved now."
		);
		appendActivity("The app built cleanly.");
		clearError();
	} catch (error) {
		showError(error instanceof Error ? error.message : String(error));
		setStatus(
			"Something interrupted the process.",
			"Try a smaller prompt or check that the server key is configured."
		);
		appendActivity("The request hit a snag.");
	} finally {
		setBusy(false);
	}
}

async function handleDownload() {
	if (!state.exeBytes || !state.sourceCode) {
		return;
	}

	setBusy(true);
	clearError();
	setStatus("Packing it up.", "Bundling the source file and executable together.");
	appendActivity("Packing the ZIP.");

	try {
		const blob = await generateZip();
		const href = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = href;
		anchor.download = `${state.fileBaseName}.zip`;
		anchor.click();
		setStatus("Download started.", "Your ZIP now contains the C source and the EXE.");
		appendActivity("The ZIP is on its way.");
		setTimeout(() => URL.revokeObjectURL(href), 30_000);
	} catch (error) {
		showError(error instanceof Error ? error.message : String(error));
		setStatus("The package could not be prepared.", "Try generating again.");
		appendActivity("The ZIP step needs another try.");
	} finally {
		setBusy(false);
	}
}

presetElement.addEventListener("change", () => {
	const preset = PRESETS[presetElement.value];
	if (!preset) {
		return;
	}

	promptElement.value = preset;
	resetArtifact();
	appendActivity("Loaded a starter idea.");
});

generateButton.addEventListener("click", () => {
	void runWorkflow();
});

downloadButton.addEventListener("click", () => {
	void handleDownload();
});

promptElement.addEventListener("input", () => {
	resetArtifact();
});

appendActivity("Ready when you are.");
