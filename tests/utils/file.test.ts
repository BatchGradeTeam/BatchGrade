import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectFile, selectCppFiles } from '../../src/main/utils/file'
import { dialog } from 'electron'

// ai-gen start (Gemini-3, 2)

// Mock Electron and fs
vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
  },
}))
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
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
})

// ai-gen end