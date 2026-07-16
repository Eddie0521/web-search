import { parseHTML } from "linkedom@0.16.11";
import { Readability } from "@mozilla/readability@0.6.0";
import TurndownService from "turndown@7.2.4";
import { checkSSRF } from "./ssrf.ts";

const turndown = new TurndownService({ headingStyle: "atx" });

export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
}

function extractWithReadability(html: string, url: string): ExtractedContent | null {
  const { document } = parseHTML(html);
  for (const sel of ["script", "style", "nav", "footer", "header", "aside", ".sidebar", ".ad", ".cookie-banner"]) {
    for (const el of document.querySelectorAll(sel)) el.remove();
  }
  const article = new Readability(document).parse();
  if (!article) return null;
  const articleHtml = article.content?.trim() || "";
  const text = article.textContent?.trim() || "";
  const content = articleHtml || text;
  if (content.length < 50) return null;
  return {
    url,
    title: article.title?.trim() || "",
    content: articleHtml ? turndown.turndown(articleHtml) : text,
  };
}

async function fetchViaProxy(url: string, proxyUrl: string): Promise<string | null> {
  try {
    const res = await fetch(proxyUrl.replace("{url}", encodeURIComponent(url)), {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length < 100 ? null : text;
  } catch {
    return null;
  }
}

export async function extractContent(url: string, html?: string): Promise<ExtractedContent> {
  await checkSSRF(url);
  if (html) {
    const local = extractWithReadability(html, url);
    if (local) return local;
  }
  const jina = await fetchViaProxy(url, "https://r.jina.ai/{url}");
  if (jina) {
    const title = jina.match(/^Title: (.+)/m)?.[1]?.trim() ?? "";
    const body = jina.replace(/^Title: .+\nURL Source: .+\n\n/m, "").trim();
    return { url, title, content: body };
  }
  const defuddle = await fetchViaProxy(url, "https://defuddle.md/{url}");
  if (defuddle) return { url, title: "", content: defuddle };
  throw new Error(`无法获取内容: ${url}`);
}
