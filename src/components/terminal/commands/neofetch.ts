import type { Command } from '../core/types'
import { SITE } from '../../../config/site'
import { escapeHtml, htmlLine, line } from '../core/utils'

const LOGO = String.raw`
 ██████╗  ██████╗ ██████╗ ███████╗
██╔════╝ ██╔═══██╗██╔══██╗██╔════╝
██║  ███╗██║   ██║██║  ██║███████╗
██║   ██║██║   ██║██║  ██║╚════██║
╚██████╔╝╚██████╔╝██████╔╝███████║
 ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝
`.trim()

export const neofetchCmd: Command = {
  name: 'neofetch',
  description: 'system information',
  category: 'intel',
  run(_args, ctx) {
    const facts: Array<[string, string]> = [
      ['OS', 'gods.dev 1.0 (Olympus) x86_64'],
      ['Host', 'GitHub Pages (bare metal is a state of mind)'],
      ['Kernel', 'astro-5-static'],
      ['Shell', 'gsh (gods shell) 0.1'],
      ['Theme', ctx.getTheme()],
      ['Uptime', 'since the fall of the old gods'],
      ['Operator', SITE.name],
      ['Contact', SITE.github],
    ]
    const pad = Math.max(...facts.map(([k]) => k.length))
    const palette = ['●', '●', '●', '●', '●', '●', '●', '●']
    return {
      lines: [
        ...LOGO.split('\n').map((l) => line(l, 'ascii')),
        htmlLine(`  <span class="out-name">${escapeHtml(SITE.name)}</span><span class="muted">@</span><span class="out-name">gods.dev</span>`),
        htmlLine(`  <span class="out-rule">${'─'.repeat(pad + 2 + 34)}</span>`),
        ...facts.map(([k, v]) =>
          htmlLine(`  <span class="kv-key">${escapeHtml(k.padEnd(pad))}</span>  ${escapeHtml(v)}`),
        ),
        line(''),
        htmlLine(`  ${palette.map((d, i) => `<span class="ne-dot ne-dot-${i}">${d}</span>`).join(' ')}`),
      ],
    }
  },
}
