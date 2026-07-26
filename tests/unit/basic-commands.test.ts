import { describe, it, expect } from 'vitest'
import { helpCmd } from '../../src/components/terminal/commands/help'
import { echoCmd, dateCmd, whoamiCmd, clearCmd, historyCmd } from '../../src/components/terminal/commands/basic'
import { makeCtx } from './helpers'

describe('help', () => {
  it('lists visible commands with clickable names', async () => {
    const ctx = makeCtx()
    ctx.registry.register(helpCmd)
    ctx.registry.register(echoCmd)
    const res = await helpCmd.run([], ctx)
    const html = res.lines.map((l) => l.text).join('\n')
    expect(html).toContain('data-cmd="help"')
    expect(html).toContain('data-cmd="echo"')
    expect(html).toContain(echoCmd.description)
  })
  it('renders grouped box frame with category headers', async () => {
    const ctx = makeCtx()
    ctx.registry.register(helpCmd)
    ctx.registry.register(echoCmd)
    const res = await helpCmd.run([], ctx)
    const html = res.lines.map((l) => l.text).join('\n')
    expect(html).toContain('gsh (gods shell) 0.1')
    expect(html).toContain('┌─[ <span class="line-success">shell</span> ]')
    expect(html).toContain('│  ')
    expect(html).toContain('└──')
    expect(html).toContain('tip: TAB completes')
  })
  it('groups uncategorized commands under misc', async () => {
    const ctx = makeCtx()
    ctx.registry.register(helpCmd)
    ctx.registry.register({ name: 'mystery', description: 'no category', run: () => ({ lines: [] }) })
    const res = await helpCmd.run([], ctx)
    const html = res.lines.map((l) => l.text).join('\n')
    expect(html).toContain('<span class="line-success">misc</span>')
    expect(html).toContain('data-cmd="mystery"')
  })
})

describe('echo', () => {
  it('echoes args escaped', async () => {
    const res = await echoCmd.run(['<b>hi</b>'], makeCtx())
    expect(res.lines[0]?.text).toBe('&lt;b&gt;hi&lt;/b&gt;')
    expect(res.lines[0]?.html).toBe(true)
  })
  it('prints empty line without args', async () => {
    const res = await echoCmd.run([], makeCtx())
    expect(res.lines[0]?.text).toBe('')
  })
})

describe('whoami', () => {
  it('identifies the guest', async () => {
    const res = await whoamiCmd.run([], makeCtx())
    expect(res.lines[0]?.text).toContain('guest')
  })
})

describe('date', () => {
  it('prints a date string', async () => {
    const res = await dateCmd.run([], makeCtx())
    expect(res.lines[0]?.text).toMatch(/\d{4}/)
  })
})

describe('clear', () => {
  it('signals a screen clear', async () => {
    const res = await clearCmd.run([], makeCtx())
    expect(res.clear).toBe(true)
    expect(res.lines).toEqual([])
  })
})

describe('history', () => {
  it('lists numbered history entries', async () => {
    const ctx = makeCtx({ historyList: () => ['help', 'ls'] })
    const res = await historyCmd.run([], ctx)
    expect(res.lines[0]?.text).toMatch(/1\s+help/)
    expect(res.lines[1]?.text).toMatch(/2\s+ls/)
  })
  it('reports empty history', async () => {
    const res = await historyCmd.run([], makeCtx())
    expect(res.lines[0]?.kind).toBe('muted')
  })
})
