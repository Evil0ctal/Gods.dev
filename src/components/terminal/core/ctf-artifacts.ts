// AUTO-GENERATED CTF artifacts (scripts/gen-artifacts is the source).
// These strings are puzzle material. None contains a plaintext flag —
// each flag is only recoverable by solving the challenge.
/* eslint-disable */

export const SCROLL_OF_HERMES = `┌─ SCROLL OF HERMES ──────────────────────────────┐
│ the messenger seals every prophecy twice:       │
│ first he rolls his tongue thirteen letters,     │
│ then wraps the scroll in the sixty-fourth       │
│ alphabet for its flight across the wire.        │
│ unwrap in reverse order, mortal.                │
└─────────────────────────────────────────────────┘

dGJxZntndXZlZ3JyYV9mZ3JjZl9oY19ieWx6Y2hmfQ==`

export const FORGE_JS = `// forge.js — the smith-god's key daemon, salvaged from /opt/olympus.
// The smith forges a key for anyone who speaks the right name.
// He is deaf to all prayers but one: his own.
function keygen(offering) {
  if (typeof offering !== 'string' || offering.length !== 10) {
    return 'the forge is cold. (a name of ten letters, lowercase)'
  }
  let h = 0
  for (const c of offering) h = (h * 31 + c.charCodeAt(0)) % 65521
  if (h !== 0xf0f0) {
    return 'the smith does not answer to "' + offering + '".'
  }
  const slag = [
    15, 11, 22, 24, 30, 6, 69, 6, 19, 20, 15, 62, 28, 0, 62, 16, 25, 18,
    46, 16, 2, 4, 28, 15, 61, 14, 16, 45, 26, 30, 19, 11, 4, 24, 20, 24,
  ]
  let out = ''
  for (let i = 0; i < slag.length; i++) {
    out += String.fromCharCode(slag[i] ^ offering.charCodeAt(i % 10) ^ (i % 7))
  }
  return out
}`

// zero-width steganography: visible text is an innocuous verse; the flag is
// encoded in interleaved U+200B/U+200C bits terminated by U+200D. Emitted as
// \u escapes so editors/formatters cannot strip the invisible payload.
export const UNSEEN_TXT = "F\u200b\u200c\u200c\u200b\u200b\u200c\u200c\u200c\u200da\u200b\u200c\u200c\u200b\u200c\u200c\u200c\u200c\u200di\u200b\u200c\u200c\u200b\u200b\u200c\u200b\u200b\u200dt\u200b\u200c\u200c\u200c\u200b\u200b\u200c\u200c\u200dh\u200b\u200c\u200c\u200c\u200c\u200b\u200c\u200c\u200d \u200b\u200c\u200c\u200c\u200b\u200c\u200b\u200c\u200di\u200b\u200c\u200c\u200b\u200c\u200c\u200c\u200b\u200ds\u200b\u200c\u200c\u200c\u200b\u200b\u200c\u200c\u200d \u200b\u200c\u200c\u200b\u200b\u200c\u200b\u200c\u200dt\u200b\u200c\u200c\u200b\u200b\u200c\u200b\u200c\u200dh\u200b\u200c\u200c\u200b\u200c\u200c\u200c\u200b\u200de\u200b\u200c\u200b\u200c\u200c\u200c\u200c\u200c\u200d \u200b\u200c\u200c\u200b\u200b\u200b\u200c\u200b\u200de\u200b\u200c\u200c\u200c\u200b\u200c\u200b\u200c\u200dv\u200b\u200c\u200c\u200c\u200b\u200c\u200b\u200b\u200di\u200b\u200c\u200b\u200c\u200c\u200c\u200c\u200c\u200dd\u200b\u200c\u200c\u200c\u200b\u200b\u200b\u200b\u200de\u200b\u200c\u200c\u200c\u200b\u200b\u200c\u200b\u200dn\u200b\u200c\u200c\u200b\u200b\u200c\u200b\u200c\u200dc\u200b\u200c\u200c\u200c\u200b\u200b\u200c\u200c\u200de\u200b\u200c\u200c\u200b\u200b\u200c\u200b\u200c\u200d \u200b\u200c\u200c\u200b\u200c\u200c\u200c\u200b\u200do\u200b\u200c\u200c\u200c\u200b\u200c\u200b\u200b\u200df\u200b\u200c\u200c\u200c\u200c\u200c\u200b\u200c\u200d things not seen."

