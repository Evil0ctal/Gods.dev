import type { Challenge } from './challenges'
import { CHALLENGES, challengeTrack } from './challenges'

/** an achievement derived purely from which challenges are solved */
export interface Badge {
  id: string
  label: string
  icon: string
  desc: string
  earned: boolean
}

interface Rule {
  id: string
  label: string
  icon: string
  desc: string
  test: (solved: Set<string>, ch: Challenge[]) => boolean
}

const solvedCount = (solved: Set<string>, ch: Challenge[]) => ch.filter((c) => solved.has(c.id)).length
const clears = (solved: Set<string>, ch: Challenge[], pred: (c: Challenge) => boolean) => {
  const group = ch.filter(pred)
  return group.length > 0 && group.every((c) => solved.has(c.id))
}

const RULES: Rule[] = [
  { id: 'first-blood', label: 'First Blood', icon: '🩸', desc: 'capture your first flag', test: (s, ch) => solvedCount(s, ch) >= 1 },
  { id: 'halfway', label: 'Halfway There', icon: '📈', desc: 'solve half the board', test: (s, ch) => solvedCount(s, ch) >= Math.ceil(ch.length / 2) },
  { id: 'recon-clear', label: 'Recon Cleared', icon: '🛰', desc: 'solve every RECON challenge', test: (s, ch) => clears(s, ch, (c) => challengeTrack(c) === 'recon') },
  { id: 'field-ops-clear', label: 'Field Ops Cleared', icon: '🎯', desc: 'solve every FIELD OPS challenge', test: (s, ch) => clears(s, ch, (c) => challengeTrack(c) === 'field-ops') },
  { id: 'reverser', label: 'Reverser', icon: '🔩', desc: 'solve every reversing challenge', test: (s, ch) => clears(s, ch, (c) => c.category === 'reversing') },
  { id: 'god', label: 'God of gods.dev', icon: '👑', desc: 'capture every flag', test: (s, ch) => ch.length > 0 && solvedCount(s, ch) === ch.length },
]

/** every badge with its earned state, in display order */
export function earnedBadges(solvedIds: string[], challenges: Challenge[] = CHALLENGES): Badge[] {
  const solved = new Set(solvedIds)
  return RULES.map((r) => ({ id: r.id, label: r.label, icon: r.icon, desc: r.desc, earned: r.test(solved, challenges) }))
}

export function earnedCount(solvedIds: string[], challenges: Challenge[] = CHALLENGES): number {
  return earnedBadges(solvedIds, challenges).filter((b) => b.earned).length
}
