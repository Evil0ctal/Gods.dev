import type { PostMeta, VfsDir, VfsNode } from './types'

const PROPHECY = `an old god left this behind. it does not want to be read — it wants to be earned.

  M29xp3g0nQAsMmE0Z3AsZTMsMmOxp180pzIsZUNmoa0=

hint: caesar guarded the gates before the gods (13).
      beneath his cipher sleeps an older one — the ancient sixty-four.
      when you hold the truth, submit it:  flag submit <what-you-found>`

const README = `Welcome, wanderer.

This machine belongs to Evil0ctal. You are logged in as guest.
Nothing here is quite what it seems. Some directories are shy —
'ls' shows them anyway, if you look from the right place.

Start with: help, neofetch, blog, projects
The curious get further:  ls -a, cat, cd`

export function createVfs(posts: PostMeta[]): VfsDir {
  const blogChildren: Record<string, VfsNode> = {}
  for (const p of posts) {
    blogChildren[`${p.slug}.md`] = {
      type: 'file',
      content: `# ${p.title}\n\n${p.description}\n\n(read the full post: blog read ${p.slug})`,
    }
  }

  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          guest: {
            type: 'dir',
            children: {
              'README.txt': { type: 'file', content: README },
              blog: { type: 'dir', children: blogChildren },
              '.secrets': {
                type: 'dir',
                children: { 'prophecy.txt': { type: 'file', content: PROPHECY } },
              },
            },
          },
        },
      },
      etc: {
        type: 'dir',
        children: {
          motd: { type: 'file', content: 'gods.dev — the terminal is the interface.' },
        },
      },
    },
  }
}
