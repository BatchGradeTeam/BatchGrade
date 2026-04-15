import { vi, describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import { createSubmission, getSubmissionById } from '../../src/main/database/queries/submissionServices'
import { getDb } from '../../src/main/database/index'

// ai-gen start (Gemini-3, 1)

// Mock dependencies
vi.mock('fs')
vi.mock('node:crypto', () => ({
  default: { randomUUID: () => 'test-uuid-100' }
}))
vi.mock('../../src/main/database/index', () => ({
  getDb: vi.fn()
}))

const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn()
  }

beforeEach(async () => {
  vi.clearAllMocks()
    vi.mocked(getDb).mockReturnValue(mockDb as any)
})

describe('Submission Services Schema', () => {
  it('emptyTable_createSubmission_successfulCreation', async () => {

    // Mock fs to return a small file
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('Code for HW1'))

    const mockedResult = { uuid: 'test-uuid-100', studentId: 'student-200', assignmentId: 'assignment-200', fileName: 'HW1.cpp', filePath: '/Class1/HW1/HW1.cpp', status: 'pending' }

    mockDb.get.mockReturnValue(mockedResult)
    
    const result = createSubmission({ studentId: 'student-200', assignmentId: 'assignment-200', fileName: 'HW1.cpp', filePath: '/Class1/HW1/HW1.cpp'})

    expect(result).toEqual(mockedResult)
  })

  it('givenEmptyFile_createSubmission_throwsError', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(''))

    expect(() => createSubmission({ studentId: 'student-200', assignmentId: 'assignment-200', fileName: 'HW1.cpp', filePath: '/Class1/HW1/HW1.cpp'})).toThrow(`Submitted file "HW1.cpp" is empty.`)
  })

  it('givenLargeFile_createSubmission_throwsError', async () => {
    const tooLarge = Buffer.alloc(501 * 1024) // 501 KB
    vi.mocked(fs.readFileSync).mockReturnValue(tooLarge)

    expect(() => createSubmission({ studentId: 'student-200', assignmentId: 'assignment-200', fileName: 'HW1.cpp', filePath: '/Class1/HW1/HW1.cpp'})).toThrow(`File "HW1.cpp" exceeds the maximum allowed size of 500 KB. Submitted file size: 501.0 KB.`)
  })

  it('createdSubmission_getSubmissionByID_getCorrectSubmission', async () => {
    const mockedResult = { uuid: '123', status: 'pending' }
    mockDb.get.mockReturnValue(mockedResult)

    const result = getSubmissionById('123')

    expect(result).toBe(mockedResult)
  })

  it('nonexistentSubmission_getSubmissionByID_getUndefined', async () => {
      mockDb.get.mockReturnValue(undefined)

      const result = getSubmissionById('does-not-exist')

      expect(result).toBeUndefined()
    })
})
// ai-gen end
