import { describe, it, expect, vi, beforeEach } from 'vitest'

const { execFileAsyncMock } = vi.hoisted(() => {
  return {
    execFileAsyncMock: vi.fn()
  }
})

vi.mock('node:util', () => {
  return { promisify: () => execFileAsyncMock }
})

vi.mock('node:child_process', () => {
  return { execFile: vi.fn() }
})

async function loadDockerDetectionModule(): Promise<typeof import('../../src/main/compiler/dockerDetection')> {
  vi.resetModules()
  return await import('../../src/main/compiler/dockerDetection')
}

beforeEach(() => {
  execFileAsyncMock.mockReset()
})

describe('detectDockerInstallation', () => {
  it('Should return ready status when Docker is available', async () => {
    execFileAsyncMock.mockImplementation((cmd, args) => {
      if (args[0] === '--version') {
        return Promise.resolve({ stdout: 'Docker version 24.0.0, build abc123', stderr: '' })
      }
      if (args[0] === 'ps') {
        return Promise.resolve({ stdout: '', stderr: '' })
      }
      return Promise.reject(new Error('Unknown command'))
    })

    const { detectDockerInstallation } = await loadDockerDetectionModule()
    const result = await detectDockerInstallation()

    expect(result.status).toBe('ready')
    expect(result.message).toContain('Docker')
  })

  it('Should return missing status when Docker is not installed', async () => {
    execFileAsyncMock.mockRejectedValue(new Error('docker not found'))

    const { detectDockerInstallation } = await loadDockerDetectionModule()
    const result = await detectDockerInstallation()

    expect(result.status).toBe('missing')
    expect(result.message).toContain('not installed')
  })

  it('Should return not-running status when Docker daemon is not running', async () => {
    execFileAsyncMock.mockImplementation((cmd, args) => {
      if (args[0] === '--version') {
        return Promise.resolve({ stdout: 'Docker version 24.0.0, build abc123', stderr: '' })
      }
      if (args[0] === 'ps') {
        return Promise.reject(new Error('Cannot connect to Docker daemon'))
      }
      return Promise.reject(new Error('Unknown command'))
    })

    const { detectDockerInstallation } = await loadDockerDetectionModule()
    const result = await detectDockerInstallation()

    expect(result.status).toBe('not-running')
  })
})
