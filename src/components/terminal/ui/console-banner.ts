export function printConsoleBanner(): void {
  const style = 'color:#7aa2f7;font-family:monospace;font-size:12px'
  console.log(
    `%c
  ┌──────────────────────────────────────────────────┐
  │  so you opened the console. naturally.           │
  │                                                  │
  │  the prophecy is buried where dotfiles hide.     │
  │  ls sees what ls is told to see.                 │
  │  start at ~ and look for what starts with '.'    │
  │                                                  │
  │  flags: gods{...}  ·  submit them in the terminal│
  └──────────────────────────────────────────────────┘`,
    style,
  )
}
