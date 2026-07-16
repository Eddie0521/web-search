#!/usr/bin/env bun
/**
 * CLI: bun search.ts "<query>" [--num N]
 * 搜索级联：论文查询 → arXiv API；否则 Exa → AnySearch → Tavily
 */

import { search } from "./lib/search.ts";

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const args = Bun.argv.slice(2);
let numResults: number | undefined;
const positional: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--num" && args[i + 1]) {
    numResults = Number(args[++i]);
  } else {
    positional.push(args[i]);
  }
}

const query = positional.join(" ").trim();
if (!query) die('用法: bun search.ts "<query>" [--num N]');

const result = await search(query, { numResults });

if (result.answer) {
  console.log(result.answer);
  console.log("\n---\n");
}

for (let i = 0; i < result.results.length; i++) {
  const r = result.results[i];
  console.log(`${i + 1}. ${r.title}`);
  console.log(`   ${r.url}`);
  if (r.snippet) console.log(`   ${r.snippet}`);
  console.log();
}

console.error(`provider: ${result.provider} | results: ${result.results.length}`);
