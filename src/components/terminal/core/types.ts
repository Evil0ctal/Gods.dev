export type LineKind = 'out' | 'error' | 'success' | 'muted' | 'ascii'

export interface OutputLine {
  text: string
  kind?: LineKind
  /** true 时 text 是可信 HTML（只能来自命令模块的静态字符串，用户输入必须先 escapeHtml） */
  html?: boolean
}

export interface CommandResult {
  lines: OutputLine[]
  clear?: boolean
  navigate?: string
  effect?: 'matrix' | 'crash' | 'vim' | 'fireworks'
  /** launch a real-time key-driven game (snake, 2048) — the terminal enters game mode */
  game?: GameLaunch
  /** enter a line-based captured session (text adventure) — input routes to it until done */
  repl?: ReplSession
}

/** runtime handed to a real-time game: draw frames, read keys, run a tick loop */
export interface GameIO {
  /** replace the game screen with trusted, game-authored HTML */
  draw(html: string): void
  /** register the key handler (normalized KeyboardEvent.key values) */
  onKey(fn: (key: string) => void): void
  /** start/replace the tick loop */
  every(ms: number, fn: () => void): void
  /** end the game, printing optional summary lines back into the terminal */
  exit(summary?: OutputLine[]): void
  rng(): number
  beep(kind: SoundKind): void
}

export interface GameLaunch {
  title: string
  /** one-line controls hint shown in the game header */
  controls: string
  run(io: GameIO): void
}

/** a captured line-input session (text adventure); input routes here until done */
export interface ReplSession {
  intro: OutputLine[]
  prompt: string
  onInput(line: string): { lines: OutputLine[]; done?: boolean }
}

export type SoundKind = 'key' | 'move' | 'eat' | 'merge' | 'win' | 'lose' | 'error' | 'boot' | 'pop'

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string // YYYY-MM-DD
}

export interface ProjectMeta {
  name: string
  description: string
  url: string
  tags: string[]
  /** live GitHub metadata, present when sourced from the API at build time */
  stars?: number
  language?: string | null
  updated?: string // YYYY-MM-DD
}

export interface StatsMeta {
  publicRepos: number
  followers: number
  following: number
  totalStars: number
  languages: Array<{ name: string; count: number }>
  latest: { name: string; date: string } | null
  memberSince: string
  /** contribution calendar (GraphQL, CI-only); weeks of up to 7 daily counts */
  contributions?: { total: number; weeks: number[][] } | null
}

export interface VfsFile { type: 'file'; content: string }
export interface VfsDir { type: 'dir'; children: Record<string, VfsNode> }
export type VfsNode = VfsFile | VfsDir

export interface CommandRegistry {
  register(cmd: Command): void
  get(name: string): Command | undefined
  list(includeHidden?: boolean): Command[]
  names(includeHidden?: boolean): string[]
}

export interface TerminalContext {
  cwd: string
  setCwd(path: string): void
  getTheme(): string
  setTheme(theme: string): boolean
  vfs: VfsDir
  posts: PostMeta[]
  studies: PostMeta[]
  projects: ProjectMeta[]
  stats: StatsMeta | null
  ctf: CtfStore
  registry: CommandRegistry
  historyList(): string[]
}

/** CTF 解题进度存储（生产用 localStorage，测试注入内存实现） */
export interface CtfStore {
  solved(): string[]
  markSolved(id: string): void
}

export interface Command {
  name: string
  description: string
  usage?: string
  hidden?: boolean
  /** help 分组：intel/content/filesystem/shell；未设置的归入 misc */
  category?: string
  run(args: string[], ctx: TerminalContext): CommandResult | Promise<CommandResult>
}
