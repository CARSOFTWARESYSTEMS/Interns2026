/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'local' | 'gdrive' | 'firebase'
  readonly VITE_FIREBASE_API_KEY?: string
  /** Bare hostname: ev2027.firebaseapp.com, or auth.ev.engineer once it serves /__/auth/handler. */
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /**
   * Localhost-only: which Partner hostname to emulate (e.g. "login.gamyaa.in").
   * Ignored on every non-loopback host.
   */
  readonly VITE_DEV_PARTNER_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
