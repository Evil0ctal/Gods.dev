import type { VfsDir, VfsNode } from './types'

export const HOME = '/home/guest'

export function normalizePath(cwd: string, input: string): string {
  let path = input.trim()
  if (path === '' || path === '~') path = HOME
  else if (path.startsWith('~/')) path = HOME + path.slice(1)
  else if (!path.startsWith('/')) path = `${cwd}/${path}`

  const parts: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

export function getNode(root: VfsDir, absPath: string): VfsNode | null {
  if (absPath === '/') return root
  let node: VfsNode = root
  for (const seg of absPath.split('/').filter(Boolean)) {
    if (node.type !== 'dir') return null
    const child: VfsNode | undefined = node.children[seg]
    if (!child) return null
    node = child
  }
  return node
}

export function listDir(root: VfsDir, absPath: string): string[] | null {
  const node = getNode(root, absPath)
  if (!node || node.type !== 'dir') return null
  const entries = Object.entries(node.children)
  const dirs = entries.filter(([, n]) => n.type === 'dir').map(([name]) => `${name}/`)
  const files = entries.filter(([, n]) => n.type === 'file').map(([name]) => name)
  return [...dirs.sort(), ...files.sort()]
}

export function readFile(root: VfsDir, absPath: string): string | null {
  const node = getNode(root, absPath)
  return node?.type === 'file' ? node.content : null
}

export function displayPath(absPath: string): string {
  if (absPath === HOME) return '~'
  if (absPath.startsWith(`${HOME}/`)) return `~${absPath.slice(HOME.length)}`
  return absPath
}
