import type { ProjectMeta } from '../components/terminal/core/types'
import { PROJECTS as FALLBACK } from '../data/projects'

const USER = 'Evil0ctal'
const MAX_FEATURED = 8
/** repos never shown even if popular (forks/archives are excluded automatically) */
const EXCLUDE = new Set<string>([])

interface GhRepo {
  name: string
  description: string | null
  html_url: string
  fork: boolean
  archived: boolean
  private: boolean
  stargazers_count: number
  language: string | null
  topics?: string[]
  pushed_at: string | null
}

// module-level memo: one fetch per build, shared across every page that asks
let cache: Promise<ProjectMeta[]> | null = null

/**
 * Fetch the user's top public repositories at BUILD time and bake them into
 * static output. Falls back to a curated static list if the API is
 * unreachable or rate-limited, so the build never fails.
 */
export function getProjects(): Promise<ProjectMeta[]> {
  if (!cache) cache = load()
  return cache
}

async function load(): Promise<ProjectMeta[]> {
  const token = process.env.GITHUB_TOKEN ?? process.env.PROJECTS_GITHUB_TOKEN
  try {
    const res = await fetch(
      `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'gods.dev-build',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`)
    const repos = (await res.json()) as GhRepo[]
    if (!Array.isArray(repos)) throw new Error('unexpected GitHub response shape')

    const projects = repos
      .filter((r) => !r.fork && !r.archived && !r.private && !EXCLUDE.has(r.name))
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, MAX_FEATURED)
      .map(normalize)

    if (projects.length === 0) throw new Error('no public repos returned')
    // eslint-disable-next-line no-console
    console.log(`[github] baked ${projects.length} repos for ${USER} (top by stars)`)
    return projects
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[github] repo fetch failed, using static fallback: ${err instanceof Error ? err.message : String(err)}`,
    )
    return FALLBACK
  }
}

function normalize(r: GhRepo): ProjectMeta {
  const tags = (r.topics ?? []).slice(0, 4)
  if (tags.length === 0 && r.language) tags.push(r.language.toLowerCase())
  return {
    name: r.name,
    description: r.description ?? '',
    url: r.html_url,
    tags,
    stars: r.stargazers_count,
    language: r.language,
    updated: r.pushed_at ? r.pushed_at.slice(0, 10) : undefined,
  }
}

/** 18979 -> "19k", 1500 -> "1.5k", 470 -> "470" */
export function formatStars(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`
}
