import type { ProjectMeta } from '../components/terminal/core/types'

/**
 * Static fallback for the projects list — used only when the GitHub API is
 * unreachable or rate-limited at build time (see src/lib/github.ts).
 * Normally the live top-starred repos are baked in at build.
 */
export const PROJECTS: ProjectMeta[] = [
  {
    name: 'Douyin_TikTok_Download_API',
    description:
      'High-performance async API for Douyin / TikTok / Bilibili data scraping and watermark-free downloads.',
    url: 'https://github.com/Evil0ctal/Douyin_TikTok_Download_API',
    tags: ['python', 'async', 'crawler'],
  },
  {
    name: 'AndroidReverse101',
    description: 'Learn Android reverse engineering from zero to one — systematic, hands-on, and fun.',
    url: 'https://github.com/Evil0ctal/AndroidReverse101',
    tags: ['android', 'reverse-engineering', 'apktool'],
  },
  {
    name: 'Gods.dev',
    description: 'This very site — a terminal that pretends to be a homepage. View source, there are secrets.',
    url: 'https://github.com/Evil0ctal/Gods.dev',
    tags: ['astro', 'typescript', 'ctf'],
  },
]
