import type { GameLaunch, GameIO, OutputLine } from './types'
import { htmlLine, line, escapeHtml, name as nameSpan } from './utils'

/**
 * `traceroute` and `nmap` — hacker-tool theatre that doubles as a portfolio.
 * The hops are Evil0ctal's real projects; the open ports are his real skills.
 * Both animate in game-mode (one row per tick) and, when done, leave the full
 * report in the scrollback. Pure data + render here; the command layer decides
 * animate-vs-instant based on prefers-reduced-motion.
 */

/* ── traceroute ─────────────────────────────────────────────────────── */

export interface Hop {
  n: number
  host: string
  ms: number | null // null → timed out (* * *)
  note: string
  kind: 'infra' | 'proj' | 'blocked' | 'arrive'
}

export const TRACE_TARGET = 'gods.dev (185.199.108.153)'

export const TRACE_HOPS: Hop[] = [
  { n: 1, host: 'guest@localhost', ms: 0.3, note: 'you are here', kind: 'infra' },
  { n: 2, host: 'edge.gods.dev', ms: 8, note: 'GitHub Pages edge', kind: 'infra' },
  { n: 3, host: 'async-scraper', ms: 22, note: 'Douyin_TikTok_Download_API', kind: 'proj' },
  { n: 4, host: 'wechat-wasm-gw', ms: 31, note: 'WeChat Channels · WASM RE', kind: 'proj' },
  { n: 5, host: 'whisper-asr-edge', ms: 40, note: 'Whisper-Speech-to-Text-API', kind: 'proj' },
  { n: 6, host: 'android-re-lab', ms: null, note: 'firewalled — reversing in progress', kind: 'blocked' },
  { n: 7, host: 'gods.dev', ms: 52, note: 'You have arrived.', kind: 'arrive' },
]

const HOST_W = 18

/** plain, aligned text for one hop (used for width math + tests) */
export function hopText(h: Hop): string {
  const num = String(h.n).padStart(2)
  const host = h.host.padEnd(HOST_W)
  const ms = (h.ms === null ? '* * *' : `${h.ms} ms`).padStart(7)
  return ` ${num}  ${host}  ${ms}  ${h.note}`
}

/** the same line with theme colouring; visible text is identical to hopText */
export function hopHtml(h: Hop): string {
  const num = `<span class="line-muted">${String(h.n).padStart(2)}</span>`
  const hostText = h.kind === 'proj' || h.kind === 'arrive' ? nameSpan(h.host) : escapeHtml(h.host)
  const hostPad = ' '.repeat(Math.max(0, HOST_W - h.host.length))
  const msRaw = h.ms === null ? '* * *' : `${h.ms} ms`
  const msPad = ' '.repeat(Math.max(0, 7 - msRaw.length))
  const msCls = h.ms === null ? 'line-error' : 'line-success'
  const ms = `${msPad}<span class="${msCls}">${escapeHtml(msRaw)}</span>`
  const noteCls = h.kind === 'arrive' ? 'line-success' : h.kind === 'blocked' ? 'line-error' : 'line-muted'
  const note = `<span class="${noteCls}">${escapeHtml(h.note)}</span>`
  return ` ${num}  ${hostText}${hostPad}  ${ms}  ${note}`
}

/** the full report, for instant (reduced-motion) output and the exit summary */
export function traceLines(): OutputLine[] {
  return [
    line(`traceroute to ${TRACE_TARGET}, ${TRACE_HOPS.length} hops max`, 'muted'),
    ...TRACE_HOPS.map((h) => htmlLine(hopHtml(h))),
  ]
}

function traceGrid(shown: number): string {
  const head = `traceroute to ${escapeHtml(TRACE_TARGET)}`
  const rows = TRACE_HOPS.slice(0, shown).map(hopHtml).join('\n')
  const probing = shown < TRACE_HOPS.length ? `\n <span class="line-muted">${String(shown + 1).padStart(2)}  probing…</span>` : ''
  return `<pre class="game-grid"><span class="line-muted">${head}</span>\n${rows}${probing}</pre>`
}

export function tracerouteGame(): GameLaunch {
  return {
    title: 'traceroute',
    controls: 'any key to skip · q to quit',
    run(io: GameIO) {
      let shown = 0
      let settle = 0
      io.draw(traceGrid(shown))
      // any key fast-forwards to the full trace
      io.onKey(() => {
        shown = TRACE_HOPS.length
        io.draw(traceGrid(shown))
        io.exit(traceLines())
      })
      io.every(360, () => {
        if (shown < TRACE_HOPS.length) {
          shown++
          io.beep('key')
          io.draw(traceGrid(shown))
          return
        }
        // linger a beat on the finished trace, then drop it into scrollback
        if (settle++ >= 1) io.exit(traceLines())
      })
    },
  }
}

