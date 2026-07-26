import type { Command } from '../core/types'
import { SITE } from '../../../config/site'
import { PROJECTS } from '../../../data/projects'
import { aLink, badge, escapeHtml, headLine, htmlLine, line, tagChips } from '../core/utils'

export const aboutCmd: Command = {
  name: 'about',
  description: 'who runs this machine',
  category: 'intel',
  run() {
    return {
      lines: [
        htmlLine(`<span class="out-name">${SITE.name}</span> — security researcher &amp; open-source developer.`),
        line('  I break things to understand them, then build tools so you can too.', 'muted'),
        line(`  ${SITE.tagline}`, 'muted'),
        line(''),
        htmlLine(`full story  →  ${aLink('/about/', 'gods.dev/about')}`),
      ],
    }
  },
}

function fmtStars(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`
}

export const projectsCmd: Command = {
  name: 'projects',
  description: 'selected open-source work',
  category: 'content',
  run(_args, ctx) {
    const projects = ctx.projects.length > 0 ? ctx.projects : PROJECTS
    const lines = [headLine('selected open-source work'), line('')]
    for (const p of projects) {
      const star = typeof p.stars === 'number' ? `  ${badge(`★ ${fmtStars(p.stars)}`, 'star')}` : ''
      const chips = p.tags.length > 0 ? `  ${tagChips(p.tags)}` : ''
      lines.push(
        htmlLine(`<a class="term-link out-name" href="${escapeHtml(p.url)}">${escapeHtml(p.name)}</a>${star}${chips}`),
      )
      if (p.description) lines.push(line(`  ${p.description}`, 'muted'))
    }
    lines.push(line(''))
    lines.push(
      htmlLine(`more  →  ${aLink('/projects/', 'gods.dev/projects')}  ·  ${aLink(SITE.github, 'github.com/Evil0ctal')}`),
    )
    return { lines }
  },
}

export const contactCmd: Command = {
  name: 'contact',
  description: 'reach the operator',
  category: 'intel',
  run() {
    const row = (k: string, v: string) => htmlLine(`  <span class="kv-key">${k.padEnd(8)}</span>${v}`)
    return {
      lines: [
        headLine('reach the operator'),
        line(''),
        row('github', aLink(SITE.github, 'github.com/Evil0ctal')),
        row('email', aLink(`mailto:${SITE.email}`, SITE.email)),
        row('pgp', '<span class="line-muted">ask first. trust no one.</span>'),
      ],
    }
  },
}

export const studyCmd: Command = {
  name: 'study',
  description: 'bible study notes',
  usage: 'study [read <slug>]',
  category: 'scripture',
  run(args, ctx) {
    if (args[0] === 'read') {
      const slug = args[1]
      const s = ctx.studies.find((p) => p.slug === slug)
      if (!s) return { lines: [line(`study: no such study: ${slug ?? ''}`, 'error')] }
      return { lines: [line(`opening ~/study/${s.slug}.md ...`, 'muted')], navigate: `/study/${s.slug}/` }
    }
    if (ctx.studies.length === 0) {
      return { lines: [line('No studies yet. The word endures; the notes are coming.', 'muted')] }
    }
    return {
      lines: [
        headLine('bible study — rightly dividing the word'),
        line(''),
        ...ctx.studies.map((s) =>
          htmlLine(
            `  <span class="kv-key">${escapeHtml(s.date)}</span>  <a class="term-link out-name" href="/study/${escapeHtml(s.slug)}/">${escapeHtml(s.slug)}</a> — ${escapeHtml(s.title)}`,
          ),
        ),
        line(''),
        line('open one  →  study read <slug>   ·   source text  →  bible classics', 'muted'),
      ],
    }
  },
}

export const blogCmd: Command = {
  name: 'blog',
  description: 'read the blog',
  category: 'content',
  usage: 'blog [read <slug>]',
  run(args, ctx) {
    if (args[0] === 'read') {
      const slug = args[1]
      const post = ctx.posts.find((p) => p.slug === slug)
      if (!post) return { lines: [line(`blog: no such post: ${slug ?? ''}`, 'error')] }
      return { lines: [line(`opening ~/blog/${post.slug}.md ...`, 'muted')], navigate: `/blog/${post.slug}/` }
    }
    if (ctx.posts.length === 0) {
      return { lines: [line('No posts yet. The gods are still writing.', 'muted')] }
    }
    return {
      lines: [
        headLine('latest transmissions'),
        line(''),
        ...ctx.posts.map((p) =>
          htmlLine(
            `  <span class="kv-key">${escapeHtml(p.date)}</span>  <a class="term-link out-name" href="/blog/${escapeHtml(p.slug)}/">${escapeHtml(p.slug)}</a> — ${escapeHtml(p.title)}`,
          ),
        ),
        line(''),
        line('open one  →  blog read <slug>', 'muted'),
      ],
    }
  },
}
