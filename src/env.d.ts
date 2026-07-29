/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** short git SHA baked at build (astro.config.mjs) */
  readonly BUILD_SHA?: string
  /** ISO date of the built commit */
  readonly BUILD_DATE?: string
  /** ISO timestamp of the build itself */
  readonly BUILD_TIME?: string
  /** JSON-encoded ChangeEntry[] of recent commits */
  readonly CHANGELOG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