export const OLYMPUS_ACCESS_LOG = `198.51.100.24 - - [13/Jul/2026:03:01:12 +0000] "GET / HTTP/1.1" 200 5213 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
66.249.66.1 - - [13/Jul/2026:03:02:45 +0000] "GET /robots.txt HTTP/1.1" 200 67 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
198.51.100.24 - - [13/Jul/2026:03:03:02 +0000] "GET /blog HTTP/1.1" 200 4180 "https://gods.dev/" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.0.2.171 - - [13/Jul/2026:03:04:19 +0000] "GET /.env HTTP/1.1" 404 153 "-" "Mozilla/5.0 zgrab/0.x"
192.0.2.171 - - [13/Jul/2026:03:04:21 +0000] "GET /wp-login.php HTTP/1.1" 404 153 "-" "Mozilla/5.0 zgrab/0.x"
198.51.100.77 - - [13/Jul/2026:03:05:58 +0000] "GET /oracle/ask?q=d3Jvbmdfcml2ZXJfbW9ydGFs HTTP/1.1" 200 312 "-" "Mozilla/5.0 (X11; Linux x86_64) Firefox/128.0"
203.0.113.66 - - [13/Jul/2026:03:07:33 +0000] "GET /olympus/login HTTP/1.1" 200 891 "-" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:07:41 +0000] "POST /olympus/login HTTP/1.1" 401 42 "https://gods.dev/olympus/login" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:07:49 +0000] "POST /olympus/login HTTP/1.1" 401 42 "https://gods.dev/olympus/login" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:07:58 +0000] "POST /olympus/login HTTP/1.1" 401 42 "https://gods.dev/olympus/login" "Charon/2.0 (ferryman)"
198.51.100.24 - - [13/Jul/2026:03:08:11 +0000] "GET /projects HTTP/1.1" 200 3944 "https://gods.dev/blog" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
203.0.113.66 - - [13/Jul/2026:03:08:12 +0000] "POST /olympus/login HTTP/1.1" 401 42 "https://gods.dev/olympus/login" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:08:27 +0000] "POST /olympus/login HTTP/1.1" 200 118 "https://gods.dev/olympus/login" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:09:04 +0000] "GET /olympus/vault HTTP/1.1" 200 2048 "-" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:10:11 +0000] "GET /styx/ferry?i=3&c=1c19r HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
172.16.4.9 - - [13/Jul/2026:03:10:40 +0000] "GET /favicon.svg HTTP/1.1" 200 1223 "https://gods.dev/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"
203.0.113.66 - - [13/Jul/2026:03:11:02 +0000] "GET /styx/ferry?i=0&c=Z29kc HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:11:53 +0000] "GET /styx/ferry?i=6&c=VfbG9 HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
198.51.100.24 - - [13/Jul/2026:03:12:19 +0000] "GET /about HTTP/1.1" 200 2751 "https://gods.dev/projects" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
203.0.113.66 - - [13/Jul/2026:03:12:44 +0000] "GET /styx/ferry?i=1&c=3t0YX HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:13:37 +0000] "GET /styx/ferry?i=4&c=ZWVwc HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
66.249.66.1 - - [13/Jul/2026:03:14:05 +0000] "GET /sitemap-index.xml HTTP/1.1" 200 421 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
203.0.113.66 - - [13/Jul/2026:03:14:28 +0000] "GET /styx/ferry?i=7&c=nc30= HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
192.0.2.171 - - [13/Jul/2026:03:15:10 +0000] "GET /phpmyadmin/ HTTP/1.1" 404 153 "-" "Mozilla/5.0 zgrab/0.x"
203.0.113.66 - - [13/Jul/2026:03:15:19 +0000] "GET /styx/ferry?i=2&c=J0YXJ HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:16:06 +0000] "GET /styx/ferry?i=5&c=190aG HTTP/1.1" 204 0 "-" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:16:52 +0000] "DELETE /var/log/olympus/access.log HTTP/1.1" 403 199 "-" "Charon/2.0 (ferryman)"
203.0.113.66 - - [13/Jul/2026:03:17:03 +0000] "GET /olympus/logout HTTP/1.1" 302 0 "-" "Charon/2.0 (ferryman)"`
