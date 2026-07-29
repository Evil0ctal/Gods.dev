import type { Command } from '../core/types'
import { htmlLine, line } from '../core/utils'
import { sha256Hex } from '../core/flags'
import { ASCENSION_SHA256, ASCENDED_KEY } from '../../../data/ascension'

function isAscended(): boolean {
  try {
    return localStorage.getItem(ASCENDED_KEY) === '1'
  } catch {
    return false
  }
}

export const ascendCmd: Command = {
  name: 'ascend',
  description: 'rise above guest (if you have earned it)',
  usage: 'ascend <word>',
  hidden: true,
  async run(args, ctx) {
    const word = args.join(' ').trim().toLowerCase()
    if (!word) {
      if (isAscended()) {
        return { lines: [line('You have already ascended. The crown is yours, wanderer.', 'muted')] }
      }
      return {
        lines: [
          line('ascend: the way up is assembled, not given.', 'muted'),
          line('three fragments are scattered — the console, a kernel panic, and /proc.', 'muted'),
          line('join them, decode, and speak the word: ascend <word>', 'muted'),
        ],
      }
    }

    const hash = await sha256Hex(word)
    if (hash !== ASCENSION_SHA256) {
      return { lines: [line('The gate does not open for that word.', 'error')] }
    }

    if (isAscended()) {
      return { lines: [line('You have already ascended. The crown remains yours.', 'muted')] }
    }
    try {
      localStorage.setItem(ASCENDED_KEY, '1')
    } catch {
      /* private mode — ascension lasts only this session */
    }
    ctx.setTheme('aureus') // don the gold

    return {
      lines: [
        htmlLine('<span class="out-name">✦ ✦ ✦   A P O T H E O S I S   ✦ ✦ ✦</span>', 'success'),
        line(''),
        line('The fragments align. The gate that was shut to guest swings open.', 'success'),
        line('You are no longer merely passing through — you have ascended.', 'success'),
        line(''),
        htmlLine('<span class="line-muted">the gold is yours: theme </span><span class="out-name">aureus</span><span class="line-muted"> is unlocked, and a ✦ now rides your prompt. tell no one.</span>'),
      ],
    }
  },
}
