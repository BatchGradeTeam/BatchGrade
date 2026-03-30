import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './user'
import { assignments } from './gradebook'

// Action Logs table: Tracking "Who did what"
export const studentActionLogs = sqliteTable('action_logs', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.uuid, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  createdAt: integer('created_at').default(sql`(unixepoch())`)
})

// Compile Logs table: Tracking student code compilation and execution
export const compileLogs = sqliteTable('compile_logs', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  studentId: text('student_id')
    .notNull()
    .references(() => users.uuid),
  submissionId: text('submission_id')
    .notNull()
    .references(() => assignments.uuid),
  status: text('status') // 'success' or 'error'
    .notNull(),
  exitCode: integer('exit_code'),
  stdout: text('stdout'), // The standard output
  stderr: text('stderr'), // The error message if it failed
  duration: integer('duration'), // How long the code ran in ms
  createdAt: integer('created_at').default(sql`(unixepoch())`)
})
