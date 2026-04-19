/**
 * @file gradebook.ts
 * @description Shared types for Gradebook records saved from Grading+.
 */

/**
 * GradebookRecord
 *
 * Represents one saved grading result for a student.
 */
export type GradebookRecord = {
  studentId: string
  studentName: string
  assignmentId: string
  score: number
  passedCount: number
  totalCount: number
  status: 'done' | 'failed'
  submittedAt: number
}
