/**
 * "The Annotated Reverse" demo data. A representative 48-byte WeChat-Channels-
 * style video head: CIPHER is the on-disk noise, KEY is the recovered keystream.
 * XOR them and an MP4 `ftyp` box falls out — the whole point of the widget.
 * Nothing secret here; the reveal is the lesson. Generated so cipher = plain^key.
 */
export const CIPHER = [
  66, 233, 63, 64, 179, 98, 239, 55, 137, 207, 124, 67, 135, 252, 236, 138,
  159, 141, 182, 111, 240, 162, 223, 253, 32, 36, 158, 96, 145, 106, 119, 154,
  134, 241, 21, 106, 225, 16, 43, 44, 29, 74, 47, 3, 49, 251, 105, 29,
]

export const KEY = [
  66, 233, 63, 96, 213, 22, 150, 71, 224, 188, 19, 46, 135, 252, 238, 138,
  246, 254, 217, 2, 153, 209, 176, 207, 65, 82, 253, 81, 252, 26, 67, 171,
  134, 241, 21, 98, 135, 98, 78, 73, 29, 74, 5, 60, 92, 159, 8, 105,
]

export const BYTES_PER_ROW = 16
