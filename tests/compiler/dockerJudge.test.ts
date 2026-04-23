import { describe, it, expect, vi, beforeEach } from 'vitest'

const { dockerExecuteMock } = vi.hoisted(() => {
  return {
    dockerExecuteMock: vi.fn()
  }
})

vi.mock('../../src/main/compiler/dockerExecute', () => {
  return {
    dockerExecute: dockerExecuteMock
  }
})

async function loadDockerJudgeModule(): Promise<typeof import('../../src/main/compiler/dockerJudge')> {
  vi.resetModules()
  return await import('../../src/main/compiler/dockerJudge')
}

beforeEach(() => {
  dockerExecuteMock.mockReset()
})

describe('dockerJudge', () => {
  it('Should mark output as passed when actual matches expected', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: true,
      timedOut: false,
      stdout: 'Hello World',
      stderr: '',
      message: 'Program execution success.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/program',
      stdin: '',
      expectedOutput: 'Hello World',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.passed).toBe(true)
    expect(result.actualOutput).toBe('Hello World')
    expect(result.expectedOutput).toBe('Hello World')
  })

  it('Should ignore trailing whitespace when comparing output', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: true,
      timedOut: false,
      stdout: 'Hello World\n',
      stderr: '',
      message: 'Program execution success.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/program',
      stdin: '',
      expectedOutput: 'Hello World',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.passed).toBe(true)
  })

  it('Should normalize line endings when comparing output', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: true,
      timedOut: false,
      stdout: 'Line 1\r\nLine 2',
      stderr: '',
      message: 'Program execution success.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/program',
      stdin: '',
      expectedOutput: 'Line 1\nLine 2',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.passed).toBe(true)
  })

  it('Should mark as failed when output does not match', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: true,
      timedOut: false,
      stdout: 'Goodbye World',
      stderr: '',
      message: 'Program execution success.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/program',
      stdin: '',
      expectedOutput: 'Hello World',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.passed).toBe(false)
    expect(result.actualOutput).toBe('Goodbye World')
  })

  it('Should mark as failed when execution fails', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: false,
      timedOut: false,
      stdout: '',
      stderr: 'Segmentation fault',
      message: 'Program execution failed.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/program',
      stdin: '',
      expectedOutput: 'Hello World',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.passed).toBe(false)
    expect(result.timedOut).toBe(false)
  })

  it('Should mark timedOut when execution times out', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: false,
      timedOut: true,
      stdout: '',
      stderr: '',
      message: 'Program execution timed out.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/program',
      stdin: 'infinite loop input',
      expectedOutput: 'result',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(result.passed).toBe(false)
    expect(result.timedOut).toBe(true)
  })

  it('Should pass stdin to docker execution', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: true,
      timedOut: false,
      stdout: '42',
      stderr: '',
      message: 'Program execution success.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    await dockerJudge({
      executablePath: '/tmp/program',
      stdin: '10\n20\n',
      expectedOutput: '42',
      timeoutMs: 5000,
      language: 'cpp'
    })

    expect(dockerExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stdin: '10\n20\n'
      })
    )
  })

  it('Should handle Python execution', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: true,
      timedOut: false,
      stdout: 'Python result',
      stderr: '',
      message: 'Program execution success.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/main.py',
      stdin: '',
      expectedOutput: 'Python result',
      timeoutMs: 5000,
      language: 'python'
    })

    expect(result.passed).toBe(true)
    expect(dockerExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'python'
      })
    )
  })

  it('Should handle Java execution', async () => {
    dockerExecuteMock.mockResolvedValue({
      success: true,
      timedOut: false,
      stdout: 'Java output',
      stderr: '',
      message: 'Program execution success.'
    })

    const { dockerJudge } = await loadDockerJudgeModule()
    const result = await dockerJudge({
      executablePath: '/tmp/Main.class',
      stdin: '',
      expectedOutput: 'Java output',
      timeoutMs: 5000,
      language: 'java'
    })

    expect(result.passed).toBe(true)
    expect(dockerExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'java'
      })
    )
  })
})
