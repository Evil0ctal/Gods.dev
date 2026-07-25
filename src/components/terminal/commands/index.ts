import type { CommandRegistry } from '../core/types'
import { helpCmd } from './help'
import { echoCmd, dateCmd, whoamiCmd, clearCmd, historyCmd } from './basic'
import { lsCmd, cdCmd, catCmd } from './fs'
import { aboutCmd, projectsCmd, contactCmd, blogCmd } from './content'
import { themeCmd } from './theme'
import { neofetchCmd } from './neofetch'
import { flagCmd } from './flag'
import { sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd } from './eggs'

export function registerAll(reg: CommandRegistry): void {
  const commands = [
    helpCmd, aboutCmd, whoamiCmd, blogCmd, projectsCmd, contactCmd,
    themeCmd, neofetchCmd, clearCmd, historyCmd, echoCmd, dateCmd,
    lsCmd, cdCmd, catCmd,
    flagCmd, sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd,
    { ...contactCmd, name: 'social', hidden: true },
  ]
  for (const c of commands) reg.register(c)
}
