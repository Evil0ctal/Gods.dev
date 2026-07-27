import type { OutputLine, ReplSession } from '../types'

/**
 * A tiny Zork-style text adventure, original and self-contained, set in the
 * gods.dev mythos. Pure state machine (testable): step(state, input) -> lines.
 */

type Dir = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'

interface Room {
  name: string
  desc: string
  exits: Partial<Record<Dir, string>>
  item?: string
}

const WORLD: Record<string, Room> = {
  gate: {
    name: 'The Gates of Olympus',
    desc: 'You stand before towering bronze gates, cold and sealed. A prompt blinks in the stone. Paths lead north into a glow.',
    exits: { north: 'terminal', east: 'summit' }, // east is locked until you hold the key
  },
  terminal: {
    name: 'The Glowing Terminal',
    desc: 'A single terminal hums on a pedestal, cursor pulsing green. Passages run east to heat, down into shadow, and south back to the gates.',
    exits: { south: 'gate', east: 'forge', down: 'secrets' },
  },
  secrets: {
    name: 'The Grove of ~/.secrets',
    desc: 'Dotfiles rustle like leaves. Something small and bright rests in the roots. A way leads up.',
    exits: { up: 'terminal' },
    item: 'key',
  },
  forge: {
    name: "Hephaestus' Forge",
    desc: 'A dead forge, its fire long cold. Slag and half-struck keys litter the floor. The only way out is west.',
    exits: { west: 'terminal' },
    item: 'ember',
  },
  summit: {
    name: 'The Summit',
    desc: 'Beyond the gates: nothing but sky, and your name already carved in the rafters. You made it, wanderer.',
    exits: {},
  },
}

const DIRS: Dir[] = ['north', 'south', 'east', 'west', 'up', 'down']
const DIR_ALIAS: Record<string, Dir> = {
  n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down',
  north: 'north', south: 'south', east: 'east', west: 'west', up: 'up', down: 'down',
}

export interface AdventureState {
  room: string
  inventory: string[]
  taken: string[] // items already picked up (removed from rooms)
  done: boolean
}

export function newAdventure(): AdventureState {
  return { room: 'gate', inventory: [], taken: [], done: false }
}

const line = (text: string, kind?: OutputLine['kind']): OutputLine => (kind ? { text, kind } : { text })

export function describe(state: AdventureState): OutputLine[] {
  const room = WORLD[state.room]!
  const out: OutputLine[] = [line(`— ${room.name} —`, 'success'), line(room.desc)]
  if (room.item && !state.taken.includes(room.item)) {
    out.push(line(`You see a ${room.item} here.`, 'muted'))
  }
  const exits = Object.keys(room.exits)
  if (exits.length) out.push(line(`Exits: ${exits.join(', ')}`, 'muted'))
  return out
}

export function step(state: AdventureState, input: string): { state: AdventureState; out: OutputLine[] } {
  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const verb = words[0] ?? ''
  const noun = words.slice(1).join(' ')
  const room = WORLD[state.room]!

  if (verb === '') return { state, out: [] }
  if (verb === 'quit' || verb === 'exit' || verb === 'q') {
    return { state: { ...state, done: true }, out: [line('You step back into the terminal.', 'muted')] }
  }
  if (verb === 'help' || verb === '?') {
    return {
      state,
      out: [
        line('commands: look · go <dir> (or n/s/e/w/u/d) · take <item> · use <item> · inventory · quit', 'muted'),
      ],
    }
  }
  if (verb === 'look' || verb === 'l') return { state, out: describe(state) }
  if (verb === 'inventory' || verb === 'i' || verb === 'inv') {
    return {
      state,
      out: [line(state.inventory.length ? `You carry: ${state.inventory.join(', ')}` : 'Your hands are empty.', 'muted')],
    }
  }
  if (verb === 'take' || verb === 'get' || verb === 'grab') {
    if (room.item && room.item === noun && !state.taken.includes(room.item)) {
      return {
        state: { ...state, inventory: [...state.inventory, room.item], taken: [...state.taken, room.item] },
        out: [line(`Taken: ${room.item}.`, 'success')],
      }
    }
    return { state, out: [line(`There is no ${noun || 'that'} to take here.`, 'error')] }
  }
  if (verb === 'use') {
    if (noun === 'key' && state.inventory.includes('key') && state.room === 'gate') {
      return { state, out: [line('The key fits. The eastern gate groans open. (go east)', 'success')] }
    }
    return { state, out: [line(`Nothing happens.`, 'muted')] }
  }

  // movement
  const dir = DIR_ALIAS[verb === 'go' || verb === 'move' ? noun : verb]
  if (dir && DIRS.includes(dir)) {
    // the gate east is sealed until you carry the key
    if (state.room === 'gate' && dir === 'east' && !state.inventory.includes('key')) {
      return { state, out: [line('The eastern gate is sealed. It wants a key — something bright hides below the terminal.', 'error')] }
    }
    const dest = room.exits[dir]
    if (!dest) return { state, out: [line("You can't go that way.", 'error')] }
    const moved: AdventureState = { ...state, room: dest }
    if (dest === 'summit') {
      return {
        state: { ...moved, done: true },
        out: [...describe(moved), line(''), line('⚑ YOU WIN. type any command to return to the terminal.', 'success')],
      }
    }
    return { state: moved, out: describe(moved) }
  }

  return { state, out: [line(`I don't understand "${input.trim()}". try: help`, 'error')] }
}

export function createAdventure(): ReplSession {
  let state = newAdventure()
  return {
    intro: [
      line('ASCENT — a small text adventure', 'success'),
      line('Reach the Summit. Type help for commands, quit to leave.', 'muted'),
      line(''),
      ...describe(state),
    ],
    prompt: 'ascent>',
    onInput(input: string) {
      const r = step(state, input)
      state = r.state
      return { lines: r.out, done: state.done }
    },
  }
}
