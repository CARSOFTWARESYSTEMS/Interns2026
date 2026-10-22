/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'local' | 'gdrive' | 'firebase'
  /**
   * Localhost-only: which Partner hostname to emulate (e.g. "login.gamyaa.in").
   * Ignored on every non-loopback host.
   */
  readonly VITE_DEV_PARTNER_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
