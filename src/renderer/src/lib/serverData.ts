import type { Assignment } from '../../../shared/types'
import type { GradebookRecord } from '../../../shared/gradebookTypes'
import type { SubmissionCompileSnapshot, SubmitCppResult } from '../../../shared/submission'
import { supabase } from './supabase'
import { getProfile, type Profile } from './profiles'

/**
 * Supabase-backed data helpers used by the renderer.
 *
 * This file keeps shared assignment, submission, and gradebook reads/writes in
 * one place so UI components do not need to know the database table shapes.
 */
type InstructorAssignmentRow = {
  assignments_id: string
  section_id: string | null
  assignment_name: string
  due_date: string
  grading_criteria: string
  solution_type: string
  solution_file_name: string | null
  solution_file_path: string | null
  expected_output: string | null
  created_by: string | null
  created_at: string | number | null
}

type SectionRow = {
  section_id: string | null
}

type EnrollmentRow = {
  section_id: string
}

type SubmissionRow = {
  submission_id: string
  assignment_id: string
  student_id: string
  file_name: string | null
  storage_path: string | null
  status: string | null
  submitted_at: string | null
}

type UploadedSubmissionFile = {
  relativePath?: string
  fileName?: string
  storagePath?: string
}

type GradeRow = {
  id: string
  submission_id: string
  score: number
  feedback: string | null
  graded_by: string | null
  graded_at: string | null
}

type StudentRow = {
  id: string
  student_id: string | null
  first_name: string | null
  last_name: string | null
}

const ASSIGNMENT_COLUMNS =
  'assignments_id, section_id, assignment_name, due_date, grading_criteria, solution_type, solution_file_name, solution_file_path, expected_output, created_by, created_at'
const ASSIGNMENTS_TABLE = 'instructors_assignments'
const SUBMISSIONS_BUCKET = 'Submissions'

// Supabase errors are plain objects, so normalize the useful fields for UI messages.
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
      error_description?: unknown
    }

    const message = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
      maybeError.error_description
    ]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ')

    if (message) {
      return message
    }
  }

  return String(error)
}

// Server timestamps can arrive as ISO strings, seconds, or milliseconds.
function toUnixSeconds(value: string | number | null): number {
  if (typeof value === 'number') {
    return value > 9999999999 ? Math.floor(value / 1000) : value
  }

  if (!value) {
    return Math.floor(Date.now() / 1000)
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Math.floor(Date.now() / 1000) : Math.floor(timestamp / 1000)
}

// Convert the Supabase assignment row into the shared app Assignment shape.
function toAssignment(row: InstructorAssignmentRow): Assignment {
  return {
    uuid: row.assignments_id,
    name: row.assignment_name,
    dueDate: row.due_date,
    gradingCriteria: row.grading_criteria,
    solutionType: row.solution_type,
    solutionFileName: row.solution_file_name,
    solutionFilePath: row.solution_file_path,
    expectedOutputText: row.expected_output,
    createdByUserUuid: row.created_by,
    createdAt: toUnixSeconds(row.created_at)
  }
}

// Profile reads can fail while auth still succeeds, so callers can decide fallback behavior.
async function getCurrentProfile(): Promise<Profile | null> {
  try {
    return await getProfile()
  } catch (error) {
    console.error('Could not load Supabase profile:', error)
    return null
  }
}

// Require an app profile and optionally enforce the role needed by the current operation.
async function requireCurrentProfile(role?: Profile['role']): Promise<Profile> {
  const profile = await getCurrentProfile()

  if (!profile) {
    throw new Error('Log in before using shared assignment data.')
  }

  if (role && profile.role !== role) {
    throw new Error(`Only ${role}s can perform this action.`)
  }

  return profile
}

// Use Supabase auth directly for writes so publishing can work even before profile state refreshes.
async function getAuthenticatedUser(): Promise<{ id: string; email: string | null }> {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  if (!user) {
    throw new Error('Log in before publishing shared assignment data.')
  }

  return {
    id: user.id,
    email: user.email ?? null
  }
}

// Make sure a matching profiles row exists for RLS policies and role-based queries.
async function ensureServerProfile(
  authUserId: string,
  email: string | null,
  role: Profile['role']
): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: authUserId,
      email: email ?? `${authUserId}@unknown.local`,
      role
    },
    { onConflict: 'id' }
  )

  if (error) {
    throw new Error(`Could not create Supabase profile row: ${getErrorMessage(error)}`)
  }
}

