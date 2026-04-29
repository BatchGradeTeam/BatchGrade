import { describe, it, expect, vi, beforeEach } from 'vitest'

const { spawnMock, rmSyncMock, mkdtempMock, getCommonWorkingDirectoryMock } = vi.hoisted(() => {
  return {
    spawnMock: vi.fn(),
    rmSyncMock: vi.fn(),
    mkdtempMock: vi.fn(),
    getCommonWorkingDirectoryMock: vi.fn()
  }
})

vi.mock('child_process', () => {
  return { spawn: spawnMock }
})

vi.mock('fs', () => {
  return { rmSync: rmSyncMock }
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

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

function mockPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true
  })
}

function restorePlatform(): void {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform)
  }
}

beforeEach(() => {
  vi.doUnmock('../../src/main/compiler/languages')
  spawnMock.mockReset()
  rmSyncMock.mockReset()
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
    expect(rmSyncMock).not.toHaveBeenCalled()
    if (typeof process.getuid === 'function' && typeof process.getgid === 'function') {
      expect(spawnMock).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['--user', `${process.getuid()}:${process.getgid()}`]),
        expect.any(Object)
      )
    }
  })

  it('Should clean successful compile output directories on process exit', async () => {
    let exitHandler: ((code: number) => void) | undefined
    const onceSpy = vi.spyOn(process, 'once').mockImplementation((event, listener) => {
      if (event === 'exit') exitHandler = listener as (code: number) => void
      return process
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
    mkdtempMock
      .mockResolvedValueOnce('/tmp/batchgrade-docker-1')
      .mockResolvedValueOnce('/tmp/batchgrade-docker-2')

    try {
      const { dockerCompile } = await loadDockerCompileModule()
      await dockerCompile({ sourceFiles: ['/project/main.cpp'], language: 'cpp' })
      await dockerCompile({ sourceFiles: ['/project/main.cpp'], language: 'cpp' })

      expect(onceSpy).toHaveBeenCalledTimes(1)
      expect(rmSyncMock).not.toHaveBeenCalled()

      exitHandler?.(0)

      expect(rmSyncMock).toHaveBeenCalledWith('/tmp/batchgrade-docker-1', {
        recursive: true,
        force: true
      })
      expect(rmSyncMock).toHaveBeenCalledWith('/tmp/batchgrade-docker-2', {
        recursive: true,
        force: true
      })
    } finally {
      onceSpy.mockRestore()
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
    expect(rmSyncMock).toHaveBeenCalledWith('/tmp/batchgrade-docker-123', {
      recursive: true,
      force: true
    })
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

  it('Should preserve Windows separators for Docker output paths', async () => {
    mkdtempMock.mockResolvedValue('C:\\Temp\\batchgrade-docker-123')
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

    expect(result.executablePath).toBe('C:\\Temp\\batchgrade-docker-123\\batchgrade-program')
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
    spawnMock.mockImplementation((cmd, args) => {
      if (args[0] === 'kill') {
        return {
          on: (event, callback) => {
            if (event === 'error') callback(new Error('docker kill failed'))
          }
        }
      }

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
    expect(rmSyncMock).toHaveBeenCalledWith('/tmp/batchgrade-docker-123', {
      recursive: true,
      force: true
    })
    expect(spawnMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['kill', expect.stringMatching(/^batchgrade-compile-/)]),
      expect.any(Object)
    )
  })

  it('Should skip host user args on Windows', async () => {
    mockPlatform('win32')
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

    try {
      const { dockerCompile } = await loadDockerCompileModule()
      await dockerCompile({ sourceFiles: ['/project/main.cpp'], language: 'cpp' })

      expect(spawnMock.mock.calls[0][1]).not.toContain('--user')
    } finally {
      restorePlatform()
    }
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
    expect(rmSyncMock).toHaveBeenCalledWith('/tmp/batchgrade-docker-123', {
      recursive: true,
      force: true
    })
  })
})
