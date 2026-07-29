/**
 * A small, local-time-aware aside for the `date` command and the once-a-session
 * arrival line. Pure and total: returns a quip or null. No date mutation.
 */
export function timeQuip(d: Date): string | null {
  const h = d.getHours()
  const dow = d.getDay() // 0 = Sunday
  const dom = d.getDate()

  if (dow === 5 && dom === 13) return 'Friday the 13th — mind the segfaults.'
  if (h === 0) return 'midnight. the daemons are awake.'
  if (h >= 1 && h < 5) return 'hacker hours. respect.'
  if (h >= 5 && h < 7) return 'up early — or still up?'
  if (h >= 22) return 'burning the midnight oil.'
  return null
}
