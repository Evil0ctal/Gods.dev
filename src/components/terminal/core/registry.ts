import type { Command, CommandRegistry } from './types'

export function createRegistry(): CommandRegistry {
  const commands = new Map<string, Command>()

  return {
    register(cmd: Command): void {
      if (commands.has(cmd.name)) throw new Error(`command already registered: ${cmd.name}`)
      commands.set(cmd.name, cmd)
    },
    get(name: string): Command | undefined {
      return commands.get(name)
    },
    list(includeHidden = false): Command[] {
      return [...commands.values()]
        .filter((c) => includeHidden || !c.hidden)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    names(includeHidden = false): string[] {
      return this.list(includeHidden).map((c) => c.name)
    },
  }
}
