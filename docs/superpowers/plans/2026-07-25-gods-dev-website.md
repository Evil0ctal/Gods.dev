# Gods.dev 网站实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 gods.dev 构建终端风格的个人网站（交互终端首页 + Markdown 博客 + 彩蛋 + SEO），部署到 GitHub Pages。

**Architecture:** Astro 5 纯静态生成；终端是唯一的 JS 岛屿（vanilla TS，无框架运行时）；终端核心逻辑（parser/registry/vfs/flags）与 DOM 层分离，核心纯逻辑用 Vitest TDD，DOM 交互用 Playwright E2E 覆盖。

**Tech Stack:** Astro 5, TypeScript (strict), 纯 CSS + custom properties, @astrojs/sitemap, @astrojs/rss, Vitest (+coverage-v8), Playwright, GitHub Actions (withastro/action)。

**Spec:** `docs/superpowers/specs/2026-07-25-gods-dev-website-design.md`（本计划的需求来源，冲突时以 spec 为准）

## Global Constraints

- 站点 URL：`https://gods.dev`，全站内容英文
- 输出纯静态；除终端岛屿外零 JS；终端岛屿 JS < 30KB gzip
- 不引入任何 UI 框架运行时（无 React/Vue/…）
- 单元测试覆盖率 ≥ 80%（范围：`src/components/terminal/core/**` 与 `src/components/terminal/commands/**`）
- 提交信息格式 `<type>: <description>`（feat/fix/refactor/docs/test/chore/perf/ci），**不加** Co-Authored-By 尾注（用户全局禁用署名）
- flag 明文 `gods{th3_g4t3s_0f_g0ds_4re_0p3n}` **绝不出现在任何仓库文件中**（包括测试）；仓库中只允许出现其 SHA-256 哈希 `b52f0afdfd28751884a21720fd51ae24d0e71c2251d47137cf69234befa0f997` 和 ROT13(Base64) 编码 `M29xp3g0nQAsMmE0Z3AsZTMsMmOxp180pzIsZUNmoa0=`
- localStorage 键统一前缀：`gods:theme`、`gods:booted`
- 主题固定 4 个：`default`、`crt`、`amber`、`light`
- 尊重 `prefers-reduced-motion`（跳过 boot 动画、关闭扫描线/雨点动画）
- Node ≥ 20（本机 v22.16.0），包管理器 npm

## 最终文件结构

```
astro.config.mjs, tsconfig.json, vitest.config.ts, playwright.config.ts, package.json, .gitignore
public/            CNAME, robots.txt, favicon.svg, og-default.png
src/config/site.ts                    # 站点常量（名称/URL/社交）
src/data/projects.ts                  # 精选项目静态数据
src/content.config.ts                 # 博客 collection schema
src/content/blog/*.md                 # 文章
src/layouts/BaseLayout.astro          # head/SEO/主题引导
src/layouts/PostLayout.astro          # 文章排版
src/components/TerminalWindow.astro   # 终端窗口外框（博客等页面复用）
src/components/terminal/
  core/    types.ts, utils.ts, parser.ts, registry.ts, vfs.ts, vfs-data.ts,
           flags.ts, history.ts, autocomplete.ts
  commands/ index.ts, help.ts, basic.ts, fs.ts, content.ts, theme.ts,
            neofetch.ts, eggs.ts, flag.ts
  ui/      terminal-ui.ts, boot.ts, matrix-rain.ts, konami.ts, console-banner.ts
  index.ts                            # 岛屿入口
src/pages/  index.astro, about.astro, projects.astro, admin.astro, 404.astro,
            blog/index.astro, blog/[slug].astro, rss.xml.js
src/styles/ global.css, themes.css
scripts/generate-og.mjs               # Playwright 截图生成 OG 图（一次性）
e2e/terminal.spec.ts, blog.spec.ts, pages.spec.ts
tests/unit/*.test.ts
.github/workflows/deploy.yml
```

---

