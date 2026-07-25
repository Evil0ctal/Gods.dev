const SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
]

export function listenKonami(onTrigger: () => void): void {
  let progress = 0
  window.addEventListener('keydown', (e) => {
    progress = e.key === SEQUENCE[progress] ? progress + 1 : e.key === SEQUENCE[0] ? 1 : 0
    if (progress === SEQUENCE.length) {
      progress = 0
      onTrigger()
    }
  })
}
