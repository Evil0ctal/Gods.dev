import type { ProjectMeta, StatsMeta } from '../components/terminal/core/types'
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

interface GhUser {
  public_repos: number
  followers: number
  following: number
  created_at: string
}

function ghHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? process.env.PROJECTS_GITHUB_TOKEN
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gods.dev-build',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// module-level memos: one fetch per build, shared across every page that asks
let reposCache: Promise<GhRepo[] | null> | null = null
let projectsCache: Promise<ProjectMeta[]> | null = null
let statsCache: Promise<StatsMeta | null> | null = null

function fetchRepos(): Promise<GhRepo[] | null> {
  if (!reposCache) reposCache = loadRepos()
  return reposCache
}

async function loadRepos(): Promise<GhRepo[] | null> {
  try {
    const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`, {
      headers: ghHeaders(),
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`)
    const repos = (await res.json()) as GhRepo[]
    if (!Array.isArray(repos)) throw new Error('unexpected GitHub response shape')
    return repos
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[github] repo fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/**
 * Fetch the user's top public repositories at BUILD time and bake them into
 * static output. Falls back to a curated static list if the API is
 * unreachable or rate-limited, so the build never fails.
 */
export function getProjects(): Promise<ProjectMeta[]> {
  if (!projectsCache) projectsCache = loadProjects()
  return projectsCache
}

async function loadProjects(): Promise<ProjectMeta[]> {
  const repos = await fetchRepos()
  if (!repos) return FALLBACK
  const projects = repos
    .filter((r) => !r.fork && !r.archived && !r.private && !EXCLUDE.has(r.name))
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, MAX_FEATURED)
    .map(normalize)
  if (projects.length === 0) return FALLBACK
  // eslint-disable-next-line no-console
  console.log(`[github] baked ${projects.length} repos for ${USER} (top by stars)`)
  return projects
}

/** Aggregate profile + repo stats at build time for the `stats` command. */
export function getStats(): Promise<StatsMeta | null> {
  if (!statsCache) statsCache = loadStats()
  return statsCache
}

async function loadStats(): Promise<StatsMeta | null> {
  const repos = await fetchRepos()
  if (!repos) return null
  const owned = repos.filter((r) => !r.fork && !r.private)
  try {
    const res = await fetch(`https://api.github.com/users/${USER}`, { headers: ghHeaders() })
    const user = res.ok ? ((await res.json()) as GhUser) : null

    const totalStars = owned.reduce((sum, r) => sum + r.stargazers_count, 0)
    const langCount = new Map<string, number>()
    for (const r of owned) if (r.language) langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1)
    const languages = [...langCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    const latestRepo = owned
      .filter((r) => r.pushed_at)
      .sort((a, b) => (b.pushed_at! < a.pushed_at! ? -1 : 1))[0]

    const contributions = await fetchContributions()

    // eslint-disable-next-line no-console
    console.log(
      `[github] baked stats for ${USER}: ${owned.length} repos, ${totalStars}★${contributions ? `, ${contributions.total} contributions` : ''}`,
    )
    return {
      publicRepos: user?.public_repos ?? owned.length,
      followers: user?.followers ?? 0,
      following: user?.following ?? 0,
      totalStars,
      languages,
      latest: latestRepo ? { name: latestRepo.name, date: latestRepo.pushed_at!.slice(0, 10) } : null,
      memberSince: user?.created_at ? user.created_at.slice(0, 4) : '',
      contributions,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[github] stats fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/**
 * The contribution calendar via the GitHub GraphQL API. Requires a token
 * (GraphQL is auth-only), so it is null in tokenless local builds and populated
 * in CI. Returns weeks of 7 daily counts (Sun..Sat), like the profile graph.
 */
async function fetchContributions(): Promise<{ total: number; weeks: number[][] } | null> {
  const token = process.env.GITHUB_TOKEN ?? process.env.PROJECTS_GITHUB_TOKEN
  if (!token) return null
  const query =
    'query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount weekday}}}}}}'
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { login: USER } }),
    })
    if (!res.ok) throw new Error(`GraphQL ${res.status}`)
    const json = (await res.json()) as {
      data?: { user?: { contributionsCollection?: { contributionCalendar?: { totalContributions: number; weeks: { contributionDays: { contributionCount: number; weekday: number }[] }[] } } } }
    }
    const cal = json?.data?.user?.contributionsCollection?.contributionCalendar
    if (!cal) return null
    // pad each week to 7 slots keyed by weekday (Sun=0); -1 marks days outside the range
    const weeks = cal.weeks.map((w) => {
      const slots = [-1, -1, -1, -1, -1, -1, -1]
      for (const d of w.contributionDays) slots[d.weekday] = d.contributionCount
      return slots
    })
    return { total: cal.totalContributions, weeks }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[github] contributions fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
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
