import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGradebookRecord,
  getGradebookRecords,
  clearGradebookRecords
} from '../../src/main/database/queries/gradebook'
import type { GradebookRecord } from '../../src/shared/gradebookTypes'

/**
 * @brief Clears gradebook tables before each test.
 * @pre The test database has been initialized.
 * @post grades, submissions, and assignments tables are empty....
 */
beforeEach(async () => {
  const { getDb } = await import('../../src/main/database/index')
  const { grades, submissions, assignments } = await import('../../src/main/database/schema')

  // Delete child rows first to avoid foreign key errors.
  getDb().delete(grades).run()
  getDb().delete(submissions).run()
  getDb().delete(assignments).run()
})

describe('Gradebook Queries', () => {
  /**
   * @brief Creates a gradebook record and generates a submission ID.
   * @pre No gradebook records exist.
   * @post A submission and grade row are inserted.
   */
  it('newGradebookRecord_createGradebookRecord_generatesSubmissionId', () => {
    const record: GradebookRecord = {
      studentId: 'student-1',
      studentName: 'Alice',
      assignmentId: 'assignment-1',
      assignmentName: 'HW1',
      score: 95,
      passedCount: 19,
      totalCount: 20,
      status: 'done',
      submittedAt: 1710000000000
    }

    // Create the gradebook record through the query function.
    const result = createGradebookRecord(record)

    // Verify the returned record keeps the original data and adds submissionId.
    expect(result.submissionId).toBeTruthy()
    expect(result.studentName).toBe('Alice')
    expect(result.assignmentId).toBe('assignment-1')
  })

  /**
   * @brief Stores assignment name when the assignment does not already exist.
   * @pre The assignment table is empty.
   * @post A matching assignment row is created.
   */
  it('missingAssignment_createGradebookRecord_createsAssignmentRecord', async () => {
    const { getDb } = await import('../../src/main/database/index')
    const { assignments } = await import('../../src/main/database/schema')

    createGradebookRecord({
      studentId: 'student-2',
      studentName: 'Bob',
      assignmentId: 'assignment-2',
      assignmentName: 'Lab 2',
      score: 88,
      passedCount: 8,
      totalCount: 10,
      status: 'done',
      submittedAt: 1710000000000
    })

    // Read the assignment table directly to confirm the query created it.
    const savedAssignments = getDb().select().from(assignments).all()

    expect(savedAssignments).toHaveLength(1)
    expect(savedAssignments[0].uuid).toBe('assignment-2')
    expect(savedAssignments[0].title).toBe('Lab 2')
  })

  /**
   * @brief Saves default feedback when no custom feedback is provided.
   * @pre A record is created without feedback.
   * @post The grade row stores passed/total test case feedback.
   */
  it('recordWithoutFeedback_createGradebookRecord_savesDefaultFeedback', () => {
    createGradebookRecord({
      studentId: 'student-3',
      studentName: 'Cara',
      assignmentId: 'assignment-3',
      assignmentName: 'HW3',
      score: 70,
      passedCount: 7,
      totalCount: 10,
      status: 'done',
      submittedAt: 1710000000000
    })

    // Pull records through the public getter.
    const records = getGradebookRecords()

    expect(records).toHaveLength(1)
    expect(records[0].feedback).toBe('7/10 test cases passed.')
  })

  /**
   * @brief Saves custom feedback when feedback is provided.
   * @pre A record is created with feedback.
   * @post The custom feedback is preserved.
   */
  it('recordWithFeedback_createGradebookRecord_preservesCustomFeedback', () => {
    createGradebookRecord({
      studentId: 'student-4',
      studentName: 'Dan',
      assignmentId: 'assignment-4',
      assignmentName: 'HW4',
      score: 100,
      passedCount: 10,
      totalCount: 10,
      feedback: 'Excellent work.',
      status: 'done',
      submittedAt: 1710000000000
    })

    const records = getGradebookRecords()

    expect(records[0].feedback).toBe('Excellent work.')
  })

  /**
   * @brief Returns saved gradebook records in shared GradebookRecord format.
   * @pre A gradebook record exists in the database.
   * @post The returned record maps database fields correctly.
   */
  it('savedRecord_getGradebookRecords_returnsMappedGradebookRecord', () => {
    const saved = createGradebookRecord({
      studentId: 'student-5',
      studentName: 'Eve',
      assignmentId: 'assignment-5',
      assignmentName: 'HW5',
      score: 82,
      passedCount: 0,
      totalCount: 0,
      status: 'failed',
      submittedAt: 1710000000000,
      submissionId: 'submission-5'
    })

    const records = getGradebookRecords()

    expect(records).toHaveLength(1)
    expect(records[0].studentId).toBe('Eve')
    expect(records[0].studentName).toBe('Eve')
    expect(records[0].assignmentId).toBe('assignment-5')
    expect(records[0].submissionId).toBe(saved.submissionId)
    expect(records[0].score).toBe(82)
    expect(records[0].status).toBe('failed')
    expect(records[0].scoreSource).toBe('offline-batch-grade')
  })

  /**
   * @brief Clears grade rows from the gradebook.
   * @pre At least one gradebook record exists.
   * @post getGradebookRecords returns an empty list.
   */
  it('existingRecords_clearGradebookRecords_removesGradebookRecords', () => {
    createGradebookRecord({
      studentId: 'student-6',
      studentName: 'Frank',
      assignmentId: 'assignment-6',
      assignmentName: 'HW6',
      score: 60,
      passedCount: 6,
      totalCount: 10,
      status: 'done',
      submittedAt: 1710000000000
    })

    expect(getGradebookRecords()).toHaveLength(1)

    // Clear grade rows and verify no gradebook records are returned.
    clearGradebookRecords()

    expect(getGradebookRecords()).toHaveLength(0)
  })
})