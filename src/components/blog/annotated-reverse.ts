import { CIPHER, KEY, BYTES_PER_ROW } from '../../data/annotated-reverse'

/* ── pure helpers (unit-tested) ────────────────────────────────────── */

export const N = CIPHER.length

/** the decrypted byte at i: ciphertext XOR recovered keystream */
export function plainByte(i: number): number {
  return (CIPHER[i]! ^ KEY[i]!) & 0xff
}

export function hex(b: number): string {
  return b.toString(16).padStart(2, '0').toUpperCase()
}

export function asciiChar(b: number): string {
  return b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·'
}

/** ASCII of the first n decrypted bytes — used to prove the reveal works */
export function revealedAscii(n: number): string {
  let s = ''
  for (let i = 0; i < Math.min(n, N); i++) s += asciiChar(plainByte(i))
  return s
}

/** the `ftyp` brand sits at bytes 4..7; it is legible once byte 7 is peeled */
export function ftypVisible(n: number): boolean {
  return n >= 8 && revealedAscii(n).slice(4, 8) === 'ftyp'
}

/* ── the interactive widget ────────────────────────────────────────── */

const off = (r: number) => (r * BYTES_PER_ROW).toString(16).padStart(4, '0')

function buildMarkup(): string {
  const rows: string[] = []
  for (let start = 0; start < N; start += BYTES_PER_ROW) {
    const cells: string[] = []
    const ascii: string[] = []
    for (let i = start; i < Math.min(start + BYTES_PER_ROW, N); i++) {
      cells.push(`<span class="arev-b" data-i="${i}">${hex(CIPHER[i]!)}</span>`)
      ascii.push(`<span class="arev-a" data-i="${i}">·</span>`)
    }
    rows.push(
      `<div class="arev-row"><span class="arev-off">${off(start / BYTES_PER_ROW)}</span><span class="arev-hex">${cells.join('')}</span><span class="arev-asc">${ascii.join('')}</span></div>`,
    )
  }
  return `
    <div class="arev-head">on-disk: <span class="arev-noise">/data/wechat/channels/cache/9f2c…mp4</span> · ${N} bytes · "encrypted"</div>
    <div class="arev-dump">${rows.join('')}</div>
    <div class="arev-controls">
      <input type="range" min="0" max="${N}" value="0" step="1" class="arev-slider" aria-label="keystream peel depth" />
      <span class="arev-count" aria-live="polite">0 / ${N} bytes peeled</span>
      <button type="button" class="arev-all">reveal all</button>
      <button type="button" class="arev-reset">reset</button>
    </div>
    <div class="arev-callout" hidden>
      ▸ there it is — <span class="arev-hl">66 74 79 70</span> = <span class="arev-hl">"ftyp"</span>, the ISO Base Media box header.
      This stream was never encrypted with anything stronger than a keystream you just walked by hand.
    </div>`
}

/** Mount the widget into #annotated-reverse if present (no-op otherwise). */
export function mountAnnotatedReverse(): void {
  const root = document.getElementById('annotated-reverse')
  if (!root) return
  root.classList.add('arev')
  root.innerHTML = buildMarkup()

  const hexCells = [...root.querySelectorAll<HTMLElement>('.arev-b')]
  const ascCells = [...root.querySelectorAll<HTMLElement>('.arev-a')]
  const slider = root.querySelector<HTMLInputElement>('.arev-slider')!
  const count = root.querySelector<HTMLElement>('.arev-count')!
  const callout = root.querySelector<HTMLElement>('.arev-callout')!

  function render(n: number): void {
    for (let i = 0; i < N; i++) {
      const revealed = i < n
      const b = revealed ? plainByte(i) : CIPHER[i]!
      hexCells[i]!.textContent = hex(b)
      hexCells[i]!.classList.toggle('revealed', revealed)
      ascCells[i]!.textContent = revealed ? asciiChar(plainByte(i)) : '·'
      ascCells[i]!.classList.toggle('revealed', revealed)
    }
    count.textContent = `${n} / ${N} bytes peeled`
    callout.hidden = !ftypVisible(n)
  }

  slider.addEventListener('input', () => render(Number(slider.value)))
  root.querySelector('.arev-all')!.addEventListener('click', () => {
    slider.value = String(N)
    render(N)
  })
  root.querySelector('.arev-reset')!.addEventListener('click', () => {
    slider.value = '0'
    render(0)
  })
  render(0)
}
