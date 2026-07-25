export interface ParsedInput {
  cmd: string
  args: string[]
  raw: string
}

/** 按空白切分，支持 '…' 与 "…" 引用；返回 null 表示空输入。 */
export function parse(input: string): ParsedInput | null {
  const raw = input.trim()
  if (raw === '') return null

  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let started = false

  for (const ch of raw) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (ch === ' ' || ch === '\t') {
      if (started || current !== '') tokens.push(current)
      current = ''
      started = false
    } else {
      current += ch
      started = true
    }
  }
  if (started || current !== '') tokens.push(current)

  const [first, ...args] = tokens
  return { cmd: first!.toLowerCase(), args, raw }
}
