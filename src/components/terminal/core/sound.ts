import type { SoundKind } from './types'

/**
 * Tiny retro sound engine — every blip is synthesized with the Web Audio API
 * (square/triangle oscillators + a fast gain envelope). No audio files, so
 * nothing is copied from anywhere; it's all generated at runtime.
 * Off by default; toggled with the `sound` command, persisted in localStorage.
 */

const KEY = 'gods:sound'

// [frequency Hz, duration ms, waveform]
const VOICES: Record<SoundKind, [number, number, OscillatorType]> = {
  key: [660, 18, 'square'],
  move: [420, 25, 'square'],
  eat: [880, 70, 'square'],
  merge: [523, 90, 'triangle'],
  win: [988, 220, 'triangle'],
  lose: [140, 320, 'square'],
  error: [180, 120, 'square'],
  boot: [523, 140, 'triangle'],
}

let enabled = false
let ctx: AudioContext | null = null

export function initSound(): void {
  try {
    enabled = localStorage.getItem(KEY) === '1'
  } catch {
    enabled = false
  }
}

export function soundEnabled(): boolean {
  return enabled
}

export function setSound(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* private mode */
  }
}

export function beep(kind: SoundKind): void {
  if (!enabled) return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    const [freq, ms, type] = VOICES[kind]
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t = ctx.currentTime
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    // short percussive envelope, kept quiet
    gain.gain.setValueAtTime(0.06, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + ms / 1000)
  } catch {
    /* audio unavailable — stay silent */
  }
}
