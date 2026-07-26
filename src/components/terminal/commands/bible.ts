import type { Command } from '../core/types'
import type { BibleBook, BibleIndex, BibleRef } from '../core/bible'
import { extractVerses, findBook, parseChapterVerse, pickDaily, pickRandom, refLabel } from '../core/bible'
import { cmdLink, escapeHtml, htmlLine, line } from '../core/utils'

export interface BibleDeps {
  loadIndex: () => Promise<BibleIndex | null>
  loadBook: (slug: string) => Promise<BibleBook | null>
  today?: () => string
  random?: () => number
}

const USAGE = [
  'usage:',
  '  bible                    verse of the day',
  '  bible john 3:16          a verse',
  '  bible john 3:16-18       a passage',
  '  bible john 3             a whole chapter',
  '  bible random             let providence decide',
  '  bible books              all 27 books of the New Testament',
]

const OFFLINE = 'the heavens are unreachable right now (fetch failed). try again.'

async function renderRef(deps: BibleDeps, ref: BibleRef) {
  const book = await deps.loadBook(ref.slug)
  if (!book) return { lines: [line(OFFLINE, 'error')] }
  const verses = extractVerses(book, ref)
  if (!verses) {
    return { lines: [line(`bible: ${refLabel(ref)} does not exist in this reality.`, 'error')] }
  }
  return {
    lines: [
      line(`${refLabel(ref)} · WEB`, 'success'),
      ...verses.map((v) => line(`${String(v.verse).padStart(3)}  ${v.text}`)),
    ],
  }
}

export function createBibleCmd(deps: BibleDeps): Command {
  return {
    name: 'bible',
    description: 'read the New Testament',
    usage: 'bible [book] [chapter[:verse[-verse]]] | random | books',
    category: 'scripture',
    async run(args) {
      const index = await deps.loadIndex()
      if (!index) return { lines: [line(OFFLINE, 'error')] }

      if (args.length === 0) {
        const today = (deps.today ?? (() => new Date().toISOString().slice(0, 10)))()
        const ref = pickDaily(index, today)
        const res = await renderRef(deps, ref)
        return {
          lines: [
            line(`✝ verse of the day — ${today}`, 'muted'),
            ...res.lines,
            line(''),
            line('try: bible books · bible john 3:16 · bible random', 'muted'),
          ],
        }
      }

      const sub = args[0]!.toLowerCase()
      if (sub === 'books') {
        return {
          lines: [
            line('The New Testament · World English Bible (public domain)', 'muted'),
            ...index.books.map((b) =>
              htmlLine(
                `  ${cmdLink(`bible ${b.slug} 1`, b.slug)}${' '.repeat(Math.max(1, 17 - b.slug.length))}${escapeHtml(b.name)} — ${b.chapters.length} chapter${b.chapters.length > 1 ? 's' : ''}`,
              ),
            ),
          ],
        }
      }
      if (sub === 'random') {
        const ref = pickRandom(index, deps.random)
        return renderRef(deps, ref)
      }
      if (sub === 'help' || sub === '--help') {
        return { lines: USAGE.map((u) => line(u, 'muted')) }
      }

      // book name may span tokens ("1 john 4:8"); last token may be a chapter:verse ref
      const last = args[args.length - 1]!
      const cv = args.length > 1 ? parseChapterVerse(last) : null
      const bookTokens = cv ? args.slice(0, -1) : args
      const book = findBook(index, bookTokens)
      if (!book) {
        return {
          lines: [
            line(`bible: unknown book: ${bookTokens.join(' ')}`, 'error'),
            htmlLine(`see ${cmdLink('bible books', 'bible books')} for the canon.`),
          ],
        }
      }
      const ref: BibleRef = {
        slug: book.slug,
        name: book.name,
        chapter: cv?.chapter ?? 1,
        ...(cv?.verseStart !== undefined && { verseStart: cv.verseStart }),
        ...(cv?.verseEnd !== undefined && { verseEnd: cv.verseEnd }),
      }
      return renderRef(deps, ref)
    },
  }
}

/* 生产环境默认加载器：静态 JSON 按需 fetch + 内存缓存 */
const cache = new Map<string, unknown>()

async function fetchJson<T>(path: string): Promise<T | null> {
  if (cache.has(path)) return cache.get(path) as T
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const data = (await res.json()) as T
    cache.set(path, data)
    return data
  } catch {
    return null
  }
}

export const bibleCmd = createBibleCmd({
  loadIndex: () => fetchJson<BibleIndex>('/bible/index.json'),
  loadBook: (slug) => fetchJson<BibleBook>(`/bible/${slug}.json`),
})
