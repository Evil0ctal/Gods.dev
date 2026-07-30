import type { Command } from '../core/types'
import { htmlLine, line, escapeHtml } from '../core/utils'
import { needsPipe } from '../core/pipeline'

const asLines = (stdin: string[]) => stdin.map((t) => htmlLine(escapeHtml(t)))

export const grepCmd: Command = {
  name: 'grep',
  description: 'filter piped lines by a pattern',
  usage: 'grep [-i] [-v] <pattern>',
  category: 'shell',
  run(args, _ctx, stdin) {
    if (!stdin) return needsPipe('grep')
    const flags = args.filter((a) => a.startsWith('-'))
    const ci = flags.some((f) => f.includes('i'))
    const inv = flags.some((f) => f.includes('v'))
    const pattern = args.filter((a) => !a.startsWith('-')).join(' ')
    if (!pattern) return { lines: [line('grep: no pattern given.', 'error')] }
    const needle = ci ? pattern.toLowerCase() : pattern
    const hits = stdin.filter((l) => {
      const hay = ci ? l.toLowerCase() : l
      return hay.includes(needle) !== inv
    })
    if (hits.length === 0) return { lines: [line('', 'muted')] }
    // highlight the match (only when not inverted / not case-folded away)
    return {
      lines: hits.map((l) => {
        if (inv) return htmlLine(escapeHtml(l))
        const idx = (ci ? l.toLowerCase() : l).indexOf(needle)
        if (idx < 0) return htmlLine(escapeHtml(l))
        const a = escapeHtml(l.slice(0, idx))
        const m = escapeHtml(l.slice(idx, idx + pattern.length))
        const b = escapeHtml(l.slice(idx + pattern.length))
        return htmlLine(`${a}<span class="line-success">${m}</span>${b}`)
      }),
    }
  },
}

export const wcCmd: Command = {
  name: 'wc',
  description: 'count lines, words, and characters',
  usage: 'wc [-l|-w|-c]',
  category: 'shell',
  run(args, _ctx, stdin) {
    if (!stdin) return needsPipe('wc')
    const lines = stdin.length
    const words = stdin.reduce((n, l) => n + (l.trim() ? l.trim().split(/\s+/).length : 0), 0)
    const chars = stdin.reduce((n, l) => n + l.length, 0) + stdin.length // + newlines
    const flag = args.find((a) => a.startsWith('-'))
    if (flag?.includes('l')) return { lines: [line(String(lines))] }
    if (flag?.includes('w')) return { lines: [line(String(words))] }
    if (flag?.includes('c')) return { lines: [line(String(chars))] }
    return { lines: [line(`${lines} lines  ${words} words  ${chars} chars`)] }
  },
}

function nArg(args: string[], def = 10): number {
  const i = args.indexOf('-n')
  if (i >= 0 && args[i + 1]) return Math.max(0, parseInt(args[i + 1]!, 10) || def)
  const glued = args.find((a) => /^-\d+$/.test(a))
  if (glued) return Math.abs(parseInt(glued, 10))
  return def
}

export const headCmd: Command = {
  name: 'head',
  description: 'first lines of piped input',
  usage: 'head [-n N]',
  category: 'shell',
  run(args, _ctx, stdin) {
    if (!stdin) return needsPipe('head')
    return { lines: asLines(stdin.slice(0, nArg(args))) }
  },
}

export const tailCmd: Command = {
  name: 'tail',
  description: 'last lines of piped input',
  usage: 'tail [-n N]',
  category: 'shell',
  run(args, _ctx, stdin) {
    if (!stdin) return needsPipe('tail')
    const n = nArg(args)
    return { lines: asLines(n >= stdin.length ? stdin : stdin.slice(stdin.length - n)) }
  },
}

export const sortCmd: Command = {
  name: 'sort',
  description: 'sort piped lines',
  usage: 'sort [-r]',
  category: 'shell',
  run(args, _ctx, stdin) {
    if (!stdin) return needsPipe('sort')
    const sorted = [...stdin].sort((a, b) => a.localeCompare(b))
    if (args.some((a) => a.includes('r'))) sorted.reverse()
    return { lines: asLines(sorted) }
  },
}

export const uniqCmd: Command = {
  name: 'uniq',
  description: 'collapse adjacent duplicate lines',
  usage: 'uniq [-c]',
  category: 'shell',
  run(args, _ctx, stdin) {
    if (!stdin) return needsPipe('uniq')
    const count = args.some((a) => a.includes('c'))
    const out: string[] = []
    let prev: string | null = null
    let n = 0
    const flush = () => {
      if (prev !== null) out.push(count ? `${String(n).padStart(4)} ${prev}` : prev)
    }
    for (const l of stdin) {
      if (l === prev) n++
      else {
        flush()
        prev = l
        n = 1
      }
    }
    flush()
    return { lines: asLines(out) }
  },
}

export const revCmd: Command = {
  name: 'rev',
  description: 'reverse each line',
  category: 'shell',
  run(_args, _ctx, stdin) {
    if (!stdin) return needsPipe('rev')
    return { lines: asLines(stdin.map((l) => [...l].reverse().join(''))) }
  },
}
