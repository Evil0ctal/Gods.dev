import { describe, it, expect } from 'vitest'
import { FLAGS, sha256Hex, checkFlag } from '../../src/components/terminal/core/flags'
import { flagCmd } from '../../src/components/terminal/commands/flag'
import { makeCtx } from './helpers'

describe('sha256Hex', () => {
  it('hashes to lowercase hex', async () => {
    // echo -n "abc" | shasum -a 256
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('checkFlag', () => {
  const dummy = [{ id: 'test01', name: 'Dummy', sha256: '' }]
  it('accepts a submission whose hash matches', async () => {
    const flags = [{ ...dummy[0]!, sha256: await sha256Hex('gods{dummy}') }]
    expect(await checkFlag('gods{dummy}', flags)).toEqual(flags[0])
  })
  it('rejects non-matching submissions', async () => {
    const flags = [{ ...dummy[0]!, sha256: await sha256Hex('gods{dummy}') }]
    expect(await checkFlag('gods{nope}', flags)).toBeNull()
  })
  it('trims whitespace before hashing', async () => {
    const flags = [{ ...dummy[0]!, sha256: await sha256Hex('gods{dummy}') }]
    expect(await checkFlag('  gods{dummy}  ', flags)).toEqual(flags[0])
  })
})

describe('production flag registry', () => {
  it('contains flag01 with a 64-char hex hash and no plaintext', () => {
    const f = FLAGS.find((f) => f.id === 'flag01')
    expect(f?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(FLAGS)).not.toContain('gods{')
  })
})

describe('flag command', () => {
  it('is hidden and explains usage when called bare', async () => {
    expect(flagCmd.hidden).toBe(true)
    const res = await flagCmd.run([], makeCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('flag submit')
  })
  it('rejects a wrong flag with an error line', async () => {
    const res = await flagCmd.run(['submit', 'gods{wrong}'], makeCtx())
    expect(res.lines[0]?.kind).toBe('error')
  })
})
