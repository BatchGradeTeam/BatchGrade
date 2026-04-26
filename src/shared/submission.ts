import type { CompileCppResult } from './compiler'

export type SubmissionSelfCheckSummary = {
  score: number
  passedCount: number
  totalCount: number
  feedback?: string
  completedAt: string
}

export type SubmissionCompileSnapshot = Pick<
  CompileCppResult,
  'compileSuccess' | 'compilerPath' | 'sourceFiles' | 'stdout' | 'stderr' | 'message'
>

export type SubmitCppRequest = {
  assignmentId: string
  studentId: string
  sourceFiles: string[]
  compileSnapshot: SubmissionCompileSnapshot | null
}

export type SubmittedSourceFile = {
  originalPath: string
  relativePath: string
  fileName: string
}

export type SubmitCppResult = {
  submissionSuccess: boolean
  submissionId: string | null
  assignmentId: string
  studentId: string
  submissionDirectory: string | null
  manifestPath: string | null
  submittedAt: string | null
  submittedFiles: SubmittedSourceFile[]
  message: string
}
