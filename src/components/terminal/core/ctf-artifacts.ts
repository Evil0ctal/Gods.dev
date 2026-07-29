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

// FIELD OPS — bogus-signer: reverse the request signer, then XOR the vault.
// Ships the algorithm, the canonical TARGET, and the XOR-sealed vault. The flag
// is only recoverable by running xbogus(TARGET) and un-XORing — never literal.
export const SIGNER_JS = `// signer.js — the gate stamps every request to Olympus with an X-Bogus header.
// No secret is needed: the signature is a pure function of the request. Sign the
// canonical TARGET below, then unseal the vault with the keystream it yields.
const TARGET = "aid=6383&device=olympus&ts=1721952000";

function xbogus(query) {
  let h = 5381;
  const ks = [];
  for (let i = 0; i < query.length; i++) {
    h = ((h * 33) ^ query.charCodeAt(i)) >>> 0;
    ks.push(h & 0xff);
  }
  return ks;
}

// the vault is XOR-sealed under xbogus(TARGET). unseal it:
//   const ks = xbogus(TARGET);
//   vault.map((b, i) => String.fromCharCode(b ^ ks[i % ks.length])).join('')
const vault = [163,66,205,135,57,201,182,88,108,223,168,120,93,16,87,198,188,143,48,186,161,170,7,12,122,149,72,252,108,23,30,51,8,70,92,75,93,161,76,196,137];`

// FIELD OPS — whisper-noise: LSB audio stego. Visible samples are a plausible
// PCM noise floor; the flag lives one bit deep. No comment carries a digit, so
// a numeric parse yields only the samples.
export const WHISPER_SAMPLES = `# whisper.samples — a sixteen-bit PCM tap from the ASR debug bus.
# the transcript came back empty; the message hides in the noise floor.
# read the least-significant bit of every sample, MSB-first, eight bits to a byte, then to ASCII.
1034 1073 1109 1146 1182 1221 1257 1295 1330 1369 1405 1442 1479 1517 1041 1079 1114 1153 1189 1226 1262 1301 1336 1374 1410 1449 1485 1523 1046 1084 1121 1159 1194 1233 1269 1307 1343 1380 1417 1455 1490 1529 1053 1091 1126 1165 1200 1238 1274 1313 1349 1386 1423 1460 1496 1534 1058 1096 1133 1171 1206 1244 1281 1319 1354 1393 1428 1467 1503 1029 1065 1103 1138 1177 1213 1250 1287 1325 1361 1398 1434 1472 1509 1035 1070 1108 1144 1182 1218 1256 1293 1331 1366 1404 1440 1479 1514 1041 1077 1115 1150 1188 1225 1263 1298 1337 1373 1410 1446 1485 1520 1047 1082 1121 1156 1195 1231 1269 1305 1343 1378 1417 1453 1490 1526 1053 1089 1126 1162 1201 1237 1274 1311 1349 1384 1422 1458 1497 1533 1058 1095 1133 1169 1207 1242 1281 1317 1354 1391 1429 1465 1503 1026 1065 1101 1139 1174 1212 1249 1286 1322 1361 1396 1435 1471 1509 1033 1071 1106 1145 1181 1219 1254 1292 1329 1366 1402 1441 1477 1514 1038 1077 1112 1151 1186 1225 1261 1298 1335 1373 1408 1447 1482 1521 1045 1082 1118 1157 1192 1231 1266 1305 1341 1378 1415 1453 1488 1527 1050 1089 1125 1162 1198 1236 1273 1310 1346 1384 1421 1459 1494 1532 1057 1095 1130 1169 1205 1243 1278 1316 1353 1390 1426 1465 1501 1027 1062 1100 1137 1175 1210 1249 1285 1323 1359 1397 1432 1471`

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
