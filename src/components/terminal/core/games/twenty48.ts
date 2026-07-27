import type { GameLaunch, GameIO } from '../types'

export type Board = number[][] // 4x4, 0 = empty
export type Move = 'left' | 'right' | 'up' | 'down'

const SIZE = 4

function emptyCells(b: Board): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (b[y]![x] === 0) out.push([x, y])
  return out
}

export function spawn(b: Board, rng: () => number): Board {
  const free = emptyCells(b)
  if (free.length === 0) return b
  const [x, y] = free[Math.floor(rng() * free.length)]!
  const next = b.map((row) => [...row])
  next[y]![x] = rng() < 0.9 ? 2 : 4
  return next
}

export function newBoard(rng: () => number): Board {
  let b: Board = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0))
  b = spawn(b, rng)
  b = spawn(b, rng)
  return b
}

/** slide + merge one row to the left; returns the new row and points gained */
function slideLeft(row: number[]): { row: number[]; gained: number } {
  const nums = row.filter((n) => n !== 0)
  const merged: number[] = []
  let gained = 0
  for (let i = 0; i < nums.length; i++) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const sum = nums[i]! * 2
      merged.push(sum)
      gained += sum
      i++
    } else {
      merged.push(nums[i]!)
    }
  }
  while (merged.length < SIZE) merged.push(0)
  return { row: merged, gained }
}

const transpose = (b: Board): Board => b[0]!.map((_, x) => b.map((row) => row[x]!))
const reverseRows = (b: Board): Board => b.map((row) => [...row].reverse())

export function move(b: Board, dir: Move): { board: Board; moved: boolean; gained: number } {
  let work = b
  if (dir === 'right') work = reverseRows(work)
  else if (dir === 'up') work = transpose(work)
  else if (dir === 'down') work = reverseRows(transpose(work))

  let gained = 0
  const slid = work.map((row) => {
    const r = slideLeft(row)
    gained += r.gained
    return r.row
  })

  let result = slid
  if (dir === 'right') result = reverseRows(slid)
  else if (dir === 'up') result = transpose(slid)
  else if (dir === 'down') result = transpose(reverseRows(slid))

  const moved = JSON.stringify(result) !== JSON.stringify(b)
  return { board: result, moved, gained }
}

export function hasWon(b: Board): boolean {
  return b.some((row) => row.some((n) => n >= 2048))
}

export function isOver(b: Board): boolean {
  if (emptyCells(b).length > 0) return false
  return (['left', 'up'] as Move[]).every((d) => !move(b, d).moved)
}

export function renderBoard(b: Board, score: number): string {
  const cells = b
    .map(
      (row) =>
        '  ' +
        row
          .map((n) => (n === 0 ? `<span class="tile tile-0">·</span>` : `<span class="tile tile-${n}">${n}</span>`))
          .join(''),
    )
    .join('\n\n')
  return `<pre class="game-2048">${cells}\n\nscore <span class="line-success">${score}</span></pre>`
}

export function twenty48Game(rng: () => number): GameLaunch {
  return {
    title: '2048',
    controls: 'arrows / WASD to slide · q to quit',
    run(io: GameIO) {
      let board = newBoard(io.rng)
      let score = 0
      let done = false
      const KEYMAP: Record<string, Move> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down',
      }
      const paint = () => io.draw(renderBoard(board, score))
      paint()
      io.onKey((k) => {
        if (done) return
        const dir = KEYMAP[k] ?? KEYMAP[k.toLowerCase()]
        if (!dir) return
        const r = move(board, dir)
        if (!r.moved) return
        board = spawn(r.board, io.rng)
        score += r.gained
        io.beep(r.gained > 0 ? 'merge' : 'move')
        paint()
        if (hasWon(board)) {
          done = true
          io.beep('win')
          io.exit([{ text: `you reached 2048! score ${score}. the gods are impressed.`, kind: 'success' }])
        } else if (isOver(board)) {
          done = true
          io.beep('lose')
          io.exit([{ text: `game over — 2048 · score ${score}`, kind: 'error' }, { text: 'play again: 2048', kind: 'muted' }])
        }
      })
    },
  }
}
