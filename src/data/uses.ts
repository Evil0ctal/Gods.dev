/**
 * The stack behind the projects, shown by the `uses` command.
 * NOTE (Evil0ctal): these are inferred from your public repos — edit freely to
 * match what you actually run. Keeping it honest is the whole point.
 */

export interface UsesGroup {
  label: string
  items: string[]
}

export const USES: UsesGroup[] = [
  { label: 'reverse engineering', items: ['Frida', 'jadx', 'apktool', 'Ghidra', 'mitmproxy'] },
  { label: 'scraping / backend', items: ['Python', 'asyncio', 'httpx', 'FastAPI', 'Playwright'] },
  { label: 'asr / ml', items: ['Whisper', 'faster-whisper', 'PyTorch', 'CUDA'] },
  { label: 'this site', items: ['Astro', 'TypeScript', 'zero-framework island', 'GitHub Pages'] },
  { label: 'daily driver', items: ['macOS', 'JetBrains IDEs', 'zsh', 'Cascadia Mono'] },
]
