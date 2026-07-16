import { extractText } from "unpdf@1.6.2";
import { parseHTML } from "linkedom@0.16.11";
import { Readability } from "@mozilla/readability@0.6.0";
import TurndownService from "turndown@7.2.4";
import { checkSSRF } from "./ssrf.ts";
import type { FetchResult } from "./types.ts";

type Result = { title: string; content: string; source?: string };

const turndown = new TurndownService({ headingStyle: "atx" });

async function pdfToText(buf: Uint8Array): Promise<string> {
  const { text } = await extractText(buf);
  return (Array.isArray(text) ? text.join("\n\n") : String(text)).trim();
}

function looksLikePdf(buf: Uint8Array, contentType: string): boolean {
  return contentType.includes("pdf") || (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46);
}

function readabilityExtract(html: string): Result | null {
  const { document } = parseHTML(html);
  for (const sel of ["script", "style", "nav", "footer", "header", "aside", ".sidebar", ".ad", ".cookie-banner"]) {
    for (const el of document.querySelectorAll(sel)) el.remove();
  }
  const article = new Readability(document).parse();
  if (!article) return null;
  const articleHtml = article.content?.trim() ?? "";
  const text = article.textContent?.trim() ?? "";
  const content = articleHtml ? turndown.turndown(articleHtml) : text;
  if (content.length < 50) return null;
  return { title: article.title?.trim() ?? "", content };
}

async function proxyFetch(url: string, template: string): Promise<string | null> {
  try {
    const res = await fetch(template.replace("{url}", encodeURIComponent(url)), {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.length < 100 ? null : text;
  } catch {
    return null;
  }
}

async function fetchOne(url: string, useProxy: boolean): Promise<Result> {
  await checkSSRF(url);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; web-search/1.0)",
        Accept: "text/html,application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      const buf = new Uint8Array(await res.arrayBuffer());
      if (looksLikePdf(buf, contentType)) {
        const content = await pdfToText(buf);
        if (content) return { title: "", content, source: url };
      } else {
        const body = new TextDecoder().decode(buf);
        if (contentType.includes("json") || contentType.includes("text/plain")) {
          return { title: "", content: body.trim(), source: url };
        }
        const local = readabilityExtract(body);
        if (local) return { ...local, source: url };
      }
    }
  } catch { /* proxy fallback */ }

  if (useProxy) {
    const jina = await proxyFetch(url, "https://r.jina.ai/{url}");
    if (jina) {
      const title = jina.match(/^Title: (.+)$/m)?.[1]?.trim() ?? "";
      const body = jina.replace(/^Title: .+\nURL Source: .+\n\n/m, "").trim();
      return { title, content: body, source: url };
    }
    const defuddle = await proxyFetch(url, "https://defuddle.md/{url}");
    if (defuddle) return { title: "", content: defuddle, source: url };
  }
  throw new Error(`无法获取内容: ${url}`);
}

export function isArxivUrl(url: string): boolean {
  return /arxiv\.org\/(?:abs|pdf|html)\//i.test(url);
}

export async function fetchPaper(input: string): Promise<FetchResult & { source?: string }> {
  if (!/^https?:\/\//i.test(input)) {
    const file = Bun.file(input);
    if (!(await file.exists())) throw new Error(`文件不存在: ${input}`);
    if (!input.toLowerCase().endsWith(".pdf")) throw new Error("本地文件仅支持 .pdf");
    const content = await pdfToText(new Uint8Array(await file.arrayBuffer()));
    if (!content) throw new Error("PDF 无可提取文本");
    return { url: input, content };
  }

  const arxivId = input
    .match(/arxiv\.org\/(?:abs|pdf|html)\/([^\s?#]+?)(?:\.pdf)?(?:[?#].*)?$/i)?.[1]
    ?.replace(/\/+$/, "");
  const candidates = arxivId
    ? [
        `https://arxiv.org/html/${arxivId}`,
        `https://ar5iv.labs.arxiv.org/html/${arxivId}`,
        `https://arxiv.org/pdf/${arxivId}`,
      ]
    : [input];

  let lastErr: unknown;
  for (const url of candidates) {
    const isArxivHtml = Boolean(arxivId) && url.includes("/html/");
    try {
      const r = await fetchOne(url, !isArxivHtml);
      if (isArxivHtml && r.content.length < 5000) {
        lastErr = new Error(`${url} 内容过短(${r.content.length} 字符)`);
        continue;
      }
      if (!r.content) {
        lastErr = new Error(`${url} 内容为空`);
        continue;
      }
      return { url: input, title: r.title, content: r.content, source: r.source };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`抓取失败: ${(lastErr as Error)?.message ?? "未知错误"}`);
}
