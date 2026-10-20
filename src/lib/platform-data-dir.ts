/**
 * Persistent-storage path resolution for the GRN Commerce platform.
 *
 * Two traps this file exists specifically to avoid — both verified by
 * reproducing the failure, not by reading docs, and confirmed against
 * this repo's own build:
 *
 * Trap 1 — Next.js `output: 'standalone'` breaks cwd-relative paths.
 *   The platform's launcher `cd`s into the release directory before
 *   exec'ing, so a NAIVE cwd-relative convention
 *   (`file:data/db/payload.db`) would seem to work — until you notice that
 *   Next's own generated `.next/standalone/server.js` unconditionally does
 *   `process.chdir(fileURLToPath(new URL('.', import.meta.url)))` at the
 *   top of the file, i.e. it chdirs into `standalone/` — one level BELOW
 *   the release root where the platform's `data` symlink actually lives.
 *   By the time any request handler runs, `process.cwd()` is
 *   `<release>/standalone`, not `<release>`, so a bare relative path
 *   resolves to a location that doesn't exist and isn't writable. Fix:
 *   resolve everything through the absolute, chdir-immune `$GRN_DATA_DIR`
 *   env var instead.
 *
 * Trap 2 — libSQL will not create its own parent directory.
 *   A brand-new site's persistent-storage directory is created empty by
 *   systemd — no `db/`, no `uploads/`. `@libsql/client`'s local-file
 *   backend throws `SQLITE_CANTOPEN` if the directory containing the db
 *   file doesn't already exist; it does not create it for you (Payload's
 *   own upload code IS self-healing here via `fs.mkdir(..., { recursive:
 *   true })`, but the db adapter is not). Fix: `mkdirSync` the `db/`
 *   subdirectory ourselves before returning the URL.
 */

import { mkdirSync } from 'node:fs'
import path from 'node:path'

export function getPersistentDataDir(): string {
  if (process.env.GRN_DATA_DIR) return path.resolve(process.env.GRN_DATA_DIR)
  // Local dev fallback only — never reached on the platform, where
  // GRN_DATA_DIR is always set before the process starts.
  return path.resolve(process.cwd(), 'data')
}

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const dbDir = path.join(getPersistentDataDir(), 'db')
  mkdirSync(dbDir, { recursive: true }) // Trap 2 — libSQL will not do this itself.
  return `file:${path.join(dbDir, 'payload.db')}`
}

export function getUploadsDir(): string {
  // Payload's own upload handler creates this directory itself
  // (fs.mkdir recursive) — no mkdirSync needed here, unlike the db dir.
  return path.join(getPersistentDataDir(), 'uploads')
}
