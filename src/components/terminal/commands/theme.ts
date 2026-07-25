import type { Command } from '../core/types'
import { cmdLink, htmlLine, line } from '../core/utils'

export const THEMES = ['default', 'crt', 'amber', 'light'] as const
export type ThemeName = (typeof THEMES)[number]

const DESCRIPTIONS: Record<ThemeName, string> = {
  default: 'tokyo night — the modern operator',
  crt: 'green phosphor — 1978 called',
  amber: 'amber mono — VT220 nostalgia',
  light: 'light mode — why would you do this',
}

export const themeCmd: Command = {
  name: 'theme',
  description: 'switch the terminal theme',
  usage: 'theme [name]',
  run(args, ctx) {
    const target = args[0]?.toLowerCase()
    if (!target) {
      return {
        lines: [
          line('Available themes (click to apply):', 'muted'),
          ...THEMES.map((t) => {
            const current = t === ctx.getTheme() ? ' (current)' : ''
            return htmlLine(
              `  ${cmdLink(`theme ${t}`, `${t}${current}`)}  ${DESCRIPTIONS[t]}`,
            )
          }),
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
