/**
 * Three-act boot sequence: BIOS/POST → GRUB menu → kernel + systemd.
 * Renders into (and clears) a container element so progress bars and the
 * GRUB "screen" can update in place. Any user input flips skip() → the
 * whole thing fast-forwards to the end and returns.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface BootOptions {
  output: HTMLElement
  skip: () => boolean
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
    ['<span class="out-name">SeaBIOS</span> (Olympus Edition) v1.0 — the old gods', 90],
    ['CPU: divine spark @ 3.14 THz', 70],
    ['Memory Test: 64 PiB ... <span class="line-success">OK</span>', 90],
    ['Detecting drives: /dev/hubris  /dev/fate  /dev/styx', 80],
    ['Boot order: network → /dev/hubris', 70],
  ]
  for (const [html, ms] of bios) {
    add(html, 'line-muted')
    await pause(ms)
  }
  await pause(320)
  if (skip()) return clear()

  // ── Act 2: GRUB ─────────────────────────────────────────────────
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
    await pause(280)
    if (count && !skip()) count.textContent = n
  }
  await pause(200)
  if (skip()) return clear()

  // ── Act 3: kernel + systemd ─────────────────────────────────────
  clear()
  const kernel: Array<[string, number]> = [
    ['[    0.000000] gods.dev kernel 1.0.0-olympus booting...', 60],
    ['[    0.041337] cpu0: divine spark detected, 1 core online', 45],
    ['[    0.133700] mounting /dev/hubris on /home/guest ... <span class="line-success">ok</span>', 55],
    ['[    0.271828] loading personality: <span class="out-name">evil0ctal.ko</span>', 55],
    ['[    0.314159] easter_eggs: 8 modules loaded (some hidden)', 60],
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
    ['reality-check: FAILED — continuing anyway.', 'warn'],
    ['Started gods shell (gsh).', 'ok'],
  ]
  for (const [msg, kind] of units) {
    const tag =
      kind === 'ok'
        ? '[  <span class="line-success">OK</span>  ]'
        : '[ <span class="line-error">WARN</span> ]'
    add(`${tag} ${msg}`)
    await pause(90)
  }

  // progress bar, updated in place
  add('', 'line-muted')
  const barLine = add('', 'line-success')
  const WIDTH = 24
  for (let i = 0; i <= WIDTH; i++) {
    const pct = Math.round((i / WIDTH) * 100)
    barLine.innerHTML = ` booting <span class="boot-bar">${'█'.repeat(i)}${'░'.repeat(WIDTH - i)}</span> ${String(pct).padStart(3)}%`
    if (skip()) {
      barLine.innerHTML = ` booting <span class="boot-bar">${'█'.repeat(WIDTH)}</span> 100%`
      break
    }
    await sleep(28)
  }
  await pause(240)
  clear()
}
