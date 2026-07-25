# Gods.dev 个人网站设计文档

- **日期**: 2026-07-25
- **状态**: 已确认（v1 范围）
- **域名**: https://gods.dev/
- **部署**: GitHub Pages（仓库 `Evil0ctal/Gods.dev`）
- **语言**: 网站内容全英文

## 1. 目标与范围

### 目标

一个极客/黑客风格的个人网站：Linux 终端风格的交互式首页、Markdown 博客、藏在各个角落的彩蛋，SEO 友好，纯静态部署在 GitHub Pages。

### v1 范围（本期交付）

- 终端风格交互式首页（键盘命令 + 鼠标点击 + 移动端适配）
- Markdown 博客系统（本地写 .md + git push 发布）
- About / Projects 独立页面
- 主题系统（4 个主题，`theme` 命令切换）
- 彩蛋系统 + 第一个 CTF 风格 flag（含验证器）
- 完整 SEO 基建（sitemap、RSS、OG、JSON-LD、robots.txt）
- GitHub Actions 自动部署 + 自定义域名 gods.dev

### 非目标（v2 及以后）

- 完整 CTF 小游戏（v1 只预留架构扩展点和一个入门 flag）
- 构建期自动生成每篇文章的 OG 图（v1.5）
- 评论系统、站内搜索、多语言、后端服务（永不：保持纯静态）

## 2. 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | Astro 5 + TypeScript | 静态生成、零 JS 默认输出、content collections 原生支持 Markdown 博客、SEO 最优 |
| UI 运行时 | 无（原生 TS 岛屿） | 终端组件用 vanilla TS，不引入 React 等框架运行时 |
| 样式 | 纯 CSS + 自定义属性 | 主题系统靠 CSS variables + `data-theme` 切换 |
| 代码高亮 | Shiki（Astro 内置） | 构建期高亮，零运行时成本 |
| 单元测试 | Vitest | 终端核心纯逻辑，TDD，覆盖率 80%+ |
| E2E 测试 | Playwright | 关键用户路径 |
| 部署 | GitHub Actions（`withastro/action`）→ GitHub Pages | 官方流程，push main 即发布 |

## 3. 站点结构

| 路由 | 内容 | 渲染 |
|---|---|---|
| `/` | 终端首页 | 静态 MOTD 预渲染 + JS 增强为交互终端 |
| `/blog/` | 文章列表（`ls -la` 视觉、按年分组） | 纯静态 |
| `/blog/<slug>/` | 文章页（终端窗口外框 + 舒适排版） | 纯静态 |
| `/about/` | 关于页（终端 `about` 命令同源内容） | 纯静态 |
| `/projects/` | 项目展示（GitHub 仓库精选；数据为仓库内静态维护的 TS/JSON 文件，不做运行时/构建时 API 拉取，避免限流与不确定性） | 纯静态 |
| `/admin/` | robots.txt 假 Disallow 指向的嘲讽彩蛋页 | 纯静态 |
| `/404` | 假内核 panic dump 彩蛋页（含线索） | 纯静态 |
| `/rss.xml` | RSS（@astrojs/rss） | 构建生成 |
| `/sitemap-index.xml` | sitemap（@astrojs/sitemap，排除彩蛋页） | 构建生成 |
| `/robots.txt` | 手写，含注释彩蛋 | 静态 |
| `/play/<game>` | **v2 预留**：每个游戏一个页面 + 独立岛屿 | — |

### 首页渐进增强（SEO 关键决策）

首页静态 HTML 中预渲染真实内容：h1、个人简介、指向 blog/about/projects 的真实 `<a>` 链接，视觉呈现为终端开机后的 MOTD。JS 加载后增强为可交互终端。爬虫与禁用 JS 的用户看到完整内容与导航；正常用户看到活终端。**禁止**首页核心内容依赖 JS 注入。

### 仓库结构

```
src/
  components/
    terminal/        # 终端核心（parser、registry、vfs、命令模块）
  content/
    blog/            # 文章 .md
  layouts/
  pages/
  styles/            # 全局样式 + themes
public/
  CNAME              # gods.dev
  robots.txt
.github/workflows/deploy.yml
docs/superpowers/specs/
```

## 4. 终端组件设计

### 交互模型

- **键盘**: 真实命令输入；Tab 补全、↑/↓ 历史、Ctrl+L 清屏
- **鼠标**: 输出中的命令名可点击直接执行（如 `help` 列表项）
- **移动端**: 命令建议 chips + 点击输入区唤起原生键盘

### 启动序列

假内核 boot 日志滚动约 1.5s，任意键/点击可跳过；`prefers-reduced-motion` 时直接跳过。结束后显示 MOTD 与提示符 `guest@gods.dev:~$`。

### 命令注册表（v2 游戏扩展点）

每个命令一个独立模块：

```ts
interface Command {
  name: string
  description: string   // help 中展示
  usage?: string
  hidden?: boolean      // 彩蛋命令不出现在 help
  handler(args: string[], ctx: TerminalContext): CommandResult | Promise<CommandResult>
}
```

中央 registry 注册；`help` 自动列出非隐藏命令。v2 的 CTF 游戏通过 `play <game>` 命令接入，核心零改动。

### v1 命令集

