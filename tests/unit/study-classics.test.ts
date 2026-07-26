import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { studyCmd } from '../../src/components/terminal/commands/content'
import { createBibleCmd } from '../../src/components/terminal/commands/bible'
import { CLASSIC_PASSAGES } from '../../src/data/passages'
import { parseChapterVerse } from '../../src/components/terminal/core/bible'
import type { BibleIndex } from '../../src/components/terminal/core/bible'
import { createVfs } from '../../src/components/terminal/core/vfs-data'
import { readFile } from '../../src/components/terminal/core/vfs'
import { makeCtx } from './helpers'

const studies = [
  { slug: 'the-prodigal-son', title: 'The Prodigal Son', description: 'x', date: '2026-07-26' },
  { slug: 'sermon-on-the-mount', title: 'Sermon on the Mount', description: 'y', date: '2026-07-25' },
]

describe('study command', () => {
  it('lists studies with links', async () => {
    const res = await studyCmd.run([], makeCtx({ studies }))
    const html = res.lines.map((l) => l.text).join('\n')
    expect(html).toContain('href="/study/the-prodigal-son/"')
    expect(html).toContain('The Prodigal Son')
  })
  it('study read navigates', async () => {
    const res = await studyCmd.run(['read', 'the-prodigal-son'], makeCtx({ studies }))
    expect(res.navigate).toBe('/study/the-prodigal-son/')
  })
  it('errors on unknown slug and reports empty state', async () => {
    expect((await studyCmd.run(['read', 'ghost'], makeCtx({ studies }))).lines[0]?.kind).toBe('error')
    expect((await studyCmd.run([], makeCtx())).lines[0]?.kind).toBe('muted')
  })
  it('is a visible scripture command', () => {
    expect(studyCmd.category).toBe('scripture')
    expect(studyCmd.hidden).toBeUndefined()
  })
})

describe('classic passages data integrity', () => {
  // 用真实的 public/bible 数据校验每一条精选引用真实存在
  const index = JSON.parse(readFileSync('public/bible/index.json', 'utf8')) as BibleIndex

  it('every classic passage points at a real book/chapter/verse range', () => {
    for (const p of CLASSIC_PASSAGES) {
      const book = index.books.find((b) => b.slug === p.book)
      expect(book, `book ${p.book}`).toBeDefined()
      const cv = parseChapterVerse(p.ref)
      expect(cv, `ref ${p.book} ${p.ref}`).not.toBeNull()
      const verseCount = book!.chapters[cv!.chapter - 1]
      expect(verseCount, `${p.book} ch${cv!.chapter}`).toBeGreaterThan(0)
      expect(cv!.verseStart!, `${p.book} ${p.ref} start`).toBeLessThanOrEqual(verseCount!)
      if (cv!.verseEnd) expect(cv!.verseEnd, `${p.book} ${p.ref} end`).toBeLessThanOrEqual(verseCount!)
    }
  })

  it('bible classics renders every passage as a clickable command', async () => {
    const cmd = createBibleCmd({ loadIndex: async () => index, loadBook: async () => null })
    const res = await cmd.run(['classics'], makeCtx())
    const html = res.lines.map((l) => l.text).join('\n')
    for (const p of CLASSIC_PASSAGES) {
      expect(html).toContain(`data-cmd="bible ${p.book} ${p.ref}"`)
    }
  })
})

describe('vfs study/bible integration', () => {
  const vfs = createVfs([], studies)
  it('exposes study stubs and the classics file', () => {
    expect(readFile(vfs, '/home/guest/study/the-prodigal-son.md')).toContain('study read the-prodigal-son')
    const classics = readFile(vfs, '/home/guest/bible/classics.txt')
    expect(classics).toContain('The Beatitudes')
    expect(classics).toContain('bible matthew 5:3-12')
  })
})
