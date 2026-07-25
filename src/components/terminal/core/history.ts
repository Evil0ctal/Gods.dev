export interface InputHistory {
  push(entry: string): void
  prev(): string | null
  next(): string | null
  reset(): void
  all(): string[]
}

export function createHistory(): InputHistory {
  const entries: string[] = []
  let cursor = 0 // entries.length == live line

  return {
    push(entry: string): void {
      const trimmed = entry.trim()
      if (trimmed !== '' && entries[entries.length - 1] !== trimmed) entries.push(trimmed)
      cursor = entries.length
    },
    prev(): string | null {
      if (entries.length === 0) return null
      cursor = Math.max(0, cursor - 1)
      return entries[cursor] ?? null
    },
    next(): string | null {
      if (cursor >= entries.length) return null
      cursor += 1
      return cursor >= entries.length ? null : (entries[cursor] ?? null)
    },
    reset(): void {
      cursor = entries.length
    },
    all(): string[] {
      return [...entries]
    },
  }
}
