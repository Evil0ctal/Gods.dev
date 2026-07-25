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
