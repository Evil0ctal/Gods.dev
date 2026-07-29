import type { Command, OutputLine, StatsMeta } from '../core/types'
import { line, htmlLine, headLine, ruleLine, kvLine, aLink, escapeHtml } from '../core/utils'

const PROFILE = 'https://github.com/Evil0ctal'

function fmt(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`
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
