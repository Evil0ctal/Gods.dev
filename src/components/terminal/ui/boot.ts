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

/**
 * Classify document.referrer into a friendly "how you got here" phrase.
 * The Referer header is set by the browser and read locally — nothing is
 * logged or sent anywhere. Empty referrer → a direct/typed/bookmarked visit.
 */
function entryVector(): string {
  let ref = ''
  try {
    ref = document.referrer
  } catch {
    return 'an unreadable realm'
  }
  if (!ref) return 'direct — you summoned the gate yourself (typed, bookmarked, or from an app)'
  let host = ref
  try {
    host = new URL(ref).host.replace(/^www\./, '')
  } catch {
    /* keep the raw string */
  }
  try {
    if (host === location.host) return 'internal — you walked in from elsewhere on gods.dev'
  } catch {
    /* ignore */
  }
  const known: Array<[RegExp, string]> = [
    [/google\./, 'a Google search'],
    [/bing\./, 'a Bing search'],
    [/duckduckgo\./, 'a DuckDuckGo search'],
    [/(^|\.)(x|twitter)\.com$|(^|\.)t\.co$/, 'X / Twitter'],
    [/github\./, 'GitHub'],
    [/gitlab\./, 'GitLab'],
    [/news\.ycombinator\.com/, 'Hacker News'],
    [/reddit\./, 'Reddit'],
    [/linkedin\./, 'LinkedIn'],
    [/(facebook|fb)\./, 'Facebook'],
    [/(youtube\.com|youtu\.be)/, 'YouTube'],
    [/(^|\.)t\.me$|telegram\./, 'Telegram'],
    [/baidu\./, 'a Baidu search'],
    [/zhihu\./, 'Zhihu'],
    [/weibo\./, 'Weibo'],
  ]
  for (const [re, name] of known) if (re.test(host)) return `${name} (${host})`
  return host
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
    row('clock', `${clock} local`),
  ]
}

