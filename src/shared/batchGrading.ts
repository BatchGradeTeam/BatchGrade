/**
 * @file: batchGrading.ts
 * @description:
 * This file defines shared types used for the Grading+ (batch grading) feature.
 * It represents the structure of each student submission, grading status,
 * and judge results when processing multiple students sequentially.
 */

import type { CompileCppResult, JudgeCppResult } from './compiler'

/**
 * BatchGradingStatus
 *
 * Represents the current state of a student's grading process.
 */
export type BatchGradingStatus =
  | 'pending' // Not graded yet
  | 'grading' // Currently being processed
  | 'compiled' // Compilation finished
  | 'judging' // Running test cases
  | 'saving' // Saving result to Gradebook
  | 'done' // Finished successfully
  | 'failed' // Failed at some step

/**
 * BatchJudgeCaseResult
 *
 * Represents the result of a single test case during judging.
 */
export type BatchJudgeCaseResult = {
  testNumber: number
  inputFile: string | null
  outputFile: string
  result: JudgeCppResult
}

/**
 * BatchStudentSubmission
 *
 * Represents one student's submission in the batch grading queue.
 * This object stores all information needed to track progress and results.
 */
export type BatchStudentSubmission = {
  studentId: string
  studentName: string
  folderName: string
  serverSubmissionId?: string

  // File info
  filePaths: string[]
  fileNames: string[]

  // Current grading state
  status: BatchGradingStatus

  // Compilation result
  compileResult: CompileCppResult | null

  // Judge results
  judgeResults: BatchJudgeCaseResult[]
  passedCount: number
  totalCount: number

  // Save status
  savedToGradebook: boolean

  // Error handling
  errorMessage: string | null
}
