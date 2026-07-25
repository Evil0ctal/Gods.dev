import { describe, it, expect } from 'vitest'
import { sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd } from '../../src/components/terminal/commands/eggs'
import { registerAll } from '../../src/components/terminal/commands/index'
import { createRegistry } from '../../src/components/terminal/core/registry'
import { makeCtx } from './helpers'

describe('easter egg commands', () => {
  it('are all hidden from help', () => {
    for (const c of [sudoCmd, rmCmd, vimCmd, matrixCmd, hackCmd, exitCmd]) {
      expect(c.hidden).toBe(true)
    }
  })
  it('sudo denies with attitude', async () => {
    const res = await sudoCmd.run(['rm', '-rf', '/'], makeCtx())
    expect(res.lines[0]?.kind).toBe('error')
    expect(res.lines.map((l) => l.text).join(' ')).toMatch(/incident|reported|not in the sudoers/i)
  })
  it('rm -rf / triggers the crash effect', async () => {
    const res = await rmCmd.run(['-rf', '/'], makeCtx())
    expect(res.effect).toBe('crash')
  })
  it('plain rm refuses politely without crashing', async () => {
    const res = await rmCmd.run(['file.txt'], makeCtx())
    expect(res.effect).toBeUndefined()
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('vim traps the user', async () => {
    const res = await vimCmd.run([], makeCtx())
    expect(res.effect).toBe('vim')
  })
  it('matrix and hack start the rain', async () => {
    expect((await matrixCmd.run([], makeCtx())).effect).toBe('matrix')
    expect((await hackCmd.run([], makeCtx())).effect).toBe('matrix')
  })
  it('exit has nowhere to go', async () => {
    const res = await exitCmd.run([], makeCtx())
    expect(res.lines.map((l) => l.text).join(' ')).toMatch(/nowhere|stay|cannot leave/i)
  })
})

describe('registerAll', () => {
  it('registers the full v1 command set including the social alias', () => {
    const reg = createRegistry()
    registerAll(reg)
    const all = reg.names(true)
    for (const name of [
      'about', 'blog', 'cat', 'cd', 'clear', 'contact', 'date', 'echo', 'exit', 'flag',
      'hack', 'help', 'history', 'ls', 'matrix', 'neofetch', 'projects', 'rm', 'social',
      'sudo', 'theme', 'vim', 'whoami',
    ]) {
      expect(all).toContain(name)
    }
    expect(reg.get('social')?.hidden).toBe(true)
    expect(reg.names(false)).not.toContain('sudo')
  })
})
