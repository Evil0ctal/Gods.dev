import type { CommandRegistry } from '../core/types'
import { helpCmd } from './help'
import { echoCmd, dateCmd, whoamiCmd, clearCmd, historyCmd } from './basic'
import { lsCmd, cdCmd, catCmd } from './fs'
import { aboutCmd, projectsCmd, contactCmd, blogCmd, studyCmd } from './content'
import { themeCmd } from './theme'
import { neofetchCmd } from './neofetch'
import { flagCmd } from './flag'
import { bibleCmd } from './bible'
import { ctfCmd } from './ctf'
import { gamesCmd, snakeCmd, twenty48Cmd, adventureCmd, soundCmd, birthdayCmd, fireworksCmd, dinoCmd, flappyCmd } from './games'
import { sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd } from './eggs'
import { tracerouteCmd, nmapCmd, inspectCmd, fingerprintCmd } from './recon'

export function registerAll(reg: CommandRegistry): void {
  const commands = [
    helpCmd, aboutCmd, whoamiCmd, blogCmd, projectsCmd, contactCmd,
    themeCmd, neofetchCmd, clearCmd, historyCmd, echoCmd, dateCmd, soundCmd,
    lsCmd, cdCmd, catCmd, bibleCmd, studyCmd, ctfCmd,
    tracerouteCmd, nmapCmd, inspectCmd, fingerprintCmd,
    gamesCmd, snakeCmd, twenty48Cmd, dinoCmd, flappyCmd, adventureCmd, birthdayCmd, fireworksCmd,
    flagCmd, sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd,
    { ...contactCmd, name: 'social', hidden: true },
  ]
  for (const c of commands) reg.register(c)
}
