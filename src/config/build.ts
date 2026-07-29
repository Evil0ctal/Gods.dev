/**
 * Build-time provenance, injected by vite `define` in astro.config.mjs.
 * In non-build contexts (unit tests) the values are absent and fall back, so
 * importing this module is always safe.
 */

export interface ChangeEntry {
  sha: string
  date: string // ISO
  subject: string
}

export const BUILD = {
  sha: (import.meta.env.BUILD_SHA as string | undefined) || 'dev',
  date: (import.meta.env.BUILD_DATE as string | undefined) || '',
  time: (import.meta.env.BUILD_TIME as string | undefined) || '',
} as const

export const CHANGELOG: ChangeEntry[] = parseChangelog(import.meta.env.CHANGELOG as string | undefined)

function parseChangelog(raw?: string): ChangeEntry[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as ChangeEntry[]).filter((e) => e && e.sha) : []
  } catch {
    return []
  }
}
