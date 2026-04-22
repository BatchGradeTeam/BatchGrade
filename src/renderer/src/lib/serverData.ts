import type { Assignment } from '../../../shared/types'
import type { GradebookRecord } from '../../../shared/gradebookTypes'
import type { SubmissionCompileSnapshot, SubmitCppResult } from '../../../shared/submission'
import { supabase } from './supabase'
import { getProfile, type Profile } from './profiles'

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

type UploadedSubmissionRow = SubmissionRow & {
  storage_path: string
}

type ServerSubmissionBundle = {
  submissionId: string
  studentId: string
  studentName: string
  files: {
    relativePath: string
    fileName: string
    content: string
  }[]
}

type UploadedSubmissionManifest = {
  submittedFiles?: {
    relativePath?: string
    fileName?: string
    storagePath?: string
  }[]
}

type GradeRow = {
  grade_id: string
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
const LOCAL_BATCH_STORAGE_PREFIX = 'batch://'
const SUBMISSION_MANIFEST_FILE = 'submission-manifest.json'

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

    return [maybeError.message, maybeError.details, maybeError.hint, maybeError.code]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ')
  }

  return String(error)
}

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

async function getCurrentProfile(): Promise<Profile | null> {
  try {
    return await getProfile()
  } catch (error) {
    console.error('Could not load Supabase profile:', error)
    return null
  }
}

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

async function getAuthenticatedUser(): Promise<{ id: string; email: string | null }> {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  if (!user) {
    throw new Error('Log in before publishing shared submission data.')
  }

  return {
    id: user.id,
    email: user.email ?? null
  }
}

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

function sanitizeStorageSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function toStorageRelativePath(relativePath: string, fallbackFileName: string): string {
  const parts = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map(sanitizeStorageSegment)

  return parts.length > 0 ? parts.join('/') : sanitizeStorageSegment(fallbackFileName)
}

