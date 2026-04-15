import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { dirname, join } from 'node:path'

const { spawnMock } = vi.hoisted(() => {
  return { spawnMock: vi.fn() }
})

vi.mock('child_process', () => {
  return { spawn: spawnMock }
})

type MockChildProcess = EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: {
    write: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
  }
  kill: ReturnType<typeof vi.fn>
}

function createMockChildProcess(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess

  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin = {
    write: vi.fn(),
    end: vi.fn()
  }
  child.kill = vi.fn()

  return child
}

async function loadExecuteModule(): Promise<typeof import('../../src/main/compiler/executeCppFiles')> {
  vi.resetModules()
  return await import('../../src/main/compiler/executeCppFiles')
}

beforeEach(() => {
  vi.useRealTimers()
  spawnMock.mockReset()
})

describe('executeCppFiles', () => {
  it('Executes the program, collects output, and writes stdin', async () => {
    const child = createMockChildProcess()
    const executablePath = join('/tmp', 'batchgrade-program')

    spawnMock.mockReturnValue(child)
    const { executeCppFiles } = await loadExecuteModule()

    const executionPromise = executeCppFiles({
      executablePath,
      stdin: '2 3\n',
      timeoutMs: 5000
    })

    expect(spawnMock).toHaveBeenCalledWith(executablePath, [], {
      cwd: dirname(executablePath),
      windowsHide: true
    })

    expect(child.stdin.write).toHaveBeenCalledWith('2 3\n')
    expect(child.stdin.end).toHaveBeenCalledTimes(1)

    child.stdout.emit('data', Buffer.from('hello '))
    child.stdout.emit('data', 'world')
    child.stderr.emit('data', Buffer.from('warning'))
    child.emit('close', 0)

    await expect(executionPromise).resolves.toEqual({
      executionSuccess: true,
      timedOut: false,
      stdout: 'hello world',
      stderr: 'warning',
      message: 'Program execution success.'
    })
  })

  it('Returns a failed result when the executable exits with a non-zero code', async () => {
    const child = createMockChildProcess()
    spawnMock.mockReturnValue(child)
    const { executeCppFiles } = await loadExecuteModule()

    const executionPromise = executeCppFiles({
      executablePath: join('/tmp', 'batchgrade-program'),
      stdin: '',
      timeoutMs: 5000
    })

    expect(child.stdin.write).not.toHaveBeenCalled()
    expect(child.stdin.end).toHaveBeenCalledTimes(1)

    child.stdout.emit('data', 'partial output')
    child.stderr.emit('data', 'runtime error')
    child.emit('close', 1)

    await expect(executionPromise).resolves.toEqual({
      executionSuccess: false,
      timedOut: false,
      stdout: 'partial output',
      stderr: 'runtime error',
      message: 'Program execution failed.'
    })
  })

  it('Kills the child process and reports a timeout when execution takes too long', async () => {
    vi.useFakeTimers()

    const child = createMockChildProcess()
    spawnMock.mockReturnValue(child)
    const { executeCppFiles } = await loadExecuteModule()

    const executionPromise = executeCppFiles({
      executablePath: join('/tmp', 'batchgrade-program'),
      stdin: '',
      timeoutMs: 200
    })

    await vi.advanceTimersByTimeAsync(200)

    expect(child.kill).toHaveBeenCalledTimes(1)

    child.stdout.emit('data', 'before timeout')
    child.emit('close', null)

    await expect(executionPromise).resolves.toEqual({
      executionSuccess: false,
      timedOut: true,
      stdout: 'before timeout',
      stderr: '',
      message: 'Program execution timed out.'
    })
  })

  it('Returns a clear error if the executable fails to start', async () => {
    const child = createMockChildProcess()
    spawnMock.mockReturnValue(child)
    const { executeCppFiles } = await loadExecuteModule()

    const executionPromise = executeCppFiles({
      executablePath: join('/tmp', 'missing-program'),
      stdin: '',
      timeoutMs: 5000
    })

    child.stdout.emit('data', 'setup output')
    child.emit('error', new Error('spawn ENOENT'))

    await expect(executionPromise).resolves.toEqual({
      executionSuccess: false,
      timedOut: false,
      stdout: 'setup output',
      stderr: 'spawn ENOENT',
      message: 'Program execution failed to start.'
    })
  })
})