// Assignments can be published before course sections are configured.
async function getInstructorSectionId(instructorId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sections')
    .select('section_id')
    .eq('instructor_id', instructorId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Could not load instructor section; publishing without a section:', error)
    return null
  }

  return (data as SectionRow | null)?.section_id ?? null
}

// Student assignment visibility is based on the sections they are enrolled in.
async function getStudentSectionIds(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('section_id')
    .eq('student_id', studentId)

  if (error) {
    console.error('Could not load student enrollments; loading published assignments:', error)
    return []
  }

  return ((data ?? []) as EnrollmentRow[]).map((row) => row.section_id).filter(Boolean)
}

// Map the local assignment model into the Supabase instructor assignment row shape.
function assignmentPayload(
  assignment: Assignment,
  instructorId: string,
  sectionId: string | null
): Partial<InstructorAssignmentRow> {
  return {
    assignments_id: assignment.uuid,
    section_id: sectionId,
    assignment_name: assignment.name,
    due_date: assignment.dueDate,
    grading_criteria: assignment.gradingCriteria,
    solution_type: assignment.solutionType,
    solution_file_name: assignment.solutionFileName ?? null,
    solution_file_path: assignment.solutionFilePath ?? null,
    expected_output: assignment.expectedOutputText ?? null,
    created_by: instructorId
  }
}

// Load instructor-owned assignments or student-visible assignments from Supabase.
export async function loadServerAssignments(): Promise<Assignment[]> {
  const profile = await requireCurrentProfile()

  if (profile.role === 'instructor') {
    const { data, error } = await supabase
      .from(ASSIGNMENTS_TABLE)
      .select(ASSIGNMENT_COLUMNS)
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return ((data ?? []) as InstructorAssignmentRow[]).map(toAssignment)
  }

  const sectionIds = await getStudentSectionIds(profile.id)

  if (sectionIds.length > 0) {
    const { data, error } = await supabase
      .from(ASSIGNMENTS_TABLE)
      .select(ASSIGNMENT_COLUMNS)
      .in('section_id', sectionIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Could not load section assignments; loading published assignments:', error)
    } else if ((data ?? []).length > 0) {
      return ((data ?? []) as InstructorAssignmentRow[]).map(toAssignment)
    }
  }

  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .select(ASSIGNMENT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as InstructorAssignmentRow[]).map(toAssignment)
}