/* ── nmap ───────────────────────────────────────────────────────────── */

export interface Port {
  port: string
  state: 'open' | 'closed' | 'filtered'
  service: string
  detail: string
}

export const NMAP_PORTS: Port[] = [
  { port: '22/tcp', state: 'open', service: 'ssh', detail: 'pubkey only — mortals need not knock' },
  { port: '80/tcp', state: 'open', service: 'http', detail: '301 → https' },
  { port: '443/tcp', state: 'open', service: 'https', detail: 'astro-static · HSTS' },
  { port: '1337/tcp', state: 'open', service: 'elite', detail: 'reverse-engineering' },
  { port: '3000/tcp', state: 'open', service: 'scraping-api', detail: 'async · rate-limited, be nice' },
  { port: '9000/tcp', state: 'open', service: 'asr-stream', detail: 'whisper · faster-whisper backend' },
  { port: '8080/tcp', state: 'filtered', service: 'android-re', detail: 'behind Frida' },
  { port: '31337/tcp', state: 'closed', service: 'leet', detail: 'try harder' },
]

const PORT_W = 10
const STATE_W = 9
const SVC_W = 13

export function portText(p: Port): string {
  return `${p.port.padEnd(PORT_W)}${p.state.padEnd(STATE_W)}${p.service.padEnd(SVC_W)}${p.detail}`
}

export function portHtml(p: Port): string {
  const stateCls = p.state === 'open' ? 'line-success' : p.state === 'filtered' ? 'line-error' : 'line-muted'
  const port = escapeHtml(p.port.padEnd(PORT_W))
  const state = `<span class="${stateCls}">${escapeHtml(p.state.padEnd(STATE_W))}</span>`
  const svc = p.state === 'open' ? nameSpan(p.service) + ' '.repeat(Math.max(0, SVC_W - p.service.length)) : escapeHtml(p.service.padEnd(SVC_W))
  const detail = `<span class="line-muted">${escapeHtml(p.detail)}</span>`
  return `${port}${state}${svc}${detail}`
}

export function nmapLines(): OutputLine[] {
  const open = NMAP_PORTS.filter((p) => p.state === 'open').length
  return [
    line(`Starting Nmap 13.37 ( https://gods.dev )`, 'muted'),
    line(`Nmap scan report for ${TRACE_TARGET}`, 'muted'),
    line('Host is up (0.0042s latency).', 'muted'),
    htmlLine(`<span class="kv-key">${'PORT'.padEnd(PORT_W)}${'STATE'.padEnd(STATE_W)}${'SERVICE'.padEnd(SVC_W)}</span>NOTE`),
    ...NMAP_PORTS.map((p) => htmlLine(portHtml(p))),
    line(`Nmap done: 1 host up — ${open} services exposed, 0 humans harmed.`, 'muted'),
  ]
}

function nmapGrid(shown: number): string {
  const header = `<span class="line-muted">Nmap scan report for ${escapeHtml(TRACE_TARGET)}</span>`
  const cols = `<span class="kv-key">${'PORT'.padEnd(PORT_W)}${'STATE'.padEnd(STATE_W)}${'SERVICE'.padEnd(SVC_W)}</span>NOTE`
  const rows = NMAP_PORTS.slice(0, shown).map(portHtml).join('\n')
  const scanning = shown < NMAP_PORTS.length ? `\n<span class="line-muted">scanning ${NMAP_PORTS.length - shown} more ports…</span>` : ''
  return `<pre class="game-grid">${header}\n${cols}\n${rows}${scanning}</pre>`
}

export function nmapGame(): GameLaunch {
  return {
    title: 'nmap',
    controls: 'any key to skip · q to quit',
    run(io: GameIO) {
      let shown = 0
      let settle = 0
      io.draw(nmapGrid(shown))
      io.onKey(() => {
        shown = NMAP_PORTS.length
        io.draw(nmapGrid(shown))
        io.exit(nmapLines())
      })
      io.every(220, () => {
        if (shown < NMAP_PORTS.length) {
          shown++
          io.beep('key')
          io.draw(nmapGrid(shown))
          return
        }
        if (settle++ >= 1) io.exit(nmapLines())
      })
    },
  }
}

/* ── shared ─────────────────────────────────────────────────────────── */

/** true when the visitor asked for less motion — commands fall back to an
    instant, non-animated report. Guarded so it is safe in non-browser envs. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
