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
import { buildCmd, whatsnewCmd, usesCmd } from './meta'
import { statsCmd } from './stats'
import { ascendCmd } from './ascend'
import { grepCmd, wcCmd, headCmd, tailCmd, sortCmd, uniqCmd, revCmd } from './textutils'
import { cowsayCmd, figletCmd, fortuneCmd, slCmd } from './toys'

export function registerAll(reg: CommandRegistry): void {
  const commands = [
    helpCmd, aboutCmd, whoamiCmd, blogCmd, projectsCmd, contactCmd,
    themeCmd, neofetchCmd, clearCmd, historyCmd, echoCmd, dateCmd, soundCmd,
    lsCmd, cdCmd, catCmd, bibleCmd, studyCmd, ctfCmd,
    tracerouteCmd, nmapCmd, inspectCmd, fingerprintCmd,
    buildCmd, whatsnewCmd, usesCmd, statsCmd,
    gamesCmd, snakeCmd, twenty48Cmd, dinoCmd, flappyCmd, adventureCmd, birthdayCmd, fireworksCmd,
    flagCmd, sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd, ascendCmd,
    grepCmd, wcCmd, headCmd, tailCmd, sortCmd, uniqCmd, revCmd,
    cowsayCmd, figletCmd, fortuneCmd, slCmd,
    { ...contactCmd, name: 'social', hidden: true },
  ]
  for (const c of commands) reg.register(c)
}
