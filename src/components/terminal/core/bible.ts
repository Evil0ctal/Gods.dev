export interface BibleIndexBook {
  slug: string
  name: string
  /** 每章的节数，1 基章号对应 chapters[ch-1] */
  chapters: number[]
}

export interface BibleIndex {
  translation: string
  books: BibleIndexBook[]
}

export interface BibleBook {
  name: string
  chapters: string[][]
}

export interface BibleRef {
  slug: string
  name: string
  chapter: number
  verseStart?: number
  verseEnd?: number
}

/** 常用缩写 → 卷 slug（全名与 slug 本身也总是可用） */
const ALIASES: Record<string, string> = {
  mt: 'matthew', matt: 'matthew',
  mk: 'mark',
  lk: 'luke',
  jn: 'john',
  act: 'acts',
  rom: 'romans',
  '1cor': '1corinthians', '2cor': '2corinthians',
  gal: 'galatians',
  eph: 'ephesians',
  phil: 'philippians', php: 'philippians',
  phm: 'philemon', phlm: 'philemon',
  col: 'colossians',
  '1th': '1thessalonians', '1thess': '1thessalonians',
  '2th': '2thessalonians', '2thess': '2thessalonians',
  '1tim': '1timothy', '1ti': '1timothy',
  '2tim': '2timothy', '2ti': '2timothy',
  tit: 'titus',
  heb: 'hebrews',
  jas: 'james',
  '1pet': '1peter', '1pe': '1peter',
  '2pet': '2peter', '2pe': '2peter',
  '1jn': '1john', '2jn': '2john', '3jn': '3john',
  jud: 'jude',
  rev: 'revelation',
}

function normalizeBookKey(tokens: string[]): string {
  return tokens.join('').toLowerCase().replace(/[\s.\-_]/g, '')
}

/** 按 slug 精确、别名、唯一前缀的顺序解析卷名；歧义或未知返回 null */
export function findBook(index: BibleIndex, tokens: string[]): BibleIndexBook | null {
  const key = normalizeBookKey(tokens)
  if (key === '') return null
  const bySlug = index.books.find((b) => b.slug === key)
  if (bySlug) return bySlug
  const alias = ALIASES[key]
  if (alias) return index.books.find((b) => b.slug === alias) ?? null
  const prefixed = index.books.filter((b) => b.slug.startsWith(key))
  return prefixed.length === 1 ? prefixed[0]! : null
}

/** 解析 "3" | "3:16" | "3:16-18"；非法返回 null */
export function parseChapterVerse(
  s: string,
): { chapter: number; verseStart?: number; verseEnd?: number } | null {
  const m = /^(\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(s.trim())
  if (!m) return null
  const chapter = Number(m[1])
  if (chapter < 1) return null
  if (m[2] === undefined) return { chapter }
  const verseStart = Number(m[2])
  if (verseStart < 1) return null
  if (m[3] === undefined) return { chapter, verseStart }
  const verseEnd = Number(m[3])
  if (verseEnd < verseStart) return null
  return { chapter, verseStart, verseEnd }
}

export function refLabel(ref: BibleRef): string {
  const base = `${ref.name} ${ref.chapter}`
  if (ref.verseStart === undefined) return base
  if (ref.verseEnd === undefined || ref.verseEnd === ref.verseStart) return `${base}:${ref.verseStart}`
  return `${base}:${ref.verseStart}-${ref.verseEnd}`
}

function totalVerses(index: BibleIndex): number {
  return index.books.reduce((sum, b) => sum + b.chapters.reduce((a, c) => a + c, 0), 0)
}

/** 全新约第 n 节（0 基）→ 具体引用 */
function nthVerse(index: BibleIndex, n: number): BibleRef {
  let rest = n
  for (const b of index.books) {
    for (let ch = 0; ch < b.chapters.length; ch++) {
      const count = b.chapters[ch]!
      if (rest < count) {
        return { slug: b.slug, name: b.name, chapter: ch + 1, verseStart: rest + 1 }
      }
      rest -= count
    }
  }
  const last = index.books[index.books.length - 1]!
  return { slug: last.slug, name: last.name, chapter: last.chapters.length, verseStart: 1 }
}

/** 按日期字符串（YYYY-MM-DD）确定性选取每日一节 */
export function pickDaily(index: BibleIndex, dateStr: string): BibleRef {
  let hash = 5381
  for (const ch of dateStr) hash = ((hash << 5) + hash + ch.charCodeAt(0)) >>> 0
  return nthVerse(index, hash % totalVerses(index))
}

export function pickRandom(index: BibleIndex, rand: () => number = Math.random): BibleRef {
  return nthVerse(index, Math.floor(rand() * totalVerses(index)))
}

/** 从书卷数据中取出引用对应的经文，越界返回 null */
export function extractVerses(
  book: BibleBook,
  ref: BibleRef,
): Array<{ verse: number; text: string }> | null {
  const chapter = book.chapters[ref.chapter - 1]
  if (!chapter) return null
  const start = ref.verseStart ?? 1
  const end = ref.verseEnd ?? ref.verseStart ?? chapter.length
  if (start > chapter.length) return null
  const out: Array<{ verse: number; text: string }> = []
  for (let v = start; v <= Math.min(end, chapter.length); v++) {
    const text = chapter[v - 1]!
    if (text !== '') out.push({ verse: v, text })
  }
  return out.length > 0 ? out : null
}
