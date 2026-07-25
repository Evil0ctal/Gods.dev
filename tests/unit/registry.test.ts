import { describe, it, expect } from 'vitest'
import { createRegistry } from '../../src/components/terminal/core/registry'
import type { Command } from '../../src/components/terminal/core/types'

const stub = (name: string, hidden = false): Command => ({
  name,
  description: `${name} desc`,
  hidden,
  run: () => ({ lines: [] }),
})

describe('createRegistry', () => {
  it('registers and retrieves commands by name', () => {
    const reg = createRegistry()
    reg.register(stub('help'))
    expect(reg.get('help')?.name).toBe('help')
    expect(reg.get('nope')).toBeUndefined()
  })
  it('lists visible commands sorted by name, hiding hidden ones', () => {
    const reg = createRegistry()
    reg.register(stub('theme'))
    reg.register(stub('sudo', true))
    reg.register(stub('help'))
    expect(reg.list().map((c) => c.name)).toEqual(['help', 'theme'])
    expect(reg.list(true).map((c) => c.name)).toEqual(['help', 'sudo', 'theme'])
  })
  it('names() mirrors list()', () => {
    const reg = createRegistry()
    reg.register(stub('b'))
    reg.register(stub('a'))
    expect(reg.names()).toEqual(['a', 'b'])
  })
  it('throws on duplicate registration', () => {
    const reg = createRegistry()
    reg.register(stub('x'))
    expect(() => reg.register(stub('x'))).toThrow(/already registered/)
  })
})
