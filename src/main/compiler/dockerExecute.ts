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

const DOCKER_SANDBOX_ARGS = [
  '--network', 'none', // Disable network access
  '--cap-drop', 'ALL', // Default to no capabilities
  '--security-opt', 'no-new-privileges', // Help prevent privilege escalation
  '--pids-limit', '5' // Prevent fork bombs. For simple programs this is ok.
  // More arguments will be added as needed
]

// This is used when requesting a compiled program to be executed.
interface DockerExecuteRequest {
  executablePath: string
  stdin: string
  timeoutMs: number
  language: Language
}

// This is the result of a program execution request.
interface DockerExecuteResult {
  success: boolean
  timedOut: boolean
  stdout: string
  stderr: string
  message: string
}

/**
 * Executes a compiled program using Docker.
 * @param request - The execution request containing the executable path, stdin, timeout, and language.
 * @returns A promise that resolves to the execution result.
 */
async function dockerExecute(request: DockerExecuteRequest): Promise<DockerExecuteResult> {
  // Retrieve needed info from the request and language config
  const { executablePath, stdin, timeoutMs, language } = request
  // Get the needed config for the chosen language cpp, java, python, etc.
  const config = getLanguage(language)

  // Set up Docker command arguments
  const execDir = dirname(executablePath)
  const execName = basename(executablePath)

  return new Promise((resolve) => {
    const dockerRunArgs = [
      'run',
      '--rm' // Remove the execution container after it exits
    ]

    const dockerMountArgs = [
      '-v',
      `${execDir}:/app:ro`, // Mount compiled program read-only
      '-w',
      '/app', // Execute from the mounted program directory
      '-i' // Keep stdin open so test input can be passed through
    ]

    const programArgs = [config.dockerImage, `/app/${execName}`]

    // Build docker run command
    const dockerArgs = [
      ...dockerRunArgs,
      ...DOCKER_SANDBOX_ARGS,
      ...dockerMountArgs,
      ...programArgs
    ]
    // Spawn the Docker process with the specified command and arguments
    const child = spawn('docker', dockerArgs, { windowsHide: true })

    // Timeout handling
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
