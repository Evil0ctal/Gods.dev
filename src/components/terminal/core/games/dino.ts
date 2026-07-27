import type { GameLaunch, GameIO } from '../types'

/**
 * An original endless-runner: a creature sprints across the shell, leaping
 * cacti that scroll in from the right. Distance is the score. All original
 * code and block art — no borrowed sprites.
 */

export const DINO_W = 48
export const DINO_H = 9
const DINO_X = 4
const GROUND = DINO_H - 1
const GRAVITY = 0.5
const JUMP_V = 2.6

export interface Obstacle {
  x: number
  h: number // 1 or 2 cells tall
}

export interface DinoState {
  y: number // cells above ground (float)
  vy: number
  onGround: boolean
  obstacles: Obstacle[]
  score: number
  ticks: number
  dead: boolean
}

export function newDino(): DinoState {
  return { y: 0, vy: 0, onGround: true, obstacles: [{ x: DINO_W - 1, h: 1 }], score: 0, ticks: 0, dead: false }
}

export function jump(s: DinoState): DinoState {
  if (!s.onGround || s.dead) return s
  return { ...s, vy: JUMP_V, onGround: false }
}

/** dino's occupied row (0 = top), from its height above ground */
function dinoRow(y: number): number {
  return GROUND - Math.round(y)
}

export function tick(s: DinoState, rng: () => number): DinoState {
  if (s.dead) return s

  let { y, vy } = s
  let onGround = s.onGround
  vy -= GRAVITY
  y += vy
  if (y <= 0) {
    y = 0
    vy = 0
    onGround = true
  }

  // move obstacles left; drop those off-screen
  let obstacles = s.obstacles.map((o) => ({ ...o, x: o.x - 1 })).filter((o) => o.x >= -1)

  // spawn with spacing + a little randomness (min gap grows the challenge later)
  const last = obstacles.length ? Math.max(...obstacles.map((o) => o.x)) : -Infinity
  const gap = 14 + Math.floor(rng() * 10)
  if (last < DINO_W - gap) obstacles.push({ x: DINO_W - 1, h: rng() < 0.25 ? 2 : 1 })

  // collision: an obstacle in the dino column whose top reaches the dino's row
  const dr = dinoRow(y)
  const dead = obstacles.some((o) => o.x === DINO_X && dr >= GROUND - o.h + 1)

  return { y, vy, onGround, obstacles, score: s.score + 1, ticks: s.ticks + 1, dead }
}

export function renderDino(s: DinoState): string {
  const grid: string[][] = Array.from({ length: DINO_H }, () => Array.from({ length: DINO_W }, () => ' '))
  // ground
  for (let x = 0; x < DINO_W; x++) grid[GROUND]![x] = '<span class="line-muted">▁</span>'
  // obstacles (cacti) rising from the ground
  for (const o of s.obstacles) {
    if (o.x < 0 || o.x >= DINO_W) continue
    for (let k = 0; k < o.h; k++) grid[GROUND - k]![o.x] = '<span class="g-food">♣</span>'
  }
  // dino
  const dr = dinoRow(s.y)
  if (dr >= 0 && dr < DINO_H) grid[dr]![DINO_X] = '<span class="g-head">▛</span>'
  const top = `┌${'─'.repeat(DINO_W)}┐`
  const bot = `└${'─'.repeat(DINO_W)}┘`
  const rows = grid.map((r) => `│${r.join('')}│`).join('\n')
  return `<pre class="game-grid">${top}\n${rows}\n${bot}\ndistance <span class="line-success">${s.score}</span></pre>`
}

export function dinoGame(): GameLaunch {
  return {
    title: 'dino',
    controls: 'space / ↑ to jump · q to quit',
    run(io: GameIO) {
      let state = newDino()
      const flap = () => {
        const before = state.onGround
        state = jump(state)
        if (before && !state.onGround) io.beep('move')
      }
      io.draw(renderDino(state))
      io.onKey((k) => {
        if (k === ' ' || k === 'ArrowUp' || k.toLowerCase() === 'w') flap()
      })
      io.every(70, () => {
        state = tick(state, io.rng)
        io.draw(renderDino(state))
        if (state.dead) {
          io.beep('lose')
          io.exit([
            { text: `crashed — distance ${state.score}`, kind: 'error' },
            { text: 'run again: dino', kind: 'muted' },
          ])
        }
      })
    },
  }
}
