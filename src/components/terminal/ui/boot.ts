import { escapeHtml } from '../core/utils'

/**
 * Four-act boot: BIOS/POST → host probe → GRUB → kernel/systemd.
 * The host-probe act reads the visitor's own browser facts (cores, memory,
 * GPU, display, locale, agent) entirely client-side and prints them back —
 * nothing is sent anywhere. Renders into (and clears) a container so progress
 * bars and the GRUB "screen" update in place. Any input flips skip() → the
 * sequence fast-forwards to the end and returns.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface BootOptions {
  output: HTMLElement
  skip: () => boolean
}

const val = (s: string) => `<span class="out-name">${escapeHtml(s)}</span>`

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

function gpuRenderer(): string {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return 'no accelerated device'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const r = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : ''
    return r || 'a shy graphics device'
  } catch {
    return 'a shy graphics device'
  }
}

/** lines describing the visitor's own machine — real values, read locally */
function hostProbe(): string[] {
  const n = navigator as Navigator & { deviceMemory?: number }
  const cores = n.hardwareConcurrency ? `${n.hardwareConcurrency} cores online` : 'core count sealed'
  const mem = n.deviceMemory ? `≥ ${n.deviceMemory} GiB` : 'undisclosed'
  const dpr = Number((window.devicePixelRatio || 1).toFixed(2))
  const display = `${screen.width}×${screen.height} @ ${dpr}x · viewport ${window.innerWidth}×${window.innerHeight}`
  const lang = n.language || 'unknown'
  let tz = 'unknown'
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
  } catch {
    /* ignore */
  }
  const touch = 'ontouchstart' in window || n.maxTouchPoints > 0 ? 'present' : 'absent'
  const net = n.onLine ? 'online' : 'offline'
  return [
    `  cpu ......... ${val(cores)}`,
    `  memory ...... ${val(mem)}`,
    `  gpu ......... ${val(gpuRenderer())}`,
    `  display ..... ${val(display)}`,
    `  input ....... keyboard, mouse, touch: ${val(touch)}`,
    `  locale ...... ${val(lang)}  ·  tz ${val(tz)}`,
    `  agent ....... ${val(parseAgent())}`,
    `  uplink ...... ${val(net)}`,
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

  // ── Act 1: BIOS / POST ──────────────────────────────────────────
  const bios: Array<[string, number]> = [
    ['<span class="out-name">SeaBIOS</span> (Olympus Edition) v1.0 — the old gods', 160],
    ['Copyright (C) the Pantheon. All realms reserved.', 140],
    ['', 80],
    ['CPU: divine spark @ 3.14 THz ..................... <span class="line-success">OK</span>', 150],
    ['Memory Test: 64 PiB ............................. <span class="line-success">OK</span>', 170],
    ['Detecting drives: /dev/hubris  /dev/fate  /dev/styx', 150],
    ['Boot order: network → /dev/hubris', 130],
  ]
  for (const [html, ms] of bios) {
    add(html, 'line-muted')
    await pause(ms)
  }
  await pause(420)
  if (skip()) return clear()

  // ── Act 2: host probe (the visitor's real machine) ──────────────
  clear()
  add('probing host — scrying the vessel you arrived in ...', 'line-muted')
  await pause(360)
  for (const l of hostProbe()) {
    add(l, 'line-muted')
    await pause(150)
  }
  add('', 'line-muted')
  add('  <span class="line-success">✓</span> vessel accepted. no telemetry leaves this machine.', 'line-muted')
  await pause(650)
  if (skip()) return clear()

  // ── Act 3: GRUB ─────────────────────────────────────────────────
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
    await pause(520)
    if (count && !skip()) count.textContent = n
  }
  await pause(300)
  if (skip()) return clear()

  // ── Act 4: kernel + systemd ─────────────────────────────────────
  clear()
  const kernel: Array<[string, number]> = [
    ['[    0.000000] gods.dev kernel 1.0.0-olympus booting...', 130],
    ['[    0.041337] cpu0: divine spark detected, 1 core online', 120],
    ['[    0.133700] mounting /dev/hubris on /home/guest ... <span class="line-success">ok</span>', 130],
    ['[    0.271828] loading personality: <span class="out-name">evil0ctal.ko</span>', 120],
    ['[    0.314159] easter_eggs: 8 modules loaded (some hidden)', 130],
    ['[    0.577215] ctf: 7 challenges armed', 120],
  ]
  for (const [html, ms] of kernel) {
    add(html, 'line-muted')
    await pause(ms)
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
      kind === 'ok'
        ? '[  <span class="line-success">OK</span>  ]'
        : '[ <span class="line-error">WARN</span> ]'
    add(`${tag} ${msg}`)
    await pause(130)
  }

  // progress bar, updated in place
  add('', 'line-muted')
  const barLine = add('', 'line-success')
  const WIDTH = 28
  for (let i = 0; i <= WIDTH; i++) {
    const pct = Math.round((i / WIDTH) * 100)
    barLine.innerHTML = ` booting <span class="boot-bar">${'█'.repeat(i)}${'░'.repeat(WIDTH - i)}</span> ${String(pct).padStart(3)}%`
    if (skip()) {
      barLine.innerHTML = ` booting <span class="boot-bar">${'█'.repeat(WIDTH)}</span> 100%`
      break
    }
    await sleep(45)
  }
  await pause(400)
  clear()
}
