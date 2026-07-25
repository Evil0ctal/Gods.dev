import { describe, it, expect } from 'vitest'
import { parse } from '../../src/components/terminal/core/parser'

describe('parse', () => {
  it('splits command and args on whitespace', () => {
    expect(parse('theme crt')).toEqual({ cmd: 'theme', args: ['crt'], raw: 'theme crt' })
  })
  it('lowercases the command but not the args', () => {
    expect(parse('ECHO Hello')).toEqual({ cmd: 'echo', args: ['Hello'], raw: 'ECHO Hello' })
  })
  it('collapses repeated whitespace', () => {
    expect(parse('  ls   -la  ')).toEqual({ cmd: 'ls', args: ['-la'], raw: 'ls   -la' })
  })
  it('keeps double-quoted args intact', () => {
    expect(parse('echo "hello   world" x')).toEqual({
      cmd: 'echo',
      args: ['hello   world', 'x'],
      raw: 'echo "hello   world" x',
    })
  })
  it('keeps single-quoted args intact', () => {
    expect(parse("echo 'a b'")).toEqual({ cmd: 'echo', args: ['a b'], raw: "echo 'a b'" })
  })
  it('treats an unclosed quote as literal to end of line', () => {
    expect(parse('echo "oops')).toEqual({ cmd: 'echo', args: ['oops'], raw: 'echo "oops' })
  })
  it('returns null for empty or whitespace-only input', () => {
    expect(parse('')).toBeNull()
    expect(parse('   ')).toBeNull()
  })
})
