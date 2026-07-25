import { describe, it, expect } from 'vitest'
import { complete } from '../../src/components/terminal/core/autocomplete'
import { createVfs } from '../../src/components/terminal/core/vfs-data'
import { HOME } from '../../src/components/terminal/core/vfs'

const ctx = {
  names: ['blog', 'cat', 'cd', 'clear', 'help', 'history', 'ls', 'theme'],
  vfs: createVfs([{ slug: 'hello', title: 'Hello', description: 'x', date: '2026-07-25' }]),
  cwd: HOME,
}

describe('complete: command names', () => {
  it('completes a partial first token', () => {
    expect(complete('he', ctx)).toEqual(['help'])
  })
  it('returns all matches for ambiguous prefixes', () => {
    expect(complete('c', ctx)).toEqual(['cat', 'cd', 'clear'])
  })
  it('returns [] for no match or empty input', () => {
    expect(complete('zz', ctx)).toEqual([])
    expect(complete('', ctx)).toEqual([])
  })
})

describe('complete: paths for fs commands', () => {
  it('completes entries in cwd', () => {
    expect(complete('cat REA', ctx)).toEqual(['cat README.txt'])
  })
  it('completes dotfiles and dirs', () => {
    expect(complete('cd .se', ctx)).toEqual(['cd .secrets/'])
  })
  it('completes inside a subdirectory path', () => {
    expect(complete('cat blog/he', ctx)).toEqual(['cat blog/hello.md'])
  })
  it('does not path-complete for non-fs commands', () => {
    expect(complete('theme REA', ctx)).toEqual([])
  })
})
