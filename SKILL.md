---
name: web-search
description: 搜索互联网与抓取 URL 内容。搜索级联 Exa→AnySearch→Tavily，论文查询走 arXiv API；抓取支持网页/PDF/GitHub/arXiv 全文级联。供其他 skill 或 agent 通过 CLI 调用。
---

# Web-Search

搜 + 抓全套。供 paper-reader 等 skill 软依赖调用，也可被 model 直接触发。

## CLI

```bash
bun <本skill目录>/search.ts "<query>" [--num N]
bun <本skill目录>/fetch.ts <URL|本地PDF> [输出.md]
```

省略 fetch 输出路径则正文打印到 stdout；元信息走 stderr。

## 搜索

**论文查询**（含 arxiv、paper、论文、预印本或 arXiv ID）→ **arXiv API**（免 key，结构化题目/作者/摘要/日期）

否则级联：**Exa**（零配置 MCP 或 API key）→ **AnySearch**（匿名或 key）→ **Tavily**（需 key）

## 抓取

路由顺序：
- **arXiv / 本地 PDF** → 官方 HTML → ar5iv → PDF 择优（吸收 paper-reader 论文级联）
- **GitHub** → API 列目录或取文件
- **PDF** → unpdf 提取
- **HTML** → Readability → r.jina.ai → defuddle.md 代理兜底

所有出站请求过 **SSRF 防护**（拒绝内网地址）。

## API Keys

环境变量优先，其次 `~/.claude/web-search/config.json`：

| 变量 | Provider |
|------|----------|
| `EXA_API_KEY` | Exa Direct API |
| `ANYSEARCH_API_KEY` | AnySearch |
| `TAVILY_API_KEY` | Tavily |

Exa MCP 与 AnySearch 匿名模式无需 key 即可开箱使用。

## 依赖

需要 [bun](https://bun.sh)。依赖通过 bun 版本钉死 import 自动安装，无需 `npm install`。
