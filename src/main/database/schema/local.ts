import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Assignment Table
 * Storing/tracking submission attempts
 */
export const assignments = sqliteTable('assignments', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title')
    .notNull(),
  config: blob('config'),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(unixepoch())`)
})

/**
 * Submission Table
 * Storing/tracking submission attempts
 */
export const submissions = sqliteTable('submissions', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assignmentId: text('assignment_id')
    .notNull()
    .references(() => assignments.uuid),
  attemptNumber: integer('attempt_number')
    .notNull()
    .default(0),
  fileContent: blob('file_content'),
  fileName: text('file_name')
    .notNull()
    .default('N/A'),
  fileSize: integer('file_size')
    .notNull()
    .default(0),
  filePath: text('file_path')
    .notNull(),
  status: text('status')
    .notNull()
    .default('not submitted'), // "submittted", "pending", "not submitted"
  submittedAt: integer('submitted_at')
    .default(sql`(unixepoch())`)
})

/**
 * Compile Logs Table
 * Tracking guest code compilation and execution
 */
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
})
