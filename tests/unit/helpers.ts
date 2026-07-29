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
    studies: [],
    projects: [],
    stats: null,
    ctf: makeMemoryCtf(),
    registry: createRegistry(),
    historyList: () => [],
    ...overrides,
  }
  return ctx
}

/** 内存版 CtfStore，供测试使用 */
export function makeMemoryCtf(initial: string[] = []) {
  const set = new Set(initial)
  return {
    solved: () => [...set],
    markSolved: (id: string) => {
      set.add(id)
    },
  }
}
