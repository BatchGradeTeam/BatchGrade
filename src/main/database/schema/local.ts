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
  config: blob('config', { mode: 'buffer'}),
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
  fileContent: blob('file_content', { mode: 'buffer'}),
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
 * Grades Table
 * Tracking scores for each submissions
 */
export const grades = sqliteTable('grades', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  submissionId: text('submission_id')
    .notNull()
    .references(() => submissions.uuid),
  score: integer('score').notNull(),
  feedback: text('feedback'),
  gradedAt: integer('graded_at')
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
