export interface FlagEntry {
  id: string
  name: string
  sha256: string
}

/**
 * CTF flag registry. Only hashes live here — go find the plaintext.
 * v2: append new entries; the validator needs no changes.
 */
export const FLAGS: FlagEntry[] = [
  {
    id: 'flag01',
    name: 'The Gates',
    sha256: 'b52f0afdfd28751884a21720fd51ae24d0e71c2251d47137cf69234befa0f997',
  },
]

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function checkFlag(
  submission: string,
  flags: FlagEntry[] = FLAGS,
): Promise<FlagEntry | null> {
  const hash = await sha256Hex(submission.trim())
  return flags.find((f) => f.sha256 === hash) ?? null
}
