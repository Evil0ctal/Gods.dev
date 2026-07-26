import { describe, it, expect } from 'vitest'
import {
  CHALLENGES,
  findChallenge,
  orderedChallenges,
  rankTitle,
  scoreOf,
  totalPoints,
  findChallengeByHash,
} from '../../src/components/terminal/core/challenges'
import { sha256Hex } from '../../src/components/terminal/core/flags'
import {
  FORGE_JS,
  OLYMPUS_ACCESS_LOG,
  SCROLL_OF_HERMES,
  UNSEEN_TXT,
} from '../../src/components/terminal/core/ctf-artifacts'
import { ctfCmd } from '../../src/components/terminal/commands/ctf'
import { makeCtx, makeMemoryCtf } from './helpers'

// ── decode helpers (a player's toolkit) ──────────────────────────────
const b64 = (s: string) => atob(s)
const rot13 = (s: string) =>
  s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
  })

function decodeScroll(file: string): string {
  const payload = file.trim().split('\n').pop()!.trim()
  return rot13(b64(payload))
}

// Solve the forge WITHOUT eval: parse the shipped `slag` array + checksum gate
// out of the source, confirm "hephaestus" passes the gate, then apply the
// documented XOR transform. This exercises the real shipped data (slag/gate),
// so corrupting the artifact fails the test.
function runForge(src: string): string {
  const gate = Number(/!== (0x[0-9a-f]+)\)/.exec(src)![1])
  const slagBody = /slag = \[([\s\S]*?)\]/.exec(src)![1]!.replace(/\s+/g, '').replace(/,$/, '')
  const slag = JSON.parse(`[${slagBody}]`) as number[]
  const offering = 'hephaestus'
  let h = 0
  for (const c of offering) h = (h * 31 + c.charCodeAt(0)) % 65521
  if (h !== gate) throw new Error(`offering fails checksum gate: ${h} !== ${gate}`)
  let out = ''
  for (let i = 0; i < slag.length; i++) out += String.fromCharCode(slag[i]! ^ offering.charCodeAt(i % 10) ^ (i % 7))
  return out
}

function decodeZeroWidth(s: string): string {
  const ZW0 = '​', ZW1 = '‌', SEP = '‍'
  const zw = [...s].filter((c) => c === ZW0 || c === ZW1 || c === SEP).join('')
  return zw
    .split(SEP)
    .filter(Boolean)
    .map((g) => String.fromCharCode(parseInt([...g].map((c) => (c === ZW0 ? '0' : '1')).join(''), 2)))
    .join('')
}

