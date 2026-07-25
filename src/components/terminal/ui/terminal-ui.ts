import type { CommandResult, OutputLine, TerminalContext } from '../core/types'
import { parse } from '../core/parser'
import { complete } from '../core/autocomplete'
import { displayPath } from '../core/vfs'
import { escapeHtml } from '../core/utils'
import { playBoot } from './boot'

export interface TerminalUiOptions {
  root: HTMLElement
  ctx: TerminalContext
  historyPush: (entry: string) => void
  historyPrev: () => string | null
  historyNext: () => string | null
  onEffect: (effect: NonNullable<CommandResult['effect']>) => void
}

const KIND_CLASS: Record<string, string> = {
  error: 'line-error',
  success: 'line-success',
  muted: 'line-muted',
  ascii: 'line-ascii',
}

export function createTerminalUi(opts: TerminalUiOptions) {
  const output = opts.root.querySelector<HTMLElement>('#term-output')!
  const input = opts.root.querySelector<HTMLInputElement>('#term-input')!
  const promptEl = opts.root.querySelector<HTMLElement>('#term-prompt')!
  const inputLine = opts.root.querySelector<HTMLElement>('#term-input-line')!
  let vimMode = false

  function printHtml(html: string, cls?: string): void {
    const div = document.createElement('div')
    div.className = `term-line${cls ? ` ${cls}` : ''}`
    div.innerHTML = html
    output.appendChild(div)
    div.scrollIntoView({ block: 'end' })
  }

  function printLine(l: OutputLine): void {
    const cls = l.kind ? KIND_CLASS[l.kind] : undefined
    printHtml(l.html ? l.text : escapeHtml(l.text) || '&nbsp;', cls)
  }

  function refreshPrompt(): void {
    promptEl.textContent = `guest@gods.dev:${displayPath(opts.ctx.cwd)}$`
  }

  function fakeCrash(): void {
    input.disabled = true
    const doom = [
      'rm: removing /usr ...', 'rm: removing /etc ...', 'rm: removing /home/guest ...',
      'Segmentation fault (core dumped)', 'KERNEL PANIC: the gods intervened.',
    ]
    doom.forEach((t, i) => setTimeout(() => printHtml(escapeHtml(t), 'line-error'), i * 350))
    setTimeout(() => {
      output.querySelectorAll('.term-line').forEach((el) => el.remove())
      printHtml('nice try. filesystem restored from divine backup.', 'line-success')
      input.disabled = false
      input.focus()
    }, doom.length * 350 + 900)
  }

  function enterVim(): void {
    vimMode = true
    printHtml('~<br>~<br>~<br><b>VIM - Vi IMproved</b><br>~<br>~   type  :q!&lt;Enter&gt;  to escape (you know you want to)', 'line-muted')
    promptEl.textContent = '--INSERT--'
  }

  async function runResult(res: CommandResult): Promise<void> {
    if (res.clear) output.querySelectorAll('.term-line, #motd').forEach((el) => el.remove())
    for (const l of res.lines) printLine(l)
    if (res.effect === 'crash') fakeCrash()
    else if (res.effect === 'vim') enterVim()
    else if (res.effect) opts.onEffect(res.effect)
    if (res.navigate) setTimeout(() => (window.location.href = res.navigate!), 400)
  }

  async function execute(raw: string): Promise<void> {
    printHtml(`<span class="line-muted">${escapeHtml(promptEl.textContent ?? '')}</span> ${escapeHtml(raw)}`)
    if (vimMode) {
      if (raw.trim() === ':q!') {
        vimMode = false
        printHtml('escaped vim. achievement unlocked.', 'line-success')
        refreshPrompt()
      } else printHtml('E492: Not an editor command. hint: :q!', 'line-error')
      return
    }
    const parsed = parse(raw)
    if (!parsed) return
    opts.historyPush(raw)
    const cmd = opts.ctx.registry.get(parsed.cmd)
    if (!cmd) {
      printHtml(`gsh: command not found: ${escapeHtml(parsed.cmd)}. try <button type="button" class="cmd-link" data-cmd="help">help</button>`, 'line-error')
      return
    }
    await runResult(await cmd.run(parsed.args, opts.ctx))
    refreshPrompt()
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      const v = input.value
      input.value = ''
      void execute(v)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const candidates = complete(input.value, {
        names: opts.ctx.registry.names(false),
        vfs: opts.ctx.vfs,
        cwd: opts.ctx.cwd,
      })
      if (candidates.length === 1) input.value = candidates[0]!
      else if (candidates.length > 1) printHtml(candidates.map(escapeHtml).join('&nbsp;&nbsp;'), 'line-muted')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const v = opts.historyPrev()
      if (v !== null) input.value = v
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      input.value = opts.historyNext() ?? ''
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      void execute('clear')
    }
  }

  async function start(): Promise<void> {
    const motd = output.querySelector<HTMLElement>('#motd')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const seen = localStorage.getItem('gods:booted') === '1'
    let skipped = reduced || seen
    const skipNow = () => skipped
    const onSkip = () => (skipped = true)

    if (!skipped) {
      motd?.remove()
      window.addEventListener('keydown', onSkip, { once: true })
      window.addEventListener('pointerdown', onSkip, { once: true })
      await playBoot(printHtml, skipNow)
      window.removeEventListener('keydown', onSkip)
      window.removeEventListener('pointerdown', onSkip)
      if (motd) output.appendChild(motd)
      localStorage.setItem('gods:booted', '1')
    }

    refreshPrompt()
    inputLine.hidden = false
    input.addEventListener('keydown', onKeydown)
    opts.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.cmd-link')
      if (btn?.dataset.cmd) void execute(btn.dataset.cmd)
      else if (e.target === opts.root || output.contains(e.target as Node)) input.focus()
    })
    input.focus()
  }

  return { start, execute, printHtml }
}