// Create or replace the shared Supabase copy of a locally created assignment.
export async function publishServerAssignment(assignment: Assignment): Promise<Assignment> {
  const authUser = await getAuthenticatedUser()
  await ensureServerProfile(authUser.id, authUser.email, 'instructor')
  const sectionId = await getInstructorSectionId(authUser.id)

  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .upsert(assignmentPayload(assignment, authUser.id, sectionId), {
      onConflict: 'assignments_id'
    })
    .select(ASSIGNMENT_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  return toAssignment(data as InstructorAssignmentRow)
}

// Keep the shared assignment row in sync after edits in the instructor config panel.
export async function updateServerAssignment(assignment: Assignment): Promise<Assignment> {
  const authUser = await getAuthenticatedUser()
  await ensureServerProfile(authUser.id, authUser.email, 'instructor')
  const sectionId = await getInstructorSectionId(authUser.id)

  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .upsert(assignmentPayload(assignment, authUser.id, sectionId), {
      onConflict: 'assignments_id'
    })
    .select(ASSIGNMENT_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  return toAssignment(data as InstructorAssignmentRow)
}

// Delete only assignments owned by the currently authenticated instructor.
export async function deleteServerAssignment(assignmentId: string): Promise<void> {
  const authUser = await getAuthenticatedUser()

  const { error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .delete()
    .eq('assignments_id', assignmentId)
    .eq('created_by', authUser.id)

  if (error) {
    throw error
  }
}

// Keep storage paths compatible with Supabase RLS folder checks.
function sanitizeStorageSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Preserve nested source paths while preventing traversal and invalid storage names.
function toStorageRelativePath(relativePath: string, fallbackFileName: string): string {
  const parts = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map(sanitizeStorageSegment)

  return parts.length > 0 ? parts.join('/') : sanitizeStorageSegment(fallbackFileName)
}

// Upload text content to the shared Submissions bucket.
async function uploadTextToSubmissionBucket(
  path: string,
  content: string,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .upload(path, new Blob([content], { type: contentType }), {
      contentType,
      upsert: true
    })

  if (error) {
    throw error
  }
}

// Store submitted source files plus a manifest so instructors can retrieve the full bundle later.
async function uploadSubmissionBundle(
  result: SubmitCppResult,
  compileSnapshot: SubmissionCompileSnapshot | null,
  storageOwnerId: string,
  serverStudentId: string
): Promise<string> {
  if (!result.submissionId || !result.submittedAt) {
    throw new Error('Submission metadata is incomplete.')
  }

  const rootPath = [
    sanitizeStorageSegment(storageOwnerId),
    sanitizeStorageSegment(result.assignmentId),
    sanitizeStorageSegment(result.submissionId)
  ].join('/')

  const uploadedFiles: UploadedSubmissionFile[] = await Promise.all(
    result.submittedFiles.map(async (file) => {
      const relativePath = toStorageRelativePath(file.relativePath, file.fileName)
      const storagePath = `${rootPath}/source/${relativePath}`
      const fileContent = await window.api.file.stringify(file.originalPath)

      await uploadTextToSubmissionBucket(storagePath, fileContent, 'text/plain;charset=utf-8')

      return {
        relativePath: file.relativePath,
        fileName: file.fileName,
        storagePath
      }
    })
  )

  const manifestPath = `${rootPath}/submission-manifest.json`
  const manifest = {
    formatVersion: 1,
    submissionId: result.submissionId,
    assignmentId: result.assignmentId,
    authUserId: storageOwnerId,
    studentId: serverStudentId,
    submittedAt: result.submittedAt,
    submittedFiles: uploadedFiles,
    compileSnapshot
  }

  await uploadTextToSubmissionBucket(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    'application/json;charset=utf-8'
  )

  return manifestPath
}

// Find an existing students row tied to the authenticated Supabase user.
async function findServerStudentId(authUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('students')
    .select('id, student_id, first_name, last_name')
    .or(`id.eq.${authUserId},student_id.eq.${authUserId}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as StudentRow | null)?.id ?? null
}

// Create the student row required by submission RLS policies.
async function createServerStudentId(authUserId: string, email: string | null): Promise<string> {
  const emailName = email?.split('@')[0] || 'Student'
  const studentRecord = {
    student_id: authUserId,
    first_name: emailName,
    last_name: ''
  }

  const { data, error } = await supabase
    .from('students')
    .insert({
      ...studentRecord,
      id: authUserId
    })
    .select('id')
    .single()

  if (!error) {
    const studentId = (data as Pick<StudentRow, 'id'> | null)?.id

    if (!studentId) {
      throw new Error('Could not create a student record for this account.')
    }

    return String(studentId)
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('students')
    .insert(studentRecord)
    .select('id')
    .single()

  if (fallbackError) {
    throw new Error(`Could not create Supabase student row: ${getErrorMessage(fallbackError)}`)
  }

  const fallbackStudentId = (fallbackData as Pick<StudentRow, 'id'> | null)?.id

  if (!fallbackStudentId) {
    throw new Error('Could not create a student record for this account.')
  }

  return String(fallbackStudentId)
}

// Ensure the app has the server-side student id used by submissions.student_id.
async function resolveServerStudentId(authUserId: string, email: string | null): Promise<string> {
  await ensureServerProfile(authUserId, email, 'student')

  const existingStudentId = await findServerStudentId(authUserId)

  if (existingStudentId) {
    return existingStudentId
  }

  return createServerStudentId(authUserId, email)
}

// Fail fast when a student tries to submit against an assignment that is still local-only.
async function requireServerAssignment(assignmentId: string): Promise<void> {
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .select('assignments_id')
    .eq('assignments_id', assignmentId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not verify Supabase assignment row: ${getErrorMessage(error)}`)
  }

  if (!data) {
    throw new Error(
      `Assignment ${assignmentId} is not published to Supabase. Create or update it from the instructor assignment screen before students submit.`
    )
  }
}

// Upload source files to storage and record a successful student submission in the database.
export async function publishServerSubmission(
  result: SubmitCppResult,
  compileSnapshot: SubmissionCompileSnapshot | null
): Promise<void> {
  if (!result.submissionSuccess || !result.submissionId) {
    return
  }

  const authUser = await getAuthenticatedUser()

  if (result.studentId !== authUser.id) {
    throw new Error('Submission student does not match the logged-in user.')
  }

  const serverStudentId = await resolveServerStudentId(authUser.id, authUser.email)
  await requireServerAssignment(result.assignmentId)

  let storagePath: string
  try {
    storagePath = await uploadSubmissionBundle(
      result,
      compileSnapshot,
      authUser.id,
      serverStudentId
    )
  } catch (error) {
    const message = getErrorMessage(error)
    throw new Error(`Could not upload submission files to Supabase Storage: ${message}`)
  }

  const { error } = await supabase.from('submissions').upsert(
    {
      submission_id: result.submissionId,
      assignment_id: result.assignmentId,
      student_id: serverStudentId,
      file_name: result.submittedFiles.map((file) => file.fileName).join(', '),
      storage_path: storagePath,
      status: 'submitted',
      submitted_at: result.submittedAt
    },
    { onConflict: 'submission_id' }
  )

  if (error) {
    throw new Error(`Could not create Supabase submission row: ${getErrorMessage(error)}`)
  }
}

// Reuse detailed feedback when present, otherwise summarize the batch grading result.
function buildBatchFeedback(record: GradebookRecord): string {
  if (record.feedback) {
    return record.feedback
  }

  return record.status === 'failed'
    ? 'Batch grading failed before test cases completed.'
    : `${record.passedCount} / ${record.totalCount} test cases passed.`
}

// Persist a batch grading result as a server submission plus grade row.
export async function saveServerGradebookRecord(record: GradebookRecord): Promise<void> {
  const profile = await requireCurrentProfile('instructor')
  const submissionId = crypto.randomUUID()
  const submittedAt = new Date(record.submittedAt).toISOString()

  const { error: submissionError } = await supabase.from('submissions').insert({
    submission_id: submissionId,
    assignment_id: record.assignmentId,
    student_id: record.studentId,
    file_name: record.studentName,
    storage_path: `batch://${record.assignmentId}/${record.studentId}/${record.submittedAt}`,
    status: record.status === 'failed' ? 'failed' : 'graded',
    submitted_at: submittedAt
  })

  if (submissionError) {
    throw submissionError
  }

  const { error: gradeError } = await supabase.from('grades').insert({
    id: crypto.randomUUID(),
    submission_id: submissionId,
    score: record.score,
    feedback: buildBatchFeedback(record),
    graded_by: profile.id,
    graded_at: new Date().toISOString()
  })

  if (gradeError) {
    throw gradeError
  }
}

// Resolve display names for gradebook rows without failing the whole gradebook load.
async function loadStudentNames(studentIds: string[]): Promise<Map<string, string>> {
  if (studentIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('students')
    .select('id, student_id, first_name, last_name')
    .in('id', studentIds)

  if (error) {
    console.error('Could not load student names:', error)
    return new Map()
  }

  return new Map(
    ((data ?? []) as StudentRow[]).map((student) => {
      const name = [student.first_name, student.last_name].filter(Boolean).join(' ').trim()
      return [student.id, name || student.student_id || student.id]
    })
  )
}

// Join submissions, grades, assignments, and student names into renderer-friendly records.
function mapGradebookRecords(
  submissions: SubmissionRow[],
  grades: GradeRow[],
  assignments: Assignment[],
  studentNames: Map<string, string>
): GradebookRecord[] {
  const submissionsById = new Map(
    submissions.map((submission) => [submission.submission_id, submission])
  )
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.uuid, assignment]))
  const records: GradebookRecord[] = []

  grades.forEach((grade) => {
    const submission = submissionsById.get(grade.submission_id)

    if (!submission) {
      return
    }

    const assignment = assignmentsById.get(submission.assignment_id)
    const submittedAt = submission.submitted_at ?? grade.graded_at

    records.push({
      studentId: submission.student_id,
      studentName:
        studentNames.get(submission.student_id) ?? submission.file_name ?? submission.student_id,
      assignmentId: submission.assignment_id,
      assignmentName: assignment?.name,
      score: grade.score,
      passedCount: 0,
      totalCount: 0,
      status: submission.status === 'failed' ? 'failed' : 'done',
      submittedAt: submittedAt ? Date.parse(submittedAt) : Date.now(),
      feedback: grade.feedback ?? undefined,
      gradedAt: grade.graded_at ?? undefined,
      submissionId: submission.submission_id
    })
  })

  return records
}

