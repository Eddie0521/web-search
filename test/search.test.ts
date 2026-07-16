import { test, expect, mock } from "bun:test";

mock.module("../lib/config.ts", () => ({
  resolveKeys: () => ({ exa: null, anySearch: null, tavily: null }),
}));

const { search } = await import("../lib/search.ts");
const { isPaperQuery } = await import("../lib/arxiv.ts");

const originalFetch = globalThis.fetch;

test("isPaperQuery detects paper intent", () => {
  expect(isPaperQuery("arxiv multi-agent world model")).toBe(true);
  expect(isPaperQuery("2604.18564")).toBe(true);
  expect(isPaperQuery("weather in Tokyo")).toBe(false);
});

test("search returns results from Exa MCP (zero config)", async () => {
  globalThis.fetch = mock(async (url: string) => {
    if (url === "https://mcp.exa.ai/mcp") {
      return new Response("data: " + JSON.stringify({
        result: {
          content: [{ text: "Title: Test Result\nURL: https://example.com\nText: snippet" }],
        },
      }) + "\n");
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  const result = await search("weather today", { numResults: 3 });
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.provider).toBe("exa");
  globalThis.fetch = originalFetch;
});

test("search throws when all providers fail", async () => {
  globalThis.fetch = mock(async () => new Response(null, { status: 500 })) as typeof fetch;
  await expect(search("test")).rejects.toThrow("所有搜索 provider 均不可用");
  globalThis.fetch = originalFetch;
});
