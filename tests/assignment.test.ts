import { describe, it, expect, beforeEach } from 'vitest'

// Wipes the assignmentsInstrc table before each test
beforeEach(async () => {
  const { getDb } = await import('../src/main/database/index')
  const { assignmentsInstrc } = await import('../src/main/database/schema')
  getDb().delete(assignmentsInstrc).run()
})

describe('Assignment (Instructor Config) Schema', () => {
  it('emptyTable_insertAssignmentWithFileType_generatesUuidAndStoresAllFields', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignmentsInstrc } = await import('../src/main/database/schema')

    const result = getDb()
      .insert(assignmentsInstrc)
      .values({
        name: 'PA1',
        dueDate: '2026-04-01',
        gradingCriteria: 'correctness',
        solutionType: 'file',
        solutionFileName: 'solution.cpp',
        solutionFilePath: '/solutions/pa1/solution.cpp'
      })
      .returning()
      .get()

    expect(result.uuid).toBeTruthy()
    expect(result.name).toBe('PA1')
    expect(result.solutionType).toBe('file')
    expect(result.solutionFileName).toBe('solution.cpp')
    expect(result.solutionFilePath).toBe('/solutions/pa1/solution.cpp')
  })

  it('emptyTable_insertAssignmentWithTextType_storesExpectedOutputText', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignmentsInstrc } = await import('../src/main/database/schema')

    const result = getDb()
      .insert(assignmentsInstrc)
      .values({
        name: 'PA2',
        dueDate: '2026-04-15',
        gradingCriteria: 'exact match',
        solutionType: 'text',
        expectedOutputText: 'Hello, World!'
      })
      .returning()
      .get()

    expect(result.solutionType).toBe('text')
    expect(result.expectedOutputText).toBe('Hello, World!')
    expect(result.solutionFileName).toBeNull()
    expect(result.solutionFilePath).toBeNull()
  })

  it('insertedAssignment_createdAtField_isPopulatedAutomatically', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignmentsInstrc } = await import('../src/main/database/schema')

    const result = getDb()
      .insert(assignmentsInstrc)
      .values({
        name: 'PA3',
        dueDate: '2026-05-01',
        gradingCriteria: 'output',
        solutionType: 'text',
        expectedOutputText: '42'
      })
      .returning()
      .get()

    expect(result.createdAt).toBeTruthy()
    expect(typeof result.createdAt).toBe('number')
  })

  it('assignmentWithCreatedByUser_insert_storesUserUuid', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignmentsInstrc } = await import('../src/main/database/schema')

    const result = getDb()
      .insert(assignmentsInstrc)
      .values({
        name: 'PA4',
        dueDate: '2026-05-15',
        gradingCriteria: 'output',
        solutionType: 'text',
        expectedOutputText: 'done',
        createdByUserUuid: 'some-instructor-uuid'
      })
      .returning()
      .get()

    expect(result.createdByUserUuid).toBe('some-instructor-uuid')
  })

  it('twoAssignmentsInserted_selectAll_returnsBothRecords', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignmentsInstrc } = await import('../src/main/database/schema')

    getDb()
      .insert(assignmentsInstrc)
      .values({ name: 'HW1', dueDate: '2026-03-01', gradingCriteria: 'c', solutionType: 'text', expectedOutputText: 'a' })
      .run()
    getDb()
      .insert(assignmentsInstrc)
      .values({ name: 'HW2', dueDate: '2026-03-15', gradingCriteria: 'c', solutionType: 'text', expectedOutputText: 'b' })
      .run()

    expect(getDb().select().from(assignmentsInstrc).all()).toHaveLength(2)
  })

  it('existingAssignment_deleteAll_tableIsEmpty', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignmentsInstrc } = await import('../src/main/database/schema')

    getDb()
      .insert(assignmentsInstrc)
      .values({ name: 'HW3', dueDate: '2026-04-01', gradingCriteria: 'c', solutionType: 'text', expectedOutputText: 'z' })
      .run()
    getDb().delete(assignmentsInstrc).run()

    expect(getDb().select().from(assignmentsInstrc).all()).toHaveLength(0)
  })
})
