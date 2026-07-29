export type ChallengeCategory = 'crypto' | 'web' | 'reversing' | 'stego' | 'forensics'
export type ChallengeDifficulty = 'intro' | 'easy' | 'medium' | 'hard'
export type ChallengeTrack = 'recon' | 'field-ops'

export interface Challenge {
  id: string
  name: string
  category: ChallengeCategory
  difficulty: ChallengeDifficulty
  points: number
  /** which track it belongs to; undefined = the original 'recon' track */
  track?: ChallengeTrack
  /** SHA-256 of the plaintext flag. The plaintext lives nowhere in this repo. */
  sha256: string
  /** one-line pointer to where the puzzle material lives */
  where: string
  prompt: string
  hints: string[]
  /** puzzle material delivered inline by `ctf <id>` (e.g. a token), when not a file */
  artifact?: string
}

/**
 * The gods.dev CTF. Only flag hashes live here — the plaintext is recoverable
 * only by solving each challenge. v2+: append entries; the machinery adapts.
 */
export const CHALLENGES: Challenge[] = [
  {
    id: 'source-of-truth',
    name: 'Source of Truth',
    category: 'web',
    difficulty: 'easy',
    points: 50,
    sha256: 'c51c12049c0e9cd6786b5dcf326187799267c2cdf3eb7bf7cbb282e12fcd283f',
    where: 'view-source of the /ctf page — read the <head>',
    prompt:
      'The /ctf shrine renders spotless to mortal eyes — but the ancients always carved an inscription into the rafters where no one thinks to look. The build gods left their mark when they deployed that page from Olympus. Find the inscription and read it the way a god would: not as it is shown, but as it is written.',
    hints: [
      'Mortals read the rendered page; gods read the source. Try view-source on /ctf.',
      "Near the top of the <head> is a deploy comment. Real integrity hashes are hex — 'sha0' is not a real algorithm, and that value ends in '='.",
      "A trailing '=' is base64's signature. Run atob(...) on the value in the devtools console.",
    ],
  },
  {
    id: 'scroll-of-hermes',
    name: 'Scroll of Hermes',
    category: 'crypto',
    difficulty: 'easy',
    points: 75,
    sha256: '8557ada316d81ae9bf15e77a50e352c9aec5366f13afc9a89a184ebb7a1ca061',
    where: 'cat ~/.ctf/scroll_of_hermes',
    prompt:
      'A courier from Olympus dropped a sealed scroll in ~/.ctf/scroll_of_hermes. Hermes never sends prophecy in the clear — he seals it twice before it crosses the wire. Read the scroll, note HOW he seals it, and unwrap the layers in the right order.',
    hints: [
      "The scroll names both seals in order: a tongue rolled 'thirteen letters', then the 'sixty-fourth alphabet'. He sealed last with base64 — unseal that first.",
      'After base64-decoding you get something flag-shaped but scrambled, starting tbqf{...}. Every letter walked thirteen steps up the alphabet.',
      'base64-decode, then ROT13. Digits, braces and underscores do not rotate — only letters.',
    ],
  },
  {
    id: 'the-gates',
    name: 'The Gates',
    category: 'crypto',
    difficulty: 'intro',
    points: 100,
    sha256: 'ec4e3c50b1e938f741b6125829db9225bb8c8f3dd6871938f12885fc9dfeaf59',
    where: 'the console banner points the way; then cat ~/.secrets/prophecy.txt',
    prompt:
      'An old god left a prophecy behind in ~/.secrets. It does not want to be read — it wants to be earned. The browser console has a hint for those who open it. Decode the prophecy and speak the truth back.',
    hints: [
      'Open the browser devtools console on the homepage. Something is printed there for source-readers.',
      "Look for hidden files: ls -a around your home directory. Dotfiles are shy.",
      'The prophecy is sealed the same way Hermes seals things — Caesar (13) guarding the ancient sixty-four.',
    ],
  },
  {
    id: 'forge-of-hephaestus',
    name: 'The Cold Forge',
    category: 'reversing',
    difficulty: 'medium',
    points: 125,
    sha256: '1c70f90bc769ad23f85a54e9e7b1b24f1653d14ac4b1f9d84c8ee1eba7d7bbd7',
    where: 'cat /opt/olympus/forge.js',
    prompt:
      'Deep in /opt/olympus lies a dead daemon: forge.js. Once it stamped out keys for every god on the mountain; now the fire is out and the smith answers no one. The code still remembers how to forge one last key — but only if the right offering is spoken. Read the ruin, wake the smith, and take what he makes.',
    hints: [
      "Read the source, don't just run it. The gate checks a 10-character lowercase string against a checksum — the theme tells you whose name it wants.",
      'Which Olympian works a forge? Ten letters, lowercase. Pass it to keygen() in your browser console.',
      "Last resort: you know the flag starts with gods{. Compute slag[i] XOR 'gods{'.charCodeAt(i) XOR (i%7) for i=0..4 — the key spells its own first five letters.",
    ],
  },
  {
    id: 'things-not-seen',
    name: 'The Evidence of Things Not Seen',
    category: 'stego',
    difficulty: 'medium',
    points: 125,
    sha256: '4d8085ca2fd6d66c3b2571fe2850ed798b2e20faaaf08c77b74c67c9dbe47096',
    where: 'cat ~/scriptures/unseen.txt',
    prompt:
      'An old verse rests in ~/scriptures/unseen.txt. Forty-one characters of scripture — or so your eyes report. The oracle swears the scroll weighs far more than that. Faith, after all, is the evidence of things not seen.',
    hints: [
      'Your eyes count 41 characters. The file disagrees. Copy the verse and measure it — [...s].length in the console.',
      'Three invisible tenants live between the letters: U+200B, U+200C, U+200D. Two are bits; the third ends each byte.',
      'Keep only the zero-width characters in order. Split on U+200D. Read each 8-char group as binary with U+200B=0 and U+200C=1, then to ASCII.',
    ],
  },
  {
    id: 'ferryman-ledger',
    name: "The Ferryman's Ledger",
    category: 'forensics',
    difficulty: 'medium',
    points: 150,
    sha256: 'd1a40125454795e5e643cdcc06e25dc30d0ace2cb485512b9f8574a590ebef8e',
    where: 'cat /var/log/olympus/access.log',
    prompt:
      'At 03:08 UTC someone hammered the gates of Olympus until they gave. The intruder did not leave empty-handed — the ferryman carried the stolen relic across the Styx one coin at a time, and coins do not board in order. The web server saw everything and wrote it down before the thief could burn the ledger. Find the intruder, follow the ferry, reassemble what was taken.',
    hints: [
      'Triage: one IP fails the /olympus/login gate over and over before getting in. Everything that IP did after it succeeded is the story.',
      'The /styx/ferry requests each carry a cargo c and a berth number i. The log order is a lie; the berth numbers are not.',
      'Take the eight c values, sort by i from 0 to 7, join into one string, and base64-decode it.',
    ],
  },
  {
    id: 'alg-none-ascension',
    name: 'The Aegis Token',
    category: 'web',
    difficulty: 'hard',
    points: 200,
    sha256: 'c2450ca40254913c959a996e8137648dd251c15391c845baef33bd4955d01ab7',
    where: 'the token is printed by `ctf alg-none-ascension` (below)',
    prompt:
      'gate.olympus issued you a session token — three dot-separated base64url segments, a JWT. You are role:guest. The payload carries a sealed "vault", but the gate never checks its own signature. Decode all three segments, read what the gate confesses about how it unseals, escalate, and the vault opens.',
    artifact:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InpldXMifQ.eyJpc3MiOiJnYXRlLm9seW1wdXMiLCJzdWIiOiJtb3J0YWwiLCJuYW1lIjoid2FuZGVyZXIiLCJyb2xlIjoiZ3Vlc3QiLCJ0aWVyIjowLCJlbmMiOiJ4b3I6JHJvbGUka2lkIiwidmF1bHQiOiJPMVpVQWcxSkVSMFJKZ0FMQ3dRNEVDOGxXQXdPV3lBV0J4Z2hHenhmVUIwZk1rUUVCVHdqVUEiLCJpYXQiOjE3MjE5NTIwMDAsImV4cCI6MTg5MzQ1NjAwMH0.Ly8gZ2F0ZS5qcyB2MiAtLSB0aGlzIHNlZ21lbnQgaXMgbmV2ZXIgdmVyaWZpZWQuIHVuc2VhbCh2YXVsdCkgcmVxdWlyZXMgYWxnICJub25lIiBhbmQgY2xhaW1zLnJvbGUgImFkbWluIi4',
    hints: [
      'A JWT is three base64url blobs joined by dots. Decode each. The signature segment is not a signature — it is a plaintext note describing what unseals the vault. Classic alg:none trust bug.',
      'The payload enc field is "xor:$role$kid": the vault is XOR-encrypted with role concatenated with the header kid. As guest+zeus it yields garbage. The note demands role "admin".',
      'Un-base64url the vault, XOR the bytes against ASCII "adminzeus" (repeating), and you get another base64 string. Decode THAT to read the flag.',
    ],
  },

  // ── FIELD OPS: a second track, closer to the operator's real work ──
  {
    id: 'bogus-signer',
    name: 'The Bogus Signer',
    category: 'reversing',
    difficulty: 'hard',
    points: 175,
    track: 'field-ops',
    sha256: '3503556ce59b570b0d3c05c49ab31035f1ff82da861200edc83edab4db8cad49',
    where: 'cat /opt/olympus/signer.js',
    prompt:
      'The gate signs every request to Olympus with an X-Bogus header — no secret key, just an algorithm nobody was meant to read. signer.js in /opt/olympus still carries it, and a vault it sealed under the signature of one canonical request. You need to guess nothing: sign the request the way the code does, then let the keystream fall away.',
    hints: [
      'Read /opt/olympus/signer.js. There is no password to find — xbogus(query) is deterministic. Run it on the TARGET string in the file.',
      'xbogus returns a keystream, one byte per input character. The vault is XOR-sealed with it: vault[i] ^ ks[i % ks.length].',
      "In the console: const ks = xbogus(TARGET); vault.map((b,i)=>String.fromCharCode(b^ks[i%ks.length])).join('') — that is the flag.",
    ],
  },
  {
    id: 'whisper-noise',
    name: 'Whisper in the Noise',
    category: 'stego',
    difficulty: 'hard',
    points: 175,
    track: 'field-ops',
    sha256: '36f21fd51121267c5687f583e824fe374775ccde686e6cef464b92f66a2a2e95',
    where: 'cat ~/.ctf/whisper.samples',
    prompt:
      'The ASR tap in ~/.ctf/whisper.samples caught a stream the transcript came back empty on. The words are not in the audio — they are under it. Every sample carries one stolen bit in the place no one listens: the noise floor.',
    hints: [
      'Open ~/.ctf/whisper.samples. Those integers are PCM samples. The comment says where to look: the least-significant bit of each.',
      'Take sample & 1 for every sample, in order. Group the bits eight at a time, most-significant bit first, and turn each group into a byte.',
      "parse the numbers, then bits -> 8-bit groups -> parseInt(group, 2) -> String.fromCharCode. It reads as gods{...}.",
    ],
  },
  {
    id: 'apk-keygen',
    name: 'The Licensed App',
    category: 'reversing',
    difficulty: 'hard',
    points: 200,
    track: 'field-ops',
    sha256: '75317fb5057ce70bc762ec4a4a08b588690dc2073ba2b440763bb4a9be8642c6',
    where: 'cat /opt/olympus/checklicense.js',
    prompt:
      'A cracked APK sits in /opt/olympus: checklicense.js, lifted straight out of com.olympus.gate. It phones no server — the whole license check runs on the device, which was its first mistake. The key that makes checkLicense() return true is the flag. Write the keygen the vendor was afraid you would.',
    hints: [
      'Read checklicense.js. Each character is checked independently: (((key[i] + i*3) ^ 0x5a) & 0xff) must equal TARGET[i]. Position-dependent, but per-character — so invert it per character.',
      'XOR is its own inverse and the +i*3 is undone by -i*3 (mod 256): key[i] = ((TARGET[i] ^ 0x5a) - i*3) & 0xff.',
      'Map TARGET to characters with that formula and join. It reads as gods{...}. (& 0xff on a negative in JS already wraps mod 256.)',
    ],
  },
]

