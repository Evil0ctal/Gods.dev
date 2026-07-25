import { describe, it, expect } from 'vitest'
import { HOME, normalizePath, getNode, listDir, readFile, displayPath } from '../../src/components/terminal/core/vfs'
import type { VfsDir } from '../../src/components/terminal/core/types'

const tree: VfsDir = {
  type: 'dir',
  children: {
    home: {
      type: 'dir',
      children: {
        guest: {
          type: 'dir',
          children: {
            'README.txt': { type: 'file', content: 'hello' },
            '.secrets': {
              type: 'dir',
              children: { 'prophecy.txt': { type: 'file', content: 'secret' } },
            },
            blog: { type: 'dir', children: {} },
          },
        },
      },
    },
    etc: { type: 'dir', children: { motd: { type: 'file', content: 'welcome' } } },
  },
}

describe('normalizePath', () => {
  it('resolves ~ to home', () => {
    expect(normalizePath(HOME, '~')).toBe(HOME)
    expect(normalizePath(HOME, '~/blog')).toBe(`${HOME}/blog`)
  })
  it('resolves relative paths against cwd', () => {
    expect(normalizePath(HOME, 'blog')).toBe(`${HOME}/blog`)
    expect(normalizePath(HOME, './blog')).toBe(`${HOME}/blog`)
  })
  it('resolves .. and stops at root', () => {
    expect(normalizePath(`${HOME}/blog`, '..')).toBe(HOME)
    expect(normalizePath('/', '../../..')).toBe('/')
  })
  it('keeps absolute paths', () => {
    expect(normalizePath(HOME, '/etc/motd')).toBe('/etc/motd')
  })
})

describe('getNode / readFile / listDir', () => {
  it('walks to a nested node', () => {
    expect(getNode(tree, '/etc/motd')).toEqual({ type: 'file', content: 'welcome' })
    expect(getNode(tree, '/nope')).toBeNull()
  })
  it('readFile returns content for files, null for dirs/missing', () => {
    expect(readFile(tree, `${HOME}/README.txt`)).toBe('hello')
    expect(readFile(tree, HOME)).toBeNull()
    expect(readFile(tree, '/ghost')).toBeNull()
  })
  it('listDir returns dirs first with trailing slash, then files, sorted', () => {
    expect(listDir(tree, HOME)).toEqual(['.secrets/', 'blog/', 'README.txt'])
    expect(listDir(tree, '/etc/motd')).toBeNull()
  })
})

describe('displayPath', () => {
  it('abbreviates home as ~', () => {
    expect(displayPath(HOME)).toBe('~')
    expect(displayPath(`${HOME}/blog`)).toBe('~/blog')
    expect(displayPath('/etc')).toBe('/etc')
  })
})
