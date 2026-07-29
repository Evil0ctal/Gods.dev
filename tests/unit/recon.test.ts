import { describe, it, expect, vi, afterEach } from 'vitest'
import type { GameIO, OutputLine } from '../../src/components/terminal/core/types'
import {
  TRACE_HOPS, NMAP_PORTS, traceLines, nmapLines, hopText, portText,
  tracerouteGame, nmapGame, prefersReducedMotion,
} from '../../src/components/terminal/core/recon'
import { parseAgent, gpuRenderer, probeDevice, fingerprintSeed, visitorHash } from '../../src/components/terminal/core/device'
import { tracerouteCmd, nmapCmd, inspectCmd, fingerprintCmd } from '../../src/components/terminal/commands/recon'
import { makeCtx } from './helpers'

/** a fake GameIO that captures draws and lets the test drive keys/ticks */
function fakeIO() {
  let keyFn: (k: string) => void = () => {}
  let tickFn: () => void = () => {}
  const draws: string[] = []
  let exited = false
  let summary: OutputLine[] | undefined
  const io: GameIO = {
    draw: (h) => draws.push(h),
    onKey: (f) => (keyFn = f),
    every: (_ms, f) => (tickFn = f),
    exit: (s) => {
      exited = true
      summary = s
    },
    rng: () => 0.42,
    beep: () => {},
  }
  return {
    io,
    key: (k: string) => keyFn(k),
    tick: () => tickFn(),
    draws,
    get exited() {
      return exited
    },
    get summary() {
      return summary
    },
  }
}

describe('traceroute data + render', () => {
  it('ends at gods.dev and marks the android hop as timed out', () => {
    const last = TRACE_HOPS[TRACE_HOPS.length - 1]!
    expect(last.host).toBe('gods.dev')
    expect(last.kind).toBe('arrive')
    expect(TRACE_HOPS.some((h) => h.ms === null && h.kind === 'blocked')).toBe(true)
  })
  it('traceLines names the real projects', () => {
    const text = traceLines().map((l) => l.text).join('\n')
    expect(text).toContain('Douyin_TikTok_Download_API')
    expect(text).toContain('Whisper-Speech-to-Text-API')
    expect(text).toContain('gods.dev')
  })
  it('hopText keeps every row the same visible width up to the note column', () => {
    // columns before the note are fixed-width; prefix length must be constant
    const prefixLens = TRACE_HOPS.map((h) => hopText(h).indexOf(h.note))
    expect(new Set(prefixLens).size).toBe(1)
  })
  it('run() animates hop-by-hop and exits with the full trace', () => {
    const h = fakeIO()
    tracerouteGame().run(h.io)
    expect(h.draws.length).toBe(1) // initial frame
    for (let i = 0; i < TRACE_HOPS.length + 3; i++) h.tick()
    expect(h.exited).toBe(true)
    const summaryText = (h.summary ?? []).map((l) => l.text).join('\n')
    expect(summaryText).toContain('gods.dev')
    expect(summaryText).toContain('Douyin_TikTok_Download_API')
  })
  it('any key fast-forwards straight to the full trace', () => {
    const h = fakeIO()
    tracerouteGame().run(h.io)
    h.key('x')
    expect(h.exited).toBe(true)
    expect((h.summary ?? []).length).toBe(traceLines().length)
  })
})

describe('nmap data + render', () => {
  it('exposes elite/scraping/asr ports as open', () => {
    const open = NMAP_PORTS.filter((p) => p.state === 'open').map((p) => p.service)
    expect(open).toContain('elite')
    expect(open).toContain('scraping-api')
    expect(open).toContain('asr-stream')
  })
  it('nmapLines reports open + closed + filtered states', () => {
    const text = nmapLines().map((l) => l.text).join('\n')
    expect(text).toContain('open')
    expect(text).toContain('closed')
    expect(text).toContain('filtered')
    expect(text).toContain('reverse-engineering')
  })
  it('portText is fixed-width up to the detail column', () => {
    const prefixLens = NMAP_PORTS.map((p) => portText(p).indexOf(p.detail))
    expect(new Set(prefixLens).size).toBe(1)
  })
  it('run() reveals ports and exits with the report', () => {
    const h = fakeIO()
    nmapGame().run(h.io)
    for (let i = 0; i < NMAP_PORTS.length + 3; i++) h.tick()
    expect(h.exited).toBe(true)
    expect((h.summary ?? []).map((l) => l.text).join('\n')).toContain('services exposed')
  })
})

