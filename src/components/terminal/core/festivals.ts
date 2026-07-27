/**
 * Date-driven festival detection (pure). Given a month/day (+year for the
 * lunar table), returns the active festival — a theme id + greeting + emoji —
 * or null. Drives seasonal palettes and the birthday easter egg.
 */

export interface Festival {
  id: string
  /** matching data-theme palette id */
  theme: string
  emoji: string
  greeting: string
  /** special egg to fire on arrival */
  egg?: 'birthday'
}

// Lunar New Year (Chinese New Year) day-1 dates — [month, day] by year.
const LUNAR_NEW_YEAR: Record<number, [number, number]> = {
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
}

function inWindow(day: number, start: number, end: number): boolean {
  return day >= start && day <= end
}

/**
 * @param month 1-12
 * @param day   1-31
 * @param year  optional, needed only for the lunar-new-year window
 */
export function activeFestival(month: number, day: number, year?: number): Festival | null {
  // birthday — the operator's, Oct 22; window Oct 21-23 (highest priority)
  if (month === 10 && inWindow(day, 21, 23)) {
    return {
      id: 'birthday',
      theme: 'birthday',
      emoji: '🎂',
      greeting: 'Happy Birthday, Evil0ctal!',
      egg: 'birthday',
    }
  }
  if (month === 10 && inWindow(day, 29, 31)) {
    return { id: 'halloween', theme: 'halloween', emoji: '🎃', greeting: 'Happy Halloween — the daemons are loose.' }
  }
  if (month === 12 && inWindow(day, 20, 26)) {
    return { id: 'christmas', theme: 'christmas', emoji: '🎄', greeting: 'Merry Christmas from the machine.' }
  }
  if ((month === 12 && day === 31) || (month === 1 && inWindow(day, 1, 2))) {
    return { id: 'newyear', theme: 'newyear', emoji: '🎆', greeting: 'Happy New Year — recompiling the calendar.' }
  }
  if (month === 2 && inWindow(day, 13, 14)) {
    return { id: 'valentine', theme: 'valentine', emoji: '❤', greeting: 'Roses are #ff0000, violets are #0000ff.' }
  }
  if (year && LUNAR_NEW_YEAR[year]) {
    const [lm, ld] = LUNAR_NEW_YEAR[year]!
    if (month === lm && inWindow(day, ld - 1, ld + 1)) {
      return { id: 'lunar', theme: 'lunar', emoji: '🧧', greeting: '新年快乐 — Happy Lunar New Year!' }
    }
  }
  return null
}

/** convenience for the current date */
export function festivalToday(now: Date = new Date()): Festival | null {
  return activeFestival(now.getMonth() + 1, now.getDate(), now.getFullYear())
}
