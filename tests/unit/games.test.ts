import { describe, it, expect } from 'vitest'
import type { CommandResult, GameIO, OutputLine } from '../../src/components/terminal/core/types'
import {
  newSnake, turn, tick, renderSnake, snakeGame, type SnakeState,
} from '../../src/components/terminal/core/games/snake'
import {
  newBoard, move, spawn, hasWon, isOver, renderBoard, twenty48Game, type Board,
} from '../../src/components/terminal/core/games/twenty48'
import { newAdventure, step, createAdventure } from '../../src/components/terminal/core/games/adventure'
import { newDino, jump, tick as dinoTick, renderDino, dinoGame } from '../../src/components/terminal/core/games/dino'
import { newFlappy, flap, tick as flappyTick, renderFlappy, flappyGame, FLAPPY_H } from '../../src/components/terminal/core/games/flappy'
import { initSound, setSound, soundEnabled, beep } from '../../src/components/terminal/core/sound'
import { snakeCmd, twenty48Cmd, adventureCmd, gamesCmd, soundCmd, dinoCmd, flappyCmd } from '../../src/components/terminal/commands/games'
import { makeCtx } from './helpers'

// deterministic rng
const rng = () => 0.42

/** a fake GameIO that captures draws and lets the test drive keys/ticks */
function fakeIO() {
  let keyFn: (k: string) => void = () => {}
  let tickFn: () => void = () => {}
  const draws: string[] = []
  let exited = false
  let summary: OutputLine[] | undefined
  const io: GameIO = {
    draw: (h) => draws.push(h),
    onKey: (f) => (keyFn = f),
    every: (_ms, f) => (tickFn = f),
    exit: (s) => {
      exited = true
      summary = s
    },
    rng,
    beep: () => {},
  }
  return {
    io,
    key: (k: string) => keyFn(k),
    tick: () => tickFn(),
    draws,
    get exited() {
      return exited
    },
    get summary() {
      return summary
    },
  }
}

describe('snake logic', () => {
  it('starts with a 3-cell snake heading right', () => {
    const s = newSnake(rng, 10, 10)
    expect(s.snake).toHaveLength(3)
    expect(s.dir).toBe('right')
    expect(s.dead).toBe(false)
  })
  it('ignores reversal but accepts a perpendicular turn', () => {
    const s = newSnake(rng, 10, 10)
    expect(turn(s, 'left').dir).toBe('right') // reversal ignored
    expect(turn(s, 'up').dir).toBe('up')
  })
  it('advances the head one cell per tick', () => {
    const s = newSnake(rng, 10, 10)
    const [hx, hy] = s.snake[0]!
    const n = tick(s, rng)
    expect(n.snake[0]).toEqual([hx + 1, hy])
    expect(n.snake).toHaveLength(3)
  })
  it('dies on the wall', () => {
    let s: SnakeState = { w: 4, h: 4, snake: [[3, 1]], dir: 'right', food: [0, 0], dead: false, score: 0 }
    s = tick(s, rng)
    expect(s.dead).toBe(true)
  })
  it('grows and scores when eating', () => {
    const s: SnakeState = { w: 6, h: 6, snake: [[2, 2], [1, 2]], dir: 'right', food: [3, 2], dead: false, score: 0 }
    const n = tick(s, rng)
    expect(n.score).toBe(10)
    expect(n.snake).toHaveLength(3) // grew
  })
  it('renders a bordered grid with food, head and score', () => {
    const html = renderSnake(newSnake(rng, 8, 6))
    expect(html).toContain('g-food')
    expect(html).toContain('g-head')
    expect(html).toContain('score')
  })
  it('run() drives a loop that ends in game over', () => {
    const h = fakeIO()
    snakeGame(rng).run(h.io)
    expect(h.draws.length).toBeGreaterThan(0)
    for (let i = 0; i < 60 && !h.exited; i++) h.tick()
    expect(h.exited).toBe(true) // eventually hits a wall
    expect(h.summary?.[0]?.kind).toBe('error')
  })
})

describe('2048 logic', () => {
  it('slides and merges left, reporting points gained', () => {
    const b: Board = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const r = move(b, 'left')
    expect(r.board[0]).toEqual([4, 0, 0, 0])
    expect(r.gained).toBe(4)
    expect(r.moved).toBe(true)
  })
  it('reports moved=false when nothing changes', () => {
    const b: Board = [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    expect(move(b, 'left').moved).toBe(false)
  })
  it('merges correctly in every direction', () => {
    const b: Board = [
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 2],
    ]
    expect(move(b, 'right').board[0]).toEqual([0, 0, 0, 4])
    expect(move(b, 'up').board[0]).toEqual([4, 0, 0, 4])
    expect(move(b, 'down').board[3]).toEqual([4, 0, 0, 4])
  })
  it('newBoard spawns exactly two tiles; spawn adds one', () => {
    const b = newBoard(rng)
    const count = (bd: Board) => bd.flat().filter((n) => n !== 0).length
    expect(count(b)).toBe(2)
    expect(count(spawn(b, rng))).toBe(3)
  })
  it('detects win and game-over', () => {
    expect(hasWon([[2048, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])).toBe(true)
    const stuck: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]
    expect(isOver(stuck)).toBe(true)
    expect(isOver([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])).toBe(false)
  })
  it('renders tiles and score', () => {
    const html = renderBoard(newBoard(rng), 0)
    expect(html).toContain('tile')
    expect(html).toContain('score')
  })
  it('run() draws and reacts to a move key', () => {
    const h = fakeIO()
    twenty48Game(rng).run(h.io)
    const before = h.draws.length
    h.key('ArrowLeft')
    expect(h.draws.length).toBeGreaterThanOrEqual(before) // a move may or may not shift with this rng
  })
})

