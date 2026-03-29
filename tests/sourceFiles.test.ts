import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolve, join } from 'node:path'
import { getCommonWorkingDirectory, getCppImplementationFiles, getSubmissionRelativePath } from '../src/main/utils/sourceFiles'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('node:path')
})

describe('getCommonWorkingDirectory', () => {
  it('Returns the current working directory if no files are given', () => {
    expect(getCommonWorkingDirectory([])).toBe(process.cwd())
  })

  it('Returns to the first file\'s folder if Windows files don\'t share a drive', async () => {
    vi.doMock('node:path', async () => await import('node:path/win32'))
    const { getCommonWorkingDirectory } = await import('../src/main/utils/sourceFiles')
    const { resolve } = await import('node:path/win32')

    expect(getCommonWorkingDirectory(['C:/test/test.cpp', 'D:/test/test.cpp'])).toBe(resolve('C:/test'))
  })

  it('Returns the Windows drive root when files only share the drive letter', async () => {
    vi.doMock('node:path', async () => await import('node:path/win32'))
    const { getCommonWorkingDirectory } = await import('../src/main/utils/sourceFiles')
    const { resolve } = await import('node:path/win32')

    expect(getCommonWorkingDirectory(['C:/test.cpp', 'C:/nested/test.cpp'])).toBe(resolve('C:/'))
  })

  it('Returns the filesystem root when files only share the drive root', () => {
    expect(getCommonWorkingDirectory(['/test.cpp', '/b/test.cpp'])).toBe(resolve('/'))
  })

  it('Returns directory of a single file', () => {
    expect(getCommonWorkingDirectory(['/test/src/test.cpp'])).toBe(resolve('/test/src'))
  })

  it('Returns the longest common working directory (or prefix)', () => {
    expect(getCommonWorkingDirectory(['/test/src/main/test.cpp', '/test/src/main/test2.cpp'])).toBe(resolve('/test/src/main'))
  })
})

describe('getCppImplementationFiles', () => {
  it('Should ignore everything but C++ implementation files', () => {
    const nonImplementationFiles = ["test.h", "test.hpp", "test.md", "test.txt"]
    expect(getCppImplementationFiles(nonImplementationFiles)).toStrictEqual([])
  })

  it('Returns the source files from the given files', () => {
    const files = ["test.cpp", "test.h", "test.cc", "test.hpp", "test.cxx", "test.md", "test.cp", "test.txt"]
    expect(getCppImplementationFiles(files)).toStrictEqual(["test.cpp", "test.cc", "test.cxx", "test.cp"])
  })
})

describe('getSubmissionRelativePath', () => {
  it('Returns the relative path if file is inside the root directory', () => {
    expect(getSubmissionRelativePath(resolve('/test'), resolve('/test/src/main/main.cpp'))).toBe(join('src', 'main', 'main.cpp'))
  })
  it('Returns its filename if file is outside the root directory', () => {
    expect(getSubmissionRelativePath(resolve('/test'), resolve('/notTest/test.cpp'))).toBe('test.cpp')
  })
})

describe('getCommonWorkingDirectory POSIX root branch', () => {
  it('Returns "/" when the shared directory string is empty', async () => {
    vi.doMock('node:path', async () => await import('node:path/posix'))
    const { getCommonWorkingDirectory } = await import('../src/main/utils/sourceFiles')
    expect(getCommonWorkingDirectory(['/a.cpp', '/b/test.cpp'])).toBe('/')
  })
})
