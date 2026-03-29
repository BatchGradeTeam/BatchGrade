import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolve, join } from 'node:path'

async function loadSourceFilesModule(pathFlavor: 'default' | 'win32' | 'posix' = 'default'): Promise<typeof import('../src/main/utils/sourceFiles')> {
  vi.resetModules()
  vi.doUnmock('node:path')

  if (pathFlavor === 'win32') {
    vi.doMock('node:path', async () => await import('node:path/win32'))
  }

  if (pathFlavor === 'posix') {
    vi.doMock('node:path', async () => await import('node:path/posix'))
  }

  return await import('../src/main/utils/sourceFiles')
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('node:path')
})

describe('getCommonWorkingDirectory', () => {
  it('Returns the current working directory if no files are given', async () => {
    const { getCommonWorkingDirectory } = await loadSourceFilesModule()
    expect(getCommonWorkingDirectory([])).toBe(process.cwd())
  })

  it('Returns to the first file\'s folder if Windows files don\'t share a drive', async () => {
    const { getCommonWorkingDirectory } = await loadSourceFilesModule('win32')
    const { resolve } = await import('node:path/win32')

    expect(getCommonWorkingDirectory(['C:/test/test.cpp', 'D:/test/test.cpp'])).toBe(resolve('C:/test'))
  })

  it('Returns the Windows drive root when files only share the drive letter', async () => {
    const { getCommonWorkingDirectory } = await loadSourceFilesModule('win32')
    const { resolve } = await import('node:path/win32')

    expect(getCommonWorkingDirectory(['C:/test.cpp', 'C:/nested/test.cpp'])).toBe(resolve('C:/'))
  })

  it('Returns the filesystem root when files only share the drive root', async () => {
    const { getCommonWorkingDirectory } = await loadSourceFilesModule()
    expect(getCommonWorkingDirectory(['/test.cpp', '/b/test.cpp'])).toBe(resolve('/'))
  })

  it('Returns directory of a single file', async () => {
    const { getCommonWorkingDirectory } = await loadSourceFilesModule()
    expect(getCommonWorkingDirectory(['/test/src/test.cpp'])).toBe(resolve('/test/src'))
  })

  it('Returns the longest common working directory (or prefix)', async () => {
    const { getCommonWorkingDirectory } = await loadSourceFilesModule()
    expect(getCommonWorkingDirectory(['/test/src/main/test.cpp', '/test/src/main/test2.cpp'])).toBe(resolve('/test/src/main'))
  })
})

describe('getCppImplementationFiles', () => {
  it('Should ignore everything but C++ implementation files', async () => {
    const { getCppImplementationFiles } = await loadSourceFilesModule()
    const nonImplementationFiles = ["test.h", "test.hpp", "test.md", "test.txt"]
    expect(getCppImplementationFiles(nonImplementationFiles)).toStrictEqual([])
  })

  it('Returns the source files from the given files', async () => {
    const { getCppImplementationFiles } = await loadSourceFilesModule()
    const files = ["test.cpp", "test.h", "test.cc", "test.hpp", "test.cxx", "test.md", "test.cp", "test.txt"]
    expect(getCppImplementationFiles(files)).toStrictEqual(["test.cpp", "test.cc", "test.cxx", "test.cp"])
  })
})

describe('getSubmissionRelativePath', () => {
  it('Returns the relative path if file is inside the root directory', async () => {
    const { getSubmissionRelativePath } = await loadSourceFilesModule()
    expect(getSubmissionRelativePath(resolve('/test'), resolve('/test/src/main/main.cpp'))).toBe(join('src', 'main', 'main.cpp'))
  })
  it('Returns its filename if file is outside the root directory', async () => {
    const { getSubmissionRelativePath } = await loadSourceFilesModule()
    expect(getSubmissionRelativePath(resolve('/test'), resolve('/notTest/test.cpp'))).toBe('test.cpp')
  })
})

describe('getCommonWorkingDirectory POSIX root branch', () => {
  it('Returns "/" when the shared directory string is empty', async () => {
    const { getCommonWorkingDirectory } = await loadSourceFilesModule('posix')
    expect(getCommonWorkingDirectory(['/a.cpp', '/b/test.cpp'])).toBe('/')
  })
})
