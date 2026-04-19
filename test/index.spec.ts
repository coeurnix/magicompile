import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe("Magicompile worker", () => {
	it("serves the static client (unit style)", async () => {
		const request = new Request<unknown, IncomingRequestCfProperties>(
			"http://example.com/"
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{
				...env,
				ASSETS: {
					fetch: async () =>
						new Response("<!doctype html><title>Magicompile</title>"),
				},
			},
			ctx
		);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Magicompile");
	});

	it("generates plain source through the API route", async () => {
		globalThis.fetch = vi.fn(async (input) => {
			expect(String(input)).toBe("https://api.openai.com/v1/responses");
			return new Response(
				JSON.stringify({
					output: [
						{
							type: "message",
							content: [
								{
									type: "output_text",
									text: "int WINAPI WinMain(void){return 0;}",
								},
							],
						},
					],
				}),
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				}
			);
		}) as typeof globalThis.fetch;

		const request = new Request("http://example.com/api/generate", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				prompt: "Make a tiny greeting app.",
			}),
		});

		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{
				...env,
				OPENAI_API_KEY: "test-key",
			},
			ctx
		);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json<any>();
		expect(body.sourceCode).toContain("WinMain");
		expect(body.model).toBeUndefined();
	});

	it("serves the prompt-first client (integration style)", async () => {
		const request = new Request("http://example.com/");
		const response = await SELF.fetch(request);
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("Describe a small Windows program.");
		expect(html).toContain("TCC (Tiny C Compiler)");
		expect(html).toContain("https://bellard.org/tcc/");
		expect(html).toContain("/windows-vista-wait.gif");
	});
});
