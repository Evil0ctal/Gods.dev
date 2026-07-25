import type { VfsDir } from './types'
import { listDir, normalizePath } from './vfs'

const FS_COMMANDS = new Set(['ls', 'cd', 'cat'])

export interface CompleteCtx {
  names: string[]
  vfs: VfsDir
  cwd: string
}

export function complete(input: string, ctx: CompleteCtx): string[] {
  if (input.trim() === '') return []
  const tokens = input.split(/\s+/)

  if (tokens.length === 1) {
    const prefix = tokens[0]!.toLowerCase()
    return ctx.names.filter((n) => n.startsWith(prefix) && n !== prefix)
  }

  const cmd = tokens[0]!.toLowerCase()
  if (!FS_COMMANDS.has(cmd)) return []

  const partial = tokens[tokens.length - 1]!
  const slash = partial.lastIndexOf('/')
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : ''
  const namePart = slash >= 0 ? partial.slice(slash + 1) : partial

  const dirAbs = normalizePath(ctx.cwd, dirPart === '' ? '.' : dirPart)
  const entries = listDir(ctx.vfs, dirAbs) ?? []
  const head = tokens.slice(0, -1).join(' ')

  return entries
    .filter((e) => e.startsWith(namePart) && e !== namePart)
    .map((e) => `${head} ${dirPart}${e}`)
}
