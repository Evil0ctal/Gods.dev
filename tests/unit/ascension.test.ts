import { describe, it, expect } from 'vitest'
import type { CommandResult } from '../../src/components/terminal/core/types'
import { FRAG1, FRAG2_HEX, FRAG3, ASCENSION_SHA256 } from '../../src/data/ascension'
import { sha256Hex } from '../../src/components/terminal/core/flags'
import { THEMES, SECRET_THEMES, CORE_THEMES, SEASONAL_THEMES } from '../../src/components/terminal/commands/theme'
import { ascendCmd } from '../../src/components/terminal/commands/ascend'
import { makeCtx } from './helpers'

// a player's toolkit: hex -> ascii, then join the three base64 fragments and decode
function hexToAscii(hex: string): string {
  let s = ''
  for (let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  return s
}
function assemblePassphrase(): string {
  const b64 = FRAG1 + hexToAscii(FRAG2_HEX) + FRAG3
  return atob(b64)
}

describe('ascension ARG', () => {
  it('the three breadcrumbs reassemble to the registered answer', async () => {
    const word = assemblePassphrase()
    expect(word).toMatch(/^[a-z]+$/) // a plain word, not garbage
    expect(await sha256Hex(word)).toBe(ASCENSION_SHA256)
  })
  it('no fragment leaks the plaintext passphrase', () => {
    const word = assemblePassphrase()
    for (const f of [FRAG1, FRAG2_HEX, FRAG3]) expect(f).not.toContain(word)
  })
  it('aureus is a valid theme but never listed in the public menu', () => {
    expect(THEMES as readonly string[]).toContain('aureus')
    expect(SECRET_THEMES as readonly string[]).toContain('aureus')
    expect([...CORE_THEMES, ...SEASONAL_THEMES] as readonly string[]).not.toContain('aureus')
  })
})

describe('ascend command', () => {
  const sync = (r: CommandResult | Promise<CommandResult>) => r as Promise<CommandResult>
  it('nudges toward the fragments when called bare', async () => {
    const res = await sync(ascendCmd.run([], makeCtx()))
    expect(res.lines.map((l) => l.text).join('\n')).toContain('three fragments')
    expect(ascendCmd.hidden).toBe(true)
  })
  it('rejects a wrong word', async () => {
    const res = await sync(ascendCmd.run(['mortal'], makeCtx()))
    expect(res.lines[0]?.kind).toBe('error')
  })
  it('promotes on the correct assembled word and dons the gold', async () => {
    let theme = 'default'
    const ctx = makeCtx({ setTheme: (t: string) => ((theme = t), true) })
    const res = await sync(ascendCmd.run([assemblePassphrase()], ctx))
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('ascended')
    expect(text).toContain('aureus')
    expect(theme).toBe('aureus')
  })
})
