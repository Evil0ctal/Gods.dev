import { describe, it, expect } from 'vitest'
import { CIPHER, KEY } from '../../src/data/annotated-reverse'
import { N, plainByte, hex, asciiChar, revealedAscii, ftypVisible } from '../../src/components/blog/annotated-reverse'

describe('annotated-reverse decode', () => {
  it('cipher and key are the same length', () => {
    expect(CIPHER.length).toBe(KEY.length)
    expect(N).toBe(CIPHER.length)
  })
  it('XOR reveals a real MP4 ftyp box', () => {
    const full = revealedAscii(N)
    expect(full.slice(4, 8)).toBe('ftyp') // box header at offset 4
    expect(full).toContain('isom') // a real compatible-brand
    // byte 3 is the ftyp box size 0x20
    expect(plainByte(3)).toBe(0x20)
  })
  it('ftyp only becomes legible once byte 7 is peeled', () => {
    expect(ftypVisible(7)).toBe(false)
    expect(ftypVisible(8)).toBe(true)
    expect(ftypVisible(N)).toBe(true)
  })
  it('hex and ascii helpers behave', () => {
    expect(hex(0x66)).toBe('66')
    expect(hex(0)).toBe('00')
    expect(asciiChar(0x66)).toBe('f')
    expect(asciiChar(0x00)).toBe('·') // non-printable
  })
  it('the shipped cipher/key never spell the answer literally', () => {
    const asNoise = (a: number[]) => a.map(asciiChar).join('')
    expect(asNoise(CIPHER)).not.toContain('ftyp')
    expect(asNoise(KEY)).not.toContain('ftyp')
  })
})
