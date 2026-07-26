import type { Command } from '../core/types'
import { SITE } from '../../../config/site'
import { line } from '../core/utils'

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
    return {
      lines: [
        ...LOGO.split('\n').map((l) => line(l, 'ascii')),
        line(''),
        ...facts.map(([k, v]) => line(`  ${k.padEnd(pad)}  ${v}`)),
      ],
    }
  },
}
