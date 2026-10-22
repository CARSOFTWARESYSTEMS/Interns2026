/**
 * Demo/seed records are shown ONLY in local development (`vite dev`).
 * In production builds this is the literal `false`, so the demo arrays are
 * empty and their contents are dropped from the bundle: a new Partner never
 * sees another organisation's fictional people, candidates or letters.
 */
export const SHOW_DEMO_DATA: boolean = import.meta.env.DEV
