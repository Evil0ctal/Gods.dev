import type { Command } from '../core/types'
import { cmdLink, htmlLine, line } from '../core/utils'

const GROUP_ORDER = ['intel', 'content', 'filesystem', 'shell']
const FRAME_WIDTH = 42

export const helpCmd: Command = {
  name: 'help',
  description: 'list available commands',
  category: 'shell',
  run(_args, ctx) {
    const cmds = ctx.registry.list()
    const width = Math.max(0, ...cmds.map((c) => c.name.length)) + 3

    const groups = new Map<string, Command[]>()
    for (const c of cmds) {
      const cat = c.category ?? 'misc'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(c)
    }
    const order = [
      ...GROUP_ORDER.filter((g) => groups.has(g)),
      ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g)).sort(),
    ]

    const lines = [line('gsh (gods shell) 0.1 — built-in commands', 'muted'), line('')]
    order.forEach((cat, i) => {
      const head = `${i === 0 ? '┌' : '├'}─[ `
      const padLen = Math.max(0, FRAME_WIDTH - head.length - cat.length - 2)
      lines.push(htmlLine(`${head}<span class="line-success">${cat}</span> ]${'─'.repeat(padLen)}`))
      for (const c of groups.get(cat)!) {
        lines.push(htmlLine(`│  ${cmdLink(c.name)}${' '.repeat(width - c.name.length)}${c.description}`))
      }
    })
    lines.push(line(`└${'─'.repeat(FRAME_WIDTH - 1)}`))
    lines.push(line(''))
    lines.push(line('tip: TAB completes · ↑/↓ history · Ctrl+L clears', 'muted'))
    lines.push(line('there is more than what is listed here. explore.', 'muted'))
    return { lines }
  },
}
