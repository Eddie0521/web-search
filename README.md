# Web-Search

> Claude Code skill — 搜索互联网 + 抓取 URL 内容。搜（Exa/AnySearch/Tavily + arXiv）与抓（网页/PDF/GitHub/论文级联）全套。

供 [paper-reader](https://github.com/Eddie0521/paper-reader) 等 skill 软依赖调用；安装后 paper-reader 自动检测 `~/.claude/skills/web-search/` 并优先使用本 skill 的脚本。

## 特性

- **搜索级联** — Exa（零配置）→ AnySearch → Tavily
- **arXiv provider** — 论文类查询自动走 arXiv API（免 key）
- **抓取级联** — arXiv 官方 HTML → ar5iv → PDF；网页 Readability + 代理兜底
- **SSRF 防护** — 拒绝内网地址
- **model-invoked** — 可被其他 skill 通过路径调用

## 安装

```bash
npx skills add Eddie0521/web-search
```

### 需要 bun

```bash
curl -fsSL https://bun.sh/install | bash
```

macOS：`brew install oven-sh/bun/bun`

### 本地开发

```bash
git clone <本仓库 URL>
cd web-search
./sync.sh
```

## CLI

```bash
bun search.ts "multi-agent world model papers"
bun search.ts "2604.18564" --num 3
bun fetch.ts https://arxiv.org/abs/2604.18564 paper.md
bun fetch.ts https://github.com/Eddie0521/paper-reader
```

## API Keys（可选）

```bash
export EXA_API_KEY=...
export ANYSEARCH_API_KEY=...
export TAVILY_API_KEY=...
```

或写入 `~/.claude/web-search/config.json`。

## 仓库结构

| 文件 | 说明 |
|------|------|
| `SKILL.md` | skill 入口（model-invoked） |
| `search.ts` / `fetch.ts` | CLI 入口 |
| `lib/` | 搜索、抓取、arXiv、SSRF 实现 |
| `sync.sh` | 分发到 skills 安装位 |
