import type { PostMeta, VfsDir, VfsNode } from './types'
import { CLASSIC_PASSAGES } from '../../../data/passages'
import { FORGE_JS, OLYMPUS_ACCESS_LOG, SCROLL_OF_HERMES, UNSEEN_TXT } from './ctf-artifacts'

const PROPHECY = `an old god left this behind. it does not want to be read — it wants to be earned.

  M29xp3fjoTEsMmOxp19hZ3qsqUVkL2gmsD==

hint: caesar guarded the gates before the gods (13).
      beneath his cipher sleeps an older one — the ancient sixty-four.
      when you hold the truth, submit it:  flag submit <what-you-found>`

const README = `Welcome, wanderer.

This machine belongs to Evil0ctal. You are logged in as guest.
Nothing here is quite what it seems. Some directories are shy —
'ls' shows them anyway, if you look from the right place.

Start with: help, neofetch, blog, projects
The curious get further:  ls -a, cat, cd`

export function createVfs(posts: PostMeta[], studies: PostMeta[] = []): VfsDir {
  const blogChildren: Record<string, VfsNode> = {}
  for (const p of posts) {
    blogChildren[`${p.slug}.md`] = {
      type: 'file',
      content: `# ${p.title}\n\n${p.description}\n\n(read the full post: blog read ${p.slug})`,
    }
  }

  const studyChildren: Record<string, VfsNode> = {}
  for (const s of studies) {
    studyChildren[`${s.slug}.md`] = {
      type: 'file',
      content: `# ${s.title}\n\n${s.description}\n\n(read the full study: study read ${s.slug})`,
    }
  }

  const classics = CLASSIC_PASSAGES.map((p) => `  ${p.title.padEnd(30)}bible ${p.book} ${p.ref}`).join('\n')

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
              bible: {
                type: 'dir',
                children: {
                  'README.txt': {
                    type: 'file',
                    content: `the word is not stored in files. it is spoken.

  bible john 3:16     a verse
  bible books         the whole canon
  bible               today's verse

(World English Bible — public domain. even the gods respect licensing.)`,
                  },
                  'classics.txt': {
                    type: 'file',
                    content: `the greatest hits. speak any line to hear it:\n\n${classics}`,
                  },
                },
              },
              blog: { type: 'dir', children: blogChildren },
              study: { type: 'dir', children: studyChildren },
              scriptures: {
                type: 'dir',
                children: { 'unseen.txt': { type: 'file', content: UNSEEN_TXT } },
              },
              '.ctf': {
                type: 'dir',
                children: {
                  'README.txt': {
                    type: 'file',
                    content: `challenge material lives here and elsewhere on the machine.
run 'ctf' in the terminal for the full board.`,
                  },
                  scroll_of_hermes: { type: 'file', content: SCROLL_OF_HERMES },
                },
              },
              '.secrets': {
                type: 'dir',
                children: { 'prophecy.txt': { type: 'file', content: PROPHECY } },
              },
            },
          },
        },
      },
      opt: {
        type: 'dir',
        children: {
          olympus: {
            type: 'dir',
            children: { 'forge.js': { type: 'file', content: FORGE_JS } },
          },
        },
      },
      var: {
        type: 'dir',
        children: {
          log: {
            type: 'dir',
            children: {
              olympus: {
                type: 'dir',
                children: { 'access.log': { type: 'file', content: OLYMPUS_ACCESS_LOG } },
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