- **公开**: `help`、`about`、`whoami`、`blog`（列出文章/`blog read <slug>` 跳转）、`projects`、`contact`/`social`、`theme <name>`、`neofetch`（ASCII art + 信息卡）、`clear`、`history`、`echo`、`date`
- **虚拟文件系统**: `ls`、`cd`、`cat`，操作 JSON 目录树（`~/blog/`、`~/projects/`、`~/.secrets/`）
- **隐藏彩蛋**: `sudo`（拒绝嘲讽）、`rm -rf /`（假崩溃后恢复）、`vim`（出不来的老梗）、`matrix`、`hack`、`exit`、`flag`（flag 验证）

### 可访问性

- 输出区 `aria-live="polite"`
- skip link 跳过终端直达普通导航
- 全键盘可操作；焦点管理

### 性能预算

- 终端岛屿 JS < 30KB gzip；其余页面零 JS
- 系统等宽字体栈优先，可选 web font 用 `font-display: swap`

## 5. 博客设计

### 内容模型

`src/content/blog/*.md`，frontmatter 用 zod schema 校验：

```yaml
title: string
description: string      # meta description / 列表摘要
pubDate: date
updatedDate: date?       # 可选
tags: string[]
draft: boolean           # true 时本地可见、构建排除
ogImage: string?         # 可选，覆盖默认 OG 图
```

### 阅读体验

- 文章页：终端窗口外框（macOS 风格窗口按钮 + `~/blog/<slug>.md` 标题栏），正文高可读排版（**不是**绿字黑底硬读）
- 代码块 Shiki 高亮 + 一键复制按钮
- 列表页：按年份分组，视觉致敬 `ls -la`（日期、装饰性"权限位"、文件名即标题），语义化 HTML 列表

## 6. SEO（v1 全部落地）

- 每页独立 `<title>`、`meta description`、canonical URL
- OpenGraph + Twitter Card；v1 一张品牌默认 OG 图，文章可 frontmatter 覆盖
- JSON-LD：首页 `Person`（sameAs 关联 https://github.com/Evil0ctal/ ）、文章页 `BlogPosting`
- `@astrojs/sitemap`（排除 `/admin/` 等彩蛋页）、`@astrojs/rss`、手写 `robots.txt`
- 语义化 HTML、全站静态预渲染
- **验收标准**: Lighthouse SEO 100 分

## 7. 主题系统

CSS 自定义属性 + `<html data-theme="...">` 切换，localStorage 持久化，`theme` 命令与点击切换均可。

| 主题 | 描述 |
|---|---|
| `default` | Tokyo Night 系现代深色终端（默认） |
| `crt` | 绿色磷光 + 扫描线叠加 + 辉光（`prefers-reduced-motion` 时关闭扫描线动画） |
| `amber` | 琥珀单色老终端 |
| `light` | 彩蛋式"刺眼模式"，切换时终端吐槽 |

## 8. 彩蛋与 flag 系统

### v1 彩蛋清单

1. HTML 源码注释：ASCII art banner + 给同类的留言 + flag 线索（第 1 环）
2. 控制台 styled `console.log` 横幅 + 线索（第 2 环）
3. Konami 码 → 全屏 Matrix 数字雨
4. 隐藏命令（见 4. 命令集）
5. 虚拟文件系统 `~/.secrets/` 藏编码谜题（第 3 环）：简单可解的编码组合（如 base64/ROT13/XOR），纯前端可解，谜面文件内附隐晦提示
6. `robots.txt` 注释彩蛋 + 假 `Disallow: /admin`，`/admin/` 是嘲讽页
7. 404 页假内核 panic dump，含线索
8. **第一个 flag**：格式 `gods{...}`，线索链 源码注释 → console → `~/.secrets/` 解谜 → 得 flag

### flag 验证器（v2 CTF 系统雏形）

- 终端命令 `flag submit <flag>`，客户端 SHA-256 验证
- 源码中只存哈希，明文不可搜索
- flag 注册表设计为列表结构，v2 直接追加新 flag

## 9. 部署与域名

- push `main` → GitHub Actions（`withastro/action`）构建 → 部署 GitHub Pages
- PR 触发构建 + 测试，不部署
- `public/CNAME` 内容为 `gods.dev`；DNS 在域名商配 A/AAAA 记录指向 GitHub Pages；`.dev` 为 HSTS 预载 TLD，GitHub Pages 自动签发证书并强制 HTTPS

## 10. 测试策略

- **单元（Vitest, TDD, 覆盖率 80%+）**: 命令解析器、命令注册表、虚拟文件系统、flag 验证器、主题持久化逻辑
- **E2E（Playwright）**: boot→敲命令→输出、点击命令执行、Tab 补全、主题切换持久化、博客列表→文章页导航、404 页
- **CI**: PR 与 main 均跑 build + 单元 + E2E

## 11. 验收标准

- [ ] gods.dev 通过 HTTPS 正常访问，全站英文
- [ ] 终端支持键盘输入、点击执行、Tab 补全、历史；移动端可用
- [ ] 博客：新增 .md + push 即发布；草稿不出现在线上
- [ ] Lighthouse：SEO 100，Performance/Accessibility/Best Practices ≥ 95
- [ ] 禁用 JS 时首页仍可见简介与全站导航
- [ ] 4 个主题可切换且持久化
- [ ] 8 项彩蛋全部就位，第一个 flag 线索链可完整走通且明文不可搜索
- [ ] 单元测试覆盖率 ≥ 80%，E2E 全绿
