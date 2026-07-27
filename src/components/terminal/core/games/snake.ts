import type { GameLaunch, GameIO } from '../types'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Cell = [number, number]

export interface SnakeState {
  w: number
  h: number
  snake: Cell[] // head first
  dir: Dir
  food: Cell
  dead: boolean
  score: number
}

const DELTA: Record<Dir, Cell> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export const SNAKE_W = 26
export const SNAKE_H = 14

function placeFood(w: number, h: number, snake: Cell[], rng: () => number): Cell {
  const occupied = new Set(snake.map(([x, y]) => `${x},${y}`))
  const free: Cell[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (!occupied.has(`${x},${y}`)) free.push([x, y])
  if (free.length === 0) return snake[0]!
  return free[Math.floor(rng() * free.length)]!
}

export function newSnake(rng: () => number, w = SNAKE_W, h = SNAKE_H): SnakeState {
  const cx = Math.floor(w / 2)
  const cy = Math.floor(h / 2)
  const snake: Cell[] = [
    [cx, cy],
    [cx - 1, cy],
    [cx - 2, cy],
  ]
  return { w, h, snake, dir: 'right', food: placeFood(w, h, snake, rng), dead: false, score: 0 }
}

/** queue a direction change; reversing onto yourself is ignored */
export function turn(s: SnakeState, dir: Dir): SnakeState {
  if (dir === OPPOSITE[s.dir]) return s
  return { ...s, dir }
}

/** advance one step; grows on food, dies on wall/self collision */
export function tick(s: SnakeState, rng: () => number): SnakeState {
  if (s.dead) return s
  const [dx, dy] = DELTA[s.dir]
  const [hx, hy] = s.snake[0]!
  const head: Cell = [hx + dx, hy + dy]

  if (head[0] < 0 || head[0] >= s.w || head[1] < 0 || head[1] >= s.h) return { ...s, dead: true }
  const eating = head[0] === s.food[0] && head[1] === s.food[1]
  const body = eating ? s.snake : s.snake.slice(0, -1)
  if (body.some(([x, y]) => x === head[0] && y === head[1])) return { ...s, dead: true }

  const snake: Cell[] = [head, ...body]
  if (eating) {
    return { ...s, snake, score: s.score + 10, food: placeFood(s.w, s.h, snake, rng) }
  }
  return { ...s, snake }
}

export function renderSnake(s: SnakeState): string {
  const grid: string[][] = Array.from({ length: s.h }, () => Array.from({ length: s.w }, () => ' '))
  grid[s.food[1]]![s.food[0]] = '<span class="g-food">◆</span>'
  s.snake.forEach(([x, y], i) => {
    grid[y]![x] = i === 0 ? '<span class="g-head">█</span>' : '<span class="g-snake">█</span>'
  })
  const top = `┌${'─'.repeat(s.w)}┐`
  const bot = `└${'─'.repeat(s.w)}┘`
  const rows = grid.map((r) => `│${r.join('')}│`).join('\n')
  return `<pre class="game-grid">${top}\n${rows}\n${bot}\nscore <span class="line-success">${s.score}</span></pre>`
}

export function snakeGame(rng: () => number): GameLaunch {
  return {
    title: 'snake',
    controls: 'arrows / WASD to steer · q to quit',
    run(io: GameIO) {
      let state = newSnake(io.rng)
      const KEYMAP: Record<string, Dir> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      }
      io.draw(renderSnake(state))
      io.onKey((k) => {
        const dir = KEYMAP[k] ?? KEYMAP[k.toLowerCase()]
        if (dir) {
          const before = state.dir
          state = turn(state, dir)
          if (state.dir !== before) io.beep('move')
        }
      })
      io.every(110, () => {
        const prevScore = state.score
        state = tick(state, io.rng)
        if (state.score > prevScore) io.beep('eat')
        io.draw(renderSnake(state))
        if (state.dead) {
          io.beep('lose')
          io.exit([
            { text: `game over — snake · score ${state.score}`, kind: 'error' },
            { text: 'play again: snake', kind: 'muted' },
          ])
        }
      })
    },
  }
}
