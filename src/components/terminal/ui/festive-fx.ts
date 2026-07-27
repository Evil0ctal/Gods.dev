import type { FestiveEffect } from '../core/festivals'
import { startFireworks } from './fireworks'

/**
 * Transparent falling-glyph overlays (snow, hearts, spooky). Original canvas
 * particle code — glyphs drift down with a gentle sway and fade near the end.
 * Fully see-through (terminal stays visible), respects reduced-motion, and
 * removes itself after `durationMs`.
 */

const GLYPHS: Record<'snow' | 'hearts' | 'spooky', string[]> = {
  snow: ['❄', '❅', '·', '*'],
  hearts: ['❤', '♥', '💕'],
  spooky: ['🎃', '🦇', '👻', '☾'],
}

interface Flake {
  x: number
  y: number
  vy: number
  drift: number
  phase: number
  size: number
  glyph: string
}

function startFalling(kind: 'snow' | 'hearts' | 'spooky', durationMs = 8000): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (document.getElementById('festive-fx')) return

  const canvas = document.createElement('canvas')
  canvas.id = 'festive-fx'
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9997;pointer-events:none'
  document.body.appendChild(canvas)
  const resize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const ctx = canvas.getContext('2d')!
  const glyphs = GLYPHS[kind]
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const count = kind === 'snow' ? 90 : 40
  const flakes: Flake[] = Array.from({ length: count }, () => ({
    x: rand(0, canvas.width),
    y: rand(-canvas.height, 0),
    vy: rand(0.6, 2.2),
    drift: rand(-0.6, 0.6),
    phase: rand(0, Math.PI * 2),
    size: Math.round(rand(14, 26)),
    glyph: glyphs[Math.floor(Math.random() * glyphs.length)]!,
  }))

  const start = performance.now()
  let raf = 0
  function frame(t: number): void {
    raf = requestAnimationFrame(frame)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const remaining = durationMs - (t - start)
    const fade = remaining < 1500 ? Math.max(0, remaining / 1500) : 1
    for (const f of flakes) {
      f.y += f.vy
      f.phase += 0.02
      f.x += f.drift + Math.sin(f.phase) * 0.4
      if (f.y > canvas.height + 20) {
        f.y = -20
        f.x = rand(0, canvas.width)
      }
      ctx.globalAlpha = fade * 0.9
      ctx.font = `${f.size}px monospace`
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#bb9af7'
      ctx.fillText(f.glyph, f.x, f.y)
    }
    ctx.globalAlpha = 1
    if (t - start > durationMs) stop()
  }
  function stop(): void {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    canvas.remove()
  }
  raf = requestAnimationFrame(frame)
  setTimeout(stop, durationMs + 2000)
}

/** dispatch a festival's on-arrival effect */
export function startFestiveEffect(effect: FestiveEffect): void {
  if (effect === 'fireworks') startFireworks()
  else startFalling(effect)
}
