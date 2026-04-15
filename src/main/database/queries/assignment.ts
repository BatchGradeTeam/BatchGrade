import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import { assignmentsInstrc } from '../schema'
import type { Assignment as DbAssignment, NewAssignment, UpdateAssignment } from '../schema'
import type { Assignment } from '../../../shared/types'

// convert DbAssignment to Assignment for IPC communications between main and renderer processes
function toIpcAssignment(assignment: DbAssignment): Assignment {
  return {
    uuid: assignment.uuid,
    name: assignment.name,
    dueDate: assignment.dueDate,
    gradingCriteria: assignment.gradingCriteria,
    solutionType: assignment.solutionType,
    solutionFileName: assignment.solutionFileName,
    solutionFilePath: assignment.solutionFilePath,
    expectedOutputText: assignment.expectedOutputText,
    createdByUserUuid: assignment.createdByUserUuid,
    createdAt: assignment.createdAt
  }
}

// @brief get all assignments from database
// @returns array of all assignments in database
export function getAllAssignments(): Assignment[] {
  return getDb().select().from(assignmentsInstrc).all().map(toIpcAssignment)
}

// @brief create new assignment in database
// @param data - the assignment data to create
// @returns the created assignment
export function createAssignment(data: NewAssignment): Assignment {
  // insert new assignment into database and return the created assignment
  const created = getDb().insert(assignmentsInstrc).values(data).returning().get()

  // check if create was successful, else throw error
  if (!created) {
    throw new Error('Failed to create assignment')
  }

  return toIpcAssignment(created)
}

// @brief update existing assignment in database
// @param data - the updated assignment data, must include uuid to ID which assignment to update
// @returns the updated assignment
export function updateAssignment(data: UpdateAssignment): Assignment {
  const changes: Partial<NewAssignment> = {}

  // update fields that are provided in the updated data, otherwise
  // keep existing values

  // name of the assignment
  if (data.name !== undefined) {
    changes.name = data.name
  }

  // due date of the assignment
  if (data.dueDate !== undefined) {
    changes.dueDate = data.dueDate
  }

  // grading criteria for the assignment (points, rubric, etc...)
  if (data.gradingCriteria !== undefined) {
    changes.gradingCriteria = data.gradingCriteria
  }

  // solution type (file or text)
  if (data.solutionType !== undefined) {
    changes.solutionType = data.solutionType
  }

  // solution file name (if file is provided)
  if (data.solutionFileName !== undefined) {
    changes.solutionFileName = data.solutionFileName
  }

  // solution file path (if file is provided)
  if (data.solutionFilePath !== undefined) {
    changes.solutionFilePath = data.solutionFilePath
  }

  // solution output text (if text is provided)
  if (data.expectedOutputText !== undefined) {
    changes.expectedOutputText = data.expectedOutputText
  }

  // user who created the assignment
  if (data.createdByUserUuid !== undefined) {
    changes.createdByUserUuid = data.createdByUserUuid
  }

  // if no fields are provided for update, error - empty update not allowed.
  if (Object.keys(changes).length === 0) {
    throw new Error('No fields provided to update')
  }

  // update assignments in database
  const updated = getDb()
    .update(assignmentsInstrc)
    .set(changes)
    .where(eq(assignmentsInstrc.uuid, data.uuid))
    .returning()
    .get()

  // if the update was not successful, throw error - not found with uuid
  if (!updated) {
    throw new Error(`Assignment not found: ${data.uuid}`)
  }

  return toIpcAssignment(updated)
}

// @brief delete assignment from database by uuid
// @param uuid - the uuid for the assignment to delete
// @returns the deleted assignment
export function deleteAssignment(uuid: string): Assignment {
  // delete the assignment form the database
  const deleted = getDb()
    .delete(assignmentsInstrc)
    .where(eq(assignmentsInstrc.uuid, uuid))
    .returning()
    .get()

  // if not successful, throw error - not found with uuid
  if (!deleted) {
    throw new Error(`Assignment not found: ${uuid}`)
  }

  return toIpcAssignment(deleted)
}
