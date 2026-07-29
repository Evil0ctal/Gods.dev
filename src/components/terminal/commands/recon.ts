import type { Command } from '../core/types'
import { line, htmlLine, headLine, ruleLine, kvLine, badge } from '../core/utils'
import { tracerouteGame, nmapGame, traceLines, nmapLines, prefersReducedMotion } from '../core/recon'
import { probeDevice, fingerprintSeed, visitorHash } from '../core/device'

export const tracerouteCmd: Command = {
  name: 'traceroute',
  description: 'trace the route to gods.dev — every hop is a real project',
  category: 'intel',
  run() {
    // animate in game-mode, unless the visitor asked for reduced motion
    return prefersReducedMotion() ? { lines: traceLines() } : { lines: [], game: tracerouteGame() }
  },
}

export const nmapCmd: Command = {
  name: 'nmap',
  description: 'scan gods.dev — the open ports are my skills',
  category: 'intel',
  run() {
    return prefersReducedMotion() ? { lines: nmapLines() } : { lines: [], game: nmapGame() }
  },
}

export const inspectCmd: Command = {
  name: 'inspect',
  description: "read your own device fingerprint — the signals trackers use",
  category: 'intel',
  async run() {
    const facts = probeDevice()
    const pad = Math.max(...facts.map((f) => f.key.length)) + 1
    const id = await visitorHash(fingerprintSeed(facts))
    return {
      lines: [
        headLine('fingerprint — what your browser hands every site you visit'),
        ruleLine(56),
        ...facts.map((f) => kvLine(f.key, f.value, pad)),
        ruleLine(56),
        htmlLine(`<span class="kv-key">${'visitor-id'.padEnd(pad)}</span>${badge(id, 'ok')} <span class="line-muted">SHA-256 of the above, computed in your browser</span>`),
        line(''),
        line('No cookies. No server. Trackers assemble exactly this to follow you', 'muted'),
        line('across sites — it is called device fingerprinting, and it is my day job.', 'muted'),
        htmlLine(`<span class="line-muted">open the same page in another browser and the id changes. that is the tell.</span>`),
      ],
    }
  },
}

// hidden alias — `fingerprint` is the word most people reach for
export const fingerprintCmd: Command = { ...inspectCmd, name: 'fingerprint', hidden: true }
