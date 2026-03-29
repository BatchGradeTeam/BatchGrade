import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { execFileAsyncMock,mkdtempMock, getCppImplementationFilesMock,getCommonWorkingDirectoryMock } = vi.hoisted(() => {
  return {
    execFileAsyncMock: vi.fn(),
    mkdtempMock: vi.fn(),
    getCppImplementationFilesMock: vi.fn(),
    getCommonWorkingDirectoryMock: vi.fn()
  }
})

let testPlatform = ''
const realPlatform = process.platform

vi.mock('child_process', () => {
  return { execFile: vi.fn() }
})

vi.mock('util', () => {
  return { promisify: () => execFileAsyncMock }
})

vi.mock('fs/promises', () => {
  return { mkdtemp: mkdtempMock }
})

vi.mock('os', () => {
  return { tmpdir: () => '/tmp' }
})

vi.mock('../src/main/utils/sourceFiles', () => {
  return {
    getCppImplementationFiles: getCppImplementationFilesMock,
    getCommonWorkingDirectory: getCommonWorkingDirectoryMock
  }
})

async function loadCompileModule():Promise<typeof import('../src/main/compiler/compileCppFiles')> {
  vi.resetModules()

  Object.defineProperty(process, 'platform', {
    value: testPlatform,
    configurable: true
  })

  return await import('../src/main/compiler/compileCppFiles')
}

beforeEach(() => {
  testPlatform = ''
  execFileAsyncMock.mockReset()
  mkdtempMock.mockReset()
  getCppImplementationFilesMock.mockReset()
  getCommonWorkingDirectoryMock.mockReset()

  mkdtempMock.mockResolvedValue('/tmp/batchgrade-123')
  getCppImplementationFilesMock.mockReturnValue(['test.cpp'])
  getCommonWorkingDirectoryMock.mockReturnValue('/projectTest')
})

afterEach(() => {
  Object.defineProperty(process, 'platform', {
    value: realPlatform,
    configurable: true
  })
})

describe('compileCppFiles', () => {
  it('Returns error CompileCppResult if no C++ source files are selected', async () => {
    getCppImplementationFilesMock.mockReturnValue([])

    const { compileCppFiles } = await loadCompileModule()
    const result = await compileCppFiles('g++', { sourceFiles: ['test.h', 'test.txt', 'test.md'] })

    expect(result).toEqual({
      compileSuccess: false,
      compilerPath: 'g++',
      executablePath: null,
      sourceFiles: ['test.h', 'test.txt', 'test.md'],
      stdout: '',
      stderr: '',
      message: 'Select at least one C++ source file.'
    })

    // Expect these functions to not have been called as well
    expect(mkdtempMock).not.toHaveBeenCalled()
    expect(execFileAsyncMock).not.toHaveBeenCalled()
  })

  it('Successfully compiles implementation files into a temporary executable', async () => {
    getCppImplementationFilesMock.mockReturnValue(['test.cpp'])
    execFileAsyncMock.mockResolvedValue({
      stdout: 'compiled',
      stderr: ''
    })

    const { compileCppFiles } = await loadCompileModule()
    const result = await compileCppFiles('g++', { sourceFiles: ['test.cpp', 'test.h'] })

    expect(result).toEqual({
      compileSuccess: true,
      compilerPath: 'g++',
      executablePath: '/tmp/batchgrade-123/batchgrade-program',
      sourceFiles: ['test.cpp', 'test.h'],
      stdout: 'compiled',
      stderr: '',
      message: 'Compilation success.'
    })

    // Expect to be called using this
    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'g++',
      ['test.cpp', '-o', '/tmp/batchgrade-123/batchgrade-program'], // NOTE: 'test'.cpp from the mock
      expect.objectContaining({
        cwd: '/projectTest',
        windowsHide: true,
        timeout: 15000
      })
    )
  })

  it('Uses .exe for Windows', async () => {
    testPlatform = 'win32'
    execFileAsyncMock.mockResolvedValue({
      stdout:'compiled',
      stderr: ''
    })

    const { compileCppFiles } = await loadCompileModule()
    const result = await compileCppFiles('g++', { sourceFiles: ['test.cpp'] })

    expect(result.executablePath).toBe('/tmp/batchgrade-123/batchgrade-program.exe')

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'g++',
      ['test.cpp', '-o', '/tmp/batchgrade-123/batchgrade-program.exe'],
      expect.objectContaining({
        cwd: '/projectTest',
        windowsHide: true,
        timeout: 15000
      })
    )
  })

  it('Returns compiler stderr if compilation fails', async () => {
    execFileAsyncMock.mockRejectedValue({
      stdout: 'warning',
      stderr: 'compile error',
      message: 'failed'
    })

    const { compileCppFiles } = await loadCompileModule()
    const result = await compileCppFiles('g++', { sourceFiles: ['test.cpp'] })

     expect(result).toEqual({
      compileSuccess: false,
      compilerPath: 'g++',
      executablePath: null,
      sourceFiles: ['test.cpp'],
      stdout: 'warning',
      stderr: 'compile error',
      message: 'Compilation failed.'
    })

  })

  it('Returns error message if stderr is missing', async () => {
    execFileAsyncMock.mockRejectedValue({
      message: 'compiler crashed'
    })

    const { compileCppFiles } = await loadCompileModule()
    const result = await compileCppFiles('g++', { sourceFiles: ['test.cpp'] })

    expect(result).toEqual({
      compileSuccess: false,
      compilerPath: 'g++',
      executablePath: null,
      sourceFiles: ['test.cpp'],
      stdout: '',
      stderr: 'compiler crashed',
      message: 'Compilation failed.'
    })
  })
})