describe('device fingerprint', () => {
  it('parseAgent reads browser + OS out of a UA string', () => {
    expect(parseAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/120.0 Safari/537')).toContain('Chrome')
    expect(parseAgent('Mozilla/5.0 (Windows NT 10.0) Firefox/121.0')).toContain('on Windows')
    expect(parseAgent('')).toBe('an unknown vessel')
  })
  it('probeDevice returns a stable set of guarded facts and never throws', () => {
    const facts = probeDevice()
    const keys = facts.map((f) => f.key)
    for (const k of ['agent', 'gpu', 'timezone', 'cpu', 'dnt']) expect(keys).toContain(k)
    expect(facts.every((f) => typeof f.value === 'string' && f.value.length > 0)).toBe(true)
  })
  it('visitorHash is deterministic and 16 hex chars', async () => {
    const a = await visitorHash('seed-one')
    const b = await visitorHash('seed-one')
    const c = await visitorHash('seed-two')
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
  it('fingerprintSeed joins key=value pairs', () => {
    expect(fingerprintSeed([{ key: 'a', value: '1' }, { key: 'b', value: '2' }])).toBe('a=1|b=2')
  })
  it('parseAgent covers every OS and browser branch', () => {
    expect(parseAgent('X (Android 14) Chrome/120.0')).toContain('on Android')
    expect(parseAgent('X (iPhone; iOS 17) Version/17.0 Safari/605')).toContain('on iOS')
    expect(parseAgent('X (X11; Linux x86_64) Firefox/121.0')).toContain('on Linux')
    expect(parseAgent('X (Windows NT 10.0) Edg/120.0')).toContain('Edge')
    expect(parseAgent('X (Macintosh) OPR/106.0')).toContain('Opera')
    expect(parseAgent('some weird crawler/1.0')).toContain('unknown')
  })
})

describe('device probes in a hostile environment', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('gpuRenderer handles the no-context and unmasked-renderer paths', () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    expect(gpuRenderer()).toBe('no accelerated device')

    const fakeGl = {
      getExtension: (n: string) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 37446 } : null),
      getParameter: (p: number) => (p === 37446 ? 'Apple M3 Pro' : ''),
    }
    vi.stubGlobal('document', { createElement: () => ({ getContext: (t: string) => (t === 'webgl' ? fakeGl : null) }) })
    expect(gpuRenderer()).toBe('Apple M3 Pro')
  })

  it('visitorHash falls back to a non-crypto hash when SubtleCrypto is absent', async () => {
    vi.stubGlobal('crypto', {}) // no .subtle
    const h = await visitorHash('anything')
    expect(h).toMatch(/^[0-9a-f]{16}$/)
  })

  it('probeDevice degrades gracefully when navigator/screen/window are gone', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('screen', undefined)
    vi.stubGlobal('window', undefined)
    const facts = probeDevice()
    expect(facts.find((f) => f.key === 'agent')?.value).toBe('an unknown vessel')
    expect(facts.every((f) => f.value.length > 0)).toBe(true)
  })
})

describe('recon commands', () => {
  it('traceroute / nmap launch the animated game (title set)', () => {
    // jsdom-less env → prefersReducedMotion() is false → returns a game
    expect(prefersReducedMotion()).toBe(false)
    expect((tracerouteCmd.run([], makeCtx()) as any).game?.title).toBe('traceroute')
    expect((nmapCmd.run([], makeCtx()) as any).game?.title).toBe('nmap')
  })
  it('inspect prints the fingerprint readout with a visitor id', async () => {
    const res = await inspectCmd.run([], makeCtx())
    const text = res.lines.map((l) => l.text).join('\n')
    expect(text).toContain('fingerprint')
    expect(text).toContain('visitor-id')
    expect(text).toContain('fingerprinting')
    expect(inspectCmd.category).toBe('intel')
  })
  it('fingerprint is a hidden alias of inspect', () => {
    expect(fingerprintCmd.name).toBe('fingerprint')
    expect(fingerprintCmd.hidden).toBe(true)
  })
})
