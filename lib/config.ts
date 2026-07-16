import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { WebSearchConfig } from "./types.ts";

const CONFIG_PATH = join(homedir(), ".claude", "web-search", "config.json");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

function loadRaw(): WebSearchConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as WebSearchConfig;
  } catch {
    return {};
  }
}

export function saveConfig(updates: Partial<WebSearchConfig>): void {
  const merged = { ...loadRaw(), ...updates };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  try { chmodSync(CONFIG_PATH, 0o600); } catch { /* best effort */ }
}

export interface ResolvedKeys {
  exa: string | null;
  anySearch: string | null;
  tavily: string | null;
}

export function resolveKeys(): ResolvedKeys {
  const cfg = loadRaw();
  return {
    exa: process.env.EXA_API_KEY?.trim() || cfg.exaApiKey?.trim() || null,
    anySearch: process.env.ANYSEARCH_API_KEY?.trim() || cfg.anySearchApiKey?.trim() || null,
    tavily: process.env.TAVILY_API_KEY?.trim() || cfg.tavilyApiKey?.trim() || null,
  };
}