### Task 1: 项目脚手架（Astro + 工具链，构建通过）

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/pages/index.astro`（临时占位）, `src/styles/global.css`（空壳）
- Test: 无（脚手架任务，验证 = `npm run build` 成功）

**Interfaces:**
- Produces: 可构建的 Astro 项目；`npm run dev/build/preview/test:unit/test:e2e` 脚本；后续所有任务在此之上工作

- [ ] **Step 1: 创建 `.gitignore`**

```gitignore
node_modules/
dist/
.astro/
coverage/
playwright-report/
test-results/
.DS_Store
.idea/
*.log
```

- [ ] **Step 2: 创建 `package.json`**

```json
{
  "name": "gods.dev",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 3: 安装依赖**

Run: `npm install astro @astrojs/sitemap @astrojs/rss && npm install -D typescript vitest @vitest/coverage-v8 @playwright/test`
Expected: 安装成功，astro 版本为 5.x（`npx astro --version` 确认）

- [ ] **Step 4: 创建 `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://gods.dev',
  compressHTML: false, // 保留源码中的注释彩蛋与可读性（view-source 是产品的一部分）
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
})
```

- [ ] **Step 5: 创建 `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "tests/**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 6: 创建 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/components/terminal/core/**/*.ts',
        'src/components/terminal/commands/**/*.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
```

- [ ] **Step 7: 创建占位首页 `src/pages/index.astro` 与空的 `src/styles/global.css`**

`src/styles/global.css`（本任务先留最小内容，Task 9 完整实现）：

```css
/* gods.dev global styles — populated in themes/layout task */
:root { color-scheme: dark; }
```

`src/pages/index.astro`：

```astro
---
// Placeholder — replaced by the terminal homepage in Task 10.
import '../styles/global.css'
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>gods.dev</title>
  </head>
  <body>
    <h1>gods.dev — under construction</h1>
  </body>
</html>
```

- [ ] **Step 8: 验证构建**

Run: `npm run build`
Expected: 构建成功，`dist/index.html` 存在

- [ ] **Step 9: Commit**

```bash
git add .gitignore package.json package-lock.json astro.config.mjs tsconfig.json vitest.config.ts src/
git commit -m "chore: scaffold astro 5 project with vitest and sitemap"
```

---

### Task 2: 终端核心 — 类型、工具函数、命令解析器（TDD）

**Files:**
- Create: `src/components/terminal/core/types.ts`, `src/components/terminal/core/utils.ts`, `src/components/terminal/core/parser.ts`
- Test: `tests/unit/parser.test.ts`, `tests/unit/utils.test.ts`

**Interfaces:**
- Produces（后续所有任务依赖这些精确签名）:
  - `types.ts`: `OutputLine { text: string; kind?: 'out'|'error'|'success'|'muted'|'ascii'; html?: boolean }`；`CommandResult { lines: OutputLine[]; clear?: boolean; navigate?: string; effect?: 'matrix'|'crash'|'vim' }`；`Command { name: string; description: string; usage?: string; hidden?: boolean; run(args: string[], ctx: TerminalContext): CommandResult | Promise<CommandResult> }`；`CommandRegistry { register(cmd: Command): void; get(name: string): Command | undefined; list(includeHidden?: boolean): Command[]; names(includeHidden?: boolean): string[] }`；`TerminalContext { cwd: string; setCwd(path: string): void; getTheme(): string; setTheme(theme: string): boolean; vfs: VfsDir; posts: PostMeta[]; registry: CommandRegistry; historyList(): string[] }`；`PostMeta { slug: string; title: string; description: string; date: string }`；`ProjectMeta { name: string; description: string; url: string; tags: string[] }`；`VfsFile { type: 'file'; content: string }`；`VfsDir { type: 'dir'; children: Record<string, VfsNode> }`；`VfsNode = VfsFile | VfsDir`
  - `utils.ts`: `escapeHtml(s: string): string`；`cmdLink(name: string, label?: string): string`；`aLink(href: string, label: string): string`；`line(text: string, kind?: LineKind): OutputLine`；`htmlLine(html: string, kind?: LineKind): OutputLine`
  - `parser.ts`: `parse(input: string): { cmd: string; args: string[]; raw: string } | null`

- [ ] **Step 1: 创建 `src/components/terminal/core/types.ts`**

```ts
export type LineKind = 'out' | 'error' | 'success' | 'muted' | 'ascii'

export interface OutputLine {
  text: string
  kind?: LineKind
  /** true 时 text 是可信 HTML（只能来自命令模块的静态字符串，用户输入必须先 escapeHtml） */
  html?: boolean
}

export interface CommandResult {
  lines: OutputLine[]
  clear?: boolean
  navigate?: string
  effect?: 'matrix' | 'crash' | 'vim'
}

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string // YYYY-MM-DD
}

export interface ProjectMeta {
  name: string
  description: string
  url: string
  tags: string[]
}

export interface VfsFile { type: 'file'; content: string }
export interface VfsDir { type: 'dir'; children: Record<string, VfsNode> }
export type VfsNode = VfsFile | VfsDir

export interface CommandRegistry {
  register(cmd: Command): void
  get(name: string): Command | undefined
  list(includeHidden?: boolean): Command[]
  names(includeHidden?: boolean): string[]
}

export interface TerminalContext {
  cwd: string
  setCwd(path: string): void
  getTheme(): string
  setTheme(theme: string): boolean
  vfs: VfsDir
  posts: PostMeta[]
  registry: CommandRegistry
  historyList(): string[]
}

export interface Command {
  name: string
  description: string
  usage?: string
  hidden?: boolean
  run(args: string[], ctx: TerminalContext): CommandResult | Promise<CommandResult>
}
```

- [ ] **Step 2: 写失败测试 `tests/unit/utils.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { escapeHtml, cmdLink, aLink, line, htmlLine } from '../../src/components/terminal/core/utils'

describe('escapeHtml', () => {
  it('escapes angle brackets, quotes and ampersands', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')" & more>`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot; &amp; more&gt;',
    )
  })
  it('passes plain text through', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('link builders', () => {
  it('cmdLink renders a clickable command button', () => {
    expect(cmdLink('help')).toBe(
      '<button type="button" class="cmd-link" data-cmd="help">help</button>',
    )
  })
  it('cmdLink supports a custom label', () => {
    expect(cmdLink('blog read hello', 'hello')).toBe(
      '<button type="button" class="cmd-link" data-cmd="blog read hello">hello</button>',
    )
  })
  it('aLink renders an anchor', () => {
    expect(aLink('/blog/', 'blog')).toBe('<a class="term-link" href="/blog/">blog</a>')
  })
})

describe('line helpers', () => {
  it('line builds a plain OutputLine', () => {
    expect(line('hi', 'error')).toEqual({ text: 'hi', kind: 'error' })
  })
  it('htmlLine sets the html flag', () => {
    expect(htmlLine('<b>x</b>')).toEqual({ text: '<b>x</b>', html: true, kind: undefined })
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — cannot resolve `utils`

- [ ] **Step 4: 实现 `src/components/terminal/core/utils.ts`**

```ts
import type { LineKind, OutputLine } from './types'

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** 输出中可点击执行的命令。name 只能是命令模块内的静态字符串。 */
export function cmdLink(name: string, label?: string): string {
  return `<button type="button" class="cmd-link" data-cmd="${escapeHtml(name)}">${escapeHtml(label ?? name)}</button>`
}

export function aLink(href: string, label: string): string {
  return `<a class="term-link" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
}

export function line(text: string, kind?: LineKind): OutputLine {
  return kind === undefined ? { text } : { text, kind }
}

export function htmlLine(html: string, kind?: LineKind): OutputLine {
  return { text: html, html: true, kind }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test:unit`
Expected: utils.test.ts 全部 PASS

- [ ] **Step 6: 写失败测试 `tests/unit/parser.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parse } from '../../src/components/terminal/core/parser'

describe('parse', () => {
  it('splits command and args on whitespace', () => {
    expect(parse('theme crt')).toEqual({ cmd: 'theme', args: ['crt'], raw: 'theme crt' })
  })
  it('lowercases the command but not the args', () => {
    expect(parse('ECHO Hello')).toEqual({ cmd: 'echo', args: ['Hello'], raw: 'ECHO Hello' })
  })
  it('collapses repeated whitespace', () => {
    expect(parse('  ls   -la  ')).toEqual({ cmd: 'ls', args: ['-la'], raw: 'ls   -la' })
  })
  it('keeps double-quoted args intact', () => {
    expect(parse('echo "hello   world" x')).toEqual({
      cmd: 'echo',
      args: ['hello   world', 'x'],
      raw: 'echo "hello   world" x',
    })
  })
  it('keeps single-quoted args intact', () => {
    expect(parse("echo 'a b'")).toEqual({ cmd: 'echo', args: ['a b'], raw: "echo 'a b'" })
  })
  it('treats an unclosed quote as literal to end of line', () => {
    expect(parse('echo "oops')).toEqual({ cmd: 'echo', args: ['oops'], raw: 'echo "oops' })
  })
  it('returns null for empty or whitespace-only input', () => {
    expect(parse('')).toBeNull()
    expect(parse('   ')).toBeNull()
  })
})
```

- [ ] **Step 7: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — cannot resolve `parser`

- [ ] **Step 8: 实现 `src/components/terminal/core/parser.ts`**

```ts
export interface ParsedInput {
  cmd: string
  args: string[]
  raw: string
}

/** 按空白切分，支持 '…' 与 "…" 引用；返回 null 表示空输入。 */
export function parse(input: string): ParsedInput | null {
  const raw = input.trim()
  if (raw === '') return null

  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let started = false

  for (const ch of raw) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (ch === ' ' || ch === '\t') {
      if (started || current !== '') tokens.push(current)
      current = ''
      started = false
    } else {
      current += ch
      started = true
    }
  }
  if (started || current !== '') tokens.push(current)

  const [first, ...args] = tokens
  return { cmd: first!.toLowerCase(), args, raw }
}
```

- [ ] **Step 9: 运行测试确认通过**

Run: `npm run test:unit`
Expected: 全部 PASS

- [ ] **Step 10: Commit**

```bash
git add src/components/terminal/core/ tests/unit/
git commit -m "feat: terminal core types, html-safe output helpers and input parser"
```

---

### Task 3: 命令注册表 + 基础命令（help/echo/date/whoami/clear/history）（TDD）

**Files:**
- Create: `src/components/terminal/core/registry.ts`, `src/components/terminal/commands/help.ts`, `src/components/terminal/commands/basic.ts`
- Test: `tests/unit/registry.test.ts`, `tests/unit/basic-commands.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `types.ts`（`Command`, `CommandRegistry`, `TerminalContext`）与 `utils.ts`
- Produces:
  - `registry.ts`: `createRegistry(): CommandRegistry`
  - `help.ts`: `export const helpCmd: Command`
  - `basic.ts`: `export const echoCmd, dateCmd, whoamiCmd, clearCmd, historyCmd: Command`
  - 测试工具（后续命令测试复用）：`tests/unit/helpers.ts` 的 `makeCtx(overrides?: Partial<TerminalContext>): TerminalContext`

- [ ] **Step 1: 写失败测试 `tests/unit/registry.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createRegistry } from '../../src/components/terminal/core/registry'
import type { Command } from '../../src/components/terminal/core/types'

const stub = (name: string, hidden = false): Command => ({
  name,
  description: `${name} desc`,
  hidden,
  run: () => ({ lines: [] }),
})

describe('createRegistry', () => {
  it('registers and retrieves commands by name', () => {
    const reg = createRegistry()
    reg.register(stub('help'))
    expect(reg.get('help')?.name).toBe('help')
    expect(reg.get('nope')).toBeUndefined()
  })
  it('lists visible commands sorted by name, hiding hidden ones', () => {
    const reg = createRegistry()
    reg.register(stub('theme'))
    reg.register(stub('sudo', true))
    reg.register(stub('help'))
    expect(reg.list().map((c) => c.name)).toEqual(['help', 'theme'])
    expect(reg.list(true).map((c) => c.name)).toEqual(['help', 'sudo', 'theme'])
  })
  it('names() mirrors list()', () => {
    const reg = createRegistry()
    reg.register(stub('b'))
    reg.register(stub('a'))
    expect(reg.names()).toEqual(['a', 'b'])
  })
  it('throws on duplicate registration', () => {
    const reg = createRegistry()
    reg.register(stub('x'))
    expect(() => reg.register(stub('x'))).toThrow(/already registered/)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — cannot resolve `registry`

- [ ] **Step 3: 实现 `src/components/terminal/core/registry.ts`**

```ts
import type { Command, CommandRegistry } from './types'

export function createRegistry(): CommandRegistry {
  const commands = new Map<string, Command>()

  return {
    register(cmd: Command): void {
      if (commands.has(cmd.name)) throw new Error(`command already registered: ${cmd.name}`)
      commands.set(cmd.name, cmd)
    },
    get(name: string): Command | undefined {
      return commands.get(name)
    },
    list(includeHidden = false): Command[] {
      return [...commands.values()]
        .filter((c) => includeHidden || !c.hidden)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    names(includeHidden = false): string[] {
      return this.list(includeHidden).map((c) => c.name)
    },
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 5: 创建测试上下文工具 `tests/unit/helpers.ts`**

```ts
import { createRegistry } from '../../src/components/terminal/core/registry'
import type { TerminalContext, VfsDir } from '../../src/components/terminal/core/types'

const emptyVfs: VfsDir = { type: 'dir', children: {} }

export function makeCtx(overrides: Partial<TerminalContext> = {}): TerminalContext {
  let cwd = '/home/guest'
  let theme = 'default'
  const ctx: TerminalContext = {
    get cwd() {
      return cwd
    },
    set cwd(v: string) {
      cwd = v
    },
    setCwd(p: string) {
      cwd = p
    },
    getTheme: () => theme,
    setTheme(t: string) {
      theme = t
      return true
    },
    vfs: emptyVfs,
    posts: [],
    registry: createRegistry(),
    historyList: () => [],
    ...overrides,
  }
  return ctx
}
```

- [ ] **Step 6: 写失败测试 `tests/unit/basic-commands.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { helpCmd } from '../../src/components/terminal/commands/help'
import { echoCmd, dateCmd, whoamiCmd, clearCmd, historyCmd } from '../../src/components/terminal/commands/basic'
import { makeCtx } from './helpers'

describe('help', () => {
  it('lists visible commands with clickable names', async () => {
    const ctx = makeCtx()
    ctx.registry.register(helpCmd)
    ctx.registry.register(echoCmd)
    const res = await helpCmd.run([], ctx)
    const html = res.lines.map((l) => l.text).join('\n')
    expect(html).toContain('data-cmd="help"')
    expect(html).toContain('data-cmd="echo"')
    expect(html).toContain(echoCmd.description)
  })
})

describe('echo', () => {
  it('echoes args escaped', async () => {
    const res = await echoCmd.run(['<b>hi</b>'], makeCtx())
    expect(res.lines[0]?.text).toBe('&lt;b&gt;hi&lt;/b&gt;')
    expect(res.lines[0]?.html).toBe(true)
  })
  it('prints empty line without args', async () => {
    const res = await echoCmd.run([], makeCtx())
    expect(res.lines[0]?.text).toBe('')
  })
})

describe('whoami', () => {
  it('identifies the guest', async () => {
    const res = await whoamiCmd.run([], makeCtx())
    expect(res.lines[0]?.text).toContain('guest')
  })
})

describe('date', () => {
  it('prints a date string', async () => {
    const res = await dateCmd.run([], makeCtx())
    expect(res.lines[0]?.text).toMatch(/\d{4}/)
  })
})

describe('clear', () => {
  it('signals a screen clear', async () => {
    const res = await clearCmd.run([], makeCtx())
    expect(res.clear).toBe(true)
    expect(res.lines).toEqual([])
  })
})

describe('history', () => {
  it('lists numbered history entries', async () => {
    const ctx = makeCtx({ historyList: () => ['help', 'ls'] })
    const res = await historyCmd.run([], ctx)
    expect(res.lines[0]?.text).toMatch(/1\s+help/)
    expect(res.lines[1]?.text).toMatch(/2\s+ls/)
  })
  it('reports empty history', async () => {
    const res = await historyCmd.run([], makeCtx())
    expect(res.lines[0]?.kind).toBe('muted')
  })
})
```

- [ ] **Step 7: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — cannot resolve `help` / `basic`

- [ ] **Step 8: 实现 `src/components/terminal/commands/help.ts`**

```ts
import type { Command } from '../core/types'
import { cmdLink, htmlLine, line } from '../core/utils'

export const helpCmd: Command = {
  name: 'help',
  description: 'list available commands',
  run(_args, ctx) {
    const cmds = ctx.registry.list()
    const width = Math.max(...cmds.map((c) => c.name.length)) + 2
    return {
      lines: [
        line('Available commands (click or type):', 'muted'),
        ...cmds.map((c) =>
          htmlLine(`  ${cmdLink(c.name)}${' '.repeat(width - c.name.length)}${c.description}`),
        ),
        line(''),
        line('There is more than what is listed here. Explore.', 'muted'),
      ],
    }
  },
}
```

- [ ] **Step 9: 实现 `src/components/terminal/commands/basic.ts`**

```ts
import type { Command } from '../core/types'
import { escapeHtml, htmlLine, line } from '../core/utils'

export const echoCmd: Command = {
  name: 'echo',
  description: 'print text back',
  usage: 'echo <text>',
  run(args) {
    return { lines: [htmlLine(escapeHtml(args.join(' ')))] }
  },
}

export const whoamiCmd: Command = {
  name: 'whoami',
  description: 'who are you, really?',
  run() {
    return {
      lines: [
        line('guest'),
        line('(identity is a construct. here, you are whoever you type.)', 'muted'),
      ],
    }
  },
}

export const dateCmd: Command = {
  name: 'date',
  description: 'current date and time',
  run() {
    return { lines: [line(new Date().toString())] }
  },
}

export const clearCmd: Command = {
  name: 'clear',
  description: 'clear the screen',
  run() {
    return { lines: [], clear: true }
  },
}

export const historyCmd: Command = {
  name: 'history',
  description: 'your command history',
  run(_args, ctx) {
    const entries = ctx.historyList()
    if (entries.length === 0) return { lines: [line('history: empty. make some.', 'muted')] }
    return { lines: entries.map((e, i) => line(`${String(i + 1).padStart(3)}  ${e}`)) }
  },
}
```

- [ ] **Step 10: 运行测试确认通过**

Run: `npm run test:unit`
Expected: 全部 PASS

- [ ] **Step 11: Commit**

```bash
git add src/components/terminal/ tests/unit/
git commit -m "feat: command registry with help, echo, date, whoami, clear, history"
```

---

### Task 4: 虚拟文件系统 + ls/cd/cat（TDD）

**Files:**
- Create: `src/components/terminal/core/vfs.ts`, `src/components/terminal/core/vfs-data.ts`, `src/components/terminal/commands/fs.ts`
- Test: `tests/unit/vfs.test.ts`, `tests/unit/fs-commands.test.ts`

**Interfaces:**
- Consumes: `types.ts`（`VfsDir/VfsNode/PostMeta/Command`）、`utils.ts`、`tests/unit/helpers.ts` 的 `makeCtx`
- Produces:
  - `vfs.ts`: `HOME = '/home/guest'`；`normalizePath(cwd: string, input: string): string`；`getNode(root: VfsDir, absPath: string): VfsNode | null`；`listDir(root: VfsDir, absPath: string): string[] | null`（目录名带尾 `/`，目录在前，各自按字母排序）；`readFile(root: VfsDir, absPath: string): string | null`；`displayPath(absPath: string): string`
  - `vfs-data.ts`: `createVfs(posts: PostMeta[]): VfsDir` — 含 `~/.secrets/prophecy.txt`（ROT13(Base64) 谜题）、`~/README.txt`、`~/blog/<slug>.md` 存根、`/etc/motd`
  - `fs.ts`: `export const lsCmd, cdCmd, catCmd: Command`

- [ ] **Step 1: 写失败测试 `tests/unit/vfs.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { HOME, normalizePath, getNode, listDir, readFile, displayPath } from '../../src/components/terminal/core/vfs'
import type { VfsDir } from '../../src/components/terminal/core/types'

const tree: VfsDir = {
  type: 'dir',
  children: {
    home: {
      type: 'dir',
      children: {
        guest: {
          type: 'dir',
          children: {
            'README.txt': { type: 'file', content: 'hello' },
            '.secrets': {
              type: 'dir',
              children: { 'prophecy.txt': { type: 'file', content: 'secret' } },
            },
            blog: { type: 'dir', children: {} },
          },
        },
      },
    },
    etc: { type: 'dir', children: { motd: { type: 'file', content: 'welcome' } } },
  },
}

describe('normalizePath', () => {
  it('resolves ~ to home', () => {
    expect(normalizePath(HOME, '~')).toBe(HOME)
    expect(normalizePath(HOME, '~/blog')).toBe(`${HOME}/blog`)
  })
  it('resolves relative paths against cwd', () => {
    expect(normalizePath(HOME, 'blog')).toBe(`${HOME}/blog`)
    expect(normalizePath(HOME, './blog')).toBe(`${HOME}/blog`)
  })
  it('resolves .. and stops at root', () => {
    expect(normalizePath(`${HOME}/blog`, '..')).toBe(HOME)
    expect(normalizePath('/', '../../..')).toBe('/')
  })
  it('keeps absolute paths', () => {
    expect(normalizePath(HOME, '/etc/motd')).toBe('/etc/motd')
  })
})

describe('getNode / readFile / listDir', () => {
  it('walks to a nested node', () => {
    expect(getNode(tree, '/etc/motd')).toEqual({ type: 'file', content: 'welcome' })
    expect(getNode(tree, '/nope')).toBeNull()
  })
  it('readFile returns content for files, null for dirs/missing', () => {
    expect(readFile(tree, `${HOME}/README.txt`)).toBe('hello')
    expect(readFile(tree, HOME)).toBeNull()
    expect(readFile(tree, '/ghost')).toBeNull()
  })
  it('listDir returns dirs first with trailing slash, then files, sorted', () => {
    expect(listDir(tree, HOME)).toEqual(['.secrets/', 'blog/', 'README.txt'])
    expect(listDir(tree, '/etc/motd')).toBeNull()
  })
})

describe('displayPath', () => {
  it('abbreviates home as ~', () => {
    expect(displayPath(HOME)).toBe('~')
    expect(displayPath(`${HOME}/blog`)).toBe('~/blog')
    expect(displayPath('/etc')).toBe('/etc')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — cannot resolve `vfs`

- [ ] **Step 3: 实现 `src/components/terminal/core/vfs.ts`**

```ts
import type { VfsDir, VfsNode } from './types'

export const HOME = '/home/guest'

export function normalizePath(cwd: string, input: string): string {
  let path = input.trim()
  if (path === '' || path === '~') path = HOME
  else if (path.startsWith('~/')) path = HOME + path.slice(1)
  else if (!path.startsWith('/')) path = `${cwd}/${path}`

  const parts: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

export function getNode(root: VfsDir, absPath: string): VfsNode | null {
  if (absPath === '/') return root
  let node: VfsNode = root
  for (const seg of absPath.split('/').filter(Boolean)) {
    if (node.type !== 'dir') return null
    const child: VfsNode | undefined = node.children[seg]
    if (!child) return null
    node = child
  }
  return node
}

export function listDir(root: VfsDir, absPath: string): string[] | null {
  const node = getNode(root, absPath)
  if (!node || node.type !== 'dir') return null
  const entries = Object.entries(node.children)
  const dirs = entries.filter(([, n]) => n.type === 'dir').map(([name]) => `${name}/`)
  const files = entries.filter(([, n]) => n.type === 'file').map(([name]) => name)
  return [...dirs.sort(), ...files.sort()]
}

export function readFile(root: VfsDir, absPath: string): string | null {
  const node = getNode(root, absPath)
  return node?.type === 'file' ? node.content : null
}

export function displayPath(absPath: string): string {
  if (absPath === HOME) return '~'
  if (absPath.startsWith(`${HOME}/`)) return `~${absPath.slice(HOME.length)}`
  return absPath
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 5: 实现 `src/components/terminal/core/vfs-data.ts`（无单独测试，数据文件；由 fs 命令测试覆盖）**

```ts
import type { PostMeta, VfsDir, VfsNode } from './types'

const PROPHECY = `an old god left this behind. it does not want to be read — it wants to be earned.

  M29xp3g0nQAsMmE0Z3AsZTMsMmOxp180pzIsZUNmoa0=

hint: caesar guarded the gates before the gods (13).
      beneath his cipher sleeps an older one — the ancient sixty-four.
      when you hold the truth, submit it:  flag submit <what-you-found>`

const README = `Welcome, wanderer.

This machine belongs to Evil0ctal. You are logged in as guest.
Nothing here is quite what it seems. Some directories are shy —
'ls' shows them anyway, if you look from the right place.

Start with: help, neofetch, blog, projects
The curious get further:  ls -a, cat, cd`

export function createVfs(posts: PostMeta[]): VfsDir {
  const blogChildren: Record<string, VfsNode> = {}
  for (const p of posts) {
    blogChildren[`${p.slug}.md`] = {
      type: 'file',
      content: `# ${p.title}\n\n${p.description}\n\n(read the full post: blog read ${p.slug})`,
    }
  }

  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          guest: {
            type: 'dir',
            children: {
              'README.txt': { type: 'file', content: README },
              blog: { type: 'dir', children: blogChildren },
              '.secrets': {
                type: 'dir',
                children: { 'prophecy.txt': { type: 'file', content: PROPHECY } },
              },
            },
          },
        },
      },
      etc: {
        type: 'dir',
        children: {
          motd: { type: 'file', content: 'gods.dev — the terminal is the interface.' },
        },
      },
    },
  }
}
```

- [ ] **Step 6: 写失败测试 `tests/unit/fs-commands.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { lsCmd, cdCmd, catCmd } from '../../src/components/terminal/commands/fs'
import { createVfs } from '../../src/components/terminal/core/vfs-data'
import { HOME } from '../../src/components/terminal/core/vfs'
import { makeCtx } from './helpers'

const posts = [{ slug: 'hello', title: 'Hello', description: 'First post', date: '2026-07-25' }]
const vfsCtx = () => makeCtx({ vfs: createVfs(posts) })

describe('ls', () => {
  it('lists cwd entries including dotfiles', async () => {
    const res = await lsCmd.run([], vfsCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('.secrets/')
    expect(text).toContain('blog/')
    expect(text).toContain('README.txt')
  })
  it('lists a given path', async () => {
    const res = await lsCmd.run(['~/blog'], vfsCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('hello.md')
  })
  it('errors on missing path', async () => {
    const res = await lsCmd.run(['/nope'], vfsCtx())
    expect(res.lines[0]?.kind).toBe('error')
  })
})

describe('cd', () => {
  it('changes cwd and reports it', async () => {
    const ctx = vfsCtx()
    const res = await cdCmd.run(['.secrets'], ctx)
    expect(ctx.cwd).toBe(`${HOME}/.secrets`)
    expect(res.lines).toEqual([])
  })
  it('cd with no args goes home', async () => {
    const ctx = vfsCtx()
    ctx.setCwd('/etc')
    await cdCmd.run([], ctx)
    expect(ctx.cwd).toBe(HOME)
  })
  it('rejects files and missing dirs', async () => {
    const ctx = vfsCtx()
    const res = await cdCmd.run(['README.txt'], ctx)
    expect(res.lines[0]?.kind).toBe('error')
    expect(ctx.cwd).toBe(HOME)
  })
})

describe('cat', () => {
  it('prints file content', async () => {
    const res = await catCmd.run(['README.txt'], vfsCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('Evil0ctal')
  })
  it('prints the prophecy puzzle from ~/.secrets', async () => {
    const res = await catCmd.run(['~/.secrets/prophecy.txt'], vfsCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('M29xp3g0nQAsMmE0Z3AsZTMsMmOxp180pzIsZUNmoa0=')
    expect(text).toContain('flag submit')
  })
  it('errors on dirs and missing files', async () => {
    expect((await catCmd.run(['blog'], vfsCtx())).lines[0]?.kind).toBe('error')
    expect((await catCmd.run(['ghost.txt'], vfsCtx())).lines[0]?.kind).toBe('error')
    expect((await catCmd.run([], vfsCtx())).lines[0]?.kind).toBe('error')
  })
})
```

- [ ] **Step 7: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — cannot resolve `fs`

- [ ] **Step 8: 实现 `src/components/terminal/commands/fs.ts`**

```ts
import type { Command } from '../core/types'
import { HOME, displayPath, getNode, listDir, normalizePath, readFile } from '../core/vfs'
import { line } from '../core/utils'

export const lsCmd: Command = {
  name: 'ls',
  description: 'list directory contents',
  usage: 'ls [path]',
  run(args, ctx) {
    const target = args.find((a) => !a.startsWith('-')) ?? '.'
    const abs = normalizePath(ctx.cwd, target)
    const entries = listDir(ctx.vfs, abs)
    if (entries === null) return { lines: [line(`ls: cannot access '${target}': no such directory`, 'error')] }
    if (entries.length === 0) return { lines: [line('(empty)', 'muted')] }
    return { lines: entries.map((e) => line(e, e.endsWith('/') ? 'success' : undefined)) }
  },
}

export const cdCmd: Command = {
  name: 'cd',
  description: 'change directory',
  usage: 'cd [path]',
  run(args, ctx) {
    const target = args[0] ?? '~'
    const abs = normalizePath(ctx.cwd, target)
    const node = getNode(ctx.vfs, abs)
    if (!node || node.type !== 'dir') {
      return { lines: [line(`cd: ${target}: not a directory`, 'error')] }
    }
    ctx.setCwd(abs)
    return { lines: [] }
  },
}

export const catCmd: Command = {
  name: 'cat',
  description: 'read a file',
  usage: 'cat <file>',
  run(args, ctx) {
    const target = args[0]
    if (!target) return { lines: [line('cat: missing operand. try: cat README.txt', 'error')] }
    const abs = normalizePath(ctx.cwd, target)
    const content = readFile(ctx.vfs, abs)
    if (content === null) {
      const node = getNode(ctx.vfs, abs)
      const msg = node ? `cat: ${target}: is a directory` : `cat: ${target}: no such file`
      return { lines: [line(msg, 'error')] }
    }
    return { lines: content.split('\n').map((l) => line(l)) }
  },
}

export { HOME, displayPath }
```

- [ ] **Step 9: 运行测试确认通过**

Run: `npm run test:unit`
Expected: 全部 PASS

- [ ] **Step 10: Commit**

```bash
git add src/components/terminal/ tests/unit/
git commit -m "feat: virtual filesystem with ls, cd, cat and hidden secrets"
```

---

### Task 5: flag 验证器 + flag 命令（TDD）

**Files:**
- Create: `src/components/terminal/core/flags.ts`, `src/components/terminal/commands/flag.ts`
- Test: `tests/unit/flags.test.ts`

**Interfaces:**
- Consumes: `types.ts`、`utils.ts`、`makeCtx`
- Produces:
  - `flags.ts`: `FlagEntry { id: string; name: string; sha256: string }`；`FLAGS: FlagEntry[]`；`sha256Hex(text: string): Promise<string>`（Web Crypto，Node ≥20 与浏览器通用）；`checkFlag(submission: string, flags?: FlagEntry[]): Promise<FlagEntry | null>`
  - `flag.ts`: `export const flagCmd: Command`（hidden；`flag` 显示说明，`flag submit <flag>` 验证）
- **约束**：真 flag 明文只存在于用户脑中与谜题编码里；测试用 dummy flag 验证机制

- [ ] **Step 1: 写失败测试 `tests/unit/flags.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { FLAGS, sha256Hex, checkFlag } from '../../src/components/terminal/core/flags'
import { flagCmd } from '../../src/components/terminal/commands/flag'
import { makeCtx } from './helpers'

describe('sha256Hex', () => {
  it('hashes to lowercase hex', async () => {
    // echo -n "abc" | shasum -a 256
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('checkFlag', () => {
  const dummy = [{ id: 'test01', name: 'Dummy', sha256: '' }]
  it('accepts a submission whose hash matches', async () => {
    const flags = [{ ...dummy[0]!, sha256: await sha256Hex('gods{dummy}') }]
    expect(await checkFlag('gods{dummy}', flags)).toEqual(flags[0])
  })
  it('rejects non-matching submissions', async () => {
    const flags = [{ ...dummy[0]!, sha256: await sha256Hex('gods{dummy}') }]
    expect(await checkFlag('gods{nope}', flags)).toBeNull()
  })
  it('trims whitespace before hashing', async () => {
    const flags = [{ ...dummy[0]!, sha256: await sha256Hex('gods{dummy}') }]
    expect(await checkFlag('  gods{dummy}  ', flags)).toEqual(flags[0])
  })
})

describe('production flag registry', () => {
  it('contains flag01 with a 64-char hex hash and no plaintext', () => {
    const f = FLAGS.find((f) => f.id === 'flag01')
    expect(f?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(FLAGS)).not.toContain('gods{')
  })
})

describe('flag command', () => {
  it('is hidden and explains usage when called bare', async () => {
    expect(flagCmd.hidden).toBe(true)
    const res = await flagCmd.run([], makeCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('flag submit')
  })
  it('rejects a wrong flag with an error line', async () => {
    const res = await flagCmd.run(['submit', 'gods{wrong}'], makeCtx())
    expect(res.lines[0]?.kind).toBe('error')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — cannot resolve `flags`

- [ ] **Step 3: 实现 `src/components/terminal/core/flags.ts`**

```ts
export interface FlagEntry {
  id: string
  name: string
  sha256: string
}

/**
 * CTF flag registry. Only hashes live here — go find the plaintext.
 * v2: append new entries; the validator needs no changes.
 */
export const FLAGS: FlagEntry[] = [
  {
    id: 'flag01',
    name: 'The Gates',
    sha256: 'b52f0afdfd28751884a21720fd51ae24d0e71c2251d47137cf69234befa0f997',
  },
]

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function checkFlag(
  submission: string,
  flags: FlagEntry[] = FLAGS,
): Promise<FlagEntry | null> {
  const hash = await sha256Hex(submission.trim())
  return flags.find((f) => f.sha256 === hash) ?? null
}
```

- [ ] **Step 4: 实现 `src/components/terminal/commands/flag.ts`**

```ts
import type { Command } from '../core/types'
import { checkFlag, FLAGS } from '../core/flags'
import { line } from '../core/utils'

export const flagCmd: Command = {
  name: 'flag',
  description: 'submit a captured flag',
  usage: 'flag submit <flag>',
  hidden: true,
  async run(args) {
    if (args[0] !== 'submit' || !args[1]) {
      return {
        lines: [
          line('So you found the flag system. Good.'),
          line(`${FLAGS.length} flag(s) are hidden in this site. Format: gods{...}`, 'muted'),
          line('Usage: flag submit <flag>', 'muted'),
        ],
      }
    }
    const hit = await checkFlag(args.slice(1).join(' '))
    if (!hit) {
      return { lines: [line('Nope. The gods are not fooled so easily.', 'error')] }
    }
    return {
      lines: [
        line(`⚑ CORRECT — ${hit.id}: "${hit.name}" captured.`, 'success'),
        line('You have proven yourself. More challenges are coming to gods.dev.', 'muted'),
      ],
    }
  },
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test:unit`
Expected: 全部 PASS

- [ ] **Step 6: 手工验证真 flag 哈希（不落盘）**

Run: `node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode(process.argv[1])).then(d => console.log([...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')))" 'gods{th3_g4t3s_0f_g0ds_4re_0p3n}'`
Expected: 输出 `b52f0afdfd28751884a21720fd51ae24d0e71c2251d47137cf69234befa0f997`（与 flags.ts 中一致）

- [ ] **Step 7: Commit**

```bash
git add src/components/terminal/ tests/unit/
git commit -m "feat: sha-256 flag validator with first hidden flag"
```

---

### Task 6: 输入历史导航 + Tab 自动补全（TDD）

**Files:**
- Create: `src/components/terminal/core/history.ts`, `src/components/terminal/core/autocomplete.ts`
- Test: `tests/unit/history.test.ts`, `tests/unit/autocomplete.test.ts`

**Interfaces:**
- Consumes: `types.ts`、`vfs.ts` 的 `normalizePath/listDir`
- Produces:
  - `history.ts`: `createHistory(): InputHistory`；`InputHistory { push(entry: string): void; prev(): string | null; next(): string | null; reset(): void; all(): string[] }` — `prev` 向旧移动（到最旧后停住重复返回最旧），`next` 向新移动（越过最新返回 null，UI 借此清空输入行），`push` 忽略空串与连续重复并 reset 游标
  - `autocomplete.ts`: `complete(input: string, ctx: { names: string[]; vfs: VfsDir; cwd: string }): string[]` — 返回**完整输入行**候选；首 token 补命令名；`ls/cd/cat` 的路径参数补 vfs 条目；无候选返回 `[]`

- [ ] **Step 1: 写失败测试 `tests/unit/history.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createHistory } from '../../src/components/terminal/core/history'

describe('InputHistory', () => {
  it('navigates prev through entries newest-first', () => {
    const h = createHistory()
    h.push('a')
    h.push('b')
    expect(h.prev()).toBe('b')
    expect(h.prev()).toBe('a')
    expect(h.prev()).toBe('a') // clamps at oldest
  })
  it('navigates next back toward the live line', () => {
    const h = createHistory()
    h.push('a')
    h.push('b')
    h.prev() // b
    h.prev() // a
    expect(h.next()).toBe('b')
    expect(h.next()).toBeNull() // past newest -> live line
  })
  it('prev on empty history returns null', () => {
    expect(createHistory().prev()).toBeNull()
  })
  it('push ignores empty and consecutive duplicates, resets cursor', () => {
    const h = createHistory()
    h.push('a')
    h.push('')
    h.push('a')
    expect(h.all()).toEqual(['a'])
    h.push('b')
    h.prev()
    h.push('c')
    expect(h.prev()).toBe('c')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL

- [ ] **Step 3: 实现 `src/components/terminal/core/history.ts`**

```ts
export interface InputHistory {
  push(entry: string): void
  prev(): string | null
  next(): string | null
  reset(): void
  all(): string[]
}

export function createHistory(): InputHistory {
  const entries: string[] = []
  let cursor = 0 // entries.length == live line

  return {
    push(entry: string): void {
      const trimmed = entry.trim()
      if (trimmed !== '' && entries[entries.length - 1] !== trimmed) entries.push(trimmed)
      cursor = entries.length
    },
    prev(): string | null {
      if (entries.length === 0) return null
      cursor = Math.max(0, cursor - 1)
      return entries[cursor] ?? null
    },
    next(): string | null {
      if (cursor >= entries.length) return null
      cursor += 1
      return cursor >= entries.length ? null : (entries[cursor] ?? null)
    },
    reset(): void {
      cursor = entries.length
    },
    all(): string[] {
      return [...entries]
    },
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 5: 写失败测试 `tests/unit/autocomplete.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { complete } from '../../src/components/terminal/core/autocomplete'
import { createVfs } from '../../src/components/terminal/core/vfs-data'
import { HOME } from '../../src/components/terminal/core/vfs'

const ctx = {
  names: ['blog', 'cat', 'cd', 'clear', 'help', 'history', 'ls', 'theme'],
  vfs: createVfs([{ slug: 'hello', title: 'Hello', description: 'x', date: '2026-07-25' }]),
  cwd: HOME,
}

describe('complete: command names', () => {
  it('completes a partial first token', () => {
    expect(complete('he', ctx)).toEqual(['help'])
  })
  it('returns all matches for ambiguous prefixes', () => {
    expect(complete('c', ctx)).toEqual(['cat', 'cd', 'clear'])
  })
  it('returns [] for no match or empty input', () => {
    expect(complete('zz', ctx)).toEqual([])
    expect(complete('', ctx)).toEqual([])
  })
})

describe('complete: paths for fs commands', () => {
  it('completes entries in cwd', () => {
    expect(complete('cat REA', ctx)).toEqual(['cat README.txt'])
  })
  it('completes dotfiles and dirs', () => {
    expect(complete('cd .se', ctx)).toEqual(['cd .secrets/'])
  })
  it('completes inside a subdirectory path', () => {
    expect(complete('cat blog/he', ctx)).toEqual(['cat blog/hello.md'])
  })
  it('does not path-complete for non-fs commands', () => {
    expect(complete('theme REA', ctx)).toEqual([])
  })
})
```

- [ ] **Step 6: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL

- [ ] **Step 7: 实现 `src/components/terminal/core/autocomplete.ts`**

```ts
import type { VfsDir } from './types'
import { listDir, normalizePath } from './vfs'

const FS_COMMANDS = new Set(['ls', 'cd', 'cat'])

export interface CompleteCtx {
  names: string[]
  vfs: VfsDir
  cwd: string
}

export function complete(input: string, ctx: CompleteCtx): string[] {
  if (input.trim() === '') return []
  const tokens = input.split(/\s+/)

  if (tokens.length === 1) {
    const prefix = tokens[0]!.toLowerCase()
    return ctx.names.filter((n) => n.startsWith(prefix) && n !== prefix)
  }

  const cmd = tokens[0]!.toLowerCase()
  if (!FS_COMMANDS.has(cmd)) return []

  const partial = tokens[tokens.length - 1]!
  const slash = partial.lastIndexOf('/')
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : ''
  const namePart = slash >= 0 ? partial.slice(slash + 1) : partial

  const dirAbs = normalizePath(ctx.cwd, dirPart === '' ? '.' : dirPart)
  const entries = listDir(ctx.vfs, dirAbs) ?? []
  const head = tokens.slice(0, -1).join(' ')

  return entries
    .filter((e) => e.startsWith(namePart) && e !== namePart)
    .map((e) => `${head} ${dirPart}${e}`)
}
```

- [ ] **Step 8: 运行测试确认通过**

Run: `npm run test:unit`
Expected: 全部 PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/terminal/ tests/unit/
git commit -m "feat: input history navigation and tab autocomplete"
```

---

### Task 7: 站点数据 + 内容命令（about/projects/contact/blog/theme/neofetch）（TDD）

**Files:**
- Create: `src/config/site.ts`, `src/data/projects.ts`, `src/components/terminal/commands/content.ts`, `src/components/terminal/commands/theme.ts`, `src/components/terminal/commands/neofetch.ts`
- Test: `tests/unit/content-commands.test.ts`

**Interfaces:**
- Consumes: `types.ts`、`utils.ts`、`makeCtx`
- Produces:
  - `site.ts`: `SITE = { url, name, handle, title, description, tagline, github, email }`（均 string）
  - `projects.ts`: `PROJECTS: ProjectMeta[]`
  - `content.ts`: `aboutCmd, projectsCmd, contactCmd, blogCmd: Command`（`contactCmd` 同时响应别名 `social` — 通过在 commands/index.ts 注册一个 `name: 'social'` 的包装实现，见 Task 8 的 index.ts）
  - `theme.ts`: `THEMES = ['default', 'crt', 'amber', 'light'] as const`；`themeCmd: Command`
  - `neofetch.ts`: `neofetchCmd: Command`

- [ ] **Step 1: 创建 `src/config/site.ts`**

```ts
export const SITE = {
  url: 'https://gods.dev',
  name: 'Evil0ctal',
  handle: 'guest@gods.dev',
  title: 'Evil0ctal — gods.dev',
  description:
    'Personal site of Evil0ctal: security research, open-source tools, hacker culture, and a terminal that talks back.',
  tagline: 'the terminal is the interface.',
  github: 'https://github.com/Evil0ctal',
  email: 'evil0ctal1985@gmail.com',
} as const
```

- [ ] **Step 2: 创建 `src/data/projects.ts`（数据文件，用户可随时增改）**

```ts
import type { ProjectMeta } from '../components/terminal/core/types'

export const PROJECTS: ProjectMeta[] = [
  {
    name: 'Douyin_TikTok_Download_API',
    description: 'High-performance async API for Douyin / TikTok data scraping and watermark-free downloads.',
    url: 'https://github.com/Evil0ctal/Douyin_TikTok_Download_API',
    tags: ['python', 'fastapi', 'scraping'],
  },
  {
    name: 'Gods.dev',
    description: 'This very site — a terminal that pretends to be a homepage. View source, there are secrets.',
    url: 'https://github.com/Evil0ctal/Gods.dev',
    tags: ['astro', 'typescript', 'easter-eggs'],
  },
]
```

- [ ] **Step 3: 写失败测试 `tests/unit/content-commands.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { aboutCmd, projectsCmd, contactCmd, blogCmd } from '../../src/components/terminal/commands/content'
import { themeCmd, THEMES } from '../../src/components/terminal/commands/theme'
import { neofetchCmd } from '../../src/components/terminal/commands/neofetch'
import { makeCtx } from './helpers'

const posts = [
  { slug: 'newer', title: 'Newer Post', description: 'n', date: '2026-07-20' },
  { slug: 'older', title: 'Older Post', description: 'o', date: '2026-01-01' },
]

describe('about', () => {
  it('mentions the author and links the about page', async () => {
    const text = (await aboutCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('Evil0ctal')
    expect(text).toContain('/about/')
  })
})

describe('projects', () => {
  it('lists projects with links', async () => {
    const text = (await projectsCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('Douyin_TikTok_Download_API')
    expect(text).toContain('github.com/Evil0ctal')
  })
})

describe('contact', () => {
  it('lists github and email', async () => {
    const text = (await contactCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('github.com/Evil0ctal')
    expect(text).toContain('evil0ctal1985@gmail.com')
  })
})

describe('blog', () => {
  it('lists posts newest first with clickable slugs', async () => {
    const res = await blogCmd.run([], makeCtx({ posts }))
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text.indexOf('newer')).toBeLessThan(text.indexOf('older'))
    expect(text).toContain('href="/blog/newer/"')
  })
  it('blog read <slug> navigates to the post', async () => {
    const res = await blogCmd.run(['read', 'older'], makeCtx({ posts }))
    expect(res.navigate).toBe('/blog/older/')
  })
  it('blog read with unknown slug errors', async () => {
    const res = await blogCmd.run(['read', 'ghost'], makeCtx({ posts }))
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('reports when there are no posts yet', async () => {
    const res = await blogCmd.run([], makeCtx())
    expect(res.lines[0]?.kind).toBe('muted')
  })
})

describe('theme', () => {
  it('lists themes when called bare, marking the current one', async () => {
    const text = (await themeCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    for (const t of THEMES) expect(text).toContain(t)
    expect(text).toContain('default (current)')
  })
  it('switches to a valid theme via ctx.setTheme', async () => {
    const ctx = makeCtx()
    const res = await themeCmd.run(['crt'], ctx)
    expect(ctx.getTheme()).toBe('crt')
    expect(res.lines[0]?.kind).toBe('success')
  })
  it('rejects unknown themes', async () => {
    const ctx = makeCtx({ setTheme: () => false })
    const res = await themeCmd.run(['rainbow'], ctx)
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('roasts the light theme', async () => {
    const res = await themeCmd.run(['light'], makeCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toMatch(/eyes|bright|regret/i)
  })
})

describe('neofetch', () => {
  it('prints ascii art and site facts', async () => {
    const res = await neofetchCmd.run([], makeCtx())
    expect(res.lines.some((l) => l.kind === 'ascii')).toBe(true)
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('gods.dev')
    expect(text).toContain('Uptime')
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL — 模块不存在

- [ ] **Step 5: 实现 `src/components/terminal/commands/content.ts`**

```ts
import type { Command } from '../core/types'
import { SITE } from '../../../config/site'
import { PROJECTS } from '../../../data/projects'
import { aLink, htmlLine, line } from '../core/utils'

export const aboutCmd: Command = {
  name: 'about',
  description: 'who runs this machine',
  run() {
    return {
      lines: [
        line(`${SITE.name} — security researcher & open-source developer.`),
        line('I break things to understand them, then build tools so you can too.'),
        line(SITE.tagline, 'muted'),
        line(''),
        htmlLine(`Full story: ${aLink('/about/', 'gods.dev/about')}`),
      ],
    }
  },
}

export const projectsCmd: Command = {
  name: 'projects',
  description: 'selected open-source work',
  run() {
    const lines = PROJECTS.flatMap((p) => [
      htmlLine(`${aLink(p.url, p.name)}  <span class="muted">[${p.tags.join(', ')}]</span>`),
      line(`  ${p.description}`, 'muted'),
    ])
    return {
      lines: [...lines, htmlLine(`More: ${aLink('/projects/', 'gods.dev/projects')}`)],
    }
  },
}

export const contactCmd: Command = {
  name: 'contact',
  description: 'reach the operator',
  run() {
    return {
      lines: [
        htmlLine(`GitHub  ${aLink(SITE.github, 'github.com/Evil0ctal')}`),
        htmlLine(`Email   ${aLink(`mailto:${SITE.email}`, SITE.email)}`),
        line('PGP     ask first. trust no one.', 'muted'),
      ],
    }
  },
}

export const blogCmd: Command = {
  name: 'blog',
  description: 'read the blog',
  usage: 'blog [read <slug>]',
  run(args, ctx) {
    if (args[0] === 'read') {
      const slug = args[1]
      const post = ctx.posts.find((p) => p.slug === slug)
      if (!post) return { lines: [line(`blog: no such post: ${slug ?? ''}`, 'error')] }
      return { lines: [line(`opening ~/blog/${post.slug}.md ...`, 'muted')], navigate: `/blog/${post.slug}/` }
    }
    if (ctx.posts.length === 0) {
      return { lines: [line('No posts yet. The gods are still writing.', 'muted')] }
    }
    return {
      lines: [
        line('Latest transmissions:', 'muted'),
        ...ctx.posts.map((p) =>
          htmlLine(`  ${p.date}  <a class="term-link" href="/blog/${p.slug}/">${p.slug}</a> — ${p.title}`),
        ),
        line(''),
        line('Open one:  blog read <slug>', 'muted'),
      ],
    }
  },
}
```

**注意**：`blogCmd` 假设 `ctx.posts` 已按日期从新到旧排序（排序发生在岛屿入口构造 ctx 时，见 Task 10）。测试里的 posts 已按此顺序传入。

- [ ] **Step 6: 实现 `src/components/terminal/commands/theme.ts`**

```ts
import type { Command } from '../core/types'
import { cmdLink, htmlLine, line } from '../core/utils'

export const THEMES = ['default', 'crt', 'amber', 'light'] as const
export type ThemeName = (typeof THEMES)[number]

const DESCRIPTIONS: Record<ThemeName, string> = {
  default: 'tokyo night — the modern operator',
  crt: 'green phosphor — 1978 called',
  amber: 'amber mono — VT220 nostalgia',
  light: 'light mode — why would you do this',
}

export const themeCmd: Command = {
  name: 'theme',
  description: 'switch the terminal theme',
  usage: 'theme [name]',
  run(args, ctx) {
    const target = args[0]?.toLowerCase()
    if (!target) {
      return {
        lines: [
          line('Available themes (click to apply):', 'muted'),
          ...THEMES.map((t) =>
            htmlLine(
              `  ${cmdLink(`theme ${t}`, t)}  ${DESCRIPTIONS[t]}${t === ctx.getTheme() ? ' (current)' : ''}`,
            ),
          ),
        ],
      }
    }
    if (!ctx.setTheme(target)) {
      return { lines: [line(`theme: unknown theme '${target}'. try: theme`, 'error')] }
    }
    const quip =
      target === 'light'
        ? 'Your eyes. Your funeral. You will regret this bright decision.'
        : `Theme set: ${target}`
    return { lines: [line(quip, target === 'light' ? 'muted' : 'success')] }
  },
}
```

- [ ] **Step 7: 实现 `src/components/terminal/commands/neofetch.ts`**

```ts
import type { Command } from '../core/types'
import { SITE } from '../../../config/site'
import { line } from '../core/utils'

const LOGO = String.raw`
   ▄████  ▒█████  ▓█████▄   ██████
  ██▒ ▀█▒▒██▒  ██▒▒██▀ ██▌▒██    ▒
 ▒██░▄▄▄░▒██░  ██▒░██   █▌░ ▓██▄
 ░▓█  ██▓▒██   ██░░▓█▄   ▌  ▒   ██▒
 ░▒▓███▀▒░ ████▓▒░░▒████▓ ▒██████▒▒
  ░▒   ▒ ░ ▒░▒░▒░  ▒▒▓  ▒ ▒ ▒▓▒ ▒ ░
`.trim()

export const neofetchCmd: Command = {
  name: 'neofetch',
  description: 'system information',
  run(_args, ctx) {
    const facts: Array<[string, string]> = [
      ['OS', 'gods.dev 1.0 (Olympus) x86_64'],
      ['Host', 'GitHub Pages (bare metal is a state of mind)'],
      ['Kernel', 'astro-5-static'],
      ['Shell', 'gsh (gods shell) 0.1'],
      ['Theme', ctx.getTheme()],
      ['Uptime', 'since the fall of the old gods'],
      ['Operator', SITE.name],
      ['Contact', SITE.github],
    ]
    const pad = Math.max(...facts.map(([k]) => k.length))
    return {
      lines: [
        ...LOGO.split('\n').map((l) => line(l, 'ascii')),
        line(''),
        ...facts.map(([k, v]) => line(`  ${k.padEnd(pad)}  ${v}`)),
      ],
    }
  },
}
```

- [ ] **Step 8: 运行测试确认通过**

Run: `npm run test:unit`
Expected: 全部 PASS

- [ ] **Step 9: Commit**

```bash
git add src/config/ src/data/ src/components/terminal/ tests/unit/
git commit -m "feat: content commands — about, projects, contact, blog, theme, neofetch"
```

---

### Task 8: 彩蛋命令（sudo/rm/vim/matrix/hack/exit）+ 命令总注册（TDD）

**Files:**
- Create: `src/components/terminal/commands/eggs.ts`, `src/components/terminal/commands/index.ts`
- Test: `tests/unit/eggs-commands.test.ts`

**Interfaces:**
- Consumes: 前述全部命令模块
- Produces:
  - `eggs.ts`: `sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd: Command`（全部 `hidden: true`）
  - `index.ts`: `registerAll(reg: CommandRegistry): void` — 注册所有命令 + `social` 别名（`{ ...contactCmd, name: 'social', hidden: true }`）
  - UI 层约定：`effect: 'matrix'` 触发数字雨；`effect: 'crash'` 触发假崩溃动画；`effect: 'vim'` 进入假 vim 模式（仅 `:q!` 可退出）——效果实现在 Task 10/11

- [ ] **Step 1: 写失败测试 `tests/unit/eggs-commands.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd } from '../../src/components/terminal/commands/eggs'
import { registerAll } from '../../src/components/terminal/commands/index'
import { createRegistry } from '../../src/components/terminal/core/registry'
import { makeCtx } from './helpers'

describe('easter egg commands', () => {
  it('are all hidden from help', () => {
    for (const c of [sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd]) {
      expect(c.hidden).toBe(true)
    }
  })
  it('sudo denies with attitude', async () => {
    const res = await sudoCmd.run(['rm', '-rf', '/'], makeCtx())
    expect(res.lines[0]?.kind).toBe('error')
    expect(res.lines.map((l) => l.text).join(' ')).toMatch(/incident|reported|not in the sudoers/i)
  })
  it('rm -rf / triggers the crash effect', async () => {
    const res = await rmCmd.run(['-rf', '/'], makeCtx())
    expect(res.effect).toBe('crash')
  })
  it('plain rm refuses politely without crashing', async () => {
    const res = await rmCmd.run(['file.txt'], makeCtx())
    expect(res.effect).toBeUndefined()
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('vim traps the user', async () => {
    const res = await vimCmd.run([], makeCtx())
    expect(res.effect).toBe('vim')
  })
  it('matrix and hack start the rain', async () => {
    expect((await matrixCmd.run([], makeCtx())).effect).toBe('matrix')
    expect((await hackCmd.run([], makeCtx())).effect).toBe('matrix')
  })
  it('exit has nowhere to go', async () => {
    const res = await exitCmd.run([], makeCtx())
    expect(res.lines.map((l) => l.text).join(' ')).toMatch(/nowhere|stay|cannot leave/i)
  })
})

describe('registerAll', () => {
  it('registers the full v1 command set including the social alias', () => {
    const reg = createRegistry()
    registerAll(reg)
    const all = reg.names(true)
    for (const name of [
      'about', 'blog', 'cat', 'cd', 'clear', 'contact', 'date', 'echo', 'exit', 'flag',
      'hack', 'help', 'history', 'ls', 'matrix', 'neofetch', 'projects', 'rm', 'social',
      'sudo', 'theme', 'vim', 'whoami',
    ]) {
      expect(all).toContain(name)
    }
    expect(reg.get('social')?.hidden).toBe(true)
    expect(reg.names(false)).not.toContain('sudo')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL

- [ ] **Step 3: 实现 `src/components/terminal/commands/eggs.ts`**

```ts
import type { Command } from '../core/types'
import { line } from '../core/utils'

export const sudoCmd: Command = {
  name: 'sudo',
  description: 'become root (you wish)',
  hidden: true,
  run(args) {
    return {
      lines: [
        line(`guest is not in the sudoers file. This incident will be reported.`, 'error'),
        line(`(reported to whom? the gods. they are laughing${args.length ? ` at "${args.join(' ').slice(0, 40)}"` : ''}.)`, 'muted'),
      ],
    }
  },
}

export const rmCmd: Command = {
  name: 'rm',
  description: 'remove files (careful now)',
  hidden: true,
  run(args) {
    const nuke = args.some((a) => /^-[a-z]*r/i.test(a)) && args.includes('/')
    if (nuke) {
      return {
        lines: [line('rm: descending into /: this is fine.', 'error')],
        effect: 'crash',
      }
    }
    return {
      lines: [line(`rm: cannot remove '${args.filter((a) => !a.startsWith('-')).join(' ') || '?'}': read-only cosmos`, 'error')],
    }
  },
}

export const vimCmd: Command = {
  name: 'vim',
  description: 'a text editor you cannot leave',
  hidden: true,
  run() {
    return { lines: [], effect: 'vim' }
  },
}

export const matrixCmd: Command = {
  name: 'matrix',
  description: 'there is no spoon',
  hidden: true,
  run() {
    return { lines: [line('Wake up, Neo...', 'success')], effect: 'matrix' }
  },
}

export const hackCmd: Command = {
  name: 'hack',
  description: 'hack the planet',
  hidden: true,
  run() {
    return { lines: [line('ACCESS GRANTED. just kidding. enjoy the rain.', 'success')], effect: 'matrix' }
  },
}

export const exitCmd: Command = {
  name: 'exit',
  description: 'log out',
  hidden: true,
  run() {
    return {
      lines: [
        line('exit: there is nowhere to go. this terminal is your home now.', 'muted'),
        line('(close the tab if you must. the gods will remember.)', 'muted'),
      ],
    }
  },
}
```

- [ ] **Step 4: 实现 `src/components/terminal/commands/index.ts`**

```ts
import type { CommandRegistry } from '../core/types'
import { helpCmd } from './help'
import { echoCmd, dateCmd, whoamiCmd, clearCmd, historyCmd } from './basic'
import { lsCmd, cdCmd, catCmd } from './fs'
import { aboutCmd, projectsCmd, contactCmd, blogCmd } from './content'
import { themeCmd } from './theme'
import { neofetchCmd } from './neofetch'
import { flagCmd } from './flag'
import { sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd } from './eggs'

export function registerAll(reg: CommandRegistry): void {
  const commands = [
    helpCmd, aboutCmd, whoamiCmd, blogCmd, projectsCmd, contactCmd,
    themeCmd, neofetchCmd, clearCmd, historyCmd, echoCmd, dateCmd,
    lsCmd, cdCmd, catCmd,
    flagCmd, sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd,
    { ...contactCmd, name: 'social', hidden: true },
  ]
  for (const c of commands) reg.register(c)
}
```

- [ ] **Step 5: 运行测试确认通过 + 覆盖率检查**

Run: `npm run coverage`
Expected: 全部 PASS；core/ + commands/ 覆盖率 ≥ 80%（阈值在 vitest.config.ts 强制）

- [ ] **Step 6: Commit**

```bash
git add src/components/terminal/ tests/unit/
git commit -m "feat: easter egg commands and full command registration"
```

---

### Task 9: 主题系统 CSS + BaseLayout + 无闪烁主题引导

**Files:**
- Create: `src/styles/themes.css`, `src/layouts/BaseLayout.astro`, `public/favicon.svg`
- Modify: `src/styles/global.css`（完整实现）

**Interfaces:**
- Consumes: `SITE`（Task 7）
- Produces:
  - BaseLayout Props: `{ title: string; description: string; ogImage?: string; type?: 'website' | 'article'; jsonLd?: Record<string, unknown>; noindex?: boolean }`
  - 主题机制：`<html data-theme="...">` + CSS custom properties；键 `gods:theme`；head 内联脚本在首帧前应用主题（防 FOUC）
  - CSS 类约定（终端 UI 与页面共用）：`.term-link`（下划线链接）、`.cmd-link`（可点击命令按钮样式）、`.muted`、行级 kind 类 `.line-error/.line-success/.line-muted/.line-ascii`、终端窗口 `.term-window/.term-titlebar/.term-body`

- [ ] **Step 1: 实现 `src/styles/themes.css`**

```css
/* ── gods.dev theme system ─────────────────────────────
   Themes switch via <html data-theme="...">.
   Try: default | crt | amber | light          */

:root,
:root[data-theme='default'] {
  --bg: #16161e;
  --bg-elev: #1a1b26;
  --bg-titlebar: #13131a;
  --fg: #c0caf5;
  --fg-muted: #565f89;
  --accent: #7aa2f7;
  --accent-2: #bb9af7;
  --ok: #9ece6a;
  --err: #f7768e;
  --warn: #e0af68;
  --glow: transparent;
  --selection: #33467c;
}

:root[data-theme='crt'] {
  --bg: #020a02;
  --bg-elev: #041004;
  --bg-titlebar: #030c03;
  --fg: #33ff66;
  --fg-muted: #1d8c3d;
  --accent: #66ff99;
  --accent-2: #99ffbb;
  --ok: #66ff99;
  --err: #ff5555;
  --warn: #ffcc33;
  --glow: rgba(51, 255, 102, 0.55);
  --selection: #0d4d1f;
}

:root[data-theme='amber'] {
  --bg: #0d0800;
  --bg-elev: #150d02;
  --bg-titlebar: #100a01;
  --fg: #ffb000;
  --fg-muted: #8c6a1d;
  --accent: #ffc933;
  --accent-2: #ffdd66;
  --ok: #ffc933;
  --err: #ff5555;
  --warn: #ffdd66;
  --glow: rgba(255, 176, 0, 0.45);
  --selection: #4d3800;
}

:root[data-theme='light'] {
  --bg: #fafafa;
  --bg-elev: #ffffff;
  --bg-titlebar: #ececec;
  --fg: #1a1a2e;
  --fg-muted: #6b7280;
  --accent: #2563eb;
  --accent-2: #7c3aed;
  --ok: #16a34a;
  --err: #dc2626;
  --warn: #d97706;
  --glow: transparent;
  --selection: #bfdbfe;
}

:root[data-theme='light'] { color-scheme: light; }

/* CRT extras: phosphor glow + scanlines (reduced-motion drops the flicker) */
:root[data-theme='crt'] body,
:root[data-theme='amber'] body {
  text-shadow: 0 0 6px var(--glow);
}
:root[data-theme='crt'] body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.22) 0px,
    rgba(0, 0, 0, 0.22) 1px,
    transparent 1px,
    transparent 3px
  );
  animation: crt-flicker 0.12s infinite;
}
@keyframes crt-flicker {
  0% { opacity: 0.97; }
  50% { opacity: 1; }
  100% { opacity: 0.98; }
}
@media (prefers-reduced-motion: reduce) {
  :root[data-theme='crt'] body::after { animation: none; }
}
```

- [ ] **Step 2: 完整实现 `src/styles/global.css`（覆盖 Task 1 的空壳）**

```css
@import './themes.css';

:root { color-scheme: dark; }

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 15px;
  line-height: 1.55;
}

::selection { background: var(--selection); }

a, .term-link { color: var(--accent); text-decoration-color: var(--fg-muted); }
a:hover, .term-link:hover { color: var(--accent-2); }

.muted { color: var(--fg-muted); }

.cmd-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--accent);
  text-decoration: underline dotted;
  cursor: pointer;
}
.cmd-link:hover { color: var(--accent-2); }

.line-error { color: var(--err); }
.line-success { color: var(--ok); }
.line-muted { color: var(--fg-muted); }
.line-ascii { color: var(--accent-2); white-space: pre; }

/* terminal window chrome (homepage + blog frames) */
.term-window {
  max-width: 60rem;
  margin: 2rem auto;
  border: 1px solid color-mix(in srgb, var(--fg-muted) 40%, transparent);
  border-radius: 8px;
  background: var(--bg-elev);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.term-titlebar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  background: var(--bg-titlebar);
  color: var(--fg-muted);
  font-size: 0.8rem;
  border-bottom: 1px solid color-mix(in srgb, var(--fg-muted) 25%, transparent);
}
.term-titlebar .dots { display: flex; gap: 0.4rem; }
.term-titlebar .dot { width: 0.72rem; height: 0.72rem; border-radius: 50%; }
.dot-r { background: #ff5f56; } .dot-y { background: #ffbd2e; } .dot-g { background: #27c93f; }
.term-titlebar .title { margin-inline: auto; }
.term-body { padding: 1.1rem 1.3rem 1.6rem; }

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--bg-elev);
  color: var(--fg);
  padding: 0.5rem 1rem;
  z-index: 10000;
}
.skip-link:focus { left: 0; }

@media (max-width: 640px) {
  .term-window { margin: 0; border-radius: 0; border-inline: none; min-height: 100dvh; }
  html, body { font-size: 14px; }
}
```

- [ ] **Step 3: 实现 `src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/global.css'
import { SITE } from '../config/site'

interface Props {
  title: string
  description: string
  ogImage?: string
  type?: 'website' | 'article'
  jsonLd?: Record<string, unknown>
  noindex?: boolean
}

const { title, description, ogImage = '/og-default.png', type = 'website', jsonLd, noindex = false } = Astro.props
const canonical = new URL(Astro.url.pathname, SITE.url).href
const ogImageAbs = new URL(ogImage, SITE.url).href
---

<!doctype html>
<html lang="en" data-theme="default">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="alternate" type="application/rss+xml" title={SITE.title} href="/rss.xml" />
    {noindex && <meta name="robots" content="noindex" />}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content={type} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImageAbs} />
    <meta property="og:site_name" content={SITE.title} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={ogImageAbs} />
    {jsonLd && <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />}
    <script is:inline>
      // theme before first paint — no FOUC
      try {
        var t = localStorage.getItem('gods:theme')
        if (t && ['default', 'crt', 'amber', 'light'].indexOf(t) !== -1) {
          document.documentElement.dataset.theme = t
        }
      } catch (e) {}
    </script>
  </head>
  <body>
    <a class="skip-link" href="#site-nav">Skip to navigation</a>
    <slot />
    <footer id="site-nav" class="muted" style="text-align:center; padding: 1rem; font-size: 0.8rem;">
      <nav aria-label="Site">
        <a href="/">~</a> · <a href="/blog/">blog</a> · <a href="/about/">about</a> ·
        <a href="/projects/">projects</a> · <a href={SITE.github}>github</a> · <a href="/rss.xml">rss</a>
      </nav>
      <p>© 2026 {SITE.name} — {SITE.tagline}</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 4: 创建 `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="10" fill="#16161e"/>
  <text x="32" y="42" font-family="monospace" font-size="30" fill="#7aa2f7" text-anchor="middle">&gt;_</text>
</svg>
```

- [ ] **Step 5: 验证构建**

Run: `npm run build`
Expected: 构建成功（BaseLayout 尚未被页面使用也不报错；`astro check` 可选跑一次确认无类型错误）

- [ ] **Step 6: Commit**

```bash
git add src/styles/ src/layouts/ public/
git commit -m "feat: four-theme css system and seo-ready base layout"
```

---

### Task 10: 终端 UI 岛屿 + boot 序列 + 终端首页

**Files:**
- Create: `src/components/terminal/ui/terminal-ui.ts`, `src/components/terminal/ui/boot.ts`, `src/components/terminal/index.ts`
- Modify: `src/pages/index.astro`（替换 Task 1 占位）
- Test: 本任务手工验证（`npm run dev`），自动化覆盖在 Task 15 E2E

**Interfaces:**
- Consumes: `registerAll`、`createRegistry`、`createHistory`、`complete`、`createVfs`、`parse`、`THEMES`、`displayPath`、`HOME`、`escapeHtml`、`SITE`
- Produces:
  - `index.ts`: `mountTerminal(): void` — 读取 `#terminal-data` JSON（`{ posts: PostMeta[] }`），构建 ctx，挂载 UI。岛屿入口，被 index.astro 的 `<script>` 调用
  - `boot.ts`: `playBoot(print: (html: string, cls?: string) => void, skip: () => boolean): Promise<void>`
  - DOM 契约（E2E 依赖这些选择器）：`#terminal`（主容器）、`#term-output`（输出区，`aria-live="polite"`）、`#motd`（静态预渲染 MOTD）、`#term-input`（真实 `<input>`）、`#term-prompt`（提示符 span）、`.term-line`（输出行）、`.cmd-link[data-cmd]`（可点击命令）
  - 行为契约：Enter 执行；Tab 补全（唯一候选直接填充，多候选打印列表）；↑/↓ 历史；Ctrl+L 清屏；点击 `.cmd-link` 等效输入其 `data-cmd` 并执行；`navigate` 结果跳转；`clear` 清屏；effect `'crash'`/`'vim'`/`'matrix'` 分别触发假崩溃、假 vim、数字雨（matrix 在 Task 11 接入，本任务先打印占位行 `[matrix rain loading...]`）
  - localStorage: `gods:booted` 存在时跳过 boot 动画；`prefers-reduced-motion` 同样跳过

- [ ] **Step 1: 实现 `src/components/terminal/ui/boot.ts`**

```ts
const BOOT_LINES: Array<[string, number]> = [
  ['[    0.000000] gods.dev kernel 1.0.0-olympus booting...', 60],
  ['[    0.041337] cpu0: divine spark detected', 45],
  ['[    0.133700] mounting /dev/hubris on /home/guest ... ok', 55],
  ['[    0.271828] loading personality: evil0ctal.ko', 50],
  ['[    0.314159] easter_eggs: 8 modules loaded (some hidden)', 60],
  ['[    0.999999] reality check: <span class="line-error">FAILED</span> (continuing anyway)', 70],
  ['[    1.000000] startup complete. welcome, guest.', 40],
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 打印 boot 日志。skip() 返回 true 时立即输出剩余行。 */
export async function playBoot(
  print: (html: string, cls?: string) => void,
  skip: () => boolean,
): Promise<void> {
  for (const [html, delay] of BOOT_LINES) {
    print(html, 'line-muted')
    if (!skip()) await sleep(delay)
  }
}
```

- [ ] **Step 2: 实现 `src/components/terminal/ui/terminal-ui.ts`**

```ts
import type { CommandResult, OutputLine, TerminalContext } from '../core/types'
import { parse } from '../core/parser'
import { complete } from '../core/autocomplete'
import { displayPath } from '../core/vfs'
import { escapeHtml } from '../core/utils'
import { playBoot } from './boot'

export interface TerminalUiOptions {
  root: HTMLElement
  ctx: TerminalContext
  historyPush: (entry: string) => void
  historyPrev: () => string | null
  historyNext: () => string | null
  onEffect: (effect: NonNullable<CommandResult['effect']>) => void
}

const KIND_CLASS: Record<string, string> = {
  error: 'line-error',
  success: 'line-success',
  muted: 'line-muted',
  ascii: 'line-ascii',
}

export function createTerminalUi(opts: TerminalUiOptions) {
  const output = opts.root.querySelector<HTMLElement>('#term-output')!
  const input = opts.root.querySelector<HTMLInputElement>('#term-input')!
  const promptEl = opts.root.querySelector<HTMLElement>('#term-prompt')!
  const inputLine = opts.root.querySelector<HTMLElement>('#term-input-line')!
  let vimMode = false

  function printHtml(html: string, cls?: string): void {
    const div = document.createElement('div')
    div.className = `term-line${cls ? ` ${cls}` : ''}`
    div.innerHTML = html
    output.appendChild(div)
    div.scrollIntoView({ block: 'end' })
  }

  function printLine(l: OutputLine): void {
    const cls = l.kind ? KIND_CLASS[l.kind] : undefined
    printHtml(l.html ? l.text : escapeHtml(l.text) || '&nbsp;', cls)
  }

  function refreshPrompt(): void {
    promptEl.textContent = `guest@gods.dev:${displayPath(opts.ctx.cwd)}$`
  }

  function fakeCrash(): void {
    input.disabled = true
    const doom = [
      'rm: removing /usr ...', 'rm: removing /etc ...', 'rm: removing /home/guest ...',
      'Segmentation fault (core dumped)', 'KERNEL PANIC: the gods intervened.',
    ]
    doom.forEach((t, i) => setTimeout(() => printHtml(escapeHtml(t), 'line-error'), i * 350))
    setTimeout(() => {
      output.querySelectorAll('.term-line').forEach((el) => el.remove())
      printHtml('nice try. filesystem restored from divine backup.', 'line-success')
      input.disabled = false
      input.focus()
    }, doom.length * 350 + 900)
  }

  function enterVim(): void {
    vimMode = true
    printHtml('~<br>~<br>~<br><b>VIM - Vi IMproved</b><br>~<br>~   type  :q!&lt;Enter&gt;  to escape (you know you want to)', 'line-muted')
    promptEl.textContent = '--INSERT--'
  }

  async function runResult(res: CommandResult): Promise<void> {
    if (res.clear) output.querySelectorAll('.term-line, #motd').forEach((el) => el.remove())
    for (const l of res.lines) printLine(l)
    if (res.effect === 'crash') fakeCrash()
    else if (res.effect === 'vim') enterVim()
    else if (res.effect) opts.onEffect(res.effect)
    if (res.navigate) setTimeout(() => (window.location.href = res.navigate!), 400)
  }

  async function execute(raw: string): Promise<void> {
    printHtml(`<span class="line-muted">${escapeHtml(promptEl.textContent ?? '')}</span> ${escapeHtml(raw)}`)
    if (vimMode) {
      if (raw.trim() === ':q!') {
        vimMode = false
        printHtml('escaped vim. achievement unlocked.', 'line-success')
        refreshPrompt()
      } else printHtml('E492: Not an editor command. hint: :q!', 'line-error')
      return
    }
    const parsed = parse(raw)
    if (!parsed) return
    opts.historyPush(raw)
    const cmd = opts.ctx.registry.get(parsed.cmd)
    if (!cmd) {
      printHtml(`gsh: command not found: ${escapeHtml(parsed.cmd)}. try <button type="button" class="cmd-link" data-cmd="help">help</button>`, 'line-error')
      return
    }
    await runResult(await cmd.run(parsed.args, opts.ctx))
    refreshPrompt()
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      const v = input.value
      input.value = ''
      void execute(v)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const candidates = complete(input.value, {
        names: opts.ctx.registry.names(false),
        vfs: opts.ctx.vfs,
        cwd: opts.ctx.cwd,
      })
      if (candidates.length === 1) input.value = candidates[0]!
      else if (candidates.length > 1) printHtml(candidates.map(escapeHtml).join('&nbsp;&nbsp;'), 'line-muted')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const v = opts.historyPrev()
      if (v !== null) input.value = v
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      input.value = opts.historyNext() ?? ''
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      void execute('clear')
    }
  }

  async function start(): Promise<void> {
    const motd = output.querySelector<HTMLElement>('#motd')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const seen = localStorage.getItem('gods:booted') === '1'
    let skipped = reduced || seen
    const skipNow = () => skipped
    const onSkip = () => (skipped = true)

    if (!skipped) {
      motd?.remove()
      window.addEventListener('keydown', onSkip, { once: true })
      window.addEventListener('pointerdown', onSkip, { once: true })
      await playBoot(printHtml, skipNow)
      window.removeEventListener('keydown', onSkip)
      window.removeEventListener('pointerdown', onSkip)
      if (motd) output.appendChild(motd)
      localStorage.setItem('gods:booted', '1')
    }

    refreshPrompt()
    inputLine.hidden = false
    input.addEventListener('keydown', onKeydown)
    opts.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.cmd-link')
      if (btn?.dataset.cmd) void execute(btn.dataset.cmd)
      else if (e.target === opts.root || output.contains(e.target as Node)) input.focus()
    })
    input.focus()
  }

  return { start, execute, printHtml }
}
```

- [ ] **Step 3: 实现岛屿入口 `src/components/terminal/index.ts`**

```ts
import type { PostMeta, TerminalContext } from './core/types'
import { createRegistry } from './core/registry'
import { createHistory } from './core/history'
import { createVfs } from './core/vfs-data'
import { HOME } from './core/vfs'
import { registerAll } from './commands/index'
import { THEMES } from './commands/theme'
import { createTerminalUi } from './ui/terminal-ui'

export function mountTerminal(): void {
  const root = document.getElementById('terminal')
  const dataEl = document.getElementById('terminal-data')
  if (!root || !dataEl) return

  const { posts } = JSON.parse(dataEl.textContent ?? '{"posts":[]}') as { posts: PostMeta[] }
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))

  const history = createHistory()
  const registry = createRegistry()
  registerAll(registry)

  let cwd = HOME
  const ctx: TerminalContext = {
    get cwd() { return cwd },
    set cwd(v: string) { cwd = v },
    setCwd(p: string) { cwd = p },
    getTheme: () => document.documentElement.dataset.theme ?? 'default',
    setTheme(t: string): boolean {
      if (!(THEMES as readonly string[]).includes(t)) return false
      document.documentElement.dataset.theme = t
      try { localStorage.setItem('gods:theme', t) } catch { /* private mode */ }
      return true
    },
    vfs: createVfs(sorted),
    posts: sorted,
    registry,
    historyList: () => history.all(),
  }

  const ui = createTerminalUi({
    root,
    ctx,
    historyPush: (e) => history.push(e),
    historyPrev: () => history.prev(),
    historyNext: () => history.next(),
    onEffect: (effect) => {
      if (effect === 'matrix') ui.printHtml('[matrix rain loading...]', 'line-muted') // replaced in Task 11
    },
  })
  void ui.start()
}
```

- [ ] **Step 4: 重写 `src/pages/index.astro`（静态 MOTD 预渲染 + 岛屿挂载）**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import { getCollection } from 'astro:content'
import { SITE } from '../config/site'

const posts = (await getCollection('blog', ({ data }) => (import.meta.env.PROD ? !data.draft : true)))
  .map((p) => ({
    slug: p.id,
    title: p.data.title,
    description: p.data.description,
    date: p.data.pubDate.toISOString().slice(0, 10),
  }))
  .sort((a, b) => b.date.localeCompare(a.date))

const personLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: SITE.name,
  url: SITE.url,
  sameAs: [SITE.github],
  description: SITE.description,
}
---

<BaseLayout title={SITE.title} description={SITE.description} jsonLd={personLd}>
  <Fragment
    set:html={`<!--
    ██████╗  ██████╗ ██████╗ ███████╗   ██████╗ ███████╗██╗   ██╗
   ██╔════╝ ██╔═══██╗██╔══██╗██╔════╝   ██╔══██╗██╔════╝██║   ██║
   ██║  ███╗██║   ██║██║  ██║███████╗   ██║  ██║█████╗  ██║   ██║
   ██║   ██║██║   ██║██║  ██║╚════██║   ██║  ██║██╔══╝  ╚██╗ ██╔╝
   ╚██████╔╝╚██████╔╝██████╔╝███████║██╗██████╔╝███████╗ ╚████╔╝
    ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚══════╝  ╚═══╝

   well well well. a source reader. i like you already.
   the console has something for you. so does ~/.secrets — if you can find it.
   flags look like gods{...} and the terminal knows what to do with them.
-->`}
  />
  <main id="terminal" class="term-window" aria-label="Interactive terminal">
    <div class="term-titlebar">
      <div class="dots"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
      <span class="title">guest@gods.dev: ~</span>
    </div>
    <div class="term-body">
      <div id="term-output" aria-live="polite">
        <section id="motd">
          <pre class="line-ascii" aria-hidden="true">{`   ▄████  ▒█████  ▓█████▄   ██████     ▓█████▄ ▓█████  ██▒   █▓
  ██▒ ▀█▒▒██▒  ██▒▒██▀ ██▌▒██    ▒     ▒██▀ ██▌▓█   ▀ ▓██░   █▒
 ▒██░▄▄▄░▒██░  ██▒░██   █▌░ ▓██▄       ░██   █▌▒███    ▓██  █▒░
 ░▓█  ██▓▒██   ██░░▓█▄   ▌  ▒   ██▒    ░▓█▄   ▌▒▓█  ▄   ▒██ █░░
 ░▒▓███▀▒░ ████▓▒░░▒████▓ ▒██████▒▒ ██▓░▒████▓ ░▒████▒   ▒▀█░
  ░▒   ▒ ░ ▒░▒░▒░  ▒▒▓  ▒ ▒ ▒▓▒ ▒ ░ ▒▓▒ ▒▒▓  ▒ ░░ ▒░ ░   ░ ▐░`}</pre>
          <h1>{SITE.name} <span class="muted">@ gods.dev</span></h1>
          <p>{SITE.description}</p>
          <nav aria-label="Main">
            <a class="term-link" href="/blog/">blog</a> ·
            <a class="term-link" href="/about/">about</a> ·
            <a class="term-link" href="/projects/">projects</a> ·
            <a class="term-link" href={SITE.github}>github</a>
          </nav>
          <p class="muted">
            Type <button type="button" class="cmd-link" data-cmd="help">help</button> to begin.
            Mouse users: commands are clickable. Keyboard users: you already know what to do.
          </p>
        </section>
      </div>
      <div id="term-input-line" hidden>
        <label class="sr-only" for="term-input">Terminal command input</label>
        <span id="term-prompt">guest@gods.dev:~$</span>
        <input id="term-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" />
      </div>
    </div>
  </main>
  <script type="application/json" id="terminal-data" set:html={JSON.stringify({ posts })} />
  <script>
    import { mountTerminal } from '../components/terminal/index'
    mountTerminal()
  </script>
</BaseLayout>

<style>
  #term-input-line { display: flex; gap: 0.6rem; margin-top: 0.35rem; }
  #term-input-line[hidden] { display: none; }
  #term-prompt { color: var(--ok); white-space: nowrap; }
  #term-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--fg);
    font: inherit;
    caret-color: var(--accent);
    padding: 0;
  }
  .sr-only {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap;
  }
  #motd h1 { font-size: 1.15rem; margin: 0.8rem 0 0.3rem; }
  #motd p { margin: 0.4rem 0; }
  #term-output :global(.term-line) { white-space: pre-wrap; word-break: break-word; min-height: 1.2em; }
</style>
```

**注意**：本步引用了 `getCollection('blog')`，需要 content collection 已定义。Task 12 才创建 schema——因此**本任务 Step 4 先用空 posts 兜底**：如果 `src/content.config.ts` 尚不存在，把 frontmatter 里 `getCollection` 三行换成 `const posts: Array<{slug:string;title:string;description:string;date:string}> = []`，并在 Task 12 的 Step 6 恢复为上面的最终版本（该步骤会明确写出）。

- [ ] **Step 5: 手工验证**

Run: `npm run dev` 然后浏览器打开 http://localhost:4321
Expected: boot 动画 → MOTD → 提示符；`help` 可点击可输入；`theme crt` 切换绿屏；`ls`/`cat README.txt` 工作；`sudo`、`rm -rf /`、`vim`（`:q!` 退出）彩蛋工作；刷新后不再播 boot；禁用 JS（DevTools）后 MOTD 与导航仍可见

- [ ] **Step 6: Commit**

```bash
git add src/components/terminal/ src/pages/index.astro
git commit -m "feat: interactive terminal homepage with boot sequence and static motd"
```

---

### Task 11: Matrix 数字雨 + Konami 码 + 控制台横幅

**Files:**
- Create: `src/components/terminal/ui/matrix-rain.ts`, `src/components/terminal/ui/konami.ts`, `src/components/terminal/ui/console-banner.ts`
- Modify: `src/components/terminal/index.ts`（接入三者，替换 Step 3 的 onEffect 占位）

**Interfaces:**
- Consumes: Task 10 的 `mountTerminal` 结构
- Produces:
  - `matrix-rain.ts`: `startMatrixRain(durationMs?: number): void` — 全屏 canvas 叠加层，ESC/点击/超时（默认 8000ms）退出；`prefers-reduced-motion` 时直接不启动并返回
  - `konami.ts`: `listenKonami(onTrigger: () => void): void` — ↑↑↓↓←→←→BA 触发
  - `console-banner.ts`: `printConsoleBanner(): void` — styled console.log 横幅 + 线索

- [ ] **Step 1: 实现 `src/components/terminal/ui/matrix-rain.ts`**

```ts
const GLYPHS = 'アィウェオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF'

export function startMatrixRain(durationMs = 8000): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (document.getElementById('matrix-rain')) return

  const canvas = document.createElement('canvas')
  canvas.id = 'matrix-rain'
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.9)'
  document.body.appendChild(canvas)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const ctx = canvas.getContext('2d')!
  const fontSize = 16
  const cols = Math.floor(canvas.width / fontSize)
  const drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -50))

  const timer = setInterval(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.07)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#33ff66'
    ctx.font = `${fontSize}px monospace`
    drops.forEach((y, i) => {
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!
      ctx.fillText(ch, i * fontSize, y * fontSize)
      drops[i] = y * fontSize > canvas.height && Math.random() > 0.975 ? 0 : y + 1
    })
  }, 50)

  const stop = () => {
    clearInterval(timer)
    canvas.remove()
    window.removeEventListener('keydown', onKey)
  }
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stop()
  canvas.addEventListener('pointerdown', stop)
  window.addEventListener('keydown', onKey)
  setTimeout(stop, durationMs)
}
```

- [ ] **Step 2: 实现 `src/components/terminal/ui/konami.ts`**

```ts
const SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
]

export function listenKonami(onTrigger: () => void): void {
  let progress = 0
  window.addEventListener('keydown', (e) => {
    progress = e.key === SEQUENCE[progress] ? progress + 1 : e.key === SEQUENCE[0] ? 1 : 0
    if (progress === SEQUENCE.length) {
      progress = 0
      onTrigger()
    }
  })
}
```

- [ ] **Step 3: 实现 `src/components/terminal/ui/console-banner.ts`**

```ts
export function printConsoleBanner(): void {
  const style = 'color:#7aa2f7;font-family:monospace;font-size:12px'
  console.log(
    `%c
  ┌──────────────────────────────────────────────────┐
  │  so you opened the console. naturally.           │
  │                                                  │
  │  the prophecy is buried where dotfiles hide.     │
  │  ls sees what ls is told to see.                 │
  │  start at ~ and look for what starts with '.'    │
  │                                                  │
  │  flags: gods{...}  ·  submit them in the terminal│
  └──────────────────────────────────────────────────┘`,
    style,
  )
}
```

- [ ] **Step 4: 修改 `src/components/terminal/index.ts` 接入三者**

将 Task 10 Step 3 中 `mountTerminal` 的结尾部分：

```ts
  const ui = createTerminalUi({
    root,
    ctx,
    historyPush: (e) => history.push(e),
    historyPrev: () => history.prev(),
    historyNext: () => history.next(),
    onEffect: (effect) => {
      if (effect === 'matrix') ui.printHtml('[matrix rain loading...]', 'line-muted') // replaced in Task 11
    },
  })
  void ui.start()
```

替换为：

```ts
  const ui = createTerminalUi({
    root,
    ctx,
    historyPush: (e) => history.push(e),
    historyPrev: () => history.prev(),
    historyNext: () => history.next(),
    onEffect: (effect) => {
      if (effect === 'matrix') startMatrixRain()
    },
  })
  void ui.start()
  printConsoleBanner()
  listenKonami(() => startMatrixRain())
```

并在文件顶部 import 区追加：

```ts
import { startMatrixRain } from './ui/matrix-rain'
import { listenKonami } from './ui/konami'
import { printConsoleBanner } from './ui/console-banner'
```

- [ ] **Step 5: 手工验证**

Run: `npm run dev`
Expected: `matrix`/`hack` 触发数字雨（ESC 退出）；Konami 码触发同效果；控制台可见横幅；`prefers-reduced-motion` 模拟开启时数字雨不启动

- [ ] **Step 6: Commit**

```bash
git add src/components/terminal/
git commit -m "feat: matrix rain, konami code and console banner easter eggs"
```

---

### Task 12: 博客系统（collection schema、文章、列表页、文章页、复制按钮）

**Files:**
- Create: `src/content.config.ts`, `src/content/blog/building-gods-dev.md`, `src/content/blog/drafts-are-invisible.md`（draft 示例）, `src/layouts/PostLayout.astro`, `src/components/TerminalWindow.astro`, `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`
- Modify: `src/pages/index.astro`（若 Task 10 用了空 posts 兜底，恢复 getCollection 版本）

**Interfaces:**
- Consumes: `BaseLayout`（Task 9）、`SITE`
- Produces:
  - collection `blog`：schema `{ title: string; description: string; pubDate: Date; updatedDate?: Date; tags: string[] (default []); draft: boolean (default false); ogImage?: string }`
  - `TerminalWindow.astro` Props: `{ title: string }`（slot 为窗口内容；博客与静态页复用）
  - 路由约定：文章 URL `/blog/<文件名去扩展名>/`（entry.id 即 slug）

- [ ] **Step 1: 创建 `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    ogImage: z.string().optional(),
  }),
})

export const collections = { blog }
```

- [ ] **Step 2: 创建首篇文章 `src/content/blog/building-gods-dev.md`**

```markdown
---
title: 'Building gods.dev: a terminal that pretends to be a homepage'
description: 'Why my personal site boots like a kernel, takes commands like a shell, and hides flags like a CTF — built with Astro, deployed on GitHub Pages.'
pubDate: 2026-07-25
tags: ['astro', 'meta', 'easter-eggs']
---

Every developer eventually builds a personal site. Most of them are cards:
a photo, three links, a wall of buzzwords. I wanted mine to feel like the
place I actually live — a terminal.

## The idea

The homepage of gods.dev is a shell. You type `help`, it answers. You
`ls -a` around, you find things I did not put in the navigation. Some of
them are articles. Some of them are... not.

```bash
guest@gods.dev:~$ ls -a
.secrets/  blog/  README.txt
```

## The stack

- **Astro 5** — every page is static HTML; the terminal is the only island.
- **Vanilla TypeScript** — no framework runtime. View source. It's readable.
- **GitHub Pages** — push to main, Actions builds, done.

## The rules I set for myself

1. The site must work with JavaScript disabled — content first, toys second.
2. The terminal core must be unit-tested like real software (it is).
3. Every corner must hide at least one thing worth finding.

If you found this post through the terminal: good. If you found the other
thing in `~/.secrets`: better. If you have no idea what I am talking about —
open the homepage and type `help`.
```

- [ ] **Step 3: 创建草稿示例 `src/content/blog/drafts-are-invisible.md`**

```markdown
---
title: 'DRAFT: this post must never appear in production'
description: 'Draft mechanics test post. If you can read this on gods.dev, the build is broken.'
pubDate: 2026-07-24
draft: true
---

This post exists to prove drafts stay invisible in production builds.
E2E asserts its absence.
```

- [ ] **Step 4: 创建 `src/components/TerminalWindow.astro`**

```astro
---
interface Props {
  title: string
}
const { title } = Astro.props
---

<div class="term-window">
  <div class="term-titlebar">
    <div class="dots"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
    <span class="title">{title}</span>
  </div>
  <div class="term-body"><slot /></div>
</div>
```

- [ ] **Step 5: 创建 `src/layouts/PostLayout.astro`**

```astro
---
import BaseLayout from './BaseLayout.astro'
import TerminalWindow from '../components/TerminalWindow.astro'
import { SITE } from '../config/site'

interface Props {
  slug: string
  title: string
  description: string
  pubDate: Date
  updatedDate?: Date
  tags: string[]
  ogImage?: string
}

const { slug, title, description, pubDate, updatedDate, tags, ogImage } = Astro.props
const iso = (d: Date) => d.toISOString().slice(0, 10)

const articleLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description,
  datePublished: pubDate.toISOString(),
  ...(updatedDate && { dateModified: updatedDate.toISOString() }),
  url: `${SITE.url}/blog/${slug}/`,
  author: { '@type': 'Person', name: SITE.name, url: SITE.url },
}
---

<BaseLayout title={`${title} — ${SITE.title}`} description={description} type="article" jsonLd={articleLd} ogImage={ogImage}>
  <TerminalWindow title={`~/blog/${slug}.md`}>
    <article class="post">
      <header>
        <h1>{title}</h1>
        <p class="muted">
          <time datetime={iso(pubDate)}>{iso(pubDate)}</time>
          {updatedDate && <> · updated <time datetime={iso(updatedDate)}>{iso(updatedDate)}</time></>}
          {tags.length > 0 && <> · {tags.map((t) => `#${t}`).join(' ')}</>}
        </p>
      </header>
      <slot />
      <p><a class="term-link" href="/blog/">cd ..</a></p>
    </article>
  </TerminalWindow>
</BaseLayout>

<style is:global>
  .post h1 { font-size: 1.5rem; line-height: 1.3; }
  .post h2 { font-size: 1.2rem; margin-top: 2rem; }
  .post p, .post li { line-height: 1.75; }
  .post pre {
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    border: 1px solid color-mix(in srgb, var(--fg-muted) 30%, transparent);
    position: relative;
  }
  .post code { font-size: 0.9em; }
  .post :not(pre) > code {
    background: color-mix(in srgb, var(--fg-muted) 18%, transparent);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }
  .post blockquote { border-left: 3px solid var(--accent); margin-left: 0; padding-left: 1rem; color: var(--fg-muted); }
  .copy-btn {
    position: absolute; top: 0.4rem; right: 0.4rem;
    background: var(--bg-elev); color: var(--fg-muted);
    border: 1px solid color-mix(in srgb, var(--fg-muted) 40%, transparent);
    border-radius: 4px; font: inherit; font-size: 0.72rem;
    padding: 0.15rem 0.5rem; cursor: pointer;
  }
  .copy-btn:hover { color: var(--fg); }
</style>

<script>
  for (const pre of document.querySelectorAll('article.post pre')) {
    const btn = document.createElement('button')
    btn.className = 'copy-btn'
    btn.type = 'button'
    btn.textContent = 'copy'
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '')
      btn.textContent = 'copied!'
      setTimeout(() => (btn.textContent = 'copy'), 1500)
    })
    pre.appendChild(btn)
  }
</script>
```

- [ ] **Step 6: 创建 `src/pages/blog/[slug].astro` 与 `src/pages/blog/index.astro`**

`src/pages/blog/[slug].astro`：

```astro
---
import { getCollection, render } from 'astro:content'
import PostLayout from '../../layouts/PostLayout.astro'

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => (import.meta.env.PROD ? !data.draft : true))
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }))
}

