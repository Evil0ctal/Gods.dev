import { describe, it, expect } from 'vitest'
import { sha256Hex, checkFlag } from '../../src/components/terminal/core/flags'
import type { Challenge } from '../../src/components/terminal/core/challenges'
import { flagCmd, createFlagCmd } from '../../src/components/terminal/commands/flag'
import { makeCtx, makeMemoryCtf } from './helpers'

const dummy = (sha: string): Challenge => ({
  id: 'test01',
  name: 'Dummy',
  category: 'crypto',
  difficulty: 'easy',
  points: 10,
  sha256: sha,
  where: 'nowhere',
  prompt: 'p',
  hints: [],
})

describe('sha256Hex', () => {
  it('hashes to lowercase hex', async () => {
    // echo -n "abc" | shasum -a 256
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('checkFlag', () => {
  it('accepts a submission whose hash matches and returns the challenge', async () => {
    const c = [dummy(await sha256Hex('gods{dummy}'))]
    expect(await checkFlag('gods{dummy}', c)).toEqual(c[0])
  })
  it('rejects non-matching submissions', async () => {
    const c = [dummy(await sha256Hex('gods{dummy}'))]
    expect(await checkFlag('gods{nope}', c)).toBeNull()
  })
  it('trims whitespace before hashing', async () => {
    const c = [dummy(await sha256Hex('gods{dummy}'))]
    expect(await checkFlag('  gods{dummy}  ', c)).toEqual(c[0])
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
  // happy-path tests use an injected dummy challenge — never a real flag plaintext,
  // which must not appear in any committed file.
  const dummyChallenge: Challenge = {
    id: 'dummy', name: 'Dummy Gate', category: 'crypto', difficulty: 'easy', points: 42,
    sha256: 'x', where: 'nowhere', prompt: 'p', hints: [],
  }
  const dummyFlagCmd = createFlagCmd({ check: async (s) => (s.trim() === 'gods{ok}' ? dummyChallenge : null) })

  it('marks the challenge solved and reports points on a correct submission', async () => {
    const ctf = makeMemoryCtf()
    const res = await dummyFlagCmd.run(['submit', 'gods{ok}'], makeCtx({ ctf }))
    const text = res.lines.map((l) => l.text).join('\n')
    expect(res.lines[0]?.kind).toBe('success')
    expect(text).toContain('Dummy Gate')
    expect(text).toContain('+42')
    expect(ctf.solved()).toContain('dummy')
  })
  it('reports already-captured on a repeat submission without double-counting', async () => {
    const ctf = makeMemoryCtf(['dummy'])
    const res = await dummyFlagCmd.run(['submit', 'gods{ok}'], makeCtx({ ctf }))
    expect(res.lines.map((l) => l.text).join('\n')).toContain('already captured')
  })
})