async function uploadTextToSubmissionBucket(path: string, content: string, contentType: string): Promise<void> {
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

async function downloadTextFromSubmissionBucket(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(SUBMISSIONS_BUCKET).download(path)

  if (error) {
    throw error
  }

  return data.text()
}

async function downloadSubmissionText(path: string, label: string): Promise<string> {
  try {
    return await downloadTextFromSubmissionBucket(path)
  } catch (error) {
    throw new Error(
      `Could not download ${label} from Supabase Storage path "${path}": ${getErrorMessage(error)}`
    )
  }
}

function isUploadedSubmissionManifestPath(path: string | null): path is string {
  if (!path) {
    return false
  }

  return (
    !path.startsWith(LOCAL_BATCH_STORAGE_PREFIX) && path.endsWith(`/${SUBMISSION_MANIFEST_FILE}`)
  )
}

function hasUploadedSubmissionManifest(
  submission: SubmissionRow
): submission is UploadedSubmissionRow {
  return isUploadedSubmissionManifestPath(submission.storage_path)
}

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

  const uploadedFiles = await Promise.all(
    result.submittedFiles.map(async (file) => {
      const relativePath = toStorageRelativePath(file.relativePath, file.fileName)
      const storagePath = `${rootPath}/source/${relativePath}`
      const fileContent = await window.api.file.stringify(file.originalPath)

      await uploadTextToSubmissionBucket(storagePath, fileContent, 'text/plain;charset=utf-8')

      return {
        ...file,
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
      id: authUserId,
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

async function resolveServerStudentId(authUserId: string, email: string | null): Promise<string> {
  await ensureServerProfile(authUserId, email, 'student')

  const existingStudentId = await findServerStudentId(authUserId)

  if (existingStudentId) {
    return existingStudentId
  }

  return createServerStudentId(authUserId, email)
}

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
    throw new Error(`Could not create Supabase submission row: ${error.message}`)
  }
}

export async function loadServerSubmissionsForGrading(
  assignmentId: string
): Promise<ServerSubmissionBundle[]> {
  const authUser = await getAuthenticatedUser()
  await ensureServerProfile(authUser.id, authUser.email, 'instructor')

  const { data: submissionsData, error: submissionsError } = await supabase
    .from('submissions')
    .select(
      'submission_id, assignment_id, student_id, file_name, storage_path, status, submitted_at'
    )
    .eq('assignment_id', assignmentId)
    .not('storage_path', 'is', null)

  if (submissionsError) {
    throw new Error(`Could not load Supabase submissions: ${submissionsError.message}`)
  }

  const submissions = ((submissionsData ?? []) as SubmissionRow[]).filter(
    hasUploadedSubmissionManifest
  )
  const studentNames = await loadStudentNames([
    ...new Set(submissions.map((submission) => submission.student_id))
  ])
  const bundles: ServerSubmissionBundle[] = []
  const skippedSubmissionIds: string[] = []

  for (const submission of submissions) {
    try {
      const manifestText = await downloadSubmissionText(
        submission.storage_path,
        `manifest for submission ${submission.submission_id}`
      )
      const manifest = JSON.parse(manifestText) as UploadedSubmissionManifest
      const submittedFiles = manifest.submittedFiles ?? []

      const files = await Promise.all(
        submittedFiles.map(async (file) => {
          if (!file.storagePath) {
            throw new Error(
              `Submission ${submission.submission_id} has a file without storagePath.`
            )
          }

          return {
            relativePath: file.relativePath ?? file.fileName ?? file.storagePath,
            fileName: file.fileName ?? file.storagePath.split('/').pop() ?? 'submission.cpp',
            content: await downloadSubmissionText(
              file.storagePath,
              `source file for submission ${submission.submission_id}`
            )
          }
        })
      )

      bundles.push({
        submissionId: submission.submission_id,
        studentId: submission.student_id,
        studentName:
          studentNames.get(submission.student_id) ?? submission.file_name ?? submission.student_id,
        files
      })
    } catch (error) {
      console.warn(`Skipping server submission ${submission.submission_id}:`, error)
      skippedSubmissionIds.push(submission.submission_id)
    }
  }

  if (bundles.length === 0 && skippedSubmissionIds.length > 0) {
    throw new Error(
      `Found ${skippedSubmissionIds.length} server submission row${
        skippedSubmissionIds.length === 1 ? '' : 's'
      }, but the uploaded files are missing from Supabase Storage. Ask the student to submit again, or delete the stale row from the submissions table. First stale submission: ${skippedSubmissionIds[0]}.`
    )
  }

  if (skippedSubmissionIds.length > 0) {
    console.warn(
      `Skipped ${skippedSubmissionIds.length} server submission${
        skippedSubmissionIds.length === 1 ? '' : 's'
      } with missing Supabase Storage files: ${skippedSubmissionIds.join(', ')}`
    )
  }

  return bundles
}

function buildBatchFeedback(record: GradebookRecord): string {
  if (record.feedback) {
    return record.feedback
  }

  return record.status === 'failed'
    ? 'Batch grading failed before test cases completed.'
    : `${record.passedCount} / ${record.totalCount} test cases passed.`
}

async function findServerStudentIdByIdentifier(identifier: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('students')
    .select('id, student_id, first_name, last_name')
    .or(`id.eq.${identifier},student_id.eq.${identifier}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as StudentRow | null)?.id ?? null
}

export async function saveServerGradebookRecord(record: GradebookRecord): Promise<void> {
  const authUser = await getAuthenticatedUser()
  await ensureServerProfile(authUser.id, authUser.email, 'instructor')

  let submissionId = record.submissionId ?? null

  if (!submissionId) {
    const serverStudentId = await findServerStudentIdByIdentifier(record.studentId)

    if (!serverStudentId) {
      throw new Error(
        `Could not find a Supabase student row matching "${record.studentId}". Use a student folder/file name that matches students.id or students.student_id.`
      )
    }

    submissionId = crypto.randomUUID()
    const submittedAt = new Date(record.submittedAt).toISOString()

    const { error: submissionError } = await supabase.from('submissions').insert({
      submission_id: submissionId,
      assignment_id: record.assignmentId,
      student_id: serverStudentId,
      file_name: record.studentName,
      storage_path: `batch://${record.assignmentId}/${record.studentId}/${record.submittedAt}`,
      status: record.status === 'failed' ? 'failed' : 'graded',
      submitted_at: submittedAt
    })

    if (submissionError) {
      throw submissionError
    }
  }

  const { error: gradeError } = await supabase.from('grades').insert({
    grade_id: crypto.randomUUID(),
    submission_id: submissionId,
    score: record.score,
    feedback: buildBatchFeedback(record),
    graded_by: authUser.id,
    graded_at: new Date().toISOString()
  })

  if (gradeError) {
    throw gradeError
  }
}

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
    .select('grade_id, submission_id, score, feedback, graded_by, graded_at')
    .in('submission_id', submissionIds)
    .eq('graded_by', profile.id)

  if (gradesError) {
    throw gradesError
  }

  const studentNames = await loadStudentNames([...new Set(submissions.map((submission) => submission.student_id))])

  return mapGradebookRecords(submissions, (gradesData ?? []) as GradeRow[], assignments, studentNames)
}

export async function loadServerStudentGradebookRecords(): Promise<GradebookRecord[]> {
  const authUser = await getAuthenticatedUser()
  const serverStudentId = await resolveServerStudentId(authUser.id, authUser.email)
  const assignments = await loadServerAssignments()

  const { data: submissionsData, error: submissionsError } = await supabase
    .from('submissions')
    .select('submission_id, assignment_id, student_id, file_name, storage_path, status, submitted_at')
    .eq('student_id', serverStudentId)

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
    .select('grade_id, submission_id, score, feedback, graded_by, graded_at')
    .in('submission_id', submissionIds)

  if (gradesError) {
    throw gradesError
  }

  return mapGradebookRecords(
    submissions,
    (gradesData ?? []) as GradeRow[],
    assignments,
    new Map([[serverStudentId, authUser.email ?? serverStudentId]])
  )
}
