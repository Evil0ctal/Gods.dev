import { describe, it, expect } from 'vitest'
import { splitPipes, linesToText, runPipeline } from '../../src/components/terminal/core/pipeline'
import { grepCmd, wcCmd, headCmd, tailCmd, sortCmd, uniqCmd, revCmd } from '../../src/components/terminal/commands/textutils'
import { cowsayCmd, figletCmd, fortuneCmd, slCmd } from '../../src/components/terminal/commands/toys'
import { figletRender } from '../../src/data/figlet-font'
import { createRegistry } from '../../src/components/terminal/core/registry'
import { registerAll } from '../../src/components/terminal/commands/index'
import { makeCtx } from './helpers'

const text = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text).join('\n')

describe('pipeline plumbing', () => {
  it('splitPipes respects quotes', () => {
    expect(splitPipes('a | b | c')).toEqual(['a', 'b', 'c'])
    expect(splitPipes('echo "a | b" | rev')).toEqual(['echo "a | b"', 'rev'])
    expect(splitPipes('solo')).toEqual(['solo'])
  })
  it('linesToText strips trusted HTML and decodes entities', () => {
    expect(linesToText([{ text: 'plain' }, { text: '<b>x&amp;y</b>', html: true }])).toEqual(['plain', 'x&y'])
  })
})

describe('runPipeline', () => {
  const reg = createRegistry()
  registerAll(reg)
  const ctx = makeCtx({ registry: reg })

  it('feeds one command’s text into the next', async () => {
    expect(text(await runPipeline('echo hello | rev', ctx, reg))).toBe('olleh')
  })
  it('greps the output of another command (the CTF is greppable)', async () => {
    const res = await runPipeline('help | grep snake', ctx, reg)
    expect(text(res).toLowerCase()).toContain('snake')
    expect(res.lines.length).toBeLessThan(10) // filtered, not the whole help
  })
  it('chains three stages', async () => {
    // echo two words -> one per line? echo joins; use a multi-word grep instead
    expect(text(await runPipeline('echo ABBA | rev | rev', ctx, reg))).toBe('ABBA')
  })
  it('reports an unknown command in the pipe', async () => {
    expect((await runPipeline('echo x | nope', ctx, reg)).lines[0]?.kind).toBe('error')
  })
})

describe('text filters', () => {
  const ctx = makeCtx()
  const IN = ['alpha', 'beta', 'gamma', 'beta']
  it('grep filters, inverts, and folds case', () => {
    expect((grepCmd.run(['beta'], ctx, IN) as any).lines.length).toBe(2) // both 'beta' lines
    expect((grepCmd.run(['-v', 'beta'], ctx, IN) as any).lines.length).toBe(2) // alpha, gamma
    expect(text(grepCmd.run(['-v', 'beta'], ctx, IN) as any)).not.toContain('beta')
    expect(text(grepCmd.run(['-i', 'ALPHA'], ctx, IN) as any)).toContain('alpha')
    expect((grepCmd.run(['x'], ctx) as any).lines[0]?.kind).toBe('muted') // no stdin -> usage
  })
  it('wc counts lines/words/chars', () => {
    expect(text(wcCmd.run([], ctx, ['a b', 'c']) as any)).toContain('2 lines')
    expect(text(wcCmd.run(['-l'], ctx, ['a', 'b', 'c']) as any)).toBe('3')
  })
  it('head and tail slice', () => {
    expect((headCmd.run(['-n', '2'], ctx, IN) as any).lines.length).toBe(2)
    expect(text(tailCmd.run(['-n', '1'], ctx, IN) as any)).toBe('beta')
  })
  it('sort and sort -r', () => {
    expect(text(sortCmd.run([], ctx, ['c', 'a', 'b']) as any)).toBe('a\nb\nc')
    expect(text(sortCmd.run(['-r'], ctx, ['a', 'b', 'c']) as any)).toBe('c\nb\na')
  })
  it('uniq collapses adjacent dups; -c counts', () => {
    expect(text(uniqCmd.run([], ctx, ['a', 'a', 'b', 'a']) as any)).toBe('a\nb\na')
    expect(text(uniqCmd.run(['-c'], ctx, ['a', 'a', 'b']) as any)).toContain('2 a')
  })
  it('rev reverses each line', () => {
    expect(text(revCmd.run([], ctx, ['abc', 'xy']) as any)).toBe('cba\nyx')
  })
})

describe('toys', () => {
  const ctx = makeCtx()
  // cowsay output is HTML-escaped in .text; linesToText gives the visible view
  const visible = (r: any) => linesToText(r.lines).join('\n')
  it('cowsay wraps text in a bubble with a cow', () => {
    const t = visible(cowsayCmd.run(['hello'], ctx))
    expect(t).toContain('< hello >')
    expect(t).toContain('^__^')
  })
  it('cowsay reads piped input too', () => {
    expect(visible(cowsayCmd.run([], ctx, ['piped']))).toContain('< piped >')
  })
  it('figlet renders 5 rows of block art', () => {
    const rows = figletRender('HI')
    expect(rows.length).toBe(5)
    expect(rows.join('')).toContain('█')
    expect(text(figletCmd.run(['gods'], ctx) as any)).toContain('█')
  })
  it('fortune returns a non-empty line', () => {
    expect(text(fortuneCmd.run([], ctx) as any).length).toBeGreaterThan(3)
  })
  it('sl prints a train and is hidden', () => {
    expect(text(slCmd.run([], ctx) as any)).toContain('====')
    expect(slCmd.hidden).toBe(true)
  })
})
