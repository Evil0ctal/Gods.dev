import { describe, it, expect } from 'vitest'
import type { CommandResult } from '../../src/components/terminal/core/types'
import { activeFestival, festivalToday } from '../../src/components/terminal/core/festivals'
import { melody, fanfare, bootJingle } from '../../src/components/terminal/core/sound'
import { birthdayCmd, fireworksCmd } from '../../src/components/terminal/commands/games'
import { THEMES, SEASONAL_THEMES } from '../../src/components/terminal/commands/theme'
import { makeCtx } from './helpers'

describe('activeFestival', () => {
  it('fires the birthday egg across Oct 20-24 (anchor 22 ± 2)', () => {
    expect(activeFestival(10, 19)).toBeNull()
    for (const d of [20, 21, 22, 23, 24]) {
      const f = activeFestival(10, d)
      expect(f?.id, `oct ${d}`).toBe('birthday')
      expect(f?.egg).toBe('birthday')
      expect(f?.theme).toBe('birthday')
      expect(f?.effect).toBe('fireworks')
    }
    expect(activeFestival(10, 25)?.id).not.toBe('birthday')
  })
  it('detects the common holidays with a ±2 day window and an effect each', () => {
    expect(activeFestival(10, 31)?.id).toBe('halloween')
    expect(activeFestival(11, 1)?.id).toBe('halloween') // 31 + 1, window wraps the month
    expect(activeFestival(10, 31)?.effect).toBe('spooky')
    expect(activeFestival(12, 25)?.effect).toBe('snow')
    expect(activeFestival(12, 23)?.id).toBe('christmas')
    expect(activeFestival(12, 31)?.id).toBe('newyear') // Jan 1 anchor, window wraps the year
    expect(activeFestival(1, 1)?.id).toBe('newyear')
    expect(activeFestival(2, 14)?.effect).toBe('hearts')
  })
  it('uses the lunar table when a year is given', () => {
    expect(activeFestival(2, 17, 2026)?.id).toBe('lunar')
    expect(activeFestival(2, 17)).toBeNull() // no year → no lunar match
  })
  it('returns null on an ordinary day', () => {
    expect(activeFestival(7, 4)).toBeNull()
  })
  it('festivalToday delegates to the current date', () => {
    // just proves it runs and returns a Festival|null shape
    const f = festivalToday(new Date('2026-10-22T12:00:00'))
    expect(f?.id).toBe('birthday')
  })
  it('every festival theme is a registered theme id', () => {
    for (const t of SEASONAL_THEMES) expect(THEMES as readonly string[]).toContain(t)
  })
})

describe('sound melodies never throw in a headless env', () => {
  it('melody / fanfare / bootJingle are safe no-ops when disabled', () => {
    expect(() => melody([440, 550])).not.toThrow()
    expect(() => fanfare()).not.toThrow()
    expect(() => bootJingle()).not.toThrow()
  })
})

describe('birthday & fireworks commands', () => {
  const sync = (r: CommandResult | Promise<CommandResult>) => r as CommandResult
  it('trigger the fireworks effect and stay hidden', () => {
    expect(birthdayCmd.hidden).toBe(true)
    expect(fireworksCmd.hidden).toBe(true)
    expect(sync(birthdayCmd.run([], makeCtx())).effect).toBe('fireworks')
    expect(sync(fireworksCmd.run([], makeCtx())).effect).toBe('fireworks')
  })
  it('birthday greets the operator', () => {
    const text = sync(birthdayCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('HAPPY BIRTHDAY')
    expect(text).toContain('Evil0ctal')
  })
})
