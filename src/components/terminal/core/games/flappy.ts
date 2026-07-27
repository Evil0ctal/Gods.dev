import type { GameLaunch, GameIO } from '../types'

/**
 * An original "flap through the gaps" game: a bird falls under gravity; each
 * flap gives it a lift; scrolling walls have gaps to thread. Original code and
 * block art — no borrowed assets.
 */

export const FLAPPY_W = 40
export const FLAPPY_H = 16
const BIRD_X = 8
const GRAVITY = 0.28
const FLAP_V = 1.7
const GAP_H = 5
const PIPE_SPACING = 15

export interface Pipe {
  x: number
  gap: number // top row of the gap
  passed: boolean
}

export interface FlappyState {
  y: number
  vy: number
  pipes: Pipe[]
  score: number
  ticks: number
  dead: boolean
}

function makePipe(x: number, rng: () => number): Pipe {
  const gap = 2 + Math.floor(rng() * (FLAPPY_H - GAP_H - 4))
  return { x, gap, passed: false }
}

export function newFlappy(rng: () => number): FlappyState {
  return {
    y: Math.floor(FLAPPY_H / 2),
    vy: 0,
    pipes: [makePipe(FLAPPY_W - 1, rng)],
    score: 0,
    ticks: 0,
    dead: false,
  }
}

export function flap(s: FlappyState): FlappyState {
  if (s.dead) return s
  return { ...s, vy: -FLAP_V }
}

export function tick(s: FlappyState, rng: () => number): FlappyState {
  if (s.dead) return s
  const vy = s.vy + GRAVITY
  const y = s.y + vy

  let pipes = s.pipes.map((p) => ({ ...p, x: p.x - 1 })).filter((p) => p.x >= -1)
  const last = pipes.length ? Math.max(...pipes.map((p) => p.x)) : -Infinity
  if (last <= FLAPPY_W - PIPE_SPACING) pipes.push(makePipe(FLAPPY_W - 1, rng))

  const row = Math.round(y)
  let dead = row < 0 || row >= FLAPPY_H
  let score = s.score
  for (const p of pipes) {
    if (p.x === BIRD_X && (row < p.gap || row >= p.gap + GAP_H)) dead = true
    if (!p.passed && p.x < BIRD_X) {
      p.passed = true
      score += 1
    }
  }
  return { y, vy, pipes, score, ticks: s.ticks + 1, dead }
}

export function renderFlappy(s: FlappyState): string {
  const grid: string[][] = Array.from({ length: FLAPPY_H }, () => Array.from({ length: FLAPPY_W }, () => ' '))
  for (const p of s.pipes) {
    if (p.x < 0 || p.x >= FLAPPY_W) continue
    for (let r = 0; r < FLAPPY_H; r++) {
      if (r < p.gap || r >= p.gap + GAP_H) grid[r]![p.x] = '<span class="g-snake">█</span>'
    }
  }
  const br = Math.max(0, Math.min(FLAPPY_H - 1, Math.round(s.y)))
  grid[br]![BIRD_X] = '<span class="g-head">◆</span>'
  const top = `┌${'─'.repeat(FLAPPY_W)}┐`
  const bot = `└${'─'.repeat(FLAPPY_W)}┘`
  const rows = grid.map((r) => `│${r.join('')}│`).join('\n')
  return `<pre class="game-grid">${top}\n${rows}\n${bot}\nscore <span class="line-success">${s.score}</span></pre>`
}

export function flappyGame(rng: () => number): GameLaunch {
  return {
    title: 'flappy',
    controls: 'space / ↑ to flap · q to quit',
    run(io: GameIO) {
      let state = newFlappy(rng)
      const doFlap = () => {
        state = flap(state)
        io.beep('move')
      }
      io.draw(renderFlappy(state))
      io.onKey((k) => {
        if (k === ' ' || k === 'ArrowUp' || k.toLowerCase() === 'w') doFlap()
      })
      io.every(95, () => {
        const prev = state.score
        state = tick(state, io.rng)
        if (state.score > prev) io.beep('eat')
        io.draw(renderFlappy(state))
        if (state.dead) {
          io.beep('lose')
          io.exit([
            { text: `down — flappy · score ${state.score}`, kind: 'error' },
            { text: 'fly again: flappy', kind: 'muted' },
          ])
        }
      })
    },
  }
}
