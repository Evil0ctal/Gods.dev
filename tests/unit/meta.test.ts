import { describe, it, expect } from 'vitest'
import type { CommandResult } from '../../src/components/terminal/core/types'
import type { ChangeEntry } from '../../src/config/build'
import { timeQuip } from '../../src/components/terminal/core/timequip'
import { newSince, renderChangelog } from '../../src/components/terminal/core/changelog'
import { buildCmd, whatsnewCmd, usesCmd } from '../../src/components/terminal/commands/meta'
import { dateCmd } from '../../src/components/terminal/commands/basic'
import { makeCtx } from './helpers'

describe('timeQuip', () => {
  it('flags a real Friday the 13th regardless of hour', () => {
    for (let i = 0; i < 800; i++) {
      const d = new Date(2026, 0, 1 + i, 10)
      if (d.getDay() === 5 && d.getDate() === 13) {
        expect(timeQuip(d)).toContain('Friday the 13th')
        return
      }
    }
    throw new Error('no Friday the 13th found in the scan window')
  })
  it('has hour-based quips and stays quiet during the day', () => {
    // pick a plain day (Jan 6 2026 is not a Friday the 13th)
    const at = (h: number) => timeQuip(new Date(2026, 0, 6, h))
    expect(at(0)).toContain('midnight')
    expect(at(3)).toContain('hacker hours')
    expect(at(6)).toContain('early')
    expect(at(23)).toContain('midnight oil')
    expect(at(14)).toBeNull()
  })
})

describe('newSince', () => {
  const entries: ChangeEntry[] = [
    { sha: 'aaa', date: '2026-07-29T10:00:00Z', subject: 'feat: three' },
    { sha: 'bbb', date: '2026-07-28T10:00:00Z', subject: 'fix: two' },
    { sha: 'ccc', date: '2026-07-27T10:00:00Z', subject: 'chore: one' },
  ]
  it('returns 0 on a first visit (no baseline)', () => {
    expect(newSince(entries, null)).toBe(0)
  })
  it('counts entries newer than the last-seen sha', () => {
    expect(newSince(entries, 'aaa')).toBe(0)
    expect(newSince(entries, 'bbb')).toBe(1)
    expect(newSince(entries, 'ccc')).toBe(2)
  })
  it('counts the whole window when the seen sha has scrolled out', () => {
    expect(newSince(entries, 'zzz')).toBe(3)
  })
})

describe('renderChangelog', () => {
  const entries: ChangeEntry[] = [
    { sha: 'aaa', date: '2026-07-29T10:00:00Z', subject: 'feat: three' },
    { sha: 'bbb', date: '2026-07-28T10:00:00Z', subject: 'fix: two' },
  ]
  it('reports an empty build gracefully', () => {
    expect(renderChangelog([], null)[0]?.text).toContain('no changelog')
  })
  it('lists commits and shows no counter on a first visit', () => {
    const text = renderChangelog(entries, null).map((l) => l.text).join('\n')
    expect(text).toContain('changelog')
    expect(text).toContain('feat: three')
    expect(text).not.toContain('new</span> <span class="line-muted">since')
  })
  it('shows an "N new since your last visit" badge for returning visitors', () => {
    const text = renderChangelog(entries, 'bbb').map((l) => l.text).join('\n')
    expect(text).toContain('1 new')
    expect(text).toContain('since your last visit')
  })
})

describe('meta commands', () => {
  const sync = (r: CommandResult | Promise<CommandResult>) => r as CommandResult
  it('build prints a provenance receipt', () => {
    const text = sync(buildCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('build receipt')
    expect(text).toContain('commit')
    expect(buildCmd.category).toBe('intel')
  })
  it('uses lists the toolchain groups', () => {
    const text = sync(usesCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('uses')
    expect(text).toContain('Frida')
    expect(text).toContain('reverse engineering')
  })
  it('whatsnew renders without throwing when no changelog is baked (unit env)', () => {
    // CHANGELOG is empty outside a real build; localStorage access is guarded
    const res = sync(whatsnewCmd.run([], makeCtx()))
    expect(res.lines.length).toBeGreaterThan(0)
  })
  it('date appends a quip only at special hours', () => {
    const res = sync(dateCmd.run([], makeCtx()))
    expect(res.lines.length).toBeGreaterThanOrEqual(1) // always the date; quip depends on the clock
  })
})
