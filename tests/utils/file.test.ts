import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  selectFile,
  stringifyFile,
  selectCppFiles,
  selectSubmissionFolder,
  selectFilesFromFolder,
  materializeServerSubmissions
} from '../../src/main/utils/file'
import { dialog } from 'electron'
import * as fs from 'fs/promises'
type ReaddirResult = Awaited<ReturnType<typeof fs.readdir>>

// ai-gen start (Gemini-3, 1)

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
  readdir: vi.fn(),
}))

// Mock path for consistency across different OS's
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return { ...actual }
})

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

  it('readFileContents_stringifyFile_returnsStringContent', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('hello, hello, hello')
    const result = await stringifyFile('/dummy/path.txt')
    
    expect(result).toBe('hello, hello, hello')
    expect(fs.readFile).toHaveBeenCalledWith('/dummy/path.txt', 'utf-8')
  })

  it('multipleFilesSelected_selectCppFiles_returnsPaths', async () => {
    const paths = ['/a.cpp', '/b.hpp']
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: paths })
    const result = await selectCppFiles()
    
    expect(result).toEqual(paths)
  })

  it('fileInFolderSelected_selectFilesFromFolder_returnsFile', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/folder'] })
    
    // Mock readdir to return one file and one directory
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
      { name: 'subfolder', isFile: () => false, isDirectory: () => true }
    ] as unknown as ReaddirResult)

    const result = await selectFilesFromFolder()
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('file1.txt')
  })

  it('folderSubmissionSelected_selectSubmissionFolder_returnsCorrectSubmissions', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/root'] })
    
    // Mock root folder with one student folder
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'student1', isFile: () => false, isDirectory: () => true }
      ] as unknown as ReaddirResult)
      // Mock student folder with one cpp file
      .mockResolvedValueOnce([
        { name: 'main.cpp', isFile: () => true, isDirectory: () => false }
      ] as unknown as ReaddirResult)

    const result = await selectSubmissionFolder()
    expect(result).toHaveLength(1)
    expect(result[0].folderName).toBe('student1')
    expect(result[0].cppFiles[0]).toContain('main.cpp')
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
