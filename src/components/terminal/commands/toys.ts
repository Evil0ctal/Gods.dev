import type { Command } from '../core/types'
import { htmlLine, line, escapeHtml } from '../core/utils'
import { figletRender } from '../../../data/figlet-font'

/** text from args, or from piped stdin if no args */
function inputText(args: string[], stdin?: string[]): string {
  if (args.length) return args.join(' ')
  if (stdin && stdin.length) return stdin.join(' ').trim()
  return ''
}

const COW = [
  '        \\   ^__^',
  '         \\  (oo)\\_______',
  '            (__)\\       )\\/\\',
  '                ||----w |',
  '                ||     ||',
]

export const cowsayCmd: Command = {
  name: 'cowsay',
  description: 'a cow says what you type',
  usage: 'cowsay <text>',
  category: 'shell',
  run(args, _ctx, stdin) {
    const text = inputText(args, stdin) || 'mooo'
    const top = ' ' + '_'.repeat(text.length + 2)
    const bot = ' ' + '-'.repeat(text.length + 2)
    const lines = [top, `< ${text} >`, bot, ...COW]
    return { lines: lines.map((l) => htmlLine(escapeHtml(l), 'ascii')) }
  },
}

export const figletCmd: Command = {
  name: 'figlet',
  description: 'big block-letter banners',
  usage: 'figlet <text>',
  category: 'shell',
  run(args, _ctx, stdin) {
    const text = inputText(args, stdin)
    if (!text) return { lines: [line('figlet: give me some text. try: figlet gods', 'muted')] }
    const rows = figletRender(text)
    if (rows.length === 0) return { lines: [line('figlet: nothing renderable in that text.', 'muted')] }
    return { lines: rows.map((r) => htmlLine(`<span class="line-ascii">${escapeHtml(r)}</span>`)) }
  },
}

// original one-liners — RE / operator flavored, no borrowed quotes
const FORTUNES = [
  'entropy first, debugger second.',
  '"encrypted" is a claim, not a fact.',
  'known plaintext is a superpower.',
  'the bug is not where you are looking. that is why you cannot find it.',
  'a keystream you can regenerate is not a key.',
  'read the source, do not just run it.',
  'every format has a fixed header. fixed headers are free keystream.',
  'obfuscation is a reading problem, not a cryptography one.',
  'the fastest way to understand a binary is to make it lie to you.',
  'if it phones no server, the check is on the device — and so is the answer.',
  'WASM hides the names, not the logic.',
  'grep is the most underrated exploit.',
]

export const fortuneCmd: Command = {
  name: 'fortune',
  description: 'a pithy line for the operator',
  category: 'shell',
  run() {
    const pick = FORTUNES[Math.floor(Math.random() * FORTUNES.length)]!
    return { lines: [line(`「 ${pick} 」`, 'muted')] }
  },
}

const TRAIN = [
  '      ====        ________                ___________',
  '  _D _|  |_______/        \\__I_I_____===__|_________|',
  '   |(_)---  |   H\\________/ |   |        =|___ ___|',
  '   /     |  |   H  |  |     |   |         ||_| |_||',
  '  |      |  |   H  |__--------------------| [___] |',
  '  | ________|___H__/__|_____/[][]~\\_______|       |',
  '  |/ |   |-----------I_____I [][] []  D   |=======|__',
  "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__",
  ' |/-=|___|=    ||    ||    ||    |_____/~\\___/',
  "  \\_/      \\O=====O=====O=====O_/      \\_/",
]

export const slCmd: Command = {
  name: 'sl',
  description: 'steam locomotive (you meant ls)',
  hidden: true,
  category: 'shell',
  run() {
    return {
      lines: [
        line('you typed sl. the train does not care that you meant ls.', 'muted'),
        ...TRAIN.map((t) => htmlLine(`<span class="line-ascii">${escapeHtml(t)}</span>`)),
        line('choo choo. try `ls` next time.', 'muted'),
      ],
    }
  },
}
