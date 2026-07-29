import type { Command } from '../core/types'
import { cmdLink, htmlLine, line } from '../core/utils'

export const CORE_THEMES = ['default', 'crt', 'amber', 'light'] as const
export const SEASONAL_THEMES = ['birthday', 'halloween', 'christmas', 'newyear', 'lunar', 'valentine'] as const
/** unlocked by the ASCENSION arg — a valid theme, but never shown in the menu */
export const SECRET_THEMES = ['aureus'] as const
export const THEMES = [...CORE_THEMES, ...SEASONAL_THEMES, ...SECRET_THEMES] as const
export type ThemeName = (typeof THEMES)[number]

const DESCRIPTIONS: Record<string, string> = {
  default: 'tokyo night — the modern operator',
  crt: 'green phosphor — 1978 called',
  amber: 'amber mono — VT220 nostalgia',
  light: 'light mode — why would you do this',
}

export const themeCmd: Command = {
  name: 'theme',
  description: 'switch the terminal theme',
  category: 'shell',
  usage: 'theme [name]',
  run(args, ctx) {
    const target = args[0]?.toLowerCase()
    if (!target) {
      return {
        lines: [
          line('Available themes (click to apply):', 'muted'),
          ...CORE_THEMES.map((t) => {
            const current = t === ctx.getTheme() ? ' (current)' : ''
            return htmlLine(`  ${cmdLink(`theme ${t}`, `${t}${current}`)}  ${DESCRIPTIONS[t]}`)
          }),
          line(''),
          htmlLine(
            `<span class="muted">seasonal:</span> ${SEASONAL_THEMES.map((t) => cmdLink(`theme ${t}`, t)).join('  ')}`,
          ),
          line('(seasonal palettes also apply on their own dates)', 'muted'),
        ],
      }
    }
    if (!ctx.setTheme(target)) {
      return { lines: [line(`theme: unknown theme '${target}'. try: theme`, 'error')] }
    }
    const quip =
      target === 'light'
        ? 'Your eyes. Your funeral. You will regret this bright decision.'
        : `Theme set: ${target}`
    return { lines: [line(quip, target === 'light' ? 'muted' : 'success')] }
  },
}
