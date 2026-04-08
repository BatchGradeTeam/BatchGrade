import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import fs from 'fs'
import { submissions } from '../schema'

// ai-gen start (Claude Sonnet 4.6, 2)
const MAX_FILE_SIZE = 500 * 1024 // 500 KB soft limit for file size

export type Submission = typeof submissions.$inferSelect
export type NewSubmission = typeof submissions.$inferInsert
/*
 * createSubmission: Inserts a new submission record into SQLite via Drizzle ORM.
 * Reads the file from disk, encodes it as base64, and stores it as text so
 * the submission is retrievable regardless of original file location.
 * Input: studentId, assignmentId, fileName, and the filePath on disk.
 * Output: The newly created Submission record.
 */

export function createSubmission(input: {
  studentId: string
  assignmentId: string
  fileName: string
  filePath: string
}): Submission {
  const db = getDb()

  // Read file from disk
  let fileBuffer: Buffer
  try {
    fileBuffer = fs.readFileSync(input.filePath)
  } catch {
    throw new Error(`Could not read file "${input.fileName}". Make sure the path is valid.`)
  }

  const fileSize = fileBuffer.byteLength
  const fileContent = fileBuffer.toString('base64')

  // Reject empty files
  if (fileSize === 0) {
    throw new Error(`Submitted file "${input.fileName}" is empty.`)
  }

  // Reject large files
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      `File "${input.fileName}" exceeds the maximum allowed size of 500 KB. ` +
        `Submitted file size: ${(fileSize / 1024).toFixed(1)} KB.`
    )
  }
  // Assign unique id to submission
  const submissionId = crypto.randomUUID()

  db.insert(submissions)
    .values({
      uuid: submissionId,
      assignmentId: input.assignmentId,
      fileName: input.fileName,
      fileContent: fileContent,
      fileSize: fileSize,
      status: 'pending'
    })
    .run()

  const created = db.select().from(submissions).where(eq(submissions.uuid, submissionId)).get()

  if (!created) throw new Error('Failed to create submission record.')
  return created
}
// ai-gen end
/**
 * getSubmissionById: Retrieves a single submission record by its UUID.
 * Input: A string submissionId for the target submission.
 * Output: A Submission record, or undefined if not found.
 */
export function getSubmissionById(uuid: string): Submission | undefined {
  const db = getDb()
  return db.select().from(submissions).where(eq(submissions.uuid, uuid)).get()
}
