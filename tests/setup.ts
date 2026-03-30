import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/main/database/schema'
import path from 'path'
import { afterAll } from 'vitest'

let sqliteRef: Database.Database

vi.mock('../src/main/database/index', () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.resolve('src/main/database/migrations') })
  sqliteRef = sqlite
  return {
    getDb: () => db,
    initDb: () => db,
    closeDb: () => sqlite.close()
  }
})

afterAll(() => {
  sqliteRef?.close()
})