const { post } = Astro.props
const { Content } = await render(post)
---

<PostLayout
  slug={post.id}
  title={post.data.title}
  description={post.data.description}
  pubDate={post.data.pubDate}
  updatedDate={post.data.updatedDate}
  tags={post.data.tags}
  ogImage={post.data.ogImage}
>
  <Content />
</PostLayout>
```

`src/pages/blog/index.astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro'
import TerminalWindow from '../../components/TerminalWindow.astro'
import { getCollection } from 'astro:content'
import { SITE } from '../../config/site'

const posts = (await getCollection('blog', ({ data }) => (import.meta.env.PROD ? !data.draft : true)))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())

const byYear = new Map<number, typeof posts>()
for (const p of posts) {
  const y = p.data.pubDate.getFullYear()
  if (!byYear.has(y)) byYear.set(y, [])
  byYear.get(y)!.push(p)
}
---

<BaseLayout title={`blog — ${SITE.title}`} description={`Articles by ${SITE.name}: security research, reverse engineering, web tooling, and the occasional prank.`}>
  <TerminalWindow title="guest@gods.dev: ~/blog">
    <p class="muted">$ ls -la ~/blog  <span aria-hidden="true">— {posts.length} article(s), 0 regrets</span></p>
    {[...byYear.entries()].map(([year, yearPosts]) => (
      <section>
        <h2 class="muted">{year}/</h2>
        <ul class="post-list">
          {yearPosts.map((p) => (
            <li>
              <span class="muted" aria-hidden="true">-rw-r--r--</span>
              <time datetime={p.data.pubDate.toISOString().slice(0, 10)} class="muted">
                {p.data.pubDate.toISOString().slice(0, 10)}
              </time>
              <a class="term-link" href={`/blog/${p.id}/`}>{p.data.title}</a>
            </li>
          ))}
        </ul>
      </section>
    ))}
    {posts.length === 0 && <p class="muted">No posts yet. The gods are still writing.</p>}
  </TerminalWindow>
