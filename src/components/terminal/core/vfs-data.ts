import type { PostMeta, VfsDir, VfsNode } from './types'
import { CLASSIC_PASSAGES } from '../../../data/passages'
import { CHECKLICENSE_JS, FORGE_JS, OLYMPUS_ACCESS_LOG, SCROLL_OF_HERMES, SIGNER_JS, UNSEEN_TXT, WHISPER_SAMPLES } from './ctf-artifacts'
import { FRAG3 } from '../../../data/ascension'

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
                  'whisper.samples': { type: 'file', content: WHISPER_SAMPLES },
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
            children: {
              'forge.js': { type: 'file', content: FORGE_JS },
              'signer.js': { type: 'file', content: SIGNER_JS },
              'checklicense.js': { type: 'file', content: CHECKLICENSE_JS },
            },
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
      proc: {
        type: 'dir',
        children: {
          '1': {
            type: 'dir',
            children: { cmdline: { type: 'file', content: '/sbin/olympus-init --boot --quiet' } },
          },
          // the ascend daemon idles here, waiting for a wanderer to bring it the word
          '1337': {
            type: 'dir',
            children: {
              cmdline: { type: 'file', content: `ascend --await-fragments --frag3=${FRAG3}` },
              status: {
                type: 'file',
                content: `Name:\tascend\nState:\tS (waiting for the observant)\nHint:\tascension fragment 3/3 rides in my cmdline. two others hide in the console and in a 404.`,
              },
            },
          },
        },
      },
    },
  }
}
