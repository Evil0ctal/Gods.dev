import { escapeHtml } from '../core/utils'

/**
 * Four-act boot, styled as an offensive-security operator console:
 *   1. cold boot — the gsh operator console comes online
 *   2. recon    — fingerprint the visitor's own machine (all read locally)
 *   3. exploit  — an msfconsole/meterpreter-flavoured run against olympus
 *   4. session  — drop into the gods shell (gsh)
 *
 * The recon act reads the visitor's browser facts (cores, memory, GPU, display,
 * pointer, theme, network, privacy signals, agent…) entirely client-side and
 * prints them back — nothing is sent anywhere; the "exploit" is pure theatre
 * against a fictional target. Renders into (and clears) a container so progress
 * bars update in place. Any input flips skip() → the sequence fast-forwards to
 * the end and returns.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface BootOptions {
  output: HTMLElement
  skip: () => boolean
}

const val = (s: string) => `<span class="out-name">${escapeHtml(s)}</span>`
const STAR = '<span class="boot-star">[*]</span>'
const PLUS = '<span class="line-success">[+]</span>'
const MINUS = '<span class="line-error">[-]</span>'

/** best-effort friendly "Browser X on OS" from the UA / UA-Client-Hints */
function parseAgent(): string {
  try {
    const nav = navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand: string; version: string }>; platform?: string }
    }
    const ua = nav.userAgent || ''
    let os = nav.userAgentData?.platform || ''
    if (!os) {
      if (/Windows/.test(ua)) os = 'Windows'
      else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS'
      else if (/Android/.test(ua)) os = 'Android'
      else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS'
      else if (/Linux/.test(ua)) os = 'Linux'
      else os = 'an unknown realm'
    }
    const hint = nav.userAgentData?.brands?.find((b) => !/Not.?A.?Brand/i.test(b.brand))
    if (hint) return `${hint.brand} ${hint.version} on ${os}`
    const m = /(Firefox|Edg|OPR|Chrome|Safari)\/(\d+)/.exec(ua)
    const name = m ? { Edg: 'Edge', OPR: 'Opera' }[m[1]!] ?? m[1] : 'a browser'
    return `${name}${m ? ' ' + m[2] : ''} on ${os}`
  } catch {
    return 'an unknown vessel'
  }
}

function gpu(): string {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return 'no accelerated device'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const vendor = ext ? (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) : ''
    const r = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : ''
    const s = [vendor, r].filter(Boolean).join(' / ')
    return s || 'a shy graphics device'
  } catch {
    return 'a shy graphics device'
  }
}

/** high-entropy UA-CH (arch / bitness / platform version) — async, guarded */
async function kernelString(): Promise<string> {
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string
      getHighEntropyValues?: (h: string[]) => Promise<Record<string, string>>
    }
  }
  const plat = nav.userAgentData?.platform || (navigator.platform ?? 'unknown')
  try {
    const hev = await nav.userAgentData?.getHighEntropyValues?.([
      'architecture',
      'bitness',
      'platformVersion',
    ])
    if (hev) {
      const arch = hev.architecture ? `${hev.architecture}${hev.bitness ? '/' + hev.bitness : ''}` : ''
      const ver = hev.platformVersion ? ` ${hev.platformVersion}` : ''
      return [`${plat}${ver}`, arch].filter(Boolean).join(' · ')
    }
  } catch {
    /* ignore */
  }
  return plat
}

const mq = (q: string): boolean => {
  try {
    return window.matchMedia(q).matches
  } catch {
    return false
  }
}

