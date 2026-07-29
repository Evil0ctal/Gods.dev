import { describe, it, expect } from 'vitest'
import { aboutCmd, projectsCmd, contactCmd, blogCmd } from '../../src/components/terminal/commands/content'
import { themeCmd, CORE_THEMES, SEASONAL_THEMES } from '../../src/components/terminal/commands/theme'
import { neofetchCmd } from '../../src/components/terminal/commands/neofetch'
import { makeCtx } from './helpers'

const posts = [
  { slug: 'newer', title: 'Newer Post', description: 'n', date: '2026-07-20' },
  { slug: 'older', title: 'Older Post', description: 'o', date: '2026-01-01' },
]

describe('about', () => {
  it('mentions the author and links the about page', async () => {
    const text = (await aboutCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('Evil0ctal')
    expect(text).toContain('/about/')
  })
})

describe('projects', () => {
  it('falls back to the static list when ctx has no projects', async () => {
    const text = (await projectsCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('Douyin_TikTok_Download_API')
    expect(text).toContain('/projects/')
  })
  it('renders live GitHub projects with star badges when provided', async () => {
    const projects = [
      { name: 'RepoA', description: 'desc a', url: 'https://github.com/Evil0ctal/RepoA', tags: ['python'], stars: 18979 },
      { name: 'RepoB', description: 'desc b', url: 'https://github.com/Evil0ctal/RepoB', tags: ['go'], stars: 470 },
    ]
    const text = (await projectsCmd.run([], makeCtx({ projects }))).lines.map((l) => l.text).join('\n')
    expect(text).toContain('RepoA')
    expect(text).toContain('★ 19k')
    expect(text).toContain('★ 470')
  })
})

describe('contact', () => {
  it('lists github and email', async () => {
    const text = (await contactCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    expect(text).toContain('github.com/Evil0ctal')
    expect(text).toContain('evil0ctal1985@gmail.com')
  })
})

describe('blog', () => {
  it('lists posts newest first with clickable slugs', async () => {
    const res = await blogCmd.run([], makeCtx({ posts }))
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text.indexOf('newer')).toBeLessThan(text.indexOf('older'))
    expect(text).toContain('href="/blog/newer/"')
  })
  it('blog read <slug> navigates to the post', async () => {
    const res = await blogCmd.run(['read', 'older'], makeCtx({ posts }))
    expect(res.navigate).toBe('/blog/older/')
  })
  it('blog read with unknown slug errors', async () => {
    const res = await blogCmd.run(['read', 'ghost'], makeCtx({ posts }))
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('reports when there are no posts yet', async () => {
    const res = await blogCmd.run([], makeCtx())
    expect(res.lines[0]?.kind).toBe('muted')
  })
})

describe('theme', () => {
  it('lists themes when called bare, marking the current one', async () => {
    const text = (await themeCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    for (const t of [...CORE_THEMES, ...SEASONAL_THEMES]) expect(text).toContain(t)
    expect(text).toContain('default (current)')
    expect(text).not.toContain('aureus') // secret theme, unlocked via the ARG
  })
  it('switches to a valid theme via ctx.setTheme', async () => {
    const ctx = makeCtx()
    const res = await themeCmd.run(['crt'], ctx)
    expect(ctx.getTheme()).toBe('crt')
    expect(res.lines[0]?.kind).toBe('success')
  })
  it('rejects unknown themes', async () => {
    const ctx = makeCtx({ setTheme: () => false })
    const res = await themeCmd.run(['rainbow'], ctx)
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('roasts the light theme', async () => {
    const res = await themeCmd.run(['light'], makeCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toMatch(/eyes|bright|regret/i)
  })
})

describe('neofetch', () => {
  it('prints ascii art and site facts', async () => {
    const res = await neofetchCmd.run([], makeCtx())
    expect(res.lines.some((l) => l.kind === 'ascii')).toBe(true)
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('gods.dev')
    expect(text).toContain('Uptime')
  })
})
