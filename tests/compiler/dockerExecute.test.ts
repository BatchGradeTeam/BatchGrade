import { describe, it, expect, vi, beforeEach } from 'vitest'

const { spawnMock } = vi.hoisted(() => {
  return {
    spawnMock: vi.fn()
  }
})

vi.mock('child_process', () => {
  return { spawn: spawnMock }
})

vi.mock('../../src/main/compiler/languages', () => {
  return {
    getLanguage: (lang) => {
      const configs = {
        cpp: { dockerImage: 'gcc:14' },
        python: { dockerImage: 'python:3.12-slim' },
        java: { dockerImage: 'eclipse-temurin:21-jdk-alpine' }
      }
      return configs[lang]
    }
  }
})

async function loadDockerExecuteModule(): Promise<typeof import('../../src/main/compiler/dockerExecute')> {
  vi.resetModules()
  return await import('../../src/main/compiler/dockerExecute')
}

beforeEach(() => {
  spawnMock.mockReset()
})

describe('dockerExecute', () => {
  it('Should successfully execute a program', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: {
          on: (event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Hello, World!\n'))
            }
          }
        },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        },
        stdin: { write: () => {}, end: () => {} },
        kill: () => {}
      }
    })

    const { dockerExecute } = await loadDockerExecuteModule()
    const result = await dockerExecute({
      executablePath: '/tmp/program',
      stdin: '',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.success).toBe(true)
    expect(result.stdout).toBe('Hello, World!\n')
    expect(result.message).toBe('Program execution success.')
  })

  it('Should pass stdin to the program', async () => {
    let stdinWritten = ''
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        },
        stdin: {
          write: (data) => {
            stdinWritten += data
          },
          end: () => {}
        },
        kill: () => {}
      }
    })

    const { dockerExecute } = await loadDockerExecuteModule()
    await dockerExecute({
      executablePath: '/tmp/program',
      stdin: '42\n',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(stdinWritten).toBe('42\n')
  })

  it('Should handle execution errors', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'error') {
            callback(new Error('Failed to start process'))
          }
        },
        stdin: { write: () => {}, end: () => {} },
        kill: () => {}
      }
    })

    const { dockerExecute } = await loadDockerExecuteModule()
    const result = await dockerExecute({
      executablePath: '/tmp/program',
      stdin: '',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe('Program execution failed to start.')
  })

  it('Should handle non-zero exit codes', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: {
          on: (event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Segmentation fault\n'))
            }
          }
        },
        on: (event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(139), 10) // Segmentation fault exit code
          }
        },
        stdin: { write: () => {}, end: () => {} },
        kill: () => {}
      }
    })

    const { dockerExecute } = await loadDockerExecuteModule()
    const result = await dockerExecute({
      executablePath: '/tmp/program',
      stdin: '',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe('Program execution failed.')
  })

  it('Should kill the named container when execution times out', async () => {
    let closeHandler: ((code: number | null) => void) | undefined
    spawnMock.mockImplementation(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') closeHandler = callback
        },
        stdin: { write: () => {}, end: () => {} },
        kill: () => closeHandler?.(null)
      }
    })

    const { dockerExecute } = await loadDockerExecuteModule()
    const result = await dockerExecute({
      executablePath: '/tmp/program',
      stdin: '',
      timeoutMs: 1,
      language: 'cpp'
    })

    expect(result.timedOut).toBe(true)
    expect(spawnMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['kill', expect.stringMatching(/^batchgrade-execute-/)]),
      expect.any(Object)
    )
  })

  it('Should support Python execution', async () => {
    spawnMock.mockImplementation(() => {
      return {
        stdout: {
          on: (event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Python output'))
            }
          }
        },
        stderr: { on: () => {} },
        on: (event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        },
        stdin: { write: () => {}, end: () => {} },
        kill: () => {}
      }
    })

    const { dockerExecute } = await loadDockerExecuteModule()
    const result = await dockerExecute({
      executablePath: '/tmp/main.py',
      stdin: '',
      timeoutMs: 5000,
      language: 'python'
    })

    expect(result.success).toBe(true)
    expect(spawnMock).toHaveBeenCalledWith('docker', expect.arrayContaining(['python:3.12-slim']), expect.any(Object))
  })
})
