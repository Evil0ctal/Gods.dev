import type { PostMeta, ProjectMeta, TerminalContext } from './core/types'
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
import { startFireworks } from './ui/fireworks'
import { listenKonami } from './ui/konami'
import { printConsoleBanner } from './ui/console-banner'
import { festivalToday } from './core/festivals'
import { fanfare } from './core/sound'

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

/** localStorage 支撑的 CTF 解题存储；隐私模式下降级为内存 */
function createCtfStore() {
  const KEY = 'gods:ctf:solved'
  const read = (): string[] => {
    try {
      const raw = localStorage.getItem(KEY)
      const arr = raw ? (JSON.parse(raw) as unknown) : []
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return {
    solved: read,
    markSolved(id: string) {
      const set = new Set(read())
      set.add(id)
      try {
        localStorage.setItem(KEY, JSON.stringify([...set]))
      } catch {
        /* private mode */
      }
    },
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

  const { posts = [], studies = [], projects = [] } = JSON.parse(dataEl.textContent ?? '{}') as {
    posts?: PostMeta[]
    studies?: PostMeta[]
    projects?: ProjectMeta[]
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
    projects,
    ctf: createCtfStore(),
    registry,
    historyList: () => history.all(),
  }

  // seasonal palette auto-applies on its date — unless the visitor picked one
  const festival = festivalToday()
  let savedTheme: string | null = null
  try {
    savedTheme = localStorage.getItem('gods:theme')
  } catch {
    /* private mode */
  }
  if (festival && !savedTheme) document.documentElement.dataset.theme = festival.theme

  const ui = createTerminalUi({
    root,
    ctx,
    historyPush: (e) => history.push(e),
    historyPrev: () => history.prev(),
    historyNext: () => history.next(),
    onEffect: (effect) => {
      if (effect === 'matrix') startMatrixRain()
      else if (effect === 'fireworks') startFireworks()
    },
  })
  void ui.start().then(() => {
    // birthday easter egg: Oct 21-23, once per session (unless reduced-motion)
    if (festival?.egg === 'birthday') {
      let seen = false
      try {
        seen = sessionStorage.getItem('gods:bday') === '1'
      } catch {
        /* ignore */
      }
      if (!seen) {
        ui.printHtml('<span class="out-name">✦ ✦ ✦  HAPPY BIRTHDAY, Evil0ctal  ✦ ✦ ✦</span>', 'line-success')
        ui.printHtml('another lap around the sun. 🎂  (type <button type="button" class="cmd-link" data-cmd="birthday">birthday</button> to relight the sky)', 'line-muted')
        startFireworks()
        fanfare()
        try {
          sessionStorage.setItem('gods:bday', '1')
        } catch {
          /* ignore */
        }
      }
    }
  })
  syncThemeColor()
  void refreshVotd()
  printConsoleBanner()
  listenKonami(() => startMatrixRain())
}