</BaseLayout>

<style>
  .post-list { list-style: none; padding: 0; }
  .post-list li { display: flex; gap: 1rem; padding: 0.25rem 0; flex-wrap: wrap; }
  h1 { font-size: 1.3rem; }
</style>
```

**若 Task 10 当时用了空 posts 兜底**：现在把 `src/pages/index.astro` frontmatter 中的 `const posts: Array<...> = []` 恢复为 Task 10 Step 4 所示的 `getCollection('blog', ...)` 完整版本。

- [ ] **Step 7: 验证**

Run: `npm run build && npm run preview`，浏览器检查
Expected: `/blog/` 列出 1 篇文章（draft 不出现）；文章页渲染正常、代码块有 copy 按钮；首页终端 `blog` 命令列出文章、`blog read building-gods-dev` 跳转；`npm run dev` 下 draft 可见

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/content/ src/layouts/ src/components/ src/pages/
git commit -m "feat: markdown blog with ls-style index and terminal-framed posts"
```

---

### Task 13: SEO 基建（RSS、robots.txt、OG 图）

**Files:**
- Create: `src/pages/rss.xml.js`, `public/robots.txt`, `scripts/generate-og.mjs`, `public/og-default.png`（脚本产物）

**Interfaces:**
- Consumes: collection `blog`、`SITE`
- Produces: `/rss.xml`、`/robots.txt`（含彩蛋注释与假 Disallow）、`public/og-default.png`（1200×630）
- 注：sitemap 已在 Task 1 的 astro.config.mjs 配置（`@astrojs/sitemap` + admin 过滤），canonical/OG/JSON-LD 已在 Task 9/12 落地

