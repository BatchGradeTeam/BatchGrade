import type { User, NewUser, UpdateUser } from '../shared/types'
import type {
  GccInstallationInfo,
  CompileCppRequest,
  CompileCppResult,
  RunCppRequest,
  RunCppResult,
  JudgeCppRequest,
  JudgeCppResult
} from '../shared/compiler'
import type { SubmitCppRequest, SubmitCppResult } from '../shared/submission'
import type { Assignment, NewAssignment, UpdateAssignment } from '../shared/types'

export type UsersAPI = {
  getAll: () => Promise<User[]>
  create: (data: NewUser) => Promise<User>
  update: (data: UpdateUser) => Promise<User>
  delete: (uuid: string) => Promise<User>
}

export type CompilerAPI = {
  getGccStatus: () => Promise<GccInstallationInfo>
  setGccPath: (filePath: string) => Promise<GccInstallationInfo>
  compileCpp: (request: CompileCppRequest) => Promise<CompileCppResult>
  runCompiledProgram: (request: RunCppRequest) => Promise<RunCppResult>
  judgeCpp: (request: JudgeCppRequest) => Promise<JudgeCppResult>
}

export type AssignmentsAPI = {
  /**
   * @brief Get all assignments.
   */
  getAll: () => Promise<Assignment[]>

  /**
   * @brief Create an assignment.
   * @param data Assignment creation payload.
   * @return Promise resolving to the created assignment.
   */
  create: (data: NewAssignment) => Promise<Assignment>

  /**
   * @brief Update an assignment.
   * @param data Assignment update payload.
   * @return Promise resolving to the updated assignment.
   */
  update: (data: UpdateAssignment) => Promise<Assignment>

  /**
   * @brief Delete an assignment by UUID.
   * @param uuid UUID of the assignment to delete.
   * @return Promise resolving to the deleted assignment.
   */
  delete: (uuid: string) => Promise<Assignment>
}

export type FileAPI = {
  select: () => Promise<string | undefined>
  selectCppFiles: () => Promise<string[]>
  stringify: (filePath: string) => Promise<string>
}

export type SubmissionsAPI = {
  submitCpp: (request: SubmitCppRequest) => Promise<SubmitCppResult>
}

export type AppAPI = {
  users: UsersAPI
  assignments: AssignmentsAPI
  file: FileAPI
  compiler: CompilerAPI
  submissions: SubmissionsAPI
}
