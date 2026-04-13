/*
  dockerExecute:
    - Executes compiled programs using Docker
    - Supports multiple programming languages
    - Currently focused on C++
*/

import { spawn } from 'child_process'
import { dirname, basename } from 'path'

import type { Language } from './languages'
import { getLanguage } from './languages'

interface DockerExecuteRequest {
  executablePath: string
  stdin: string
  timeoutMs: number
  language: Language
}

interface DockerExecuteResult {
  success: boolean
  timedOut: boolean
  stdout: string
  stderr: string
  message: string
}

async function dockerExecute(request: DockerExecuteRequest): Promise<DockerExecuteResult> {
  const { executablePath, stdin, timeoutMs, language } = request
  const config = getLanguage(language)

  const execDir = dirname(executablePath)
  const execName = basename(executablePath)

  return new Promise((resolve) => {
    // Build docker run command
    const dockerArgs = [
      'run',
      '--rm',
      '-v',
      `${execDir}:/app`,
      '-w',
      '/app',
      '-i',
      config.dockerImage,
      `/app/${execName}`
    ]

    const child = spawn('docker', dockerArgs, { windowsHide: true })

    let programTimedOut = false
    const timeout = setTimeout(() => {
      programTimedOut = true
      child.kill()
    }, timeoutMs)

    let stdout = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timeout)

      const message = programTimedOut
        ? 'Program execution timed out.'
        : code === 0
          ? 'Program execution success.'
          : 'Program execution failed.'

      resolve({
        success: !programTimedOut && code === 0,
        timedOut: programTimedOut,
        stdout,
        stderr,
        message
      })
    })

    child.on('error', (error) => {
      clearTimeout(timeout)

      resolve({
        success: false,
        timedOut: programTimedOut,
        stdout,
        stderr: error.message,
        message: 'Program execution failed to start.'
      })
    })

    // Send stdin to the process
    if (stdin.length > 0) {
      child.stdin?.write(stdin)
    }
    child.stdin?.end()
  })
}

export { dockerExecute, type DockerExecuteRequest, type DockerExecuteResult }