- [ ] **Step 1: 创建 `src/pages/rss.xml.js`**

```js
import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { SITE } from '../config/site'

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
  })
}
```

- [ ] **Step 2: 创建 `public/robots.txt`**

```
# ──────────────────────────────────────────────
#  gods.dev robots.txt
#  hello, crawler. or human. mostly human, i bet —
#  crawlers never read the comments.
#
#  since you're here: not every path is listed
#  where machines can see it. the terminal knows more.
# ──────────────────────────────────────────────

User-agent: *
Disallow: /admin/
Allow: /

Sitemap: https://gods.dev/sitemap-index.xml
```

- [ ] **Step 3: 创建 `scripts/generate-og.mjs`（一次性运行，产物提交）**

```js
// Generates public/og-default.png (1200x630) with Playwright's bundled chromium.
// Run once: node scripts/generate-og.mjs
import { chromium } from '@playwright/test'

const html = `<!doctype html>
<html><head><style>
  body { margin: 0; width: 1200px; height: 630px; display: flex; align-items: center;
         justify-content: center; background: #16161e; font-family: 'SF Mono', Menlo, monospace; }
  .card { width: 1080px; border: 2px solid #3b4261; border-radius: 16px; background: #1a1b26;
          box-shadow: 0 24px 80px rgba(0,0,0,.6); overflow: hidden; }
  .bar { background: #13131a; padding: 18px 28px; display: flex; gap: 12px; align-items: center;
         border-bottom: 1px solid #3b4261; }
  .dot { width: 20px; height: 20px; border-radius: 50%; }
  .body { padding: 44px 56px 56px; }
  .prompt { color: #9ece6a; font-size: 34px; }
  .cmd { color: #c0caf5; font-size: 34px; }
  h1 { color: #7aa2f7; font-size: 88px; margin: 18px 0 8px; letter-spacing: -2px; }
  p { color: #565f89; font-size: 34px; margin: 0; }
  .cursor { display: inline-block; width: 22px; height: 40px; background: #7aa2f7; vertical-align: middle; }
</style></head><body>
  <div class="card">
    <div class="bar">
      <span class="dot" style="background:#ff5f56"></span>
      <span class="dot" style="background:#ffbd2e"></span>
      <span class="dot" style="background:#27c93f"></span>
    </div>
    <div class="body">
      <div><span class="prompt">guest@gods.dev:~$</span> <span class="cmd">whoami</span></div>
      <h1>gods.dev</h1>
      <p>Evil0ctal — security research, open-source tools, and a terminal that talks back.<span class="cursor"></span></p>
    </div>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: 'public/og-default.png' })
await browser.close()
console.log('wrote public/og-default.png')
```

- [ ] **Step 4: 生成 OG 图并验证 RSS/robots**

Run: `npx playwright install chromium && node scripts/generate-og.mjs && npm run build`
Expected: `public/og-default.png` 生成（约 1200×630）；`dist/rss.xml` 含文章；`dist/robots.txt` 与 `dist/sitemap-index.xml` 存在；sitemap 中无 `/admin/`

- [ ] **Step 5: Commit**

```bash
git add src/pages/rss.xml.js public/robots.txt public/og-default.png scripts/
git commit -m "feat: rss feed, robots.txt with bait path and default og image"
```

---

### Task 14: 静态页面（about / projects / admin / 404）

**Files:**
- Create: `src/pages/about.astro`, `src/pages/projects.astro`, `src/pages/admin.astro`, `src/pages/404.astro`

**Interfaces:**
- Consumes: `BaseLayout`、`TerminalWindow`、`SITE`、`PROJECTS`

- [ ] **Step 1: 创建 `src/pages/about.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import TerminalWindow from '../components/TerminalWindow.astro'
import { SITE } from '../config/site'
---

<BaseLayout title={`about — ${SITE.title}`} description={`About ${SITE.name}: security researcher, open-source developer, terminal enthusiast.`}>
  <TerminalWindow title="guest@gods.dev: ~/about">
    <p class="muted">$ cat about.txt</p>
    <h1>{SITE.name}</h1>
    <p>
      Security researcher and open-source developer. I take software apart to
      understand it, then build tools so you can do the same — legally, and
      with better error messages.
    </p>
    <p>
      Most of my public work lives on
      <a class="term-link" href={SITE.github}>GitHub</a>: scraping APIs,
      automation tooling, and infrastructure for people who like their
      interfaces monospaced.
    </p>
    <h2>This site</h2>
    <p>
      gods.dev is a static Astro site pretending to be a shell. There is no
      backend, no tracking, no cookies — just HTML, a little TypeScript, and
      more hidden corners than strictly necessary. The
      <a class="term-link" href="https://github.com/Evil0ctal/Gods.dev">source is public</a>.
    </p>
    <h2>Contact</h2>
    <p>
      Email: <a class="term-link" href={`mailto:${SITE.email}`}>{SITE.email}</a><br />
      GitHub: <a class="term-link" href={SITE.github}>github.com/Evil0ctal</a>
    </p>
  </TerminalWindow>
</BaseLayout>
```

- [ ] **Step 2: 创建 `src/pages/projects.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import TerminalWindow from '../components/TerminalWindow.astro'
import { SITE } from '../config/site'
import { PROJECTS } from '../data/projects'
---

<BaseLayout title={`projects — ${SITE.title}`} description={`Selected open-source projects by ${SITE.name}.`}>
  <TerminalWindow title="guest@gods.dev: ~/projects">
    <p class="muted">$ ls -la ~/projects</p>
    <h1>Projects</h1>
    <ul class="projects">
      {PROJECTS.map((p) => (
        <li>
          <h2><a class="term-link" href={p.url}>{p.name}</a></h2>
          <p>{p.description}</p>
          <p class="muted">[{p.tags.join(', ')}]</p>
        </li>
      ))}
    </ul>
    <p class="muted">Everything else: <a class="term-link" href={SITE.github}>github.com/Evil0ctal</a></p>
  </TerminalWindow>
</BaseLayout>

<style>
  .projects { list-style: none; padding: 0; }
  .projects li { margin-bottom: 1.6rem; }
  .projects h2 { margin-bottom: 0.2rem; font-size: 1.05rem; }
  h1 { font-size: 1.3rem; }
</style>
```

- [ ] **Step 3: 创建 `src/pages/admin.astro`（robots.txt 诱饵页）**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import TerminalWindow from '../components/TerminalWindow.astro'
---

<BaseLayout title="admin — nice try" description="There is no admin panel." noindex={true}>
  <TerminalWindow title="root@gods.dev: /admin — ACCESS DENIED">
    <h1>403 — nice try.</h1>
    <p>
      You read <code>robots.txt</code> and came straight here. Respect.
      That is exactly the right instinct — but this is a static site.
      There is no admin panel. There is no database. There is no spoon.
    </p>
    <p class="muted">
      Your visit has been logged to <code>/dev/null</code>, where it will be
      reviewed by nobody, forever.
    </p>
    <p>
      Since you clearly like poking around:
      <a class="term-link" href="/">the terminal</a> rewards people like you.
      Try <code>ls -a</code> somewhere private.
    </p>
  </TerminalWindow>
</BaseLayout>
```

- [ ] **Step 4: 创建 `src/pages/404.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import TerminalWindow from '../components/TerminalWindow.astro'
---

<BaseLayout title="404 — kernel panic" description="Page not found." noindex={true}>
  <TerminalWindow title="guest@gods.dev: PANIC">
    <pre class="line-error">
KERNEL PANIC — not syncing: attempted to access a page that does not exist

Call Trace:
  [&lt;ffffffff81234567&gt;] your_click+0x42/0x1337
  [&lt;ffffffff89abcdef&gt;] wishful_thinking+0x0/0xdead
  [&lt;ffffffff8badf00d&gt;] http_404_handler+0x404/0x404

---[ end trace 0000000000000404 ]---</pre>
    <p>The page you wanted is gone, was never here, or is hiding on purpose.</p>
    <p class="muted">
      (hiding on purpose is not hypothetical on this site. the terminal at
      <a class="term-link" href="/">gods.dev</a> knows things. dotfiles, prophecies, flags...)
    </p>
    <p><a class="term-link" href="/">reboot → /</a></p>
  </TerminalWindow>
</BaseLayout>
```

- [ ] **Step 5: 验证**

Run: `npm run build && npm run preview`
Expected: 4 个页面渲染正常；`/admin/` 与 404 的 `<meta name="robots" content="noindex">` 存在；sitemap 不含 `/admin/`

- [ ] **Step 6: Commit**

```bash
git add src/pages/
git commit -m "feat: about, projects, admin bait and kernel-panic 404 pages"
```

---

### Task 15: Playwright E2E 测试套件

**Files:**
- Create: `playwright.config.ts`, `e2e/terminal.spec.ts`, `e2e/blog.spec.ts`, `e2e/pages.spec.ts`

**Interfaces:**
- Consumes: Task 10 的 DOM 契约（`#terminal`、`#term-output`、`#term-input`、`#term-prompt`、`.term-line`、`.cmd-link[data-cmd]`、`#motd`）；`gods:booted`/`gods:theme` localStorage 键
- Produces: `npm run test:e2e` 全绿；测试跑在 **生产构建**（`astro preview`）上，验证 draft 排除等 PROD 行为

- [ ] **Step 1: 创建 `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4321,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

- [ ] **Step 2: 创建 `e2e/terminal.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test'

// skip the boot animation for deterministic tests
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gods:booted', '1'))
  await page.goto('/')
})

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#term-input').fill(cmd)
  await page.locator('#term-input').press('Enter')
}

test('static motd and nav are present for no-js visitors', async ({ page }) => {
  await expect(page.locator('#motd h1')).toContainText('Evil0ctal')
  await expect(page.locator('#motd nav a[href="/blog/"]')).toBeVisible()
})

test('help lists commands and hides easter eggs', async ({ page }) => {
  await run(page, 'help')
  const output = page.locator('#term-output')
  await expect(output).toContainText('theme')
  await expect(output).toContainText('neofetch')
  await expect(output.getByRole('button', { name: 'sudo' })).toHaveCount(0)
})

test('clicking a command link executes it', async ({ page }) => {
  await run(page, 'help')
  await page.locator('.cmd-link[data-cmd="neofetch"]').first().click()
  await expect(page.locator('#term-output')).toContainText('gods.dev 1.0 (Olympus)')
})

test('tab completes a unique prefix', async ({ page }) => {
  const input = page.locator('#term-input')
  await input.fill('neo')
  await input.press('Tab')
  await expect(input).toHaveValue('neofetch')
})

test('arrow-up recalls history', async ({ page }) => {
  await run(page, 'whoami')
  await page.locator('#term-input').press('ArrowUp')
  await expect(page.locator('#term-input')).toHaveValue('whoami')
})

test('theme switch persists across reloads', async ({ page }) => {
  await run(page, 'theme crt')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt')
})

test('filesystem: ls reveals .secrets and cat reads the prophecy', async ({ page }) => {
  await run(page, 'ls')
  await expect(page.locator('#term-output')).toContainText('.secrets/')
  await run(page, 'cat .secrets/prophecy.txt')
  await expect(page.locator('#term-output')).toContainText('M29xp3g0nQAsMmE0Z3AsZTMsMmOxp180pzIsZUNmoa0=')
})

test('sudo gets roasted', async ({ page }) => {
  await run(page, 'sudo rm -rf /')
  await expect(page.locator('#term-output')).toContainText('not in the sudoers file')
})

test('vim traps until :q!', async ({ page }) => {
  await run(page, 'vim')
  await expect(page.locator('#term-prompt')).toHaveText('--INSERT--')
  await run(page, ':q!')
  await expect(page.locator('#term-output')).toContainText('escaped vim')
})

test('wrong flag is rejected', async ({ page }) => {
  await run(page, 'flag submit gods{definitely_wrong}')
  await expect(page.locator('#term-output')).toContainText('not fooled')
})

test('unknown command suggests help', async ({ page }) => {
  await run(page, 'frobnicate')
  await expect(page.locator('#term-output')).toContainText('command not found')
})

test('blog command lists posts and navigates', async ({ page }) => {
  await run(page, 'blog read building-gods-dev')
  await page.waitForURL('**/blog/building-gods-dev/')
  await expect(page.locator('article.post h1')).toContainText('terminal that pretends')
})
```

- [ ] **Step 3: 创建 `e2e/blog.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('blog index lists published posts, newest first', async ({ page }) => {
  await page.goto('/blog/')
  await expect(page.locator('.post-list a').first()).toContainText('terminal that pretends')
})

test('draft posts are excluded from the production build', async ({ page }) => {
  await page.goto('/blog/')
  await expect(page.locator('body')).not.toContainText('DRAFT: this post must never appear')
  const res = await page.request.get('/blog/drafts-are-invisible/')
  expect(res.status()).toBe(404)
})

test('post page has terminal chrome, code copy button and jsonld', async ({ page }) => {
  await page.goto('/blog/building-gods-dev/')
  await expect(page.locator('.term-titlebar .title')).toContainText('~/blog/building-gods-dev.md')
  await expect(page.locator('.copy-btn').first()).toBeVisible()
  const ld = await page.locator('script[type="application/ld+json"]').textContent()
  expect(ld).toContain('"BlogPosting"')
})

test('rss feed serves published posts only', async ({ page }) => {
  const res = await page.request.get('/rss.xml')
  expect(res.status()).toBe(200)
  const xml = await res.text()
  expect(xml).toContain('building-gods-dev')
  expect(xml).not.toContain('drafts-are-invisible')
})
```

- [ ] **Step 4: 创建 `e2e/pages.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('about and projects render with seo meta', async ({ page }) => {
  await page.goto('/about/')
  await expect(page.locator('h1')).toContainText('Evil0ctal')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://gods.dev/about/')

  await page.goto('/projects/')
  await expect(page.locator('.projects h2').first()).toBeVisible()
})

test('admin bait page taunts and is noindexed', async ({ page }) => {
  await page.goto('/admin/')
  await expect(page.locator('h1')).toContainText('nice try')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})

test('404 kernel panic with clue', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist/')
  expect(res?.status()).toBe(404)
  await expect(page.locator('body')).toContainText('KERNEL PANIC')
})

test('robots.txt and sitemap exist; sitemap excludes admin', async ({ page }) => {
  const robots = await page.request.get('/robots.txt')
  expect(await robots.text()).toContain('Disallow: /admin/')
  const sitemap = await page.request.get('/sitemap-index.xml')
  expect(sitemap.status()).toBe(200)
})

test('homepage source contains the ascii comment easter egg', async ({ page }) => {
  const res = await page.request.get('/')
  const html = await res.text()
  expect(html).toContain('a source reader. i like you already')
})
```

- [ ] **Step 5: 运行 E2E**

Run: `npx playwright install chromium && npm run test:e2e`
Expected: 全部 PASS（`astro preview` 对 404 返回 404 状态；若个别断言与实现细节有出入——例如文案——修实现或修测试使其一致，以 spec 为准）

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test: e2e coverage for terminal, blog, seo and easter eggs"
```

---

### Task 16: CI/CD 部署 + 域名 + README

**Files:**
- Create: `.github/workflows/deploy.yml`, `public/CNAME`
- Modify: `README.md`

**Interfaces:**
- Consumes: 全部前序任务（构建与测试脚本）
- Produces: push main → 测试 → 构建 → 部署到 GitHub Pages；PR 只测试不部署

- [ ] **Step 1: 创建 `public/CNAME`**

```
gods.dev
```

- [ ] **Step 2: 创建 `.github/workflows/deploy.yml`**

```yaml
name: ci-and-deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test:unit
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e

  build:
    needs: test
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3

  deploy:
    needs: build
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: 重写 `README.md`**

```markdown
# gods.dev

> the terminal is the interface.

Personal site of [Evil0ctal](https://github.com/Evil0ctal) — a static
[Astro](https://astro.build) site that boots like a kernel, takes commands
like a shell, and hides more than it shows.

**Live:** https://gods.dev

## What's inside

- 🖥️ Interactive terminal homepage — type `help`, or click your way around
- 📝 Markdown blog with an `ls -la` aesthetic
- 🎨 Four switchable themes (`theme crt` for the 1978 experience)
- 🥚 Easter eggs. Everywhere. `view-source` is a feature, not a bug
- ⚑ CTF-style flags — format `gods{...}`, submit in the terminal

## Development

```bash
npm install
npm run dev        # localhost:4321
npm run test:unit  # vitest (terminal core)
npm run test:e2e   # playwright (needs: npx playwright install chromium)
npm run build      # static output in dist/
```

Blog posts live in `src/content/blog/*.md` — add a file, push, done.
`draft: true` keeps a post local.

## Deploying

Pushes to `main` run tests, build, and deploy to GitHub Pages via Actions.

One-time repo setup:
1. Settings → Pages → Source: **GitHub Actions**
2. Settings → Pages → Custom domain: `gods.dev` (wait for the HTTPS check)
3. DNS at your registrar (apex A/AAAA → GitHub Pages):
   - `A` records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - `AAAA` records: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153

`.dev` is on the HSTS preload list, so HTTPS is mandatory — GitHub Pages
provisions the certificate automatically once DNS propagates.

## License

MIT — see [LICENSE](LICENSE). The flags are yours if you can find them.
```

- [ ] **Step 4: 本地全量验证**

Run: `npm run coverage && npm run test:e2e && npm run build`
Expected: 覆盖率 ≥ 80% 且全部测试通过、构建成功

- [ ] **Step 5: Commit 并推送**

```bash
git add .github/ public/CNAME README.md
git commit -m "ci: github pages deployment pipeline with custom domain"
git push origin main
```

- [ ] **Step 6: 上线验证（需要用户配合的手动步骤）**

1. GitHub 仓库 Settings → Pages → Source 选 **GitHub Actions**
2. Actions 页确认 `ci-and-deploy` 全绿
3. Settings → Pages → Custom domain 填 `gods.dev`，等待 DNS check 通过并勾选 Enforce HTTPS
4. 在域名注册商配置 Step 3 README 中列出的 A/AAAA 记录
5. 访问 https://gods.dev 验证；用 Chrome DevTools Lighthouse 跑一次：SEO 应为 100，Performance/A11y/Best Practices ≥ 95

---

## 计划自审记录

- **Spec 覆盖**：终端首页(T10)、命令集(T3-T8)、主题(T7/T9)、博客(T12)、SEO 全项(T1 sitemap/T9 meta+JSON-LD/T12 BlogPosting/T13 RSS+robots+OG)、8 项彩蛋（源码注释 T10、console T11、Konami T11、隐藏命令 T8、.secrets T4、robots+admin T13/T14、404 T14、flag T5）、部署与域名(T16)、测试策略(全任务 TDD + T15 E2E)——spec 各节均有对应任务。
- **无占位符**：所有代码块为完整可用内容；唯一的条件分支（T10 依赖 collection 的兜底）在 T10/T12 中均写明了确切替换内容。
- **类型一致性**：`Command/CommandResult/TerminalContext/VfsDir/PostMeta` 等签名在 T2 定义后被 T3-T12 一致引用；DOM 契约（T10 Produces）与 T15 选择器一致；localStorage 键全局统一。
