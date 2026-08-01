---
title: 'A CTF Writeup: From Noise to Flag'
description: 'A generic reversing challenge, worked from a bare binary with no symbols to a recovered flag, with the dead ends left in — because the dead ends are most of the actual work.'
pubDate: 2022-12-12
tags: ['security', 'ctf']
---

The challenge description said: "prove you know the password." One
file, `check`, no source, no hints beyond that sentence and 200 points.
`file check` said stripped 64-bit ELF, no debug info. That's the entire
starting position for most reversing challenges, and it's worth
writing up precisely because the process — not the eventual flag — is
the reusable part.

## First pass: run it, then look, don't touch the disassembler yet

Before opening a disassembler, run the thing and see what it wants.

```bash
$ ./check
Enter the password: hello
Wrong.
$ ./check
Enter the password: hello world this is a much longer guess
Wrong.
```

No crash on a long input — probably not a naive stack-smash-into-shell
challenge, at least not on the obvious path. `strings check | less`
next, always, before any real analysis — free information that costs
zero reverse-engineering effort:

```text
$ strings check | grep -i -E 'flag|pass|correct|wrong'
Enter the password: 
Wrong.
Correct!
```

No flag string sitting in plaintext — expected, since that would make
the challenge worth zero points. But "Correct!" existing as a string
confirms there's a straightforward comparison-and-branch somewhere, not
something wrapping the check in more obfuscation than that.

## Second pass: find the comparison

Loaded into a disassembler, the standard move is to search cross-
references to the "Correct!" string and walk backward from there — the
string has to be referenced from wherever the program decides you won.

```text
; near the "Correct!" xref
0x401180  call    check_input
0x401185  test    eax, eax
0x401187  jz      0x4011a0        ; jump to "Wrong."
0x401189  lea     rdi, [rip+0x2e70]  ; "Correct!"
0x401190  call    puts
```

`check_input` is the function that matters; everything before this is
plumbing. Inside it, instead of a straight `strcmp` against a
hardcoded string (which would show up instantly as a referenced
string constant — checked, wasn't there), the function looped over the
input doing per-character arithmetic:

```text
0x401020  movzx  eax, byte [rsi+rcx]
0x401024  xor    eax, 0x37
0x401027  sub    eax, ecx
0x401029  cmp    al, byte [rdx+rcx]
0x40102d  jne    fail
```

Per-character XOR with a constant, then subtract the loop index, then
compare against a byte from a second buffer. That second buffer —
`rdx` — is the actual target: a table of expected bytes baked into the
binary, transformed inline instead of stored as a plain string. This is
a common, cheap obfuscation in reversing challenges: nothing here is
cryptographically hard, it just avoids the "grep strings for the flag"
shortcut.

## Third pass: recover the table, invert the transform

Dump the bytes at the `rdx` table's address (readable straight from the
binary's data section once you have the address), and the transform is
simple enough to invert by hand.

```python
# forward: expected[i] = (input[i] ^ 0x37) - i   (mod 256)
# invert:   input[i]    = (expected[i] + i) ^ 0x37

table = bytes.fromhex(
    "4f4a51475e0304495a505f5f5654"  # bytes pulled from the binary's .data
)

def recover(table: bytes) -> str:
    return "".join(chr(((b + i) & 0xFF) ^ 0x37) for i, b in enumerate(table))

print(recover(table))
```

That printed `flag{n0t_a_real_c1pher_just_arithmetic}` on the actual
run — worth saying plainly: this write-up uses a synthetic
challenge built to demonstrate the technique, not a real competition's
binary, since reproducing someone else's challenge content isn't the
point. The technique is what transfers.

## The dead ends, because they're the real lesson

Two things ate more time than the eventual solve:

- I initially assumed the comparison was a straight `memcmp` and spent
  twenty minutes looking for a hardcoded string that didn't exist,
  because I disassembled *near* the check instead of stepping through
  the actual loop.
- I mis-read the loop index register once (mixed up `rcx` and `r8` in a
  screenful of near-identical instructions) and got a garbage decode
  that looked *almost* right — printable characters, wrong flag — which
  is more dangerous than an obviously broken result, because it invites
  you to keep tweaking a wrong theory instead of re-checking your
  assumptions.

Both dead ends map to the same root cause: trusting a fast read of the
disassembly over actually stepping through the loop once in a debugger
to confirm the register meanings. A five-minute debugger session at the
start would have caught both.

## What I learned

The generalizable steps, in order, for this whole class of challenge:
run it and note the behavior, `strings` before disassembly, find the
success/fail branch and walk backward to the check, identify the
transform (constant string compare vs. per-byte arithmetic vs. actual
crypto), and only reach for a debugger when static reading gets
ambiguous — which it did here, and which is exactly when it's worth the
time. The binary was never trying to be unbreakable. It was trying to
be tedious enough that skimming wouldn't get you there. Slowing down
by about ten minutes at the one register mix-up would have gotten me to
the flag faster than my first, quicker, wrong pass did.
