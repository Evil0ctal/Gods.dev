import { describe, it, expect } from 'vitest'
import {
  findBook,
  parseChapterVerse,
  pickDaily,
  pickRandom,
  refLabel,
  extractVerses,
} from '../../src/components/terminal/core/bible'
import type { BibleBook, BibleIndex } from '../../src/components/terminal/core/bible'
import { createBibleCmd } from '../../src/components/terminal/commands/bible'
import { makeCtx } from './helpers'

const index: BibleIndex = {
  translation: 'World English Bible (public domain)',
  books: [
    { slug: 'matthew', name: 'Matthew', chapters: [3, 2] },
    { slug: 'john', name: 'John', chapters: [2, 2, 16] },
    { slug: '1john', name: '1 John', chapters: [4] },
  ],
}

const johnBook: BibleBook = {
  name: 'John',
  chapters: [
    ['In the beginning was the Word.', 'The Word was with God.'],
    ['v2:1', 'v2:2'],
    [...Array.from({ length: 15 }, (_, i) => `filler ${i + 1}`), 'For God so loved the world.'],
  ],
}

const books: Record<string, BibleBook> = {
  john: johnBook,
  matthew: { name: 'Matthew', chapters: [['m1', 'm2', 'm3'], ['m4', 'm5']] },
  '1john': { name: '1 John', chapters: [['a', 'b', 'c', 'd']] },
}

const deps = {
  loadIndex: async () => index,
  loadBook: async (slug: string) => books[slug] ?? null,
  today: () => '2026-07-25',
}

describe('findBook', () => {
  it('matches exact slug, multi-token numbered books, aliases, unique prefixes', () => {
    expect(findBook(index, ['john'])?.slug).toBe('john')
    expect(findBook(index, ['1', 'john'])?.slug).toBe('1john')
    expect(findBook(index, ['1john'])?.slug).toBe('1john')
    expect(findBook(index, ['jn'])?.slug).toBe('john')
    expect(findBook(index, ['matt'])?.slug).toBe('matthew')
  })
  it('rejects unknown and ambiguous names', () => {
    expect(findBook(index, ['zzz'])).toBeNull()
    expect(findBook(index, [''])).toBeNull()
  })
})

describe('parseChapterVerse', () => {
  it('parses chapter, verse and ranges', () => {
    expect(parseChapterVerse('3')).toEqual({ chapter: 3 })
    expect(parseChapterVerse('3:16')).toEqual({ chapter: 3, verseStart: 16 })
    expect(parseChapterVerse('3:16-18')).toEqual({ chapter: 3, verseStart: 16, verseEnd: 18 })
  })
  it('rejects garbage', () => {
    expect(parseChapterVerse('0')).toBeNull()
    expect(parseChapterVerse('3:0')).toBeNull()
    expect(parseChapterVerse('3:18-16')).toBeNull()
    expect(parseChapterVerse('x')).toBeNull()
    expect(parseChapterVerse('3:')).toBeNull()
  })
})

describe('pickDaily / pickRandom', () => {
  it('is deterministic per date and stays in bounds', () => {
    const a = pickDaily(index, '2026-07-25')
    const b = pickDaily(index, '2026-07-25')
    expect(a).toEqual(b)
    const book = index.books.find((x) => x.slug === a.slug)!
    expect(a.chapter).toBeGreaterThanOrEqual(1)
    expect(a.chapter).toBeLessThanOrEqual(book.chapters.length)
    expect(a.verseStart!).toBeLessThanOrEqual(book.chapters[a.chapter - 1]!)
  })
  it('random respects the injected generator', () => {
    expect(pickRandom(index, () => 0)).toEqual({ slug: 'matthew', name: 'Matthew', chapter: 1, verseStart: 1 })
    const last = pickRandom(index, () => 0.999999)
    expect(last.slug).toBe('1john')
  })
})

describe('refLabel / extractVerses', () => {
  it('formats labels for chapter, verse and range', () => {
    expect(refLabel({ slug: 'john', name: 'John', chapter: 3 })).toBe('John 3')
    expect(refLabel({ slug: 'john', name: 'John', chapter: 3, verseStart: 16 })).toBe('John 3:16')
    expect(refLabel({ slug: 'john', name: 'John', chapter: 3, verseStart: 16, verseEnd: 18 })).toBe('John 3:16-18')
  })
  it('extracts verses and rejects out-of-range refs', () => {
    expect(extractVerses(johnBook, { slug: 'john', name: 'John', chapter: 3, verseStart: 16 })).toEqual([
      { verse: 16, text: 'For God so loved the world.' },
    ])
    expect(extractVerses(johnBook, { slug: 'john', name: 'John', chapter: 99, verseStart: 1 })).toBeNull()
    expect(extractVerses(johnBook, { slug: 'john', name: 'John', chapter: 1, verseStart: 99 })).toBeNull()
  })
})

describe('bible command', () => {
  const cmd = createBibleCmd(deps)

  it('reads a single verse', async () => {
    const res = await cmd.run(['john', '3:16'], makeCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('John 3:16 · WEB')
    expect(text).toContain('For God so loved the world.')
  })
  it('reads a whole chapter when no verse is given', async () => {
    const res = await cmd.run(['john', '1'], makeCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('In the beginning was the Word.')
    expect(text).toContain('The Word was with God.')
  })
  it('handles numbered books with spaces', async () => {
    const res = await cmd.run(['1', 'john', '1:2'], makeCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('1 John 1:2 · WEB')
  })
  it('bare invocation prints the verse of the day deterministically', async () => {
    const a = await cmd.run([], makeCtx())
    const b = await cmd.run([], makeCtx())
    expect(a.lines.map((l) => l.text)).toEqual(b.lines.map((l) => l.text))
    expect(a.lines[0]?.text).toContain('verse of the day — 2026-07-25')
  })
  it('lists all books with clickable slugs', async () => {
    const res = await cmd.run(['books'], makeCtx())
    const html = res.lines.map((l) => l.text).join('\n')
    expect(html).toContain('data-cmd="bible john 1"')
    expect(html).toContain('data-cmd="bible 1john 1"')
  })
  it('errors on unknown books with a hint', async () => {
    const res = await cmd.run(['genesis', '1:1'], makeCtx())
    expect(res.lines[0]?.kind).toBe('error')
    expect(res.lines.map((l) => l.text).join('\n')).toContain('bible books')
  })
  it('errors when the index cannot be fetched', async () => {
    const offline = createBibleCmd({ ...deps, loadIndex: async () => null })
    const res = await offline.run(['john', '3:16'], makeCtx())
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('errors on out-of-reality references', async () => {
    const res = await cmd.run(['john', '99:1'], makeCtx())
    expect(res.lines[0]?.kind).toBe('error')
    expect(res.lines[0]?.text).toContain('does not exist in this reality')
  })
  it('is registered under the scripture category', () => {
    expect(cmd.category).toBe('scripture')
    expect(cmd.hidden).toBeUndefined()
  })
})
