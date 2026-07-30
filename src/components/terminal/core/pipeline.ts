import type { CommandRegistry, CommandResult, OutputLine, TerminalContext } from './types'
import { parse } from './parser'
import { htmlLine, line, cmdLink, escapeHtml } from './utils'

/** split a raw line on top-level (unquoted) `|` into pipeline segments */
export function splitPipes(raw: string): string[] {
  const segs: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  for (const ch of raw) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      cur += ch
      quote = ch
    } else if (ch === '|') {
      segs.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  segs.push(cur)
  return segs.map((s) => s.trim())
}

/** the plain-text view of command output, for feeding a pipe's stdin.
    Trusted app HTML is tag-stripped and entity-decoded so filters see text. */
export function linesToText(lines: OutputLine[]): string[] {
  return lines.map((l) => {
    if (!l.html) return l.text
    return l.text
      .replace(/<[^>]+>/g, '')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
  })
}

/**
 * Run a (possibly piped) command line. Each segment's text output becomes the
 * next segment's stdin; the FINAL segment's CommandResult (with any game/repl/
 * effect/navigate) is what gets displayed. A `|` with no pipe present is just a
 * single segment, so this is the one execution path for every command.
 */
export async function runPipeline(
  raw: string,
  ctx: TerminalContext,
  registry: CommandRegistry,
): Promise<CommandResult> {
  const segments = splitPipes(raw).filter((s) => s !== '')
  if (segments.length === 0) return { lines: [] }

  let stdin: string[] | undefined
  let result: CommandResult = { lines: [] }
  for (let i = 0; i < segments.length; i++) {
    const parsed = parse(segments[i]!)
    if (!parsed) continue
    const cmd = registry.get(parsed.cmd)
    if (!cmd) {
      return {
        lines: [
          htmlLine(
            `gsh: command not found: ${escapeHtml(parsed.cmd)}. try ${cmdLink('help', 'help')}`,
            'error',
          ),
        ],
      }
    }
    result = await cmd.run(parsed.args, ctx, stdin)
    if (i < segments.length - 1) stdin = linesToText(result.lines)
  }
  return result
}

/** shared usage note for the stdin-only text filters */
export function needsPipe(name: string): CommandResult {
  return { lines: [line(`${name}: reads piped input. try: cat <file> | ${name} …`, 'muted')] }
}
