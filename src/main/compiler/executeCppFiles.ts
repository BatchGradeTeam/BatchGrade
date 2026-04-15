/*
  executeCppFiles:
    - Executes a compiled C++ executable
    - Runs the program in its own directory
    - Captures stdout and stderr output
    - Supports a configurable timeout to stop long-running programs
    - Kills the process if it exceeds the timeout
    - Returns execution results (success flag, timeout status, output, message)
*/
import { spawn } from 'child_process'
import { dirname } from 'path'

import type { RunCppRequest, RunCppResult } from '../../shared/compiler'

async function executeCppFiles(request: RunCppRequest): Promise<RunCppResult> {
  return new Promise((resolve) => {
    const child = spawn(request.executablePath, [], {
      cwd: dirname(request.executablePath),
      windowsHide: true
    })

    let programTimedOut = false
    // Stop programs that take forever
    const timeout = setTimeout(() => {
      programTimedOut = true
      child.kill()
    }, request.timeoutMs)

    // Listen for stdout
    let stdout = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    // Listen for stderr
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    // This event fires when the process exists
    child.on('close', (code) => {
      clearTimeout(timeout)

      // Determine program execution result
      let programMessage = ''
      if (programTimedOut) {
        programMessage = 'Program execution timed out.'
      } else if (code == 0) {
        programMessage = 'Program execution success.'
      } else {
        programMessage = 'Program execution failed.'
      }

      resolve({
        executionSuccess: !programTimedOut && code === 0,
        timedOut: programTimedOut,
        stdout,
        stderr,
        message: programMessage
      })
    })

    // If the executable cannot be started at all, return a clear runtime error.
    child.on('error', (error) => {
      clearTimeout(timeout)

      resolve({
        executionSuccess: false,
        timedOut: programTimedOut,
        stdout,
        stderr: error.message,
        message: 'Program execution failed to start.'
      })
    })

    // If there's input, send to the child process, then close stdin
    if (request.stdin.length > 0) {
      child.stdin.write(request.stdin)
    }
    child.stdin.end()
  })
}

export { executeCppFiles }