export type ChallengeTrackMeta = { id: ChallengeTrack; label: string; blurb: string }
export const TRACKS: ChallengeTrackMeta[] = [
  { id: 'recon', label: 'RECON', blurb: 'find the flags hidden across the site' },
  { id: 'field-ops', label: 'FIELD OPS', blurb: "reverse the operator's real toolkit" },
]

/** a challenge's track, defaulting the original set to 'recon' */
export function challengeTrack(c: Challenge): ChallengeTrack {
  return c.track ?? 'recon'
}

/** 段位阶梯：按已得分点数递增，全清解锁最高称号 */
const RANKS: Array<{ min: number; title: string }> = [
  { min: 0, title: 'mortal' },
  { min: 1, title: 'script kiddie' },
  { min: 150, title: 'initiate' },
  { min: 300, title: 'acolyte' },
  { min: 500, title: 'adept' },
  { min: 700, title: 'demigod' },
]

export function totalPoints(challenges: Challenge[] = CHALLENGES): number {
  return challenges.reduce((sum, c) => sum + c.points, 0)
}

export function scoreOf(solvedIds: string[], challenges: Challenge[] = CHALLENGES): number {
  const solved = new Set(solvedIds)
  return challenges.filter((c) => solved.has(c.id)).reduce((sum, c) => sum + c.points, 0)
}

export function rankTitle(
  solvedIds: string[],
  challenges: Challenge[] = CHALLENGES,
): string {
  const total = totalPoints(challenges)
  const score = scoreOf(solvedIds, challenges)
  const solvedCount = new Set(solvedIds).size
  if (solvedCount >= challenges.length && total > 0) return 'god of gods.dev'
  let title = RANKS[0]!.title
  for (const r of RANKS) if (score >= r.min) title = r.title
  return title
}

export function findChallengeByHash(hash: string, challenges: Challenge[] = CHALLENGES): Challenge | undefined {
  return challenges.find((c) => c.sha256 === hash)
}

export function findChallenge(id: string, challenges: Challenge[] = CHALLENGES): Challenge | undefined {
  return challenges.find((c) => c.id === id)
}

/** 展示顺序：按分值升序（递进难度） */
export function orderedChallenges(challenges: Challenge[] = CHALLENGES): Challenge[] {
  return [...challenges].sort((a, b) => a.points - b.points)
}
