import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAssignment,
  deleteAssignment,
  getAllAssignments,
  updateAssignment
} from '../../src/main/database/queries/assignment'

beforeEach(async () => {
  const { getDb } = await import('../../src/main/database/index')
  const { assignmentsInstrc } = await import('../../src/main/database/schema')
  getDb().delete(assignmentsInstrc).run()
})

describe('Assignment Queries', () => {
  it('Creates an assignment', () => {
    const assignment = createAssignment({
      name: 'FizzBuzz',
      dueDate: '2026-03-31',
      gradingCriteria: '10 points',
      solutionType: 'text',
      expectedOutputText: '1 2 Fizz',
      solutionFileName: null,
      solutionFilePath: null,
      createdByUserUuid: null
    })

    expect(assignment.name).toBe('FizzBuzz')
    expect(assignment.dueDate).toBe('2026-03-31')
    expect(assignment.uuid).toBeTruthy()
    expect(assignment.createdAt).toBeGreaterThan(0)
  })

  it('Gets all assignments', () => {
    createAssignment({
      name: 'A1',
      dueDate: '2026-04-01',
      gradingCriteria: '5 points',
      solutionType: 'text',
      expectedOutputText: 'ok',
      solutionFileName: null,
      solutionFilePath: null,
      createdByUserUuid: null
    })
    createAssignment({
      name: 'A2',
      dueDate: '2026-04-02',
      gradingCriteria: '15 points',
      solutionType: 'file',
      expectedOutputText: null,
      solutionFileName: 'solution.cpp',
      solutionFilePath: 'pending://solution.cpp',
      createdByUserUuid: null
    })

    expect(getAllAssignments()).toHaveLength(2)
  })

  it('Updates an assignment', () => {
    const assignment = createAssignment({
      name: 'Old Name',
      dueDate: '2026-04-10',
      gradingCriteria: 'rubric v1',
      solutionType: 'text',
      expectedOutputText: 'old output',
      solutionFileName: null,
      solutionFilePath: null,
      createdByUserUuid: null
    })

    const updated = updateAssignment({
      uuid: assignment.uuid,
      name: 'New Name',
      gradingCriteria: 'rubric v2'
    })

    expect(updated.name).toBe('New Name')
    expect(updated.gradingCriteria).toBe('rubric v2')
    expect(updated.dueDate).toBe('2026-04-10')
  })

  it('Deletes an assignment', () => {
    const assignment = createAssignment({
      name: 'Delete Me',
      dueDate: '2026-04-15',
      gradingCriteria: '1 point',
      solutionType: 'text',
      expectedOutputText: 'bye',
      solutionFileName: null,
      solutionFilePath: null,
      createdByUserUuid: null
    })

    deleteAssignment(assignment.uuid)

    expect(getAllAssignments()).toHaveLength(0)
  })
})