function decodeFerryman(log: string): string {
  const chunks: Record<number, string> = {}
  for (const line of log.split('\n')) {
    const m = /\/styx\/ferry\?i=(\d+)&c=([^ "]+)/.exec(line)
    if (m) chunks[Number(m[1])] = m[2]!
  }
  const joined = Object.keys(chunks)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => chunks[i])
    .join('')
  return b64(joined)
}

function decodeAegisToken(token: string): string {
  const payload = JSON.parse(b64(token.split('.')[1]!))
  const key = 'admin' + 'zeus' // escalate role guest -> admin
  const raw = b64(payload.vault)
  let inner = ''
  for (let i = 0; i < raw.length; i++) inner += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  return b64(inner)
}

// ── challenge registry logic ─────────────────────────────────────────
describe('challenge registry', () => {
  it('has unique ids and 64-hex hashes', () => {
    const ids = CHALLENGES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CHALLENGES) expect(c.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
  it('scoreOf sums points of solved challenges only', () => {
    const two = orderedChallenges().slice(0, 2)
    const expected = two[0]!.points + two[1]!.points
    expect(scoreOf([two[0]!.id, two[1]!.id, 'nonexistent'])).toBe(expected)
  })
  it('ranks progress from mortal to god', () => {
    expect(rankTitle([])).toBe('mortal')
    expect(rankTitle([orderedChallenges()[0]!.id])).not.toBe('mortal')
    expect(rankTitle(CHALLENGES.map((c) => c.id))).toBe('god of gods.dev')
  })
  it('orders by ascending points and totals correctly', () => {
    const pts = orderedChallenges().map((c) => c.points)
    expect(pts).toEqual([...pts].sort((a, b) => a - b))
    expect(totalPoints()).toBe(pts.reduce((a, b) => a + b, 0))
  })
})

// ── THE critical gate: every shipped artifact must yield its registered flag ──
describe('challenge integrity — artifacts decode to the registered flag hash', () => {
  async function assertYields(id: string, plaintext: string) {
    const c = findChallenge(id)!
    expect(c, id).toBeDefined()
    const hash = await sha256Hex(plaintext)
    expect(hash, `${id}: decoded flag hash must match registry`).toBe(c.sha256)
    // the decoded flag must be a valid gods{...} and must equal a real flag,
    // proving the challenge is solvable AND the registry is honest
    expect(plaintext).toMatch(/^gods\{[ -~]+\}$/)
    // and the hash must be discoverable via findChallengeByHash (flag submit path)
    expect(findChallengeByHash(hash)?.id).toBe(id)
  }

  it('scroll-of-hermes: base64 -> rot13', async () => {
    await assertYields('scroll-of-hermes', decodeScroll(SCROLL_OF_HERMES))
  })
  it('forge-of-hephaestus: keygen("hephaestus")', async () => {
    await assertYields('forge-of-hephaestus', runForge(FORGE_JS))
  })
  it('things-not-seen: zero-width stego decode', async () => {
    await assertYields('things-not-seen', decodeZeroWidth(UNSEEN_TXT))
  })
  it('ferryman-ledger: reorder styx chunks -> base64', async () => {
    await assertYields('ferryman-ledger', decodeFerryman(OLYMPUS_ACCESS_LOG))
  })
  it('alg-none-ascension: jwt vault XOR adminzeus -> base64', async () => {
    const token = findChallenge('alg-none-ascension')!.artifact!
    await assertYields('alg-none-ascension', decodeAegisToken(token))
  })
})

// ── no plaintext flag leaks in the shipped artifacts ─────────────────
describe('artifacts do not leak plaintext flags', () => {
  it('no artifact string literally contains gods{', () => {
    for (const s of [SCROLL_OF_HERMES, FORGE_JS, UNSEEN_TXT, OLYMPUS_ACCESS_LOG]) {
      expect(s).not.toContain('gods{')
    }
    for (const c of CHALLENGES) if (c.artifact) expect(c.artifact).not.toContain('gods{')
  })
})

// ── ctf command ──────────────────────────────────────────────────────
describe('ctf command', () => {
  it('lists all challenges with a scoreboard', async () => {
    const res = await ctfCmd.run([], makeCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('gods.dev CTF')
    expect(text).toContain('/825 pts')
    for (const c of CHALLENGES) expect(text).toContain(`ctf ${c.id}`)
  })
  it('marks solved challenges in the list', async () => {
    const res = await ctfCmd.run([], makeCtx({ ctf: makeMemoryCtf(['scroll-of-hermes']) }))
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('✓')
  })
  it('shows challenge detail with prompt and where-to-find', async () => {
    const res = await ctfCmd.run(['scroll-of-hermes'], makeCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('Scroll of Hermes')
    expect(text).toContain('~/.ctf/scroll_of_hermes')
  })
  it('prints the token inline for the jwt challenge', async () => {
    const res = await ctfCmd.run(['alg-none-ascension'], makeCtx())
    expect(res.lines.map((l) => l.text).join('\n')).toContain('eyJhbGciOiJIUzI1NiI')
  })
  it('reveals hints one at a time', async () => {
    const res = await ctfCmd.run(['scroll-of-hermes', 'hint', '2'], makeCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('hint 2/')
  })
  it('rejects out-of-range hints and unknown challenges', async () => {
    expect((await ctfCmd.run(['scroll-of-hermes', 'hint', '99'], makeCtx())).lines[0]?.kind).toBe('error')
    expect((await ctfCmd.run(['nope'], makeCtx())).lines[0]?.kind).toBe('error')
  })
  it('scoreboard subcommand summarizes progress', async () => {
    const res = await ctfCmd.run(['scoreboard'], makeCtx({ ctf: makeMemoryCtf(['scroll-of-hermes']) }))
    expect(res.lines[0]?.text).toContain('>75</span>')
  })
  it('is registered under the ctf category', () => {
    expect(ctfCmd.category).toBe('ctf')
  })
})
