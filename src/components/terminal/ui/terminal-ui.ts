import type { CommandResult, GameLaunch, OutputLine, ReplSession, TerminalContext } from '../core/types'
import { parse } from '../core/parser'
import { complete } from '../core/autocomplete'
import { displayPath } from '../core/vfs'
import { escapeHtml } from '../core/utils'
import { playBoot } from './boot'
import { beep, initSound } from '../core/sound'

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

/** 真终端的 scrollback 是有限的；超过后最旧的行被丢弃，避免 DOM 无限膨胀 */
const MAX_SCROLLBACK = 500

export function createTerminalUi(opts: TerminalUiOptions) {
  const output = opts.root.querySelector<HTMLElement>('#term-output')!
  const input = opts.root.querySelector<HTMLInputElement>('#term-input')!
  const promptEl = opts.root.querySelector<HTMLElement>('#term-prompt')!
  const inputLine = opts.root.querySelector<HTMLElement>('#term-input-line')!
  const titleEl = opts.root.querySelector<HTMLElement>('.term-titlebar .title')
  const scroller = output.closest<HTMLElement>('.term-body')
  let vimMode = false
  let replMode: ReplSession | null = null

  function scrollToBottom(): void {
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }

  /** 点击 .cmd-link 会把焦点带到按钮上，光标随之消失——执行完把焦点还给输入框。
      仅限精确指针设备：移动端强制聚焦会每次都弹出软键盘。 */
  function refocusInput(): void {
    if (!input.disabled && window.matchMedia('(pointer: fine)').matches) {
      input.focus({ preventScroll: true })
    }
  }

  function printHtml(html: string, cls?: string): void {
    const div = document.createElement('div')
    div.className = `term-line${cls ? ` ${cls}` : ''}`
    div.innerHTML = html
    output.appendChild(div)
    while (output.childElementCount > MAX_SCROLLBACK) output.firstElementChild?.remove()
    scrollToBottom()
  }

  function printLine(l: OutputLine): void {
    const cls = l.kind ? KIND_CLASS[l.kind] : undefined
    printHtml(l.html ? l.text : escapeHtml(l.text) || '&nbsp;', cls)
  }

  function refreshPrompt(): void {
    const path = displayPath(opts.ctx.cwd)
    promptEl.textContent = `guest@gods.dev:${path}$`
    if (titleEl) titleEl.textContent = `guest@gods.dev: ${path}`
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

  function enterGame(g: GameLaunch): void {
    input.disabled = true
    inputLine.hidden = true
    const screen = document.createElement('div')
    screen.className = 'game-screen'
    screen.id = 'game-screen'
    output.appendChild(screen)
    const header = `<div class="game-head"><span class="out-name">${escapeHtml(g.title)}</span> <span class="muted">— ${escapeHtml(g.controls)}</span></div>`

    let keyHandler: (key: string) => void = () => {}
    let timer: ReturnType<typeof setInterval> | null = null
    let ended = false

    const cleanup = () => {
      if (timer) clearInterval(timer)
      window.removeEventListener('keydown', onGameKey, true)
      screen.remove()
    }
    const io = {
      draw: (html: string) => {
        screen.innerHTML = header + html
        scrollToBottom()
      },
      onKey: (fn: (key: string) => void) => {
        keyHandler = fn
      },
      every: (ms: number, fn: () => void) => {
        if (timer) clearInterval(timer)
        timer = setInterval(fn, ms)
      },
      exit: (summary?: OutputLine[]) => {
        if (ended) return
        ended = true
        cleanup()
        summary?.forEach(printLine)
        inputLine.hidden = false
        input.disabled = false
        refreshPrompt()
        input.focus()
      },
      rng: Math.random,
      beep,
    }
    function onGameKey(e: KeyboardEvent): void {
      if (e.key === 'q' || e.key === 'Escape') {
        e.preventDefault()
        io.exit([{ text: `quit ${g.title}.`, kind: 'muted' }])
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
      keyHandler(e.key)
    }
    window.addEventListener('keydown', onGameKey, true)
    g.run(io)
  }

  function enterRepl(session: ReplSession): void {
    replMode = session
    session.intro.forEach(printLine)
    promptEl.textContent = session.prompt
  }

  async function runResult(res: CommandResult): Promise<void> {
    if (res.clear) output.querySelectorAll('.term-line, #motd').forEach((el) => el.remove())
    for (const l of res.lines) printLine(l)
    if (res.game) enterGame(res.game)
    else if (res.repl) enterRepl(res.repl)
    else if (res.effect === 'crash') fakeCrash()
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
    if (replMode) {
      const { lines, done } = replMode.onInput(raw)
      lines.forEach(printLine)
      if (done) {
        replMode = null
        refreshPrompt()
      }
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
    // a command may have entered vim/repl mode, which own the prompt
    if (!vimMode && !replMode) refreshPrompt()
  }

  function onKeydown(e: KeyboardEvent): void {
    // opt-in retro keypress tick (no-op unless `sound on`); skip modifiers
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) beep('key')
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
    } else if (e.key === 'c' && e.ctrlKey && !window.getSelection()?.toString()) {
      // ^C 中断当前输入行（有选区时不拦截，保住复制）
      e.preventDefault()
      printHtml(`<span class="line-muted">${escapeHtml(promptEl.textContent ?? '')}</span> ${escapeHtml(input.value)}^C`)
      input.value = ''
    } else if (e.key === 'u' && e.ctrlKey) {
      e.preventDefault()
      input.value = ''
    }
  }

  async function start(): Promise<void> {
    initSound()
    const motd = output.querySelector<HTMLElement>('#motd')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // boot plays every load; `gods:booted` is a test-only skip override.
    // Read it from sessionStorage, NOT localStorage: a localStorage flag left
    // behind by testing against the live domain persists forever and silently
    // disables the boot animation on every future visit. sessionStorage lives
    // only for the tab a test sets it in and production never writes it, so a
    // real visitor can never get stuck — and this build no longer reads any
    // stale localStorage flag, so already-affected browsers self-heal.
    let forceSkip = false
    try {
      forceSkip = sessionStorage.getItem('gods:booted') === '1'
    } catch {
      forceSkip = false
    }
    let skipped = reduced || forceSkip
    const skipNow = () => skipped
    const onSkip = () => (skipped = true)

    if (!skipped) {
      motd?.remove()
      const hint = document.createElement('div')
      hint.className = 'term-line boot-line boot-skip-hint'
      hint.textContent = 'press any key to skip'
      output.appendChild(hint)
      window.addEventListener('keydown', onSkip)
      window.addEventListener('pointerdown', onSkip)
      await playBoot({ output, skip: skipNow })
      window.removeEventListener('keydown', onSkip)
      window.removeEventListener('pointerdown', onSkip)
      output.querySelectorAll('.boot-line').forEach((el) => el.remove())
      if (motd) output.appendChild(motd)
    }

    refreshPrompt()
    inputLine.hidden = false
    input.addEventListener('keydown', onKeydown)
    opts.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.cmd-link')
      if (btn?.dataset.cmd) {
        void execute(btn.dataset.cmd).then(refocusInput)
      } else if (window.getSelection()?.toString()) {
        return // 正在选中文本复制，别抢焦点
      } else if (e.target === opts.root || output.contains(e.target as Node)) {
        input.focus()
      }
    })
    input.focus()
  }

  return { start, execute, printHtml }
}
