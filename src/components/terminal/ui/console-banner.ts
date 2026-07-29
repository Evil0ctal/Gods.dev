import { FRAG1 } from '../../../data/ascension'

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
  // ASCENSION breadcrumb 1/3 — the base64 head. Two more hide in a kernel
  // panic (/404) and in /proc. Join all three, base64-decode, then `ascend`.
  console.log(
    `%cascension · fragment 1/3 · %c${FRAG1}%c · two more wait in a panic and in /proc`,
    'color:#bb9af7;font-family:monospace;font-size:12px',
    'color:#e0af68;font-weight:bold;font-family:monospace',
    'color:#565f89;font-family:monospace;font-size:12px',
  )
}
