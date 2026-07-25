import type { Command } from '../core/types'
import { HOME, displayPath, getNode, listDir, normalizePath, readFile } from '../core/vfs'
import { line } from '../core/utils'

export const lsCmd: Command = {
  name: 'ls',
  description: 'list directory contents',
  usage: 'ls [path]',
  run(args, ctx) {
    const target = args.find((a) => !a.startsWith('-')) ?? '.'
    const abs = normalizePath(ctx.cwd, target)
    const entries = listDir(ctx.vfs, abs)
    if (entries === null) return { lines: [line(`ls: cannot access '${target}': no such directory`, 'error')] }
    if (entries.length === 0) return { lines: [line('(empty)', 'muted')] }
    return { lines: entries.map((e) => line(e, e.endsWith('/') ? 'success' : undefined)) }
  },
}

export const cdCmd: Command = {
  name: 'cd',
  description: 'change directory',
  usage: 'cd [path]',
  run(args, ctx) {
    const target = args[0] ?? '~'
    const abs = normalizePath(ctx.cwd, target)
    const node = getNode(ctx.vfs, abs)
    if (!node || node.type !== 'dir') {
      return { lines: [line(`cd: ${target}: not a directory`, 'error')] }
    }
    ctx.setCwd(abs)
    return { lines: [] }
  },
}

export const catCmd: Command = {
  name: 'cat',
  description: 'read a file',
  usage: 'cat <file>',
  run(args, ctx) {
    const target = args[0]
    if (!target) return { lines: [line('cat: missing operand. try: cat README.txt', 'error')] }
    const abs = normalizePath(ctx.cwd, target)
    const content = readFile(ctx.vfs, abs)
    if (content === null) {
      const node = getNode(ctx.vfs, abs)
      const msg = node ? `cat: ${target}: is a directory` : `cat: ${target}: no such file`
      return { lines: [line(msg, 'error')] }
    }
    return { lines: content.split('\n').map((l) => line(l)) }
  },
}

export { HOME, displayPath }