// Load grades for assignments owned by the current instructor.
export async function loadServerGradebookRecords(): Promise<GradebookRecord[]> {
  const profile = await requireCurrentProfile('instructor')
  const assignments = await loadServerAssignments()
  const assignmentIds = assignments.map((assignment) => assignment.uuid)

  if (assignmentIds.length === 0) {
    return []
  }

  const { data: submissionsData, error: submissionsError } = await supabase
    .from('submissions')
    .select('submission_id, assignment_id, student_id, file_name, storage_path, status, submitted_at')
    .in('assignment_id', assignmentIds)

  if (submissionsError) {
    throw submissionsError
  }

  const submissions = (submissionsData ?? []) as SubmissionRow[]
  const submissionIds = submissions.map((submission) => submission.submission_id)

  if (submissionIds.length === 0) {
    return []
  }

  const { data: gradesData, error: gradesError } = await supabase
    .from('grades')
    .select('id, submission_id, score, feedback, graded_by, graded_at')
    .in('submission_id', submissionIds)
    .eq('graded_by', profile.id)

  if (gradesError) {
    throw gradesError
  }

  const studentNames = await loadStudentNames([...new Set(submissions.map((submission) => submission.student_id))])

  return mapGradebookRecords(submissions, (gradesData ?? []) as GradeRow[], assignments, studentNames)
}

// Load the current student's own submitted and graded work.
export async function loadServerStudentGradebookRecords(): Promise<GradebookRecord[]> {
  const profile = await requireCurrentProfile('student')
  const assignments = await loadServerAssignments()

  const { data: submissionsData, error: submissionsError } = await supabase
    .from('submissions')
    .select('submission_id, assignment_id, student_id, file_name, storage_path, status, submitted_at')
    .eq('student_id', profile.id)

  if (submissionsError) {
    throw submissionsError
  }

  const submissions = (submissionsData ?? []) as SubmissionRow[]
  const submissionIds = submissions.map((submission) => submission.submission_id)

  if (submissionIds.length === 0) {
    return []
  }

  const { data: gradesData, error: gradesError } = await supabase
    .from('grades')
    .select('id, submission_id, score, feedback, graded_by, graded_at')
    .in('submission_id', submissionIds)

  if (gradesError) {
    throw gradesError
  }

  return mapGradebookRecords(
    submissions,
    (gradesData ?? []) as GradeRow[],
    assignments,
    new Map([[profile.id, profile.email]])
  )
}
