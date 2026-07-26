import type { PostMeta, TerminalContext } from './core/types'
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

/** 让移动端浏览器的状态栏配色跟随当前主题背景色 */
function syncThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
}

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
      syncThemeColor()
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
      if (effect === 'matrix') startMatrixRain()
    },
  })
  void ui.start()
  syncThemeColor()
  printConsoleBanner()
  listenKonami(() => startMatrixRain())
}
