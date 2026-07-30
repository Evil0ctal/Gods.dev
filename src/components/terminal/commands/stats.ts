import type { Command, OutputLine, StatsMeta } from '../core/types'
import { line, htmlLine, headLine, ruleLine, kvLine, aLink, escapeHtml } from '../core/utils'

const PROFILE = 'https://github.com/Evil0ctal'

function fmt(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`
}

/** contribution count → 5 intensity levels (GitHub-style) */
export function heatLevel(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 9) return 3
  return 4
}

/** an ASCII contribution heatmap: 7 rows (Sun..Sat) × one column per week */
export function heatmapLines(c?: { total: number; weeks: number[][] } | null): OutputLine[] {
  if (!c || c.weeks.length === 0) return []
  const rows: string[] = []
  for (let day = 0; day < 7; day++) {
    let row = ''
    for (const week of c.weeks) {
      const cell = week[day] ?? -1
      row += cell < 0 ? ' ' : `<span class="hm hm-${heatLevel(cell)}">█</span>`
    }
    rows.push(row)
  }
  return [
    line(''),
    htmlLine(`<span class="out-head">contributions</span> <span class="line-success">${c.total}</span> <span class="line-muted">in the last year</span>`),
    htmlLine(`<span class="hm-grid">${rows.join('\n')}</span>`),
    htmlLine(
      `<span class="line-muted">less</span> ${[0, 1, 2, 3, 4].map((l) => `<span class="hm hm-${l}">█</span>`).join('')} <span class="line-muted">more</span>`,
    ),
  ]
}

/** pure renderer — the `stats` command is a thin wrapper so this is unit-tested */
export function renderStats(stats: StatsMeta | null): OutputLine[] {
  if (!stats) {
    return [
      headLine('github · Evil0ctal'),
      line('stats unavailable — the GitHub API was unreachable when this build ran.', 'muted'),
      htmlLine(`profile: ${aLink(PROFILE, 'github.com/Evil0ctal')}`),
    ]
  }
  const out: OutputLine[] = [
    headLine('github · Evil0ctal'),
    ruleLine(48),
    kvLine('repos', String(stats.publicRepos), 11),
    kvLine('stars', `${fmt(stats.totalStars)} total across public repos`, 11),
    kvLine('followers', String(stats.followers), 11),
    kvLine('since', stats.memberSince || 'unknown', 11),
  ]
  if (stats.latest) {
    out.push(kvLine('latest', `${stats.latest.name} · ${stats.latest.date}`, 11))
  }
  out.push(...heatmapLines(stats.contributions))
  if (stats.languages.length) {
    const max = Math.max(...stats.languages.map((l) => l.count))
    const nameW = Math.max(...stats.languages.map((l) => l.name.length))
    out.push(line(''))
    out.push(htmlLine('<span class="out-head">languages</span> <span class="line-muted">(by public repo count)</span>'))
    for (const l of stats.languages) {
      const bar = '█'.repeat(Math.max(1, Math.round((l.count / max) * 16)))
      out.push(
        htmlLine(
          `  <span class="kv-key">${escapeHtml(l.name.padEnd(nameW))}</span>  <span class="line-success">${bar}</span> <span class="muted">${l.count}</span>`,
        ),
      )
    }
  }
  out.push(line(''))
  out.push(htmlLine(`<span class="line-muted">baked at build time from the GitHub API ·</span> ${aLink(PROFILE, 'github.com/Evil0ctal')}`))
  return out
}

export const statsCmd: Command = {
  name: 'stats',
  description: 'live GitHub stats (baked at build)',
  category: 'intel',
  run(_args, ctx) {
    return { lines: renderStats(ctx.stats) }
  },
}
