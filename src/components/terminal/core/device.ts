/**
 * `inspect` / `fingerprint` — a readout of the VISITOR's own device, built
 * from exactly the signals a tracker would use (no cookies, no server). This
 * is Evil0ctal's craft turned on the reader: parse the UA, read the GPU, hash
 * the lot into a stable visitor id, and say plainly how it is done.
 * Every probe is guarded so it degrades to 'sealed' instead of throwing.
 */

export interface Fact {
  key: string
  value: string
}

function nav(): any {
  return typeof navigator !== 'undefined' ? (navigator as any) : {}
}

/** best-effort "Browser on OS" from the UA string */
export function parseAgent(ua: string): string {
  if (!ua) return 'an unknown vessel'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad|iOS/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'an unknown OS'
  const m =
    ua.match(/(Firefox)\/([\d.]+)/) ||
    ua.match(/(Edg)\/([\d.]+)/) ||
    ua.match(/(OPR)\/([\d.]+)/) ||
    ua.match(/(Chrome)\/([\d.]+)/) ||
    ua.match(/Version\/([\d.]+).*(Safari)/)
  const browser = m ? (m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1] === 'Safari' || m[2] === 'Safari' ? 'Safari' : m[1]) : 'an unknown browser'
  const ver = m ? (m[2] && m[2] !== 'Safari' ? m[2] : m[1] && /[\d.]/.test(m[1]) ? m[1] : '') : ''
  return `${browser}${ver ? ' ' + String(ver).split('.')[0] : ''} on ${os}`
}

/** unmasked WebGL renderer, or a graceful fallback */
export function gpuRenderer(): string {
  try {
    if (typeof document === 'undefined') return 'sealed (no DOM)'
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return 'no accelerated device'
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const r = dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) : ''
    return r || 'a shy graphics device'
  } catch {
    return 'a shy graphics device'
  }
}

/** the full readout, one Fact per line */
export function probeDevice(): Fact[] {
  const n = nav()
  const scr = typeof screen !== 'undefined' ? screen : ({} as Screen)
  const win = typeof window !== 'undefined' ? window : ({} as Window)
  const val = (v: unknown, fallback = 'sealed'): string => (v === undefined || v === null || v === '' ? fallback : String(v))

  let tz = 'sealed'
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'sealed'
  } catch {
    /* ignore */
  }
  const dpr = (win as any).devicePixelRatio ? Number(Number((win as any).devicePixelRatio).toFixed(2)) : undefined
  const conn = (n.connection && n.connection.effectiveType) || undefined
  const langs = Array.isArray(n.languages) && n.languages.length ? n.languages.join(', ') : n.language

  return [
    { key: 'agent', value: parseAgent(n.userAgent || '') },
    { key: 'platform', value: val(n.platform) },
    { key: 'cpu', value: n.hardwareConcurrency ? `${n.hardwareConcurrency} logical cores` : 'core count sealed' },
    { key: 'memory', value: n.deviceMemory ? `≥ ${n.deviceMemory} GiB` : 'undisclosed' },
    { key: 'gpu', value: gpuRenderer() },
    {
      key: 'display',
      value: `${val((scr as any).width, '?')}×${val((scr as any).height, '?')}${dpr ? ` @ ${dpr}x` : ''} · ${val((scr as any).colorDepth, '?')}-bit`,
    },
    { key: 'viewport', value: `${val((win as any).innerWidth, '?')}×${val((win as any).innerHeight, '?')}` },
    { key: 'timezone', value: tz },
    { key: 'languages', value: val(langs) },
    { key: 'connection', value: val(conn, 'unknown link') },
    { key: 'touch', value: (n.maxTouchPoints ?? 0) > 0 || (typeof win === 'object' && 'ontouchstart' in win) ? 'present' : 'absent' },
    { key: 'cookies', value: n.cookieEnabled ? 'enabled' : 'disabled' },
    { key: 'dnt', value: n.doNotTrack === '1' ? 'requested' : 'not set' },
  ]
}

/** stable seed string from the fingerprintable facts */
export function fingerprintSeed(facts: Fact[]): string {
  return facts.map((f) => `${f.key}=${f.value}`).join('|')
}

/** a short hex visitor id — SHA-256 of the seed, first 16 hex chars.
    Falls back to a non-crypto hash where SubtleCrypto is unavailable. */
export async function visitorHash(seed: string): Promise<string> {
  try {
    const subtle = (globalThis.crypto && globalThis.crypto.subtle) || undefined
    if (subtle) {
      const buf = await subtle.digest('SHA-256', new TextEncoder().encode(seed))
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
    }
  } catch {
    /* fall through */
  }
  // deterministic non-crypto fallback (FNV-1a) so the command always returns something
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0') + '00000000'
}
