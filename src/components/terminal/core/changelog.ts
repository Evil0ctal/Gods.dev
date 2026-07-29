import type { ChangeEntry } from '../../../config/build'
import type { OutputLine } from './types'
import { line, htmlLine, headLine, ruleLine, badge, escapeHtml } from './utils'

/**
 * How many entries are newer than the one the visitor last saw.
 * CHANGELOG is newest-first, so the index of the seen sha IS the new count.
 * First-ever visit (no seen sha) returns 0 — nothing to compare, no nagging.
 * A seen sha that has scrolled out of the window counts the whole window.
 */
export function newSince(entries: ChangeEntry[], seenSha: string | null): number {
  if (!seenSha) return 0
  const idx = entries.findIndex((e) => e.sha === seenSha)
  return idx === -1 ? entries.length : idx
}

/** the `whatsnew` body — pure, so both the empty and fresh paths are testable */
export function renderChangelog(entries: ChangeEntry[], seenSha: string | null): OutputLine[] {
  if (entries.length === 0) {
    return [line('whatsnew: no changelog baked into this build.', 'muted')]
  }
  const fresh = newSince(entries, seenSha)
  const out: OutputLine[] = [headLine('changelog'), ruleLine(52)]
  if (fresh > 0) {
    out.push(htmlLine(`${badge(`${fresh} new`, 'ok')} <span class="line-muted">since your last visit</span>`))
    out.push(line(''))
  }
  entries.forEach((e, i) => {
    const marker = i < fresh ? '<span class="line-success">＋</span>' : '<span class="line-muted">·</span>'
    const day = (e.date || '').slice(0, 10)
    out.push(
      htmlLine(
        `${marker} <span class="kv-key">${escapeHtml(e.sha)}</span> <span class="line-muted">${escapeHtml(day)}</span>  ${escapeHtml(e.subject || '')}`,
      ),
    )
  })
  return out
}
