// Fetches the World English Bible New Testament (public domain) and converts
// it to compact per-book JSON under public/bible/, plus an index with
// per-chapter verse counts used for random/daily verse selection.
// Source: https://github.com/TehShrike/world-english-bible
// Run once: node scripts/fetch-bible.mjs   (output is committed)
import { mkdirSync, writeFileSync } from 'node:fs'

const SOURCE = 'https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json'

const NT_BOOKS = [
  ['matthew', 'Matthew'],
  ['mark', 'Mark'],
  ['luke', 'Luke'],
  ['john', 'John'],
  ['acts', 'Acts'],
  ['romans', 'Romans'],
  ['1corinthians', '1 Corinthians'],
  ['2corinthians', '2 Corinthians'],
  ['galatians', 'Galatians'],
  ['ephesians', 'Ephesians'],
  ['philippians', 'Philippians'],
  ['colossians', 'Colossians'],
  ['1thessalonians', '1 Thessalonians'],
  ['2thessalonians', '2 Thessalonians'],
  ['1timothy', '1 Timothy'],
  ['2timothy', '2 Timothy'],
  ['titus', 'Titus'],
  ['philemon', 'Philemon'],
  ['hebrews', 'Hebrews'],
  ['james', 'James'],
  ['1peter', '1 Peter'],
  ['2peter', '2 Peter'],
  ['1john', '1 John'],
  ['2john', '2 John'],
  ['3john', '3 John'],
  ['jude', 'Jude'],
  ['revelation', 'Revelation'],
]

mkdirSync('public/bible', { recursive: true })

const index = { translation: 'World English Bible (public domain)', books: [] }

for (const [slug, name] of NT_BOOKS) {
  const res = await fetch(`${SOURCE}/${slug}.json`)
  if (!res.ok) throw new Error(`fetch failed for ${slug}: ${res.status}`)
  const entries = await res.json()

  // verse text can span multiple entries (sections, poetry lines) — aggregate
  const chapters = new Map()
  for (const e of entries) {
    if (!e.chapterNumber || !e.verseNumber || typeof e.value !== 'string') continue
    const ch = Number(e.chapterNumber)
    const v = Number(e.verseNumber)
    if (!chapters.has(ch)) chapters.set(ch, new Map())
    const verses = chapters.get(ch)
    verses.set(v, (verses.get(v) ?? '') + e.value)
  }

  const chapterArrays = []
  const counts = []
  for (let ch = 1; ch <= Math.max(...chapters.keys()); ch++) {
    const verses = chapters.get(ch) ?? new Map()
    const maxV = verses.size ? Math.max(...verses.keys()) : 0
    const arr = []
    for (let v = 1; v <= maxV; v++) {
      arr.push((verses.get(v) ?? '').replace(/\s+/g, ' ').trim())
    }
    chapterArrays.push(arr)
    counts.push(maxV)
  }

  writeFileSync(`public/bible/${slug}.json`, JSON.stringify({ name, chapters: chapterArrays }))
  index.books.push({ slug, name, chapters: counts })
  console.log(`${name}: ${counts.length} chapters, ${counts.reduce((a, b) => a + b, 0)} verses`)
}

writeFileSync('public/bible/index.json', JSON.stringify(index))
console.log(`\nwrote ${index.books.length} books + index.json`)
