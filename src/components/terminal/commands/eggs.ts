import type { Command } from '../core/types'
import { line } from '../core/utils'

export const sudoCmd: Command = {
  name: 'sudo',
  description: 'become root (you wish)',
  hidden: true,
  run(args) {
    return {
      lines: [
        line(`guest is not in the sudoers file. This incident will be reported.`, 'error'),
        line(`(reported to whom? the gods. they are laughing${args.length ? ` at "${args.join(' ').slice(0, 40)}"` : ''}.)`, 'muted'),
      ],
    }
  },
}

export const rmCmd: Command = {
  name: 'rm',
  description: 'remove files (careful now)',
  hidden: true,
  run(args) {
    const nuke = args.some((a) => /^-[a-z]*r/i.test(a)) && args.includes('/')
    if (nuke) {
      return {
        lines: [line('rm: descending into /: this is fine.', 'error')],
        effect: 'crash',
      }
    }
    return {
      lines: [line(`rm: cannot remove '${args.filter((a) => !a.startsWith('-')).join(' ') || '?'}': read-only cosmos`, 'error')],
    }
  },
}

export const vimCmd: Command = {
  name: 'vim',
  description: 'a text editor you cannot leave',
  hidden: true,
  run() {
    return { lines: [], effect: 'vim' }
  },
}

export const matrixCmd: Command = {
  name: 'matrix',
  description: 'there is no spoon',
  hidden: true,
  run() {
    return { lines: [line('Wake up, Neo...', 'success')], effect: 'matrix' }
  },
}

export const hackCmd: Command = {
  name: 'hack',
  description: 'hack the planet',
  hidden: true,
  run() {
    return { lines: [line('ACCESS GRANTED. just kidding. enjoy the rain.', 'success')], effect: 'matrix' }
  },
}

export const exitCmd: Command = {
  name: 'exit',
  description: 'log out',
  hidden: true,
  run() {
    return {
      lines: [
        line('exit: there is nowhere to go. this terminal is your home now.', 'muted'),
        line('(close the tab if you must. the gods will remember.)', 'muted'),
      ],
    }
  },
}
