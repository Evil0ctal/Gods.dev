const GLYPHS = 'アィウェオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF'

export function startMatrixRain(durationMs = 8000): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (document.getElementById('matrix-rain')) return

  const canvas = document.createElement('canvas')
  canvas.id = 'matrix-rain'
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.9)'
  document.body.appendChild(canvas)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const ctx = canvas.getContext('2d')!
  const fontSize = 16
  const cols = Math.floor(canvas.width / fontSize)
  const drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -50))

  const timer = setInterval(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.07)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#33ff66'
    ctx.font = `${fontSize}px monospace`
    drops.forEach((y, i) => {
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!
      ctx.fillText(ch, i * fontSize, y * fontSize)
      drops[i] = y * fontSize > canvas.height && Math.random() > 0.975 ? 0 : y + 1
    })
  }, 50)

  const stop = () => {
    clearInterval(timer)
    canvas.remove()
    window.removeEventListener('keydown', onKey)
  }
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stop()
  canvas.addEventListener('pointerdown', stop)
  window.addEventListener('keydown', onKey)
  setTimeout(stop, durationMs)
}
