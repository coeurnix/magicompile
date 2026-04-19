# Magicompile

Magicompile is a Cloudflare Workers app that turns a short prompt into a small Win32 GUI program in C, then compiles it locally in the browser into a downloadable Windows `.exe`.

Live demo: https://magicompile.coeurnix.workers.dev/

## How It Works

- The browser sends your prompt to the Worker.
- The Worker calls the OpenAI Responses API and requests a single Win32 GUI C source file.
- The browser compiles that source with a WebAssembly build of [TCC (Tiny C Compiler)](https://bellard.org/tcc/).
- If the first build fails, the app asks for one repair pass and tries again.
- On success, the browser downloads a ZIP containing the `.c` file and `.exe`.

## Stack

- Cloudflare Workers for the API route and static hosting
- WebAssembly TCC for client-side Windows executable generation
- 7.css for the Windows-style UI
- JSZip for packaging source and executable together

## Development

Requirements:

- Node.js and npm
- Emscripten (`emcc`)
- Visual C++ build tools

Install dependencies:

```bash
npm install
```

Build the TCC WebAssembly bundle:

```bash
npm run build:tcc-wasm
```

Run locally:

```bash
npm run dev
```

The Worker expects an `OPENAI_API_KEY` secret in local or deployed environment configuration.

## Notes

- The current generation model is fixed in code.
- Compilation happens in the browser, not on the Worker.
- The generated apps are intended to stay small and use the bundled Win32/TCC-friendly DLL set.

## License

Licensed under the Autonomous Commons Zero License (`AC0`). See [LICENSE.txt](./LICENSE.txt).