/** lines describing the visitor's own machine — real values, read locally */
async function fingerprint(): Promise<string[]> {
  const n = navigator as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string; downlink?: number; rtt?: number }
    doNotTrack?: string
  }
  const perf = performance as Performance & { memory?: { jsHeapSizeLimit?: number } }

  const cores = n.hardwareConcurrency ? `${n.hardwareConcurrency} cores` : 'core count sealed'
  const heap = perf.memory?.jsHeapSizeLimit
    ? ` · js heap ≤ ${Math.round(perf.memory.jsHeapSizeLimit / 1048576)} MiB`
    : ''
  const mem = n.deviceMemory ? `≥ ${n.deviceMemory} GiB${heap}` : `undisclosed${heap}`
  const dpr = Number((window.devicePixelRatio || 1).toFixed(2))
  const display = `${screen.width}×${screen.height} @ ${dpr}x · ${screen.colorDepth}-bit · viewport ${window.innerWidth}×${window.innerHeight}`

  const pointer = mq('(pointer: fine)') ? 'fine' : mq('(pointer: coarse)') ? 'coarse' : 'unknown'
  const touch = 'ontouchstart' in window || n.maxTouchPoints > 0 ? `${n.maxTouchPoints || '?'} pts` : 'none'
  const theme = mq('(prefers-color-scheme: dark)') ? 'dark' : 'light'
  const motion = mq('(prefers-reduced-motion: reduce)') ? 'reduced' : 'full'

  const lang = n.language || 'unknown'
  const langs = Array.isArray(n.languages) && n.languages.length > 1 ? ` [${n.languages.slice(0, 4).join(', ')}]` : ''
  let tz = 'unknown'
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
  } catch {
    /* ignore */
  }

  const c = n.connection
  const uplink = [
    c?.effectiveType,
    typeof c?.downlink === 'number' ? `${c.downlink} Mbps` : null,
    typeof c?.rtt === 'number' ? `${c.rtt} ms rtt` : null,
    n.onLine ? 'online' : 'offline',
  ]
    .filter(Boolean)
    .join(' · ')

  const dnt = n.doNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1' ? 'on' : 'unset'
  const privacy = `cookies: ${navigator.cookieEnabled ? 'on' : 'off'} · DNT: ${dnt}`
  let vector = 'direct'
  try {
    if (document.referrer) vector = `referred by ${new URL(document.referrer).host}`
  } catch {
    /* ignore */
  }
  let clock = 'unknown'
  try {
    clock = new Date().toLocaleString(lang, { hour12: false })
  } catch {
    /* ignore */
  }

  const row = (k: string, v: string) => `    ${k.padEnd(9, '.')}. ${val(v)}`
  return [
    row('host', parseAgent()),
    row('kernel', await kernelString()),
    row('cpu', cores),
    row('ram', mem),
    row('gpu', gpu()),
    row('display', display),
    row('pointer', `${pointer} · touch: ${touch}`),
    row('theme', `${theme} · motion: ${motion}`),
    row('locale', `${lang}${langs} · tz ${tz}`),
    row('uplink', uplink),
    row('privacy', privacy),
    row('vector', vector),
    row('clock', `${clock} local`),
  ]
}

