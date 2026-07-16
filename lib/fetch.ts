import { extractText } from "unpdf@1.6.2";
import type { FetchResult } from "./types.ts";
import { checkSSRF } from "./ssrf.ts";
import { extractContent } from "./extract.ts";
import { fetchPaper, isArxivUrl } from "./paper-fetch.ts";

async function fetchGithub(url: string): Promise<FetchResult | null> {
  await checkSSRF(url);
  const match = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\/blob\/([^/]+)\/(.*))?$/);
  if (!match) return null;
  const repo = match[1];
  const branch = match[2];
  const path = match[3];
  const apiUrl = path
    ? `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`
    : `https://api.github.com/repos/${repo}/contents`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "web-search" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) && data.type === "file" && data.download_url) {
      const content = await fetch(data.download_url, { signal: AbortSignal.timeout(10000) }).then((r) => r.text());
      return { url, title: data.name, content };
    }
    if (Array.isArray(data)) {
      const items = data.map((item: { name: string; type: string; path: string }) =>
        `${item.type === "dir" ? "📁" : "📄"} ${item.name} (${item.path})`
      ).join("\n");
      return { url, title: `GitHub: ${repo}`, content: `## ${repo}\n\n${items}` };
    }
  } catch { return null; }
  return null;
}

async function fetchPdf(url: string): Promise<FetchResult | null> {
  await checkSSRF(url);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("pdf")) return null;
    const buffer = new Uint8Array(await res.arrayBuffer());
    const { text } = await extractText(buffer);
    const content = text.join("\n\n").trim();
    return { url, title: "", content: content || "（PDF 无文本内容）" };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<FetchResult> {
  await checkSSRF(url);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; web-search/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  if (contentType.includes("json") || contentType.includes("text/plain")) {
    return { url, content: body };
  }
  const extracted = await extractContent(url, body);
  return { url, title: extracted.title, content: extracted.content };
}

export async function fetchContent(url: string): Promise<FetchResult> {
  if (isArxivUrl(url) || url.toLowerCase().endsWith(".pdf")) {
    try {
      return await fetchPaper(url);
    } catch {
      if (isArxivUrl(url)) throw new Error(`arXiv 抓取失败: ${url}`);
    }
  }
  await checkSSRF(url);
  const gh = await fetchGithub(url);
  if (gh) return gh;
  const pdf = await fetchPdf(url);
  if (pdf) return pdf;
  return fetchHtml(url);
}
