import type { Command } from '../core/types'
import type { Challenge } from '../core/challenges'
import { checkFlag } from '../core/flags'
import { CHALLENGES, rankTitle, scoreOf, totalPoints } from '../core/challenges'
import { cmdLink, htmlLine, line } from '../core/utils'

export interface FlagDeps {
  /** returns the matched challenge, or null. Default: hash-check against CHALLENGES. */
  check: (submission: string) => Promise<Challenge | null>
}

function scoreLines(solved: string[]) {
  return [
    line(
      `score: ${scoreOf(solved)}/${totalPoints()} pts · solved ${new Set(solved).size}/${CHALLENGES.length} · rank: ${rankTitle(solved)}`,
      'muted',
    ),
  ]
}

export function createFlagCmd(deps: FlagDeps): Command {
  return {
    name: 'flag',
    description: 'submit a captured flag',
    usage: 'flag submit <flag>',
    hidden: true,
    async run(args, ctx) {
      if (args[0] !== 'submit' || !args[1]) {
        return {
          lines: [
            line('So you found the flag system. Good.'),
            line(`${CHALLENGES.length} flags are hidden across this site. Format: gods{...}`, 'muted'),
            htmlLine(`Browse them: ${cmdLink('ctf', 'ctf')}   ·   submit: flag submit gods{...}`),
          ],
        }
      }
      const hit = await deps.check(args.slice(1).join(' '))
      if (!hit) {
        return { lines: [line('Nope. The gods are not fooled so easily.', 'error')] }
      }

      const already = ctx.ctf.solved().includes(hit.id)
      ctx.ctf.markSolved(hit.id)
      const solved = ctx.ctf.solved()
      const cleared = new Set(solved).size >= CHALLENGES.length

      if (already) {
        return { lines: [line(`⚑ ${hit.name} — already captured. (+0)`, 'muted'), ...scoreLines(solved)] }
      }
      return {
        lines: [
          line(`⚑ CORRECT — "${hit.name}" captured!  +${hit.points} pts`, 'success'),
          ...scoreLines(solved),
          cleared
            ? line('ALL FLAGS CAPTURED. you are a god of gods.dev. tell no one.', 'success')
            : htmlLine(`next target: ${cmdLink('ctf', 'ctf')}`),
        ],
      }
    },
  }
}

export const flagCmd = createFlagCmd({ check: (s) => checkFlag(s) })
