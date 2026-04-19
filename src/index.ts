const OPENAI_MODEL = "gpt-5.4-mini-2026-03-17";

const GENERATION_INSTRUCTIONS = `You write small Windows desktop programs in C that must compile with TinyCC targeting 32-bit Win32 GUI executables.

Hard constraints:
- Return exactly one complete C source file and nothing else.
- Output raw C code only. Do not use Markdown fences, JSON, headings, notes, or explanations.
- The program must be a GUI app using WinMain or wWinMain, not a console app.
- The code must compile as plain C with TinyCC for x86 Windows.
- Use only APIs that live in this DLL set: kernel32, user32, gdi32, comctl32, comdlg32, shell32, shlwapi, advapi32, ole32, oleaut32, ws2_32, gdiplus, winmm, xinput1_4, msvcrt.
- Do not rely on external source files, resource files, icons, manifests, custom libraries, DirectX, OpenGL, .rc files, or downloaded assets.
- Do not use C++, inline assembly, #pragma comment(lib, ...), threads, fibers, COM interface-heavy patterns, or compiler-specific extensions that TinyCC is unlikely to support.
- Prefer straightforward Win32 APIs, explicit control IDs, a normal message loop, and a WM_CLOSE / WM_DESTROY path that exits cleanly.
- Do not add an in-window Close button unless the user explicitly asks for one. Rely on the normal window close event by default.
- Keep the program lean and practical. If the request is too large, reduce scope to the smallest working version that still matches the main idea.
- Keep strings and comments ASCII-only.

Implementation guidance:
- Supported headers include windows.h, commctrl.h, commdlg.h, shellapi.h, shlwapi.h, winsock2.h, gdiplus.h, mmsystem.h, xinput.h, stdio.h, stdlib.h, string.h, math.h, time.h.
- Networking should stay simple and local, such as a tiny HTTP listener with a basic UI.
- Graphics should prefer plain GDI unless the prompt specifically benefits from GDI+.
- If you use common controls, initialize them.
- If you use Winsock, initialize and clean it up.
- Keep variable names readable and code easy to repair.`;

type AssetsBinding = {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type AppEnv = Env & {
	OPENAI_API_KEY?: string;
	ASSETS?: AssetsBinding;
};

type GenerateRequest = {
	prompt?: unknown;
	mode?: unknown;
	previousSource?: unknown;
	compileError?: unknown;
};

function json(data: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
		},
		...init,
	});
}

function normalizePrompt(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function buildUserPrompt({
	prompt,
	mode,
	previousSource,
	compileError,
}: {
	prompt: string;
	mode: "generate" | "repair";
	previousSource?: string;
	compileError?: string;
}): string {
	if (mode === "repair") {
		return [
			"Original user prompt:",
			prompt,
			"",
			"The previous draft did not compile under the browser TinyCC build.",
			"Revise the source so it compiles cleanly while keeping the same main behavior.",
			"Simplify aggressively if necessary, but keep it as a Win32 GUI app in one C file.",
			"",
			"Previous source:",
			previousSource ?? "",
			"",
			"Compiler error:",
			compileError ?? "",
		].join("\n");
	}

	return [
		"Build one small Win32 GUI application from this prompt.",
		"Keep it focused and practical.",
		"",
		"User prompt:",
		prompt,
	].join("\n");
}

function extractResponseText(payload: any): string {
	if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
		return payload.output_text.trim();
	}

	const pieces: string[] = [];

	for (const item of payload?.output ?? []) {
		if (!item || item.type !== "message" || !Array.isArray(item.content)) {
			continue;
		}

		for (const content of item.content) {
			if (typeof content?.text === "string" && content.text.trim()) {
				pieces.push(content.text);
			}
		}
	}

	return pieces.join("\n").trim();
}

function sanitizeSourceCode(sourceCode: string): string {
	return sourceCode
		.replace(/\r\n/g, "\n")
		.replace(/^```[a-zA-Z0-9]*\n?/, "")
		.replace(/\n?```$/, "")
		.trim();
}

async function callOpenAI(
	apiKey: string,
	request: {
		prompt: string;
		mode: "generate" | "repair";
		previousSource?: string;
		compileError?: string;
	}
): Promise<string> {
	const response = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: OPENAI_MODEL,
			store: false,
			input: [
				{
					role: "system",
					content: [
						{
							type: "input_text",
							text: GENERATION_INSTRUCTIONS,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "input_text",
							text: buildUserPrompt(request),
						},
					],
				},
			],
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`OpenAI request failed (${response.status}): ${body.slice(0, 800)}`
		);
	}

	const payload = await response.json<any>();
	const sourceCode = sanitizeSourceCode(extractResponseText(payload));

	if (!sourceCode) {
		throw new Error("The model returned no source code.");
	}

	return sourceCode;
}

async function handleGenerate(request: Request, env: AppEnv): Promise<Response> {
	if (!env.OPENAI_API_KEY) {
		return json(
			{
				error: "OPENAI_API_KEY is not configured on the Worker.",
			},
			{ status: 500 }
		);
	}

	let payload: GenerateRequest;
	try {
		payload = (await request.json()) as GenerateRequest;
	} catch {
		return json({ error: "Request body must be valid JSON." }, { status: 400 });
	}

	const prompt = normalizePrompt(payload.prompt);
	if (!prompt) {
		return json(
			{ error: "A prompt is required before generating an app." },
			{ status: 400 }
		);
	}

	const mode = payload.mode === "repair" ? "repair" : "generate";
	const previousSource =
		typeof payload.previousSource === "string" ? payload.previousSource : undefined;
	const compileError =
		typeof payload.compileError === "string" ? payload.compileError : undefined;

	try {
		const sourceCode = await callOpenAI(env.OPENAI_API_KEY, {
			prompt,
			mode,
			previousSource,
			compileError,
		});

		return json({ sourceCode });
	} catch (error) {
		return json(
			{
				error:
					error instanceof Error
						? error.message
						: "Generation failed for an unknown reason.",
			},
			{ status: 502 }
		);
	}
}

export default {
	async fetch(request, env: AppEnv): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (pathname === "/api/generate") {
			if (request.method !== "POST") {
				return json({ error: "Method not allowed." }, { status: 405 });
			}

			return handleGenerate(request, env);
		}

		if (env.ASSETS?.fetch) {
			return env.ASSETS.fetch(request);
		}

		if (pathname === "/favicon.ico") {
			return new Response(null, { status: 204 });
		}

		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<AppEnv>;
