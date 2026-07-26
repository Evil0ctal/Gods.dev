import type { Command } from '../core/types'
import {
  CHALLENGES,
  findChallenge,
  orderedChallenges,
  rankTitle,
  scoreOf,
  totalPoints,
} from '../core/challenges'
import { cmdLink, escapeHtml, htmlLine, line } from '../core/utils'

const DIFF_LABEL: Record<string, string> = {
  intro: 'intro ',
  easy: 'easy  ',
  medium: 'medium',
  hard: 'hard  ',
}

function scoreboardLines(solved: string[]) {
  const score = scoreOf(solved)
  const total = totalPoints()
  const count = new Set(solved).size
  return [
    line(
      `score: ${score}/${total} pts · solved ${count}/${CHALLENGES.length} · rank: ${rankTitle(solved)}`,
      'success',
    ),
  ]
}

function listView(solved: string[]) {
  const solvedSet = new Set(solved)
  const rows = orderedChallenges().map((c) => {
    const mark = solvedSet.has(c.id) ? '<span class="line-success">[✓]</span>' : '[ ]'
    const meta = `<span class="muted">${DIFF_LABEL[c.difficulty] ?? c.difficulty} · ${c.category} · ${String(c.points).padStart(3)}pt</span>`
    return htmlLine(`  ${mark} ${cmdLink(`ctf ${c.id}`, c.id.padEnd(20))} ${meta}`)
  })
  return {
    lines: [
      line('┌─ gods.dev CTF ──────────────────────────────────────┐', 'muted'),
      line('│ capture the flags. they look like gods{...}.         │', 'muted'),
      line('│ each one is hidden somewhere on this site.           │', 'muted'),
      line('└─────────────────────────────────────────────────────┘', 'muted'),
      line(''),
      ...scoreboardLines(solved),
      line(''),
      ...rows,
      line(''),
      htmlLine(`details: ${cmdLink('ctf <id>', 'ctf &lt;id&gt;')}  ·  submit: flag submit gods{...}`),
    ],
  }
}

function detailView(id: string, solved: string[]) {
  const c = findChallenge(id)
  if (!c) {
    return {
      lines: [
        line(`ctf: no such challenge: ${id}`, 'error'),
        htmlLine(`run ${cmdLink('ctf', 'ctf')} to list them.`),
      ],
    }
  }
  const done = new Set(solved).has(c.id)
  const lines = [
    htmlLine(
      `<span class="line-success">${escapeHtml(c.name)}</span>  <span class="muted">[${c.difficulty} · ${c.category} · ${c.points}pt]${done ? ' — ✓ captured' : ''}</span>`,
    ),
    line(''),
    ...c.prompt.split('\n').map((p) => line(p)),
    line(''),
    line(`where: ${c.where}`, 'muted'),
  ]
  if (c.artifact) {
    lines.push(line(''))
    lines.push(line(c.artifact))
  }
  lines.push(line(''))
  lines.push(
    htmlLine(
      `stuck? ${cmdLink(`ctf ${c.id} hint`, `ctf ${c.id} hint`)} (${c.hints.length} available)  ·  then: flag submit gods{...}`,
    ),
  )
  return { lines }
}

function hintView(id: string, nRaw: string | undefined) {
  const c = findChallenge(id)
  if (!c) return { lines: [line(`ctf: no such challenge: ${id}`, 'error')] }
  const n = nRaw ? Number(nRaw) : 1
  if (!Number.isInteger(n) || n < 1 || n > c.hints.length) {
    return {
      lines: [line(`ctf: hint out of range. ${c.name} has ${c.hints.length} hints (1-${c.hints.length}).`, 'error')],
    }
  }
  return {
    lines: [
      line(`hint ${n}/${c.hints.length} — ${c.name}`, 'muted'),
      line(`  ${c.hints[n - 1]}`),
      ...(n < c.hints.length
        ? [htmlLine(`next: ${cmdLink(`ctf ${c.id} hint ${n + 1}`, `ctf ${c.id} hint ${n + 1}`)}`)]
        : [line('that was the last hint. the rest is on you.', 'muted')]),
    ],
  }
}

export const ctfCmd: Command = {
  name: 'ctf',
  description: 'capture-the-flag challenges',
  usage: 'ctf [<id> [hint [n]]] | scoreboard',
  category: 'ctf',
  run(args, ctx) {
    const solved = ctx.ctf.solved()
    if (args.length === 0) return listView(solved)
    const sub = args[0]!.toLowerCase()
    if (sub === 'scoreboard' || sub === 'score') {
      return {
        lines: [
          ...scoreboardLines(solved),
          htmlLine(`list: ${cmdLink('ctf', 'ctf')}`),
        ],
      }
    }
    if (args[1] === 'hint') return hintView(sub, args[2])
    return detailView(sub, solved)
  },
}
