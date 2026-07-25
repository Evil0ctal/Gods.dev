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
  effect?: 'matrix' | 'crash' | 'vim'
}

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
  registry: CommandRegistry
  historyList(): string[]
}

export interface Command {
  name: string
  description: string
  usage?: string
  hidden?: boolean
  run(args: string[], ctx: TerminalContext): CommandResult | Promise<CommandResult>
}
