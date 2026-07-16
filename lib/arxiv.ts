import type { SearchOptions, SearchResponse } from "./types.ts";

const ARXIV_API = "https://export.arxiv.org/api/query";

/** 判断查询是否在找论文 */
export function isPaperQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/\barxiv\b|\bpaper\b|论文|预印本|preprint|publication/i.test(q)) return true;
  if (/\d{4}\.\d{4,5}(v\d+)?/.test(q)) return true;
  if (/\b(cat:|ti:|au:)/i.test(q)) return true;
  return false;
}

function buildArxivQuery(query: string): string {
  if (/\b(cat:|ti:|au:|abs:|id:)/i.test(query)) return query;
  const id = query.match(/(\d{4}\.\d{4,5}(?:v\d+)?)/)?.[1];
  if (id) return `id:${id}`;
  return `all:${query.split(/\s+/).join("+AND+all:")}"`;
}

function parseArxivXml(xml: string): SearchResponse["results"] {
  const results: SearchResponse["results"] = [];
  const entries = xml.split("<entry>").slice(1);
  for (const entry of entries) {
    const id = entry.match(/<id>([^<]+)<\/id>/)?.[1]?.trim() ?? "";
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]?.trim() ?? "";
    const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]).join(", ");
    const arxivId = id.match(/arxiv\.org\/abs\/([^/?#]+)/)?.[1] ?? id;
    const url = arxivId ? `https://arxiv.org/abs/${arxivId}` : id;
    if (!url) continue;
    const snippet = [authors && `Authors: ${authors}`, published && `Published: ${published}`, summary.slice(0, 400)]
      .filter(Boolean)
      .join(" | ");
    results.push({ title, url, snippet });
  }
  return results;
}

export async function searchArxiv(query: string, options: SearchOptions = {}): Promise<SearchResponse | null> {
  try {
    const max = Math.min(options.numResults ?? 5, 30);
    const searchQuery = buildArxivQuery(query);
    const url = `${ARXIV_API}?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${max}&sortBy=relevance&sortOrder=descending`;
    const res = await fetch(url, { signal: options.signal ?? AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const xml = await res.text();
    const results = parseArxivXml(xml);
    return results.length > 0 ? { results, provider: "arxiv" } : null;
  } catch {
    return null;
  }
}
