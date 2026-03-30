import { describe, expect, it, vi, beforeEach } from 'vitest'
import { dirname, join } from 'node:path'

const { randomUUIDMock, copyFileMock, mkdirMock, writeFileMock, getPathMock, getCommonWorkingDirectoryMock, getSubmissionRelativePathMock } = vi.hoisted(() => {
  return {
    randomUUIDMock: vi.fn(),
    copyFileMock: vi.fn(),
    mkdirMock: vi.fn(),
    writeFileMock: vi.fn(),
    getPathMock: vi.fn(),
    getCommonWorkingDirectoryMock: vi.fn(),
    getSubmissionRelativePathMock: vi.fn()
  }
})

vi.mock('node:crypto', () => {
  return { randomUUID: randomUUIDMock }
})

vi.mock('node:fs/promises', () => {
  return {
    copyFile: copyFileMock,
    mkdir: mkdirMock,
    writeFile: writeFileMock
  }
})

vi.mock('electron', () => {
  return {
    app: {
      getPath: getPathMock
    }
  }
})

vi.mock('../../src/main/utils/sourceFiles', () => {
  return {
    getCommonWorkingDirectory: getCommonWorkingDirectoryMock,
    getSubmissionRelativePath: getSubmissionRelativePathMock
  }
})

async function loadSubmitModule(): Promise<typeof import('../../src/main/submissions/submitCppSubmission')> {
  vi.resetModules()
  return await import('../../src/main/submissions/submitCppSubmission')
}

beforeEach(() => {
  vi.useRealTimers()

  randomUUIDMock.mockReset()
  copyFileMock.mockReset()
  mkdirMock.mockReset()
  writeFileMock.mockReset()
  getPathMock.mockReset()
  getCommonWorkingDirectoryMock.mockReset()
  getSubmissionRelativePathMock.mockReset()

  randomUUIDMock.mockReturnValue('submission-uuid')
  getPathMock.mockReturnValue('/batchgrade-user-data')
  mkdirMock.mockResolvedValue(undefined)
  copyFileMock.mockResolvedValue(undefined)
  writeFileMock.mockResolvedValue(undefined)
  getCommonWorkingDirectoryMock.mockReturnValue(join('/course', 'student-work'))
})

