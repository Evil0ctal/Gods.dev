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
    sha256: 'ec4e3c50b1e938f741b6125829db9225bb8c8f3dd6871938f12885fc9dfeaf59',
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