export async function playBoot({ output, skip }: BootOptions): Promise<void> {
  const add = (html: string, cls = '') => {
    const div = document.createElement('div')
    div.className = `term-line boot-line${cls ? ` ${cls}` : ''}`
    div.innerHTML = html
    output.appendChild(div)
    div.scrollIntoView({ block: 'end' })
    return div
  }
  const clear = () => output.querySelectorAll('.boot-line').forEach((el) => el.remove())
  const pause = async (ms: number) => {
    if (!skip()) await sleep(ms)
  }
  // an in-place progress bar; resolves once full (or immediately on skip)
  const runBar = async (label: string, width: number, step: number) => {
    const bl = add('', 'line-success')
    for (let i = 0; i <= width; i++) {
      const pct = Math.round((i / width) * 100)
      bl.innerHTML = ` ${label} <span class="boot-bar">${'█'.repeat(i)}${'░'.repeat(width - i)}</span> ${String(pct).padStart(3)}%`
      if (skip()) {
        bl.innerHTML = ` ${label} <span class="boot-bar">${'█'.repeat(width)}</span> 100%`
        return
      }
      await sleep(step)
    }
  }

  // ── Act 1: cold boot — the operator console comes online ────────
  const banner: Array<[string, number]> = [
    ['<span class="out-name">gsh</span> — the gods.dev operator console  ·  build 1.0-olympus', 150],
    ['Copyright (C) the Pantheon. Authorized vessels only.', 130],
    ['', 70],
    [`${STAR} cold boot — initializing framework modules ................ <span class="line-success">ok</span>`, 150],
    [`${STAR} loaded 8 payloads · 7 exploits · 12 auxiliary`, 140],
    [`${STAR} acquiring target: <span class="out-name">gods.dev</span> (you)`, 160],
  ]
  for (const [html, ms] of banner) {
    add(html, 'line-muted')
    await pause(ms)
  }
  await pause(360)
  if (skip()) return clear()

  // ── Act 2: recon (fingerprint the visitor's real machine) ───────
  clear()
  add(`${STAR} recon — fingerprinting the vessel you arrived in`, 'line-muted')
  add(`${STAR} <span class="line-muted">everything below is read locally. no packets leave this machine.</span>`, 'line-muted')
  add('', 'line-muted')
  for (const l of await fingerprint()) {
    add(l, 'line-muted')
    await pause(95)
  }
  add('', 'line-muted')
  add(`${PLUS} fingerprint complete — <span class="out-name">0 bytes</span> exfiltrated.`, 'line-muted')
  await pause(650)
  if (skip()) return clear()

  // ── Act 3: exploit (pure theatre against a fictional target) ────
  clear()
  const pre: Array<[string, number]> = [
    [`${STAR} using <span class="out-name">olympus/http/gates_of_hubris</span> (CVE-θ-3141)`, 150],
    [`${STAR} started reverse handler on 127.0.0.1:31337`, 150],
    [`${STAR} heap grooming ....................................... <span class="line-success">done</span>`, 170],
    [`${STAR} running exploit against <span class="out-name">gods.dev</span> ...`, 220],
  ]
  for (const [html, ms] of pre) {
    add(html, 'line-muted')
    await pause(ms)
  }
  await runBar('downloading poc  hubris.rop ', 24, 40)
  await pause(140)
  const mid: Array<[string, number]> = [
    [`${STAR} sending stage (<span class="out-name">divine_spark.elf</span>, 31337 bytes) ...`, 200],
    [`${MINUS} <span class="line-error">Cerberus/3.0</span> WAF detected — three heads, one door`, 200],
    [`${STAR} bypassing WAF via 0xθ .............................. <span class="line-success">bypassed</span>`, 220],
    [`${PLUS} session <span class="out-name">1</span> opened  (guest@vessel → gods.dev:31337)`, 240],
  ]
  for (const [html, ms] of mid) {
    add(html, 'line-muted')
    await pause(ms)
  }
  await pause(420)
  if (skip()) return clear()

  // ── Act 4: post-ex → drop into the gods shell ───────────────────
  clear()
  const shell: Array<[string, number]> = [
    ['<span class="line-success">gsh</span> session 1 &gt; <span class="out-name">whoami</span>', 200],
    ['guest  (uid=1000)  —  root is earned, not given. try: <span class="out-name">ctf</span>', 220],
    ['<span class="line-success">gsh</span> session 1 &gt; <span class="out-name">uname -a</span>', 200],
    ['gods.dev 1.0.0-olympus #1 SMP the-old-gods x86_θ GNU/Divinity', 200],
    ['<span class="line-success">gsh</span> session 1 &gt; <span class="out-name">exec /bin/gsh</span>', 220],
  ]
  for (const [html, ms] of shell) {
    add(html, 'line-muted')
    await pause(ms)
  }

  const units: Array<[string, 'ok' | 'warn']> = [
    ['Mounted /home/guest.', 'ok'],
    ['Loaded personality: evil0ctal.ko', 'ok'],
    ['Armed 7 CTF challenges · 8 easter-egg modules.', 'ok'],
    ['Reached target Network (github.com/Evil0ctal).', 'ok'],
    ['reality-check: FAILED — continuing anyway.', 'warn'],
    ['Started gods shell (gsh).', 'ok'],
  ]
  for (const [msg, kind] of units) {
    const tag =
      kind === 'ok' ? '[  <span class="line-success">OK</span>  ]' : '[ <span class="line-error">WARN</span> ]'
    add(`${tag} ${msg}`)
    await pause(120)
  }

  add('', 'line-muted')
  await runBar('spawning gsh', 28, 42)
  await pause(400)
  clear()
}
