/**
 * Date-driven festival detection (pure). Each festival has a canonical anchor
 * day; it is "active" on the anchor ± 2 days (a 5-day window). Returns the
 * festival — theme id + greeting + emoji + effect — or null. Drives seasonal
 * palettes and the on-arrival festive effect.
 */

export type FestiveEffect = 'fireworks' | 'snow' | 'hearts' | 'spooky'

export interface Festival {
  id: string
  theme: string
  emoji: string
  greeting: string
  effect: FestiveEffect
  egg?: 'birthday'
}

interface FestivalDef extends Festival {
  anchor: [number, number] // [month, day]
}

const RADIUS = 2

// Lunar New Year (day 1) anchors by year — variable, so needs the year.
const LUNAR_NEW_YEAR: Record<number, [number, number]> = {
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
}

const FESTIVALS: FestivalDef[] = [
  // birthday first — highest priority
  { id: 'birthday', anchor: [10, 22], theme: 'birthday', emoji: '🎂', effect: 'fireworks', egg: 'birthday', greeting: 'Happy Birthday, Evil0ctal!' },
  { id: 'halloween', anchor: [10, 31], theme: 'halloween', emoji: '🎃', effect: 'spooky', greeting: 'Happy Halloween — the daemons are loose.' },
  { id: 'christmas', anchor: [12, 25], theme: 'christmas', emoji: '🎄', effect: 'snow', greeting: 'Merry Christmas from the machine.' },
  { id: 'newyear', anchor: [1, 1], theme: 'newyear', emoji: '🎆', effect: 'fireworks', greeting: 'Happy New Year — recompiling the calendar.' },
  { id: 'valentine', anchor: [2, 14], theme: 'valentine', emoji: '❤', effect: 'hearts', greeting: 'Roses are #ff0000, violets are #0000ff.' },
]

const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
function dayOfYear(month: number, day: number): number {
  return CUM_DAYS[month - 1]! + day
}

/** true when (month,day) is within `radius` days of the anchor, wrapping the year */
export function withinDays(
  month: number,
  day: number,
  anchor: [number, number],
  radius = RADIUS,
): boolean {
  const a = dayOfYear(month, day)
  const b = dayOfYear(anchor[0], anchor[1])
  const diff = Math.abs(a - b)
  return Math.min(diff, 365 - diff) <= radius
}

function strip(f: FestivalDef): Festival {
  const { anchor: _anchor, ...rest } = f
  return rest
}

/**
 * @param month 1-12  @param day 1-31  @param year optional (only for lunar)
 */
export function activeFestival(month: number, day: number, year?: number): Festival | null {
  for (const f of FESTIVALS) {
    if (withinDays(month, day, f.anchor)) return strip(f)
  }
  if (year && LUNAR_NEW_YEAR[year]) {
    if (withinDays(month, day, LUNAR_NEW_YEAR[year]!)) {
      return { id: 'lunar', theme: 'lunar', emoji: '🧧', effect: 'fireworks', greeting: '新年快乐 — Happy Lunar New Year!' }
    }
  }
  return null
}

/** convenience for the current date */
export function festivalToday(now: Date = new Date()): Festival | null {
  return activeFestival(now.getMonth() + 1, now.getDate(), now.getFullYear())
}
