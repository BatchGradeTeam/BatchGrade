import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import { grades, submissions, assignments } from '../schema'
import type { GradebookRecord } from '../../../shared/gradebookTypes'

export function createGradebookRecord(record: GradebookRecord): GradebookRecord {
  const db = getDb()

  const submissionId = record.submissionId ?? crypto.randomUUID()

  const existingAssignment = db
    .select()
    .from(assignments)
    .where(eq(assignments.uuid, record.assignmentId))
    .get()

  if (!existingAssignment) {
    db.insert(assignments)
      .values({
        uuid: record.assignmentId,
        title: record.assignmentName ?? record.assignmentId
      })
      .run()
  }

  db.insert(submissions)
    .values({
      uuid: submissionId,
      assignmentId: record.assignmentId,
      fileName: record.studentName,
      fileContent: '',
      fileSize: 0,
      status: record.status
    })
    .run()

  db.insert(grades)
    .values({
      submissionId,
      score: record.score,
      feedback: record.feedback ?? `${record.passedCount}/${record.totalCount} test cases passed.`,
      gradedAt: Math.floor(record.submittedAt / 1000)
    })
    .run()

  return {
    ...record,
    submissionId
  }
}

export function getGradebookRecords(): GradebookRecord[] {
  const db = getDb()

  const rows = db
    .select({
      submissionId: submissions.uuid,
      assignmentId: submissions.assignmentId,
      studentName: submissions.fileName,
      status: submissions.status,
      score: grades.score,
      feedback: grades.feedback,
      gradedAt: grades.gradedAt
    })
    .from(grades)
    .innerJoin(submissions, eq(grades.submissionId, submissions.uuid))
    .all()

  return rows.map((row) => ({
    studentId: row.studentName,
    studentName: row.studentName,
    assignmentId: row.assignmentId,
    submissionId: row.submissionId,
    score: row.score,
    passedCount: 0,
    totalCount: 0,
    feedback: row.feedback ?? undefined,
    status: row.status === 'failed' ? 'failed' : 'done',
    submittedAt: (row.gradedAt ?? Math.floor(Date.now() / 1000)) * 1000,
    scoreSource: 'offline-batch-grade'
  }))
}

export function clearGradebookRecords(): void {
  const db = getDb()
  db.delete(grades).run()
}
