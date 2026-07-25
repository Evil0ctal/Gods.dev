const BOOT_LINES: Array<[string, number]> = [
  ['[    0.000000] gods.dev kernel 1.0.0-olympus booting...', 60],
  ['[    0.041337] cpu0: divine spark detected', 45],
  ['[    0.133700] mounting /dev/hubris on /home/guest ... ok', 55],
  ['[    0.271828] loading personality: evil0ctal.ko', 50],
  ['[    0.314159] easter_eggs: 8 modules loaded (some hidden)', 60],
  ['[    0.999999] reality check: <span class="line-error">FAILED</span> (continuing anyway)', 70],
  ['[    1.000000] startup complete. welcome, guest.', 40],
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 打印 boot 日志。skip() 返回 true 时立即输出剩余行。 */
export async function playBoot(
  print: (html: string, cls?: string) => void,
  skip: () => boolean,
): Promise<void> {
  for (const [html, delay] of BOOT_LINES) {
    print(html, 'line-muted')
    if (!skip()) await sleep(delay)
  }
}