describe('submitCppSubmission', () => {
  it('Returns an error if the assignment is missing', async () => {
    const { submitCppSubmission } = await loadSubmitModule()
    const result = await submitCppSubmission({
      assignmentId: '',
      studentId: 'student-1',
      sourceFiles: [join('/course', 'main.cpp')],
      compileSnapshot: null
    })

    expect(result).toEqual({
      submissionSuccess: false,
      submissionId: null,
      assignmentId: '',
      studentId: 'student-1',
      submissionDirectory: null,
      manifestPath: null,
      submittedAt: null,
      submittedFiles: [],
      message: 'Select an assignment before submitting.'
    })

    expect(randomUUIDMock).not.toHaveBeenCalled()
    expect(getPathMock).not.toHaveBeenCalled()
    expect(getCommonWorkingDirectoryMock).not.toHaveBeenCalled()
    expect(mkdirMock).not.toHaveBeenCalled()
    expect(copyFileMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('Returns an error if the student is missing', async () => {
    const { submitCppSubmission } = await loadSubmitModule()
    const result = await submitCppSubmission({
      assignmentId: 'assignment-1',
      studentId: '',
      sourceFiles: [join('/course', 'main.cpp')],
      compileSnapshot: null
    })

    expect(result).toEqual({
      submissionSuccess: false,
      submissionId: null,
      assignmentId: 'assignment-1',
      studentId: '',
      submissionDirectory: null,
      manifestPath: null,
      submittedAt: null,
      submittedFiles: [],
      message: 'Student identity is required before submitting.'
    })

    expect(randomUUIDMock).not.toHaveBeenCalled()
    expect(getPathMock).not.toHaveBeenCalled()
    expect(getCommonWorkingDirectoryMock).not.toHaveBeenCalled()
    expect(mkdirMock).not.toHaveBeenCalled()
    expect(copyFileMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('Returns an error if no source files are selected', async () => {
    const { submitCppSubmission } = await loadSubmitModule()
    const result = await submitCppSubmission({
      assignmentId: 'assignment-1',
      studentId: 'student-1',
      sourceFiles: [],
      compileSnapshot: null
    })

    expect(result).toEqual({
      submissionSuccess: false,
      submissionId: null,
      assignmentId: 'assignment-1',
      studentId: 'student-1',
      submissionDirectory: null,
      manifestPath: null,
      submittedAt: null,
      submittedFiles: [],
      message: 'Select at least one source file before submitting.'
    })

    expect(randomUUIDMock).not.toHaveBeenCalled()
    expect(getPathMock).not.toHaveBeenCalled()
    expect(getCommonWorkingDirectoryMock).not.toHaveBeenCalled()
    expect(mkdirMock).not.toHaveBeenCalled()
    expect(copyFileMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('Copies the submission files and writes a manifest for later grading', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T15:16:17.890Z'))

    const sourceFiles = [
      join('/course', 'student-work', 'src', 'main.cpp'),
      join('/course', 'student-work', 'include', 'helpers.hpp')
    ]
    const relativePaths = new Map([
      [sourceFiles[0], join('src', 'main.cpp')],
      [sourceFiles[1], join('include', 'helpers.hpp')]
    ])
    const compileSnapshot = {
      compileSuccess: true,
      compilerPath: 'g++',
      sourceFiles,
      stdout: 'compiled',
      stderr: '',
      message: 'Compilation success.'
    }

    getSubmissionRelativePathMock.mockImplementation((_rootDirectory, filePath: string) => {
      return relativePaths.get(filePath)
    })

    const { submitCppSubmission } = await loadSubmitModule()
    const result = await submitCppSubmission({
      assignmentId: 'assignment-1',
      studentId: 'student-1',
      sourceFiles,
      compileSnapshot
    })

    const submissionDirectory = join(
      '/batchgrade-user-data',
      'submissions',
      'student-1',
      'assignment-1',
      '2026-03-29T15-16-17-890Z-submission-uuid'
    )
    const manifestPath = join(submissionDirectory, 'submission-manifest.json')

    expect(result).toEqual({
      submissionSuccess: true,
      submissionId: 'submission-uuid',
      assignmentId: 'assignment-1',
      studentId: 'student-1',
      submissionDirectory,
      manifestPath,
      submittedAt: '2026-03-29T15:16:17.890Z',
      submittedFiles: [
        {
          originalPath: sourceFiles[0],
          relativePath: join('src', 'main.cpp'),
          fileName: 'main.cpp'
        },
        {
          originalPath: sourceFiles[1],
          relativePath: join('include', 'helpers.hpp'),
          fileName: 'helpers.hpp'
        }
      ],
      message: 'Submission saved for later grading.'
    })

    expect(getPathMock).toHaveBeenCalledWith('userData')
    expect(getCommonWorkingDirectoryMock).toHaveBeenCalledWith(sourceFiles)
    expect(getSubmissionRelativePathMock).toHaveBeenCalledTimes(2)
    expect(getSubmissionRelativePathMock).toHaveBeenNthCalledWith(
      1,
      join('/course', 'student-work'),
      sourceFiles[0]
    )
    expect(getSubmissionRelativePathMock).toHaveBeenNthCalledWith(
      2,
      join('/course', 'student-work'),
      sourceFiles[1]
    )

    expect(mkdirMock).toHaveBeenNthCalledWith(1, submissionDirectory, { recursive: true })
    expect(mkdirMock).toHaveBeenNthCalledWith(2, dirname(join(submissionDirectory, 'src', 'main.cpp')), {
      recursive: true
    })
    expect(mkdirMock).toHaveBeenNthCalledWith(
      3,
      dirname(join(submissionDirectory, 'include', 'helpers.hpp')),
      { recursive: true }
    )

    expect(copyFileMock).toHaveBeenNthCalledWith(
      1,
      sourceFiles[0],
      join(submissionDirectory, 'src', 'main.cpp')
    )
    expect(copyFileMock).toHaveBeenNthCalledWith(
      2,
      sourceFiles[1],
      join(submissionDirectory, 'include', 'helpers.hpp')
    )

    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith(manifestPath, expect.any(String), 'utf8')

    const manifest = JSON.parse(writeFileMock.mock.calls[0][1] as string)

    expect(manifest).toEqual({
      formatVersion: 1,
      submissionId: 'submission-uuid',
      assignmentId: 'assignment-1',
      studentId: 'student-1',
      submittedAt: '2026-03-29T15:16:17.890Z',
      sourceRoot: join('/course', 'student-work'),
      submittedFiles: [
        {
          originalPath: sourceFiles[0],
          relativePath: join('src', 'main.cpp'),
          fileName: 'main.cpp'
        },
        {
          originalPath: sourceFiles[1],
          relativePath: join('include', 'helpers.hpp'),
          fileName: 'helpers.hpp'
        }
      ],
      compileSnapshot
    })
  })
})
