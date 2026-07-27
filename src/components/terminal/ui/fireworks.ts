import { beep } from '../core/sound'

/**
 * Original canvas fireworks: rockets rise, burst into gravity-pulled sparks
 * that fade. Colours pull from the active theme's CSS variables so it matches
 * whatever palette is live. Respects prefers-reduced-motion (no-op) and
 * removes itself after `durationMs`.
 */

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

function themeColors(): string[] {
  const s = getComputedStyle(document.documentElement)
  const pick = (v: string, fallback: string) => s.getPropertyValue(v).trim() || fallback
  return [
    pick('--accent', '#7aa2f7'),
    pick('--accent-2', '#bb9af7'),
    pick('--ok', '#9ece6a'),
    pick('--warn', '#e0af68'),
    pick('--err', '#f7768e'),
    pick('--fg', '#c0caf5'),
  ]
}

export function startFireworks(durationMs = 6000): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (document.getElementById('fireworks')) return

  const canvas = document.createElement('canvas')
  canvas.id = 'fireworks'
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9997;pointer-events:none'
  document.body.appendChild(canvas)
  const resize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const ctx = canvas.getContext('2d')!
  const colors = themeColors()
  let sparks: Spark[] = []
  const rand = (a: number, b: number) => a + Math.random() * (b - a)

  function burst(x: number, y: number): void {
    const color = colors[Math.floor(Math.random() * colors.length)]!
    const n = Math.floor(rand(28, 46))
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n
      const speed = rand(1.5, 4.5)
      sparks.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 1, color })
    }
    beep('pop')
  }

  let last = 0
  const start = performance.now()
  let raf = 0
  function frame(t: number): void {
    raf = requestAnimationFrame(frame)
    // fade the previous frame for trails
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (t - last > rand(350, 650) && t - start < durationMs - 1200) {
      last = t
      burst(rand(canvas.width * 0.15, canvas.width * 0.85), rand(canvas.height * 0.12, canvas.height * 0.55))
    }

    sparks.forEach((p) => {
      p.vy += 0.05 // gravity
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.012
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, 2.5, 2.5)
    })
    ctx.globalAlpha = 1
    sparks = sparks.filter((p) => p.life > 0)

    if (t - start > durationMs && sparks.length === 0) stop()
  }

  function stop(): void {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    canvas.remove()
  }
  raf = requestAnimationFrame(frame)
  // safety cap in case something wedges the loop
  setTimeout(stop, durationMs + 3000)
}
