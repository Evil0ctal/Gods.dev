import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import { execFileSync } from 'node:child_process'

// Bake real provenance at build time so `build`, `whatsnew`, and the footer
// receipt reflect the actual commit — no server needed. Uses execFileSync with
// an argument array (no shell, no injection surface) and falls back gracefully
// when git is unavailable (e.g. a tarball build).
function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return fallback
  }
}
const SEP = String.fromCharCode(31) // git's %x1f — a delimiter that can't appear in a subject
const rawLog = git(['log', '-12', '--format=%h%x1f%cI%x1f%s'])
const CHANGELOG = rawLog
  ? rawLog.split('\n').map((l) => {
      const [sha, date, subject] = l.split(SEP)
      return { sha, date, subject }
    })
  : []

const BUILD_SHA = git(['rev-parse', '--short', 'HEAD'], 'dev')
const BUILD_DATE = git(['log', '-1', '--format=%cI'], '')
const BUILD_TIME = new Date().toISOString()

export default defineConfig({
  site: 'https://gods.dev',
  compressHTML: false, // 保留源码中的注释彩蛋与可读性（view-source 是产品的一部分）
  markdown: {
    // css-variables theme → code highlighting follows the active site theme
    // (green in CRT, amber in amber, etc.) via the --astro-code-* vars in global.css
    shikiConfig: { theme: 'css-variables', wrap: false },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  vite: {
    define: {
      'import.meta.env.BUILD_SHA': JSON.stringify(BUILD_SHA),
      'import.meta.env.BUILD_DATE': JSON.stringify(BUILD_DATE),
      'import.meta.env.BUILD_TIME': JSON.stringify(BUILD_TIME),
      // a JSON string the app parses at runtime (double-encoded so the injected token is a string literal)
      'import.meta.env.CHANGELOG': JSON.stringify(JSON.stringify(CHANGELOG)),
    },
  },
})
