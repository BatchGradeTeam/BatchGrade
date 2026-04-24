import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, InferSelectModel, InferInsertModel } from 'drizzle-orm'

export type Assignment = InferSelectModel<typeof assignmentsInstrc>
export type NewAssignment = InferInsertModel<typeof assignmentsInstrc>
export type UpdateAssignment = Pick<Assignment, 'uuid'> & Partial<NewAssignment>
export type AssignmentTestCase = InferSelectModel<typeof assignmentTestCases>
export type NewAssignmentTestCase = InferInsertModel<typeof assignmentTestCases>

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

/**
 * Assignment test cases
 *
 * Stores optional stdin and required expected-output data for automated grading.
 * File paths are kept for local display; text fields hold the content used by
 * the judge so grading still works after the original files move.
 */
export const assignmentTestCases = sqliteTable('assignment_test_cases', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  assignmentUuid: text('assignment_uuid')
    .notNull()
    .references(() => assignmentsInstrc.uuid, { onDelete: 'cascade' }),

  caseOrder: integer('case_order').notNull(),

  inputFileName: text('input_file_name'),
  inputFilePath: text('input_file_path'),
  inputText: text('input_text'),

  expectedOutputFileName: text('expected_output_file_name'),
  expectedOutputFilePath: text('expected_output_file_path'),
  expectedOutputText: text('expected_output_text').notNull(),

  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(unixepoch())`)
})
