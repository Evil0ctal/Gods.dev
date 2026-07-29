import { describe, it, expect } from 'vitest'
import type { CommandResult, StatsMeta } from '../../src/components/terminal/core/types'
import { renderStats, statsCmd } from '../../src/components/terminal/commands/stats'
import { makeCtx } from './helpers'

const SAMPLE: StatsMeta = {
  publicRepos: 42,
  followers: 1500,
  following: 30,
  totalStars: 2500,
  languages: [
    { name: 'Python', count: 18 },
    { name: 'TypeScript', count: 7 },
    { name: 'Go', count: 3 },
  ],
  latest: { name: 'Douyin_TikTok_Download_API', date: '2026-07-20' },
  memberSince: '2019',
}

describe('renderStats', () => {
  it('renders totals, a language bar, and the latest repo', () => {
    const text = renderStats(SAMPLE).map((l) => l.text).join('\n')
    expect(text).toContain('github · Evil0ctal')
    expect(text).toContain('42') // repos
    expect(text).toContain('2.5k') // stars formatted
    expect(text).toContain('Python')
    expect(text).toContain('Douyin_TikTok_Download_API')
    expect(text).toContain('2019') // member since
  })
  it('bars scale to the most-used language', () => {
    const html = renderStats(SAMPLE).map((l) => l.text)
    const python = html.find((t) => t.includes('Python'))!
    const go = html.find((t) => t.includes('Go</span>') || /Go\s*<\/span>/.test(t)) || html.find((t) => t.includes('Go'))!
    const bars = (s: string) => (s.match(/█/g) ?? []).length
    expect(bars(python)).toBeGreaterThan(bars(go))
  })
  it('degrades gracefully when stats are unavailable', () => {
    const text = renderStats(null).map((l) => l.text).join('\n')
    expect(text).toContain('unavailable')
    expect(text).toContain('github.com/Evil0ctal')
  })
})

describe('stats command', () => {
  const sync = (r: CommandResult | Promise<CommandResult>) => r as CommandResult
  it('reads stats from context and is in the intel group', () => {
    const res = sync(statsCmd.run([], makeCtx({ stats: SAMPLE })))
    expect(res.lines.map((l) => l.text).join('\n')).toContain('2.5k')
    expect(statsCmd.category).toBe('intel')
  })
  it('handles a null-stats context (API was down at build)', () => {
    const res = sync(statsCmd.run([], makeCtx()))
    expect(res.lines.map((l) => l.text).join('\n')).toContain('unavailable')
  })
})
