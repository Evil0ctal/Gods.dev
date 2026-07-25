import { describe, it, expect } from 'vitest'
import { createHistory } from '../../src/components/terminal/core/history'

describe('InputHistory', () => {
  it('navigates prev through entries newest-first', () => {
    const h = createHistory()
    h.push('a')
    h.push('b')
    expect(h.prev()).toBe('b')
    expect(h.prev()).toBe('a')
    expect(h.prev()).toBe('a') // clamps at oldest
  })
  it('navigates next back toward the live line', () => {
    const h = createHistory()
    h.push('a')
    h.push('b')
    h.prev() // b
    h.prev() // a
    expect(h.next()).toBe('b')
    expect(h.next()).toBeNull() // past newest -> live line
  })
  it('prev on empty history returns null', () => {
    expect(createHistory().prev()).toBeNull()
  })
  it('push ignores empty and consecutive duplicates, resets cursor', () => {
    const h = createHistory()
    h.push('a')
    h.push('')
    h.push('a')
    expect(h.all()).toEqual(['a'])
    h.push('b')
    h.prev()
    h.push('c')
    expect(h.prev()).toBe('c')
  })
})
