import path from 'path'
import fs from 'fs'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)

/**
 * Resolves the absolute path to the application database file.
 *
 * - Production (packaged): `<userData>/batchgrade.db`
 * - Development: `./dev.db` relative to the project root
 *
 * Uses a dynamic `require` so this file can be safely imported outside of
 * the Electron runtime (e.g. drizzle.config.ts, tests).
 *
 * @returns Absolute path to the database file.
 */
export function getDbPath(): string {
  let dbPath = path.resolve('./dev.db')

  try {
    if (!process.versions.electron) {
      return dbPath
    }

    const { app } = nodeRequire('electron') as typeof import('electron')
    if (app.isPackaged) {
      dbPath = path.join(app.getPath('userData'), 'batchgrade.db')
    }
  } catch {
    // Running outside Electron (e.g. drizzle-kit, tests)
  }

  // Packaged Windows builds may start before the user-data directory exists.
  // Ensure the parent folder is present so SQLite can create/open the database.
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  return dbPath
}
