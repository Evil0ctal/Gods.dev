import { describe, it, expect } from 'vitest'
import { lsCmd, cdCmd, catCmd } from '../../src/components/terminal/commands/fs'
import { createVfs } from '../../src/components/terminal/core/vfs-data'
import { HOME } from '../../src/components/terminal/core/vfs'
import { makeCtx } from './helpers'

const posts = [{ slug: 'hello', title: 'Hello', description: 'First post', date: '2026-07-25' }]
const vfsCtx = () => makeCtx({ vfs: createVfs(posts) })

describe('ls', () => {
  it('lists cwd entries including dotfiles', async () => {
    const res = await lsCmd.run([], vfsCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('.secrets/')
    expect(text).toContain('blog/')
    expect(text).toContain('README.txt')
  })
  it('lists a given path', async () => {
    const res = await lsCmd.run(['~/blog'], vfsCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('hello.md')
  })
  it('errors on missing path', async () => {
    const res = await lsCmd.run(['/nope'], vfsCtx())
    expect(res.lines[0]?.kind).toBe('error')
  })
})

describe('cd', () => {
  it('changes cwd and reports it', async () => {
    const ctx = vfsCtx()
    const res = await cdCmd.run(['.secrets'], ctx)
    expect(ctx.cwd).toBe(`${HOME}/.secrets`)
    expect(res.lines).toEqual([])
  })
  it('cd with no args goes home', async () => {
    const ctx = vfsCtx()
    ctx.setCwd('/etc')
    await cdCmd.run([], ctx)
    expect(ctx.cwd).toBe(HOME)
  })
  it('rejects files and missing dirs', async () => {
    const ctx = vfsCtx()
    const res = await cdCmd.run(['README.txt'], ctx)
    expect(res.lines[0]?.kind).toBe('error')
    expect(ctx.cwd).toBe(HOME)
  })
})

describe('cat', () => {
  it('prints file content', async () => {
    const res = await catCmd.run(['README.txt'], vfsCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('Evil0ctal')
  })
  it('prints the prophecy puzzle from ~/.secrets', async () => {
    const res = await catCmd.run(['~/.secrets/prophecy.txt'], vfsCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('M29xp3g0nQAsMmE0Z3AsZTMsMmOxp180pzIsZUNmoa0=')
    expect(text).toContain('flag submit')
  })
  it('errors on dirs and missing files', async () => {
    expect((await catCmd.run(['blog'], vfsCtx())).lines[0]?.kind).toBe('error')
    expect((await catCmd.run(['ghost.txt'], vfsCtx())).lines[0]?.kind).toBe('error')
    expect((await catCmd.run([], vfsCtx())).lines[0]?.kind).toBe('error')
  })
})
