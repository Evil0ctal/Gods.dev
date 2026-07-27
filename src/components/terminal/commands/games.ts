import type { Command } from '../core/types'
import { snakeGame } from '../core/games/snake'
import { twenty48Game } from '../core/games/twenty48'
import { createAdventure } from '../core/games/adventure'
import { setSound, soundEnabled, beep } from '../core/sound'
import { badge, cmdLink, headLine, htmlLine, line } from '../core/utils'

export const snakeCmd: Command = {
  name: 'snake',
  description: 'classic snake',
  category: 'games',
  run() {
    return { lines: [line('starting snake ...', 'muted')], game: snakeGame(Math.random) }
  },
}

export const twenty48Cmd: Command = {
  name: '2048',
  description: 'slide and merge to 2048',
  category: 'games',
  run() {
    return { lines: [line('starting 2048 ...', 'muted')], game: twenty48Game(Math.random) }
  },
}

export const adventureCmd: Command = {
  name: 'adventure',
  description: 'a small text adventure',
  category: 'games',
  run() {
    return { lines: [], repl: createAdventure() }
  },
}

const GAMES: Array<[string, string]> = [
  ['snake', 'guide the snake, eat, grow, do not bite yourself'],
  ['2048', 'slide tiles, merge matching numbers, reach 2048'],
  ['adventure', 'ASCENT — escape to the Summit, one command at a time'],
]

export const gamesCmd: Command = {
  name: 'games',
  description: 'the arcade',
  category: 'games',
  run() {
    return {
      lines: [
        headLine('the gods.dev arcade'),
        line(''),
        ...GAMES.map(([id, desc]) =>
          htmlLine(`  ${cmdLink(id, id.padEnd(11))}<span class="muted">${desc}</span>`),
        ),
        line(''),
        htmlLine(`sound is <span class="muted">off by default</span> — toggle with ${cmdLink('sound on', 'sound on')}`),
      ],
    }
  },
}

export const soundCmd: Command = {
  name: 'sound',
  description: 'toggle retro sound effects',
  usage: 'sound [on|off]',
  category: 'shell',
  run(args) {
    const arg = args[0]?.toLowerCase()
    const target = arg === 'on' ? true : arg === 'off' ? false : !soundEnabled()
    setSound(target)
    if (target) beep('boot')
    return {
      lines: [
        htmlLine(
          `sound ${target ? badge('on', 'ok') : badge('off', 'warn')} <span class="muted">— synthesized beeps, no audio files</span>`,
        ),
      ],
    }
  },
}
