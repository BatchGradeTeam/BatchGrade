import { describe, it, expect, vi, beforeEach } from 'vitest'
import { materializeServerSubmissions, selectFile, selectCppFiles } from '../../src/main/utils/file'
import { dialog } from 'electron'
import * as fs from 'fs/promises'

// ai-gen start (Gemini-3, 2)

// Mock Electron and fs
vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/tmp/batchgrade-test'),
  },
}))
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  default: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Test file.ts', () => {
  it('selectedFile_selectFile_returnsPath', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/file.txt'],
    })

    const result = await selectFile()
    expect(result).toBe('/path/to/file.txt')
  })

  it('canceledSelection_selectFile_returnsUndefined', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    })

    const result = await selectFile()
    expect(result).toBeUndefined()
  })

  it('canceledSelection_selectCppFiles_returnsEmptyArray', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      })

      const result = await selectCppFiles()
      expect(result).toEqual([])
  })

  it('serverBundles_materializeServerSubmissions_writesFilesAndReturnsGroups', async () => {
    const result = await materializeServerSubmissions([
      {
        submissionId: 'submission-1',
        studentId: 'student-1',
        studentName: 'Student One',
        files: [
          {
            relativePath: '../src/main.cpp',
            fileName: 'main.cpp',
            content: 'int main() { return 0; }'
          }
        ]
      }
    ])

    expect(fs.mkdir).toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('main.cpp'),
      'int main() { return 0; }',
      'utf8'
    )
    expect(result).toHaveLength(1)
    expect(result[0].studentId).toBe('student-1')
    expect(result[0].serverSubmissionId).toBe('submission-1')
    expect(result[0].cppFiles[0]).toContain('main.cpp')
  })
})

// ai-gen end
