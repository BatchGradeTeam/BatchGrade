import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, InferSelectModel, InferInsertModel } from 'drizzle-orm'

export type Assignment = InferSelectModel<typeof assignmentsInstrc>
export type NewAssignment = InferInsertModel<typeof assignmentsInstrc>
export type UpdateAssignment = Pick<Assignment, 'uuid'> & Partial<NewAssignment>

/**
 * Assignment table
 *
 * Stores assignments configurations for MVP-5
 */
export const assignmentsInstrc = sqliteTable('instructor_assignments', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: text('name').notNull(), // name of file
  dueDate: text('due_date').notNull(), // due date
  gradingCriteria: text('grading_criteria').notNull(), // grading criteria

  // FR10: instructors solution(s) choice: file or text
  solutionType: text('solution_type').notNull(), // file or text

  // If type is file
  solutionFileName: text('solution_file_name'),
  solutionFilePath: text('solution_file_path'),

  // if type is text
  expectedOutputText: text('expected_output_text'),

  // create by
  createdByUserUuid: text('created_by_user_uuid'),

  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(unixepoch())`)
})
