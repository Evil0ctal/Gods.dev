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
