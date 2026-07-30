import { describe, it, expect } from 'vitest'
import type { CommandResult, StatsMeta } from '../../src/components/terminal/core/types'
import { renderStats, statsCmd, heatmapLines, heatLevel } from '../../src/components/terminal/commands/stats'
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

describe('contribution heatmap', () => {
  const contributions = {
    total: 1234,
    weeks: [
      [0, 1, 3, 6, 12, -1, -1], // a partial week with each intensity level + out-of-range slots
      [2, 2, 2, 2, 2, 2, 2],
    ],
  }
  it('heatLevel buckets counts into 5 levels', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(1)).toBe(1)
    expect(heatLevel(5)).toBe(2)
    expect(heatLevel(9)).toBe(3)
    expect(heatLevel(50)).toBe(4)
  })
  it('renders 7 day-rows, the total, and a legend', () => {
    const text = heatmapLines(contributions).map((l) => l.text).join('\n')
    expect(text).toContain('contributions')
    expect(text).toContain('1234')
    expect(text).toContain('hm-grid')
    expect(text).toContain('hm-4') // the level-4 cell from count 12
    // 7 day rows inside the grid
    const grid = heatmapLines(contributions).find((l) => l.text.includes('hm-grid'))!.text
    expect(grid.split('\n').length).toBe(7)
  })
  it('is empty when there is no calendar', () => {
    expect(heatmapLines(null)).toEqual([])
    expect(heatmapLines({ total: 0, weeks: [] })).toEqual([])
  })
  it('renderStats includes the heatmap when contributions are present', () => {
    const text = renderStats({ ...SAMPLE, contributions }).map((l) => l.text).join('\n')
    expect(text).toContain('contributions')
    expect(text).toContain('hm-grid')
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
