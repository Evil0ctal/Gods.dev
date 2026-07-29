/**
 * ASCENSION — a cross-page ARG. Three breadcrumbs are scattered across the real
 * site (the console banner, the 404 kernel trace, and /proc); assemble them,
 * base64-decode, and speak the word: `ascend <word>`.
 *
 * Leak-free by construction: only the ENCODED fragments and the answer's
 * SHA-256 live here. The passphrase itself is generated in a scratchpad script
 * and never committed. A unit test reassembles the fragments and checks the
 * result hashes to ASCENSION_SHA256 — proving the ARG is solvable.
 */

/** base64 head — printed in the devtools console banner */
export const FRAG1 = 'YXBvd'
/** middle — ASCII-hex, hidden inside the 404 kernel panic trace */
export const FRAG2_HEX = '47686c62334e'
/** base64 tail — carried in /proc/<pid>/cmdline */
export const FRAG3 = 'pcw=='
/** SHA-256 of the assembled passphrase */
export const ASCENSION_SHA256 = '847bb8b2a492055af15311dae5cfbac7e972041eceddc9146e46bd787492504c'

/** localStorage key holding ascension status ('1' once ascended) */
export const ASCENDED_KEY = 'gods:ascended'
