#!/usr/bin/env bun
/**
 * CLI: bun fetch.ts <URL|本地PDF> [输出.md]
 * 抓取级联：arXiv → 官方HTML/ar5iv/PDF 择优；GitHub/PDF/HTML 通用路由
 */

import { fetchContent } from "./lib/fetch.ts";

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const [input, outPath] = Bun.argv.slice(2);
if (!input) die("用法: bun fetch.ts <URL|本地PDF路径> [输出.md]");

const result = await fetchContent(input);
const md = (result.title ? `# ${result.title}\n\n` : "") + result.content + "\n";

if (result.content.length < 1000) {
  console.error(`⚠ 内容异常短(${result.content.length} 字符)，可能未抓到全文`);
}

if (outPath) {
  await Bun.write(outPath, md);
  console.error(`✓ 已写入 ${outPath}（${result.content.length} 字符）`);
} else {
  console.log(md);
}
