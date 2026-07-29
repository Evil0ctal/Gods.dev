import type { Command, OutputLine } from '../core/types'
import { line, htmlLine, headLine, ruleLine, kvLine, aLink, tagChips } from '../core/utils'
import { BUILD, CHANGELOG } from '../../../config/build'
import { renderChangelog } from '../core/changelog'
import { USES } from '../../../data/uses'

const REPO = 'https://github.com/Evil0ctal/Gods.dev'

export const buildCmd: Command = {
  name: 'build',
  description: 'provenance of the build you are looking at',
  category: 'intel',
  run() {
    const lines: OutputLine[] = [
      headLine('build receipt'),
      ruleLine(44),
      kvLine('commit', BUILD.sha, 11),
      kvLine('committed', BUILD.date ? BUILD.date.replace('T', ' ').slice(0, 19) : 'unknown', 11),
      kvLine('built', BUILD.time ? BUILD.time.replace('T', ' ').slice(0, 19) + ' UTC' : 'unknown', 11),
      line(''),
    ]
    if (BUILD.sha !== 'dev') {
      lines.push(htmlLine(`verify: ${aLink(`${REPO}/commit/${BUILD.sha}`, `${REPO.replace('https://', '')}/commit/${BUILD.sha}`)}`))
    }
    lines.push(line('this page was generated from that exact commit. trust, but verify.', 'muted'))
    return { lines }
  },
}

const SEEN_KEY = 'gods:seen'

export const whatsnewCmd: Command = {
  name: 'whatsnew',
  description: 'recent changes to this site',
  category: 'intel',
  run() {
    let seen: string | null = null
    try {
      seen = localStorage.getItem(SEEN_KEY)
    } catch {
      /* private mode */
    }
    const lines = renderChangelog(CHANGELOG, seen)
    // mark everything seen, so next visit's counter is relative to now
    if (CHANGELOG.length > 0) {
      try {
        localStorage.setItem(SEEN_KEY, CHANGELOG[0]!.sha)
      } catch {
        /* private mode */
      }
    }
    return { lines }
  },
}

export const usesCmd: Command = {
  name: 'uses',
  description: 'the tools behind the projects',
  category: 'intel',
  run() {
    const lines: OutputLine[] = [headLine('/uses — the stack behind the work'), ruleLine(52)]
    for (const g of USES) {
      lines.push(kvLine(g.label, '', 20))
      lines.push(htmlLine(`  ${tagChips(g.items)}`))
    }
    lines.push(line(''))
    lines.push(line('inferred from public repos — the source of truth is the code.', 'muted'))
    return { lines }
  },
}
