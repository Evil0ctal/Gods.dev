import type { Command } from '../core/types'
import { SITE } from '../../../config/site'
import { PROJECTS } from '../../../data/projects'
import { aLink, escapeHtml, htmlLine, line } from '../core/utils'

export const aboutCmd: Command = {
  name: 'about',
  description: 'who runs this machine',
  category: 'intel',
  run() {
    return {
      lines: [
        line(`${SITE.name} — security researcher & open-source developer.`),
        line('I break things to understand them, then build tools so you can too.'),
        line(SITE.tagline, 'muted'),
        line(''),
        htmlLine(`Full story: ${aLink('/about/', 'gods.dev/about')}`),
      ],
    }
  },
}

function starBadge(n: number): string {
  const s = n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`
  return `<span class="line-success">★ ${s}</span>`
}

export const projectsCmd: Command = {
  name: 'projects',
  description: 'selected open-source work',
  category: 'content',
  run(_args, ctx) {
    const projects = ctx.projects.length > 0 ? ctx.projects : PROJECTS
    const lines = projects.flatMap((p) => [
      htmlLine(
        `${aLink(p.url, p.name)}  ${typeof p.stars === 'number' ? starBadge(p.stars) + '  ' : ''}<span class="muted">[${p.tags.join(', ')}]</span>`,
      ),
      line(`  ${p.description}`, 'muted'),
    ])
    return {
      lines: [...lines, htmlLine(`More: ${aLink('/projects/', 'gods.dev/projects')}`)],
    }
  },
}

export const contactCmd: Command = {
  name: 'contact',
  description: 'reach the operator',
  category: 'intel',
  run() {
    return {
      lines: [
        htmlLine(`GitHub  ${aLink(SITE.github, 'github.com/Evil0ctal')}`),
        htmlLine(`Email   ${aLink(`mailto:${SITE.email}`, SITE.email)}`),
        line('PGP     ask first. trust no one.', 'muted'),
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
        line('Bible studies — rightly dividing the word:', 'muted'),
        ...ctx.studies.map((s) =>
          htmlLine(
            `  ${escapeHtml(s.date)}  <a class="term-link" href="/study/${escapeHtml(s.slug)}/">${escapeHtml(s.slug)}</a> — ${escapeHtml(s.title)}`,
          ),
        ),
        line(''),
        line('Open one:  study read <slug>   ·   source text:  bible classics', 'muted'),
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
        line('Latest transmissions:', 'muted'),
        ...ctx.posts.map((p) =>
          htmlLine(
            `  ${escapeHtml(p.date)}  <a class="term-link" href="/blog/${escapeHtml(p.slug)}/">${escapeHtml(p.slug)}</a> — ${escapeHtml(p.title)}`,
          ),
        ),
        line(''),
        line('Open one:  blog read <slug>', 'muted'),
      ],
    }
  },
}
