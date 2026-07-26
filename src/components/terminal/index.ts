import type { PostMeta, TerminalContext } from './core/types'
import type { BibleBook, BibleIndex } from './core/bible'
import { extractVerses, pickRandom, refLabel } from './core/bible'
import { createRegistry } from './core/registry'
import { createHistory } from './core/history'
import { createVfs } from './core/vfs-data'
import { HOME } from './core/vfs'
import { registerAll } from './commands/index'
import { THEMES } from './commands/theme'
import { createTerminalUi } from './ui/terminal-ui'
import { startMatrixRain } from './ui/matrix-rain'
import { listenKonami } from './ui/konami'
import { printConsoleBanner } from './ui/console-banner'

/** 预渲染的经文是构建期的静态兜底（SEO/无 JS 可见）；
    每次打开或刷新页面，挂载后立刻换成一句随机经文（离线则保留原文） */
async function refreshVotd(): Promise<void> {
  const el = document.getElementById('votd')
  if (!el) return
  try {
    const idx = (await (await fetch('/bible/index.json')).json()) as BibleIndex
    // 个别节码在 WEB 译本中缺省为空，抽中就再抽
    for (let attempt = 0; attempt < 5; attempt++) {
      const ref = pickRandom(idx)
      const book = (await (await fetch(`/bible/${ref.slug}.json`)).json()) as BibleBook
      const verse = extractVerses(book, ref)?.[0]
      if (!verse) continue
      const textEl = document.getElementById('votd-text')
      const btn = el.querySelector<HTMLElement>('.cmd-link')
      if (textEl) textEl.textContent = verse.text
      if (btn) {
        btn.textContent = refLabel(ref)
        btn.dataset.cmd = `bible ${ref.slug} ${ref.chapter}:${ref.verseStart}`
      }
      el.dataset.random = '1'
      return
    }
  } catch {
    // offline: the build-time verse stands
  }
}

/** 让移动端浏览器的状态栏配色跟随当前主题背景色 */
function syncThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
}

export function mountTerminal(): void {
  const root = document.getElementById('terminal')
  const dataEl = document.getElementById('terminal-data')
  if (!root || !dataEl) return

  const { posts = [], studies = [] } = JSON.parse(dataEl.textContent ?? '{}') as {
    posts?: PostMeta[]
    studies?: PostMeta[]
  }
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))
  const sortedStudies = [...studies].sort((a, b) => b.date.localeCompare(a.date))

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
      syncThemeColor()
      try { localStorage.setItem('gods:theme', t) } catch { /* private mode */ }
      return true
    },
    vfs: createVfs(sorted, sortedStudies),
    posts: sorted,
    studies: sortedStudies,
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
      if (effect === 'matrix') startMatrixRain()
    },
  })
  void ui.start()
  syncThemeColor()
  void refreshVotd()
  printConsoleBanner()
  listenKonami(() => startMatrixRain())
}
