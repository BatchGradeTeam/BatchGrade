import { describe, it, expect, vi, beforeEach } from 'vitest'

const { spawnMock, mkdtempMock, getCommonWorkingDirectoryMock } = vi.hoisted(() => {
  return {
    spawnMock: vi.fn(),
    mkdtempMock: vi.fn(),
    getCommonWorkingDirectoryMock: vi.fn()
  }
})

vi.mock('child_process', () => {
  return { spawn: spawnMock }
})

vi.mock('fs/promises', () => {
  return { mkdtemp: mkdtempMock }
})

vi.mock('os', () => {
  return { tmpdir: () => '/tmp' }
})

vi.mock('../../src/main/utils/sourceFiles', () => {
  return {
    getCommonWorkingDirectory: getCommonWorkingDirectoryMock
  }
})

async function loadDockerCompileModule(): Promise<typeof import('../../src/main/compiler/dockerCompile')> {
  vi.resetModules()
  return await import('../../src/main/compiler/dockerCompile')
}

beforeEach(() => {
  spawnMock.mockReset()
  mkdtempMock.mockReset()
  getCommonWorkingDirectoryMock.mockReset()

  mkdtempMock.mockResolvedValue('/tmp/batchgrade-docker-123')
  getCommonWorkingDirectoryMock.mockReturnValue('/project')
})

describe('dockerCompile', () => {
  it('Should return error when no source files match language extensions', async () => {
    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({
      sourceFiles: ['test.txt', 'README.md'],
      language: 'cpp'
    })

    expect(result.success).toBe(false)
    expect(result.executablePath).toBeNull()
    expect(result.message).toContain('No C++ source files found')
  })

  it('Should successfully compile C++ files', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10) // Simulate success exit code
          }
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({
      sourceFiles: ['/project/main.cpp', '/project/utils.cpp'],
      language: 'cpp'
    })

    expect(result.success).toBe(true)
    expect(result.executablePath).toContain('batchgrade-docker-')
    expect(result.message).toBe('Compilation success.')
    if (typeof process.getuid === 'function' && typeof process.getgid === 'function') {
      expect(spawnMock).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['--user', `${process.getuid()}:${process.getgid()}`]),
        expect.any(Object)
      )
    }
  })

  it('Should handle compilation errors', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: {
          on: (event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('error: undefined reference'))
            }
          }
        },
        on: (event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10) // Simulate failure exit code
          }
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({
      sourceFiles: ['/project/main.cpp'],
      language: 'cpp'
    })

    expect(result.success).toBe(false)
    expect(result.executablePath).toBeNull()
    expect(result.message).toBe('Compilation failed.')
  })

  it('Should filter files by language extension', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({
      sourceFiles: ['/project/main.cpp', '/project/header.h', '/project/readme.txt'],
      language: 'cpp'
    })

    expect(result.success).toBe(true)
    expect(spawnMock).toHaveBeenCalled()
  })
})
