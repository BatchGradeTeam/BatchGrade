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
  vi.doUnmock('../../src/main/compiler/languages')
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

  it('Should return language-specific error when non-C++ files do not match', async () => {
    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({
      sourceFiles: ['Main.cpp', 'README.md'],
      language: 'java'
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe('No Java source files found.')
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

  it('Should compile non-C++ files using language extensions', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: {
          on: (event, callback) => {
            if (event === 'data') callback(Buffer.from('compiled'))
          }
        },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') setTimeout(() => callback(0), 10)
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({
      sourceFiles: ['/project/Main.java', '/project/readme.txt'],
      language: 'java'
    })

    expect(result.success).toBe(true)
    expect(result.stdout).toBe('compiled')
    expect(spawnMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['eclipse-temurin:21-jdk-alpine', 'javac', 'Main.java']),
      expect.any(Object)
    )
  })

  it('Should use basename when source is outside the common working directory', async () => {
    getCommonWorkingDirectoryMock.mockReturnValue('/project')
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') setTimeout(() => callback(0), 10)
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    await dockerCompile({ sourceFiles: ['/external/main.cpp'], language: 'cpp' })

    expect(spawnMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['main.cpp']),
      expect.any(Object)
    )
  })

  it('Should use fallback stderr when compilation fails without stderr output', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') setTimeout(() => callback(1), 10)
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({ sourceFiles: ['/project/main.cpp'], language: 'cpp' })

    expect(result.success).toBe(false)
    expect(result.stderr).toBe('Compilation failed.')
  })

  it('Should include executable extension when the language config has one', async () => {
    vi.doMock('../../src/main/compiler/languages', () => {
      return {
        getLanguage: () => ({
          name: 'Test C++',
          extensions: ['.cpp'],
          dockerImage: 'gcc:test',
          compiler: 'g++',
          exeExtension: '.exe'
        })
      }
    })
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') setTimeout(() => callback(0), 10)
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({ sourceFiles: ['/project/main.cpp'], language: 'cpp' })

    expect(result.executablePath).toBe('/tmp/batchgrade-docker-123/batchgrade-program.exe')
    expect(spawnMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['/out/batchgrade-program.exe']),
      expect.any(Object)
    )
  })

  it('Should return timeout result when Docker compilation times out', async () => {
    vi.useFakeTimers()
    let closeHandler: ((code: number | null) => void) | undefined
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') closeHandler = callback
        },
        kill: () => closeHandler?.(null)
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const compilePromise = dockerCompile({ sourceFiles: ['/project/main.cpp'], language: 'cpp' })
    await vi.advanceTimersByTimeAsync(60000)
    const result = await compilePromise
    vi.useRealTimers()

    expect(result.success).toBe(false)
    expect(result.message).toBe('Compilation timed out.')
  })

  it('Should handle Docker spawn errors', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'error') callback(new Error('docker failed'))
        },
        kill: () => {}
      }
    })

    const { dockerCompile } = await loadDockerCompileModule()
    const result = await dockerCompile({ sourceFiles: ['/project/main.cpp'], language: 'cpp' })

    expect(result.success).toBe(false)
    expect(result.stderr).toBe('docker failed')
    expect(result.message).toBe('Compilation failed to start.')
  })
})
