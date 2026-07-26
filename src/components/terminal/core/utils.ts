import type { LineKind, OutputLine } from './types'

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** 输出中可点击执行的命令。name 只能是命令模块内的静态字符串。 */
export function cmdLink(name: string, label?: string): string {
  return `<button type="button" class="cmd-link" data-cmd="${escapeHtml(name)}">${escapeHtml(label ?? name)}</button>`
}

export function aLink(href: string, label: string): string {
  return `<a class="term-link" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
}

export function line(text: string, kind?: LineKind): OutputLine {
  return kind === undefined ? { text } : { text, kind }
}

export function htmlLine(html: string, kind?: LineKind): OutputLine {
  return { text: html, html: true, kind }
}

/* ── output styling primitives (shared design language) ────────────── */

export type BadgeVariant = 'star' | 'tag' | 'cat' | 'intro' | 'easy' | 'medium' | 'hard' | 'ok' | 'warn'

/** a rounded pill chip. text is escaped. */
export function badge(text: string, variant: BadgeVariant): string {
  return `<span class="badge badge-${variant}">${escapeHtml(text)}</span>`
}

/** render a tag list as #chips */
export function tagChips(list: string[]): string {
  return list.map((t) => `<span class="chip">#${escapeHtml(t)}</span>`).join(' ')
}

/** emphasize an entity name (accent-2, bold) */
export function name(text: string): string {
  return `<span class="out-name">${escapeHtml(text)}</span>`
}

/** a section header line: "▸ title" in accent */
export function headLine(title: string): OutputLine {
  return htmlLine(`<span class="out-head">${escapeHtml(title)}</span>`)
}

/** aligned key → value row for info tables (neofetch-style) */
export function kvLine(key: string, value: string, pad = 10): OutputLine {
  return htmlLine(`<span class="kv-key">${escapeHtml(key.padEnd(pad))}</span>${escapeHtml(value)}`)
}

/** a thin divider rule of the given width */
export function ruleLine(width = 52): OutputLine {
  return htmlLine(`<span class="out-rule">${'─'.repeat(width)}</span>`)
}
