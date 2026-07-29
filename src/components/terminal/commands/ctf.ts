import type { Command, OutputLine } from '../core/types'
import {
  CHALLENGES,
  TRACKS,
  challengeTrack,
  findChallenge,
  orderedChallenges,
  rankTitle,
  scoreOf,
  totalPoints,
} from '../core/challenges'
import type { Challenge } from '../core/challenges'
import { earnedBadges, earnedCount } from '../core/badges'
import { badge, cmdLink, escapeHtml, htmlLine, line } from '../core/utils'
import type { BadgeVariant } from '../core/utils'

function scoreboardLines(solved: string[]) {
  const score = scoreOf(solved)
  const total = totalPoints()
  const count = new Set(solved).size
  const pct = total > 0 ? Math.round((score / total) * 20) : 0
  const bar = '█'.repeat(pct) + '░'.repeat(20 - pct)
  return [
    htmlLine(
      `<span class="out-name">${score}</span><span class="muted">/${total} pts</span>  <span class="out-rule">${bar}</span>  solved <span class="line-success">${count}</span><span class="muted">/${CHALLENGES.length}</span>  ·  rank <span class="badge badge-ok">${escapeHtml(rankTitle(solved))}</span>`,
    ),
  ]
}

function challengeRow(c: Challenge, done: boolean): OutputLine {
  const mark = done ? '<span class="line-success">✓</span>' : '<span class="line-muted">○</span>'
  const nameCls = done ? 'cmd-link out-name' : 'cmd-link'
  const nameBtn = `<button type="button" class="${nameCls}" data-cmd="ctf ${escapeHtml(c.id)}">${escapeHtml(c.id.padEnd(20))}</button>`
  const meta = `${badge(c.difficulty, c.difficulty as BadgeVariant)} ${badge(c.category, 'cat')} <span class="muted">${c.points}pt</span>`
  return htmlLine(`  ${mark}  ${nameBtn}  ${meta}`)
}

function listView(solved: string[]) {
  const solvedSet = new Set(solved)
  const ordered = orderedChallenges()
  const sections: OutputLine[] = []
  for (const t of TRACKS) {
    const inTrack = ordered.filter((c) => challengeTrack(c) === t.id)
    if (inTrack.length === 0) continue
    const cleared = inTrack.filter((c) => solvedSet.has(c.id)).length
    sections.push(line(''))
    sections.push(
      htmlLine(
        `<span class="out-head">▸ ${escapeHtml(t.label)}</span> <span class="line-muted">${escapeHtml(t.blurb)}</span> <span class="muted">(${cleared}/${inTrack.length})</span>`,
      ),
    )
    for (const c of inTrack) sections.push(challengeRow(c, solvedSet.has(c.id)))
  }
  return {
    lines: [
      htmlLine('<span class="out-head">gods.dev CTF</span> <span class="muted">— capture flags hidden across the site. they look like</span> <span class="badge badge-cat">gods{...}</span>'),
      line(''),
      ...scoreboardLines(solved),
      ...sections,
      line(''),
      htmlLine(
        `<span class="line-muted">badges</span> <span class="line-success">${earnedCount(solved)}</span><span class="muted">/${earnedBadges(solved).length}</span> <span class="line-muted">earned  ·</span> ${cmdLink('ctf badges', 'ctf badges')}`,
      ),
      line('details  →  ctf <id>   ·   submit  →  flag submit gods{...}', 'muted'),
    ],
  }
}

function badgesView(solved: string[]) {
  const badges = earnedBadges(solved)
  const got = badges.filter((b) => b.earned).length
  const rows = badges.map((b) => {
    if (b.earned) {
      return htmlLine(`  <span class="line-success">${escapeHtml(b.icon)} ${escapeHtml(b.label)}</span> <span class="line-muted">— ${escapeHtml(b.desc)}</span>`)
    }
    return htmlLine(`  <span class="line-muted">🔒 ${escapeHtml(b.label)} — ${escapeHtml(b.desc)}</span>`)
  })
  return {
    lines: [
      htmlLine(`<span class="out-head">badges</span> <span class="muted">— ${got}/${badges.length} earned</span>`),
      line(''),
      ...rows,
      line(''),
      htmlLine(`back to the board: ${cmdLink('ctf', 'ctf')}`),
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
      `<span class="out-name">${escapeHtml(c.name)}</span>  ${badge(c.difficulty, c.difficulty as BadgeVariant)} ${badge(c.category, 'cat')} <span class="muted">${c.points}pt</span>${done ? '  <span class="line-success">✓ captured</span>' : ''}`,
    ),
    line(''),
    ...c.prompt.split('\n').map((p) => line(p)),
    line(''),
    htmlLine(`<span class="kv-key">where</span>  ${escapeHtml(c.where)}`),
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
    if (sub === 'badges' || sub === 'badge') return badgesView(solved)
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