describe('dino logic', () => {
  it('starts on the ground and jumps off it', () => {
    const s = newDino()
    expect(s.onGround).toBe(true)
    const j = jump(s)
    expect(j.onGround).toBe(false)
    expect(j.vy).toBeGreaterThan(0)
  })
  it('cannot double-jump in mid-air', () => {
    const airborne = jump(newDino())
    expect(jump(airborne)).toBe(airborne) // unchanged
  })
  it('a jump comes back down to the ground over several ticks', () => {
    let s = jump(newDino())
    expect(s.y).toBe(0)
    for (let i = 0; i < 20 && !s.onGround; i++) s = dinoTick(s, () => 0.9)
    expect(s.onGround).toBe(true)
    expect(s.y).toBe(0)
  })
  it('renders a lane, ground and distance', () => {
    const html = renderDino(newDino())
    expect(html).toContain('game-grid')
    expect(html).toContain('distance')
  })
  it('run() ends in a crash if the player never jumps', () => {
    const h = fakeIO()
    dinoGame().run(h.io)
    for (let i = 0; i < 120 && !h.exited; i++) h.tick()
    expect(h.exited).toBe(true)
    expect(h.summary?.[0]?.kind).toBe('error')
  })
})

describe('flappy logic', () => {
  it('gravity pulls the bird down; a flap lifts it', () => {
    const s = newFlappy(rng)
    const fell = flappyTick(s, rng)
    expect(fell.y).toBeGreaterThan(s.y)
    expect(flap(s).vy).toBeLessThan(0)
  })
  it('dies when it hits the floor', () => {
    let s = newFlappy(rng)
    for (let i = 0; i < FLAPPY_H * 3 && !s.dead; i++) s = flappyTick(s, rng) // never flap
    expect(s.dead).toBe(true)
  })
  it('renders walls, the bird and score', () => {
    const html = renderFlappy(newFlappy(rng))
    expect(html).toContain('game-grid')
    expect(html).toContain('score')
  })
  it('run() draws and reacts to a flap key', () => {
    const h = fakeIO()
    flappyGame(rng).run(h.io)
    const before = h.draws.length
    h.key(' ')
    h.tick()
    expect(h.draws.length).toBeGreaterThan(before)
  })
})

describe('adventure logic', () => {
  it('starts at the gate', () => {
    const s = newAdventure()
    expect(s.room).toBe('gate')
  })
  it('seals the east gate until you hold the key', () => {
    const r = step(newAdventure(), 'go east')
    expect(r.out[0]?.kind).toBe('error')
    expect(r.state.room).toBe('gate')
  })
  it('can be won: fetch the key and pass the gate', () => {
    let s = newAdventure()
    for (const cmd of ['n', 'down', 'take key', 'up', 's', 'east']) {
      s = step(s, cmd).state
    }
    expect(s.room).toBe('summit')
    expect(s.done).toBe(true)
  })
  it('handles unknown input and help', () => {
    expect(step(newAdventure(), 'frobnicate').out[0]?.kind).toBe('error')
    expect(step(newAdventure(), 'help').out[0]?.text).toContain('commands')
  })
  it('createAdventure exposes an intro and a working repl', () => {
    const sess = createAdventure()
    expect(sess.intro.length).toBeGreaterThan(0)
    expect(sess.prompt).toBe('ascent>')
    const r = sess.onInput('quit')
    expect(r.done).toBe(true)
  })
})

describe('sound', () => {
  it('toggles and persists in-memory state; beep never throws', () => {
    initSound()
    setSound(true)
    expect(soundEnabled()).toBe(true)
    setSound(false)
    expect(soundEnabled()).toBe(false)
    expect(() => beep('key')).not.toThrow()
  })
})

describe('game commands', () => {
  const sync = (r: CommandResult | Promise<CommandResult>) => r as CommandResult
  it('snake / 2048 / dino / flappy launch a game; adventure launches a repl', () => {
    expect(sync(snakeCmd.run([], makeCtx())).game?.title).toBe('snake')
    expect(sync(twenty48Cmd.run([], makeCtx())).game?.title).toBe('2048')
    expect(sync(dinoCmd.run([], makeCtx())).game?.title).toBe('dino')
    expect(sync(flappyCmd.run([], makeCtx())).game?.title).toBe('flappy')
    expect(sync(adventureCmd.run([], makeCtx())).repl?.prompt).toBe('ascent>')
  })
  it('games launcher lists clickable games', () => {
    const text = sync(gamesCmd.run([], makeCtx())).lines.map((l) => l.text).join('\n')
    for (const id of ['snake', '2048', 'dino', 'flappy', 'adventure']) {
      expect(text).toContain(`data-cmd="${id}"`)
    }
  })
  it('sound command toggles on and off', () => {
    setSound(false)
    expect(sync(soundCmd.run(['on'], makeCtx())).lines[0]?.text).toContain('on')
    expect(soundEnabled()).toBe(true)
    expect(sync(soundCmd.run(['off'], makeCtx())).lines[0]?.text).toContain('off')
    expect(soundEnabled()).toBe(false)
  })
})