// small jitter helpers — a real machine never ticks on a fixed metronome
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!
const SPEEDS = ['1.4', '2.1', '3.7', '4.9', '6.3', '8.8', '11.2', '13.6', '0.9']

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
  // jittered pause: same feel, ±40% wobble so nothing lands on a grid
  const jpause = (ms: number) => pause(Math.round(ms * (0.6 + Math.random() * 0.8)))

  // a spinner task that "works" for a few jittery frames, then resolves.
  const spin = async (label: string, end = '<span class="line-success">ok</span>') => {
    const frames = ['-', '\\', '|', '/']
    const el = add('', 'line-muted')
    const total = rand(5, 10)
    for (let i = 0; i < total; i++) {
      if (skip()) break
      el.innerHTML = ` <span class="boot-star">[${frames[i % frames.length]}]</span> ${label}`
      await sleep(rand(55, 135))
    }
    const dots = '.'.repeat(Math.max(3, 46 - label.length))
    el.innerHTML = ` ${PLUS} ${label} <span class="line-muted">${dots}</span> ${end}`
  }

  // a *believable* download: advances in ragged chunks, occasionally stalls,
  // and prints a wobbling throughput + byte counter. resolves instantly on skip.
  const bar = async (label: string, width = 24, kib = rand(240, 6144)) => {
    const el = add('', 'line-success')
    const draw = (pct: number, tail: string, stalled = false) => {
      const fill = Math.round((pct / 100) * width)
      const doneK = Math.round((pct / 100) * kib)
      el.innerHTML =
        ` ${label} <span class="boot-bar">${'█'.repeat(fill)}${'░'.repeat(width - fill)}</span>` +
        ` ${String(pct).padStart(3)}%  <span class="${stalled ? 'line-error' : 'line-muted'}">` +
        `${doneK}/${kib} KiB${tail ? ' · ' + tail : ''}</span>`
    }
    let pct = 0
    while (pct < 100) {
      if (skip()) {
        draw(100, 'done')
        return
      }
      // network hiccup — freeze for a beat, flag it red, then recover
      if (pct > 12 && pct < 90 && Math.random() < 0.14) {
        draw(pct, 'stalled — retransmitting', true)
        await sleep(rand(280, 700))
      }
      pct = Math.min(100, pct + rand(2, 9))
      draw(pct, `${pick(SPEEDS)} MB/s`)
      await sleep(rand(50, 170))
    }
    draw(100, 'done')
  }

  // "decrypting" reveal: scrambled glyphs lock into the target left→right.
  const glitch = async (target: string, cls = 'line-ascii') => {
    const el = add('', cls)
    const scr = '!<>-_/\\|[]{}=+*^?#01θ=@$%&'
    const N = target.length
    for (let locked = 0; locked <= N; locked++) {
      if (skip()) break
      let s = ''
      for (let i = 0; i < N; i++) {
        s += i < locked || target[i] === ' ' ? target[i] : scr[rand(0, scr.length - 1)]
      }
      el.textContent = s
      await sleep(rand(24, 50))
    }
    el.textContent = target
  }

  // type a command out character-by-character behind a shell prompt.
  const typeCmd = async (cmd: string, prompt = '<span class="line-success">root</span>@vessel:~# ') => {
    const el = add('', 'line-muted')
    let shown = ''
    for (const ch of cmd) {
      if (skip()) {
        shown = cmd
        break
      }
      shown += ch
      el.innerHTML = `${prompt}<span class="out-name">${escapeHtml(shown)}</span><span class="boot-caret">█</span>`
      await sleep(rand(32, 92))
    }
    el.innerHTML = `${prompt}<span class="out-name">${escapeHtml(cmd)}</span>`
  }

  // ── Act 1: cold boot — the operator console comes online ────────
  await glitch('>>> ACCESSING gods.dev — hold the line <<<', 'line-ascii')
  await jpause(220)
  const banner = [
    '<span class="out-name">gsh</span> — the gods.dev operator console  ·  build 1.0-olympus',
    'Copyright (C) the Pantheon. Authorized vessels only.',
    '',
    `${STAR} cold boot — initializing framework modules ...... <span class="line-success">ok</span>`,
    `${STAR} loaded 8 payloads · 7 exploits · 12 auxiliary`,
    `${STAR} acquiring target: <span class="out-name">gods.dev</span> (you)`,
  ]
  for (const html of banner) {
    add(html, 'line-muted')
    await jpause(150)
  }
  await jpause(360)
  if (skip()) return clear()

  // ── Act 2: recon (fingerprint the visitor's real machine) ───────
  clear()
  add(`${STAR} recon — fingerprinting the vessel you arrived in`, 'line-muted')
  add(`${STAR} <span class="line-muted">everything below is read locally. no packets leave this machine.</span>`, 'line-muted')
  add('', 'line-muted')
  for (const l of await fingerprint()) {
    add(l, 'line-muted')
    await jpause(90)
  }
  add('', 'line-muted')
  // entry-vector probe: where did this visitor come from? (Referer, read locally)
  await spin('tracing entry vector — where did you come from?', `<span class="out-name">${escapeHtml(entryVector())}</span>`)
  add('', 'line-muted')
  add(`${PLUS} fingerprint complete — <span class="out-name">0 bytes</span> exfiltrated.`, 'line-muted')
  await jpause(600)
  if (skip()) return clear()

  // ── Act 3: jailbreak the vessel (pure theatre, fictional target) ─
  clear()
  await glitch('████  JAILBREAKING THE VESSEL  ████', 'line-ascii')
  await jpause(240)
  add(`${STAR} using <span class="out-name">olympus/http/gates_of_hubris</span> (CVE-θ-3141)`, 'line-muted')
  await jpause(150)
  add(`${STAR} started reverse handler on 127.0.0.1:31337`, 'line-muted')
  await jpause(180)
  if (skip()) return clear()

  await spin('leaking kernel base — defeating kASLR', '<span class="out-name">0xθ8000</span>')
  await spin('grooming the heap into shape')
  await bar('downloading poc   hubris.rop  ', 24)
  add(`${STAR} sending stage (<span class="out-name">divine_spark.elf</span>, 31337 bytes) ...`, 'line-muted')
  await jpause(200)
  await spin('building ROP chain (θ gadgets)')
  await spin('smashing the stack canary')
  add(`${MINUS} <span class="line-error">Cerberus/3.0</span> WAF awake — three heads, one door`, 'line-muted')
  await jpause(220)
  await spin('bypassing Cerberus/3.0', '<span class="line-success">bypassed</span>')
  if (skip()) return clear()

  await bar('uploading payload divine_spark.elf', 24)
  await spin('escaping the sandbox (seatbelt)')
  await spin('patching amfid — every signature is valid now')
  await spin('hooking syscalls · task_for_pid(0)')
  await bar('patching kernel   __TEXT       ', 24, rand(2048, 8192))
  await spin('remounting rootfs read-write', '<span class="line-success">rw</span>')
  await jpause(180)
  await glitch('>>> ROOT OBTAINED — the vessel is yours <<<', 'line-success')
  await jpause(200)
  add(`${PLUS} session <span class="out-name">1</span> opened  (root@vessel → gods.dev:31337)`, 'line-muted')
  await jpause(500)
  if (skip()) return clear()

  // ── Act 4a: post-ex — prove root, then reboot the vessel ────────
  clear()
  await typeCmd('whoami')
  add('root  (uid=0)  —  well, in the demo. earn it for real: try <span class="out-name">ctf</span>', 'line-muted')
  await jpause(260)
  await typeCmd('uname -a')
  add('gods.dev 1.0.0-olympus #1 SMP the-old-gods x86_θ GNU/Divinity', 'line-muted')
  await jpause(260)
  await typeCmd('bootstrap --persist && reboot   # plant bootrom, respring')
  add(`${STAR} persistence planted — rebooting the vessel into <span class="out-name">gods.dev</span> ...`, 'line-muted')
  await jpause(650)
  if (skip()) return clear()

  // ── Act 4b: GRUB (revived from the original boot) ───────────────
  clear()
  const grub = [
    ' ┌─ GNU GRUB  version 0.θ ─────────────────────────┐',
    ' │ <span class="boot-grub-sel">*gods.dev  (kernel 1.0-olympus)                  </span>│',
    ' │  gods.dev  (recovery mode)                      │',
    ' │  memtest86+  (the old gods)                     │',
    ' └─────────────────────────────────────────────────┘',
    '',
    ' Use ↑ and ↓ to select. Booting the highlighted entry in <span class="boot-count">3</span>s.',
  ]
  for (const l of grub) add(l, 'line-ascii')
  const count = output.querySelector<HTMLElement>('.boot-count')
  for (const n of ['2', '1', '0']) {
    await pause(rand(360, 560))
    if (count && !skip()) count.textContent = n
  }
  await jpause(280)
  if (skip()) return clear()

  // ── Act 4c: kernel dmesg (revived) + systemd → gsh ──────────────
  clear()
  const kernel: Array<[string, number]> = [
    ['[    0.000000] gods.dev kernel 1.0.0-olympus booting...', 130],
    ['[    0.041337] cpu0: divine spark detected, all cores online', 120],
    ['[    0.133700] mounting /dev/hubris on /home/guest ... <span class="line-success">ok</span>', 130],
    ['[    0.271828] loading personality: <span class="out-name">evil0ctal.ko</span>', 120],
    ['[    0.314159] easter_eggs: 8 modules loaded (some hidden)', 130],
    ['[    0.577215] ctf: 7 challenges armed', 120],
  ]
  for (const [html] of kernel) {
    add(html, 'line-muted')
    await jpause(120)
  }

  const units: Array<[string, 'ok' | 'warn']> = [
    ['Reached target Olympus.', 'ok'],
    ['Mounted /home/guest.', 'ok'],
    ['Started Divine Spark Service.', 'ok'],
    ['Reached target Network (github.com/Evil0ctal).', 'ok'],
    ['Started easter-egg daemon.', 'ok'],
    ['Started the arcade (snake, 2048, ascent).', 'ok'],
    ['reality-check: FAILED — continuing anyway.', 'warn'],
    ['Started gods shell (gsh).', 'ok'],
  ]
  for (const [msg, kind] of units) {
    const tag =
      kind === 'ok' ? '[  <span class="line-success">OK</span>  ]' : '[ <span class="line-error">WARN</span> ]'
    add(`${tag} ${msg}`)
    await jpause(110)
  }

  add('', 'line-muted')
  await bar('respringing · spawning gsh    ', 28, rand(512, 2048))
  await jpause(420)
  clear()
}
