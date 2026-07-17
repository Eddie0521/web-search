# Web-Search

<p align="right">
  <a href="./README.md">中文</a> | <a href="./README_EN.md">English</a>
</p>

<div align="center">
  <h1>🔍 Web Search</h1>
  <p><b>搜索 + 抓取，给 AI agent 用，免 key 开箱即用</b></p>
  <p>
    <a href="https://github.com/Eddie0521/web-search/stargazers"><img src="https://img.shields.io/github/stars/Eddie0521/web-search?style=flat-square" alt="Stars"></a>
    <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun" alt="Bun">
    <img src="https://img.shields.io/badge/lang-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/config-zero--key-2ea043?style=flat-square" alt="Zero-config">
  </p>
</div>

<br/>

<div align="center">
  <img src="./assets/web-search-flow.svg" width="960" alt="Web Search 架构图" />
</div>

## 能力

| 能力 | 何时用 | 做什么 |
| :--- | :--- | :--- |
| **搜索** | Agent 需要查找网页来源或实时信息 | 级联调用 Exa → AnySearch → Tavily，第一个成功的引擎直接返回结果 |
| **抓取** | Agent 已有一个网页、仓库、PDF 或 arXiv 链接 | 按内容类型路由，通过多重降级返回干净的 Markdown 全文 |

所有出站请求经过 SSRF 防护（协议白名单、localhost 拦截、DNS 内网地址拒绝）。

## 安装

```bash
npx skills add Eddie0521/web-search -a claude-code codex cursor -g -y
```

技能安装到共享目录 `~/.agents/skills/web-search`，Claude Code、Codex、Cursor 等 agent 自动识别，其他 skill 也可通过路径调用。更新用 `npx skills update -g -y`。

### 前置依赖：bun

```bash
curl -fsSL https://bun.sh/install | bash      # 通用
brew install oven-sh/bun/bun                    # macOS
```

依赖通过 bun 版本钉死 import 自动安装，无需 `npm install`。

## 用法

### Agent 调用

直接在对话中触发，skill 会自动识别意图：

- "搜一下 multi-agent world model 的最新论文" → 调用搜索
- "帮我抓取 https://arxiv.org/abs/2506.18537 的全文" → 调用抓取
- "看看这个 GitHub 仓库的目录结构 https://github.com/torvalds/linux" → 调用抓取

### CLI

```bash
# 搜索（结果打印到 stdout，provider 信息到 stderr）
bun ~/.agents/skills/web-search/search.ts "multi-agent world model"
bun ~/.agents/skills/web-search/search.ts "latest LLM news" --num 5

# 抓取（省略输出路径则正文打印到 stdout）
bun ~/.agents/skills/web-search/fetch.ts https://arxiv.org/abs/2506.18537 paper.md
bun ~/.agents/skills/web-search/fetch.ts https://github.com/torvalds/linux
```

### 链式工作流

| 场景 | 流程 |
|------|------|
| **调研** | 搜索关键词 → 挑选来源链接 → 抓取全文 → 传给写作或学习 skill |
| **读论文** | 抓取 arXiv 链接 → 全文降级链 → 传给 [paper-reader](https://github.com/Eddie0521/paper-reader) |
| **看仓库** | 抓取仓库根目录 → 定位相关文件 → 抓取单文件 → 分析 |

链式调用是显式的：每个下游 skill 或 agent 自行决定如何处理返回的内容。

## 原理

### 搜索级联

普通搜索按固定顺序依次尝试三个引擎，**任何一个成功就立即返回，不再继续往下**：

1. **Exa** — 有 API key 时走官方接口；没有 key 时走零配置的匿名 MCP 端点，开箱即用。
2. **AnySearch** — 有 key 加鉴权，无 key 匿名请求。
3. **Tavily** — 需要配置 key 才启用，额外支持返回 AI 摘要和时间范围筛选。

所有引擎都失败时给出明确错误。API key 的来源优先级：环境变量 > 配置文件。

| 引擎 | 免费额度 | 说明 |
|------|----------|------|
| Exa | 1,000 次请求/月 | 免 key 可用匿名 MCP 端点；有 key 走官方 API，共享同一免费额度 |
| AnySearch | 1,000 次请求/天 | 注册后获得；匿名访问可用但额度更低 |
| Tavily | 1,000 credits/月 | 需注册 key；基础搜索 1 credit/次，高级搜索 2 credits/次 |

### 抓取路由

根据输入类型走不同的抓取路径，每条路径内部都有多重降级：

- **arXiv 论文**：依次尝试官方 HTML 版 → ar5iv 镜像 → PDF 提取，取第一个可用的全文。本地 PDF 文件也能直接解析。
- **GitHub 仓库**：通过 GitHub API 列出目录树或获取单文件内容。
- **通用 PDF**：直接下载后用 unpdf 提取文本。
- **普通网页**：先在本地用 Readability 提取正文并转为 Markdown；提取失败时依次通过 Jina Reader、Defuddle 两个在线代理兜底。

每条路径中前一步失败会自动跳到下一步，尽量保证拿到可用内容。

### SSRF 防护

所有出站请求前会检查目标地址，拒绝访问本机和内网地址。检查覆盖协议白名单（仅 http/https）、字面量拦截（localhost 等）以及 DNS 解析后的真实 IP——即使域名看起来正常，但实际解析到内网地址也会被拦截。

## 配置

API key 可选，不配置也能用（Exa MCP 匿名模式 + AnySearch 匿名模式开箱即用）。

| 环境变量 | 启用 | 说明 |
|----------|------|------|
| `EXA_API_KEY` | Exa 官方 API | 不设则走零配置匿名 MCP |
| `ANYSEARCH_API_KEY` | AnySearch 鉴权 | 不设则匿名访问（额度更低） |
| `TAVILY_API_KEY` | Tavily | 不设则跳过该引擎 |

```bash
export EXA_API_KEY=...
export ANYSEARCH_API_KEY=...
export TAVILY_API_KEY=...
```

或写入 `~/.claude/web-search/config.json`。环境变量优先于配置文件。

## 为什么

传统搜索引擎 API 返回的是给人看的结果页——广告位、知识面板、购物卡片，对 agent 来说是噪声。第三方搜索 API 是为 AI agent 设计的：返回干净、有排名、可直接消费的文本片段，拿来就能填进模型的上下文。

搜索和抓取放在一起，是因为发现一个 URL 只是任务的一半——agent 还需要拿到那个 URL 的全文内容。搜索找到来源，抓取取回正文，两步合一。

多个引擎和多个抓取路径都会失败，所以每一层都有显式降级。这让依赖本 skill 的下游工作流更可靠。

## 卸载

```bash
npx skills remove Eddie0521/web-search -g
```

如果通过 `sync.sh` 手动安装，需删除 `~/.claude/skills/web-search` 和 `~/.agents/skills/web-search`。

## 支持

- 觉得有用就给个 ⭐ Star
- [分享到 Twitter](https://twitter.com/intent/tweet?url=https://github.com/Eddie0521/web-search&text=Web%20Search%20-%20AI%20agent%20web%20search%20%26%20fetch%20skill)
- 发现引擎失效或内容类型不支持，欢迎开 [Issue](https://github.com/Eddie0521/web-search/issues)
- 欢迎提 PR 修复或改进