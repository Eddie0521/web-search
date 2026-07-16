import type { SearchOptions, SearchResponse } from "./types.ts";
import { resolveKeys } from "./config.ts";
import { isPaperQuery, searchArxiv } from "./arxiv.ts";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const EXA_MCP_URL = "https://mcp.exa.ai/mcp";
const ANYSEARCH_URL = "https://api.anysearch.com/v1/search";
const TAVILY_URL = "https://api.tavily.com/search";

interface ExaResult { title?: string; url?: string; text?: string }

async function searchExa(query: string, key: string | null, options: SearchOptions): Promise<SearchResponse | null> {
  try {
    if (key) {
      const res = await fetch(EXA_SEARCH_URL, {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ query, numResults: options.numResults ?? 5 }),
        signal: options.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { results?: ExaResult[] };
      if (!data.results?.length) return null;
      const results = data.results.filter((r) => r.url).map((r) => ({
        title: r.title ?? "",
        url: r.url!,
        snippet: (r.text ?? "").slice(0, 500),
      }));
      return results.length ? { results, provider: "exa" } : null;
    }
    const res = await fetch(EXA_MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "web_search_exa", arguments: { query, numResults: options.numResults ?? 5 } },
      }),
      signal: options.signal,
    });
    if (!res.ok) return null;
    const body = await res.text();
    const lines = body.split("\n").filter((l) => l.startsWith("data:"));
    const last = lines.at(-1)?.slice(5).trim();
    if (!last) return null;
    let mcpResult: { result?: { content?: Array<{ text?: string }> } };
    try { mcpResult = JSON.parse(last); } catch { return null; }
    const text = mcpResult.result?.content?.find((c) => c.text)?.text;
    if (!text) return null;
    const results = parseExaMcpBlock(text);
    return results.length > 0 ? { results, provider: "exa" } : null;
  } catch {
    return null;
  }
}

function parseExaMcpBlock(text: string) {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const blocks = text.split(/(?=^Title: )/m).filter((b) => b.trim());
  for (const block of blocks) {
    const title = block.match(/^Title: (.+)/m)?.[1]?.trim() ?? "";
    const url = block.match(/^URL: (.+)/m)?.[1]?.trim() ?? "";
    const contentMatch = block.match(/(?:Text: |Highlights:\s*\n)([\s\S]*)/);
    const snippet = contentMatch?.[1]?.replace(/\n---\s*$/, "").trim() ?? "";
    if (url) results.push({ title, url, snippet: snippet.slice(0, 500) });
  }
  return results;
}

interface AnySearchResponse {
  code: number;
  data?: { results?: Array<{ title?: string; url?: string; snippet?: string; content?: string }> };
}

async function searchAnySearch(query: string, key: string | null, options: SearchOptions): Promise<SearchResponse | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(ANYSEARCH_URL, {
      method: "POST", headers,
      body: JSON.stringify({ query, max_results: options.numResults ?? 10 }),
      signal: options.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AnySearchResponse;
    if (data.code !== 0 || !data.data?.results?.length) return null;
    const results = data.data.results.filter((r) => r.url).map((r) => ({
      title: r.title ?? "",
      url: r.url!,
      snippet: (r.snippet ?? r.content ?? "").slice(0, 500),
    }));
    return { results, provider: "anysearch" };
  } catch {
    return null;
  }
}

interface TavilyResponse { answer?: string; results?: Array<{ title?: string; url?: string; content?: string }> }

async function searchTavily(query: string, key: string, options: SearchOptions): Promise<SearchResponse | null> {
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: options.numResults ?? 5,
        include_answer: "basic",
        ...(options.recencyFilter ? { time_range: options.recencyFilter } : {}),
      }),
      signal: options.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TavilyResponse;
    if (!data.results?.length) return null;
    const results = data.results.filter((r) => r.url).map((r) => ({
      title: r.title ?? "",
      url: r.url!,
      snippet: (r.content ?? "").slice(0, 500),
    }));
    return { results, answer: data.answer, provider: "tavily" };
  } catch {
    return null;
  }
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  if (isPaperQuery(query)) {
    const arxiv = await searchArxiv(query, options);
    if (arxiv) return arxiv;
  }

  const keys = resolveKeys();
  const exaResult = await searchExa(query, keys.exa, options);
  if (exaResult) return exaResult;

  const anyResult = await searchAnySearch(query, keys.anySearch, options);
  if (anyResult) return anyResult;

  if (keys.tavily) {
    const tavilyResult = await searchTavily(query, keys.tavily, options);
    if (tavilyResult) return tavilyResult;
  }

  throw new Error("所有搜索 provider 均不可用。请检查网络或配置 API key（Exa MCP 应始终可用）");
}

export function getAvailableProviders(): string[] {
  const keys = resolveKeys();
  const available = ["arxiv", "exa", "anysearch"];
  if (keys.tavily) available.push("tavily");
  return available;
}
