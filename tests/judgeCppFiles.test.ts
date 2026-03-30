import { describe, it, expect, vi, beforeEach } from 'vitest'

const { executeCppFilesMock } = vi.hoisted(() => {
  return {
    executeCppFilesMock: vi.fn()
  }
})

vi.mock('../src/main/compiler/executeCppFiles', () => {
  return {
    executeCppFiles: executeCppFilesMock
  }
})

async function loadJudgeModule(): Promise<typeof import('../src/main/compiler/judgeCppFiles')> {
  vi.resetModules()
  return await import('../src/main/compiler/judgeCppFiles')
}

beforeEach(() => {
  executeCppFilesMock.mockReset()
})

describe('judgeCppFiles', () => {
  it('Returns passed: false when actual output does not match expected output', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: true,
      timedOut: false,
      stdout: 'actual output',
      stderr: '',
      message: 'Execution success.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: 'expected output',
      timeoutMs: 5000
    })

    expect(result).toEqual({
      passed: false,
      timedOut: false,
      expectedOutput: 'expected output',
      actualOutput: 'actual output'
    })
  })

  it('Returns passed: true when actual output matches expected output', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: true,
      timedOut: false,
      stdout: 'hello world',
      stderr: '',
      message: 'Execution success.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: 'hello world',
      timeoutMs: 5000
    })

    expect(result).toEqual({
      passed: true,
      timedOut: false,
      expectedOutput: 'hello world',
      actualOutput: 'hello world'
    })
  })

  it('Returns passed: false when execution fails', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: false,
      timedOut: false,
      stdout: 'partial output',
      stderr: 'runtime error',
      message: 'Execution failed.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: 'expected output',
      timeoutMs: 5000
    })

    expect(result).toEqual({
      passed: false,
      timedOut: false,
      expectedOutput: 'expected output',
      actualOutput: 'partial output'
    })
  })

  it('Returns timedOut: true when execution times out', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: false,
      timedOut: true,
      stdout: '',
      stderr: 'timeout',
      message: 'Execution timed out.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: 'expected output',
      timeoutMs: 1000
    })

    expect(result).toEqual({
      passed: false,
      timedOut: true,
      expectedOutput: 'expected output',
      actualOutput: ''
    })
  })

  it('Normalizes whitespace and line endings in output comparison', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: true,
      timedOut: false,
      stdout: 'hello world  \n  \n',
      stderr: '',
      message: 'Execution success.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: '  hello world  ',
      timeoutMs: 5000
    })

    expect(result.passed).toBe(true)
  })

  it('Normalizes different line endings (CRLF to LF)', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: true,
      timedOut: false,
      stdout: 'line1\r\nline2\r\n',
      stderr: '',
      message: 'Execution success.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: 'line1\nline2\n',
      timeoutMs: 5000
    })

    expect(result.passed).toBe(true)
  })

  it('Normalizes CR line endings to LF', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: true,
      timedOut: false,
      stdout: 'line1\rline2\r',
      stderr: '',
      message: 'Execution success.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: 'line1\nline2\n',
      timeoutMs: 5000
    })

    expect(result.passed).toBe(true)
  })

  it('Removes trailing newlines before comparison', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: true,
      timedOut: false,
      stdout: 'output\n\n\n',
      stderr: '',
      message: 'Execution success.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    const result = await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '',
      expectedOutput: 'output',
      timeoutMs: 5000
    })

    expect(result.passed).toBe(true)
  })

  it('Passes stdin to execution', async () => {
    executeCppFilesMock.mockResolvedValue({
      executionSuccess: true,
      timedOut: false,
      stdout: '5',
      stderr: '',
      message: 'Execution success.'
    })

    const { judgeCppFiles } = await loadJudgeModule()
    await judgeCppFiles({
      executablePath: '/tmp/test',
      stdin: '2 3',
      expectedOutput: '5',
      timeoutMs: 5000
    })

    expect(executeCppFilesMock).toHaveBeenCalledWith({
      executablePath: '/tmp/test',
      stdin: '2 3',
      timeoutMs: 5000
    })
  })
})
