import type { Command } from '../core/types'
import { escapeHtml, htmlLine, line } from '../core/utils'

export const echoCmd: Command = {
  name: 'echo',
  description: 'print text back',
  category: 'shell',
  usage: 'echo <text>',
  run(args) {
    return { lines: [htmlLine(escapeHtml(args.join(' ')))] }
  },
}

export const whoamiCmd: Command = {
  name: 'whoami',
  description: 'who are you, really?',
  category: 'intel',
  run() {
    return {
      lines: [
        line('guest'),
        line('(identity is a construct. here, you are whoever you type.)', 'muted'),
      ],
    }
  },
}

export const dateCmd: Command = {
  name: 'date',
  description: 'current date and time',
  category: 'shell',
  run() {
    return { lines: [line(new Date().toString())] }
  },
}

export const clearCmd: Command = {
  name: 'clear',
  description: 'clear the screen',
  category: 'shell',
  run() {
    return { lines: [], clear: true }
  },
}

export const historyCmd: Command = {
  name: 'history',
  description: 'your command history',
  category: 'shell',
  run(_args, ctx) {
    const entries = ctx.historyList()
    if (entries.length === 0) return { lines: [line('history: empty. make some.', 'muted')] }
    return { lines: entries.map((e, i) => line(`${String(i + 1).padStart(3)}  ${e}`)) }
  },
}
