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
