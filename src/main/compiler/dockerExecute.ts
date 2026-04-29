/*
  dockerExecute:
    - Executes compiled programs using Docker
    - Supports multiple programming languages
    - Currently focused on C++
*/

import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, basename, join } from 'path'

import { DOCKER_RUN_ARGS, DOCKER_SANDBOX_ARGS } from '../../shared/compiler'
import type { Language } from './languages'
import { getLanguage } from './languages'

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
  outputDirectory: string
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
  const outputDirectory = await mkdtemp(join(tmpdir(), 'batchgrade-output-'))
  const containerName = `batchgrade-execute-${randomUUID()}`

  return new Promise((resolve) => {
    const dockerMountArgs = [
      '-v',
      `${execDir}:/app:ro`, // Mount compiled program read-only
      '-v',
      `${outputDirectory}:/work`,
      '-w',
      '/work', // Keep student-created output files in a host-controlled folder
      '-i' // Keep stdin open so test input can be passed through
    ]

    const programArgs = [config.dockerImage, `/app/${execName}`]

    // On macOS/Linux, run as the host user so Docker can read the temp executable.
    // Windows does not use POSIX uid/gid values, so skip this Docker option there.
    const hostUserArgs =
      process.platform === 'win32' ||
      typeof process.getuid !== 'function' ||
      typeof process.getgid !== 'function'
        ? []
        : ['--user', `${process.getuid()}:${process.getgid()}`]

    // Build docker run command
    const dockerArgs = [
      ...DOCKER_RUN_ARGS,
      '--name',
      containerName,
      ...DOCKER_SANDBOX_ARGS,
      ...hostUserArgs,
      ...dockerMountArgs,
      ...programArgs
    ]
    // Spawn the Docker process with the specified command and arguments
    const child = spawn('docker', dockerArgs, { windowsHide: true })

    // Timeout handling
    let programTimedOut = false
    const timeout = setTimeout(() => {
      programTimedOut = true
      spawn('docker', ['kill', containerName], { windowsHide: true }).on('error', () => {})
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
        message,
        outputDirectory
      })
    })

    child.on('error', (error) => {
      clearTimeout(timeout)

      resolve({
        success: false,
        timedOut: programTimedOut,
        stdout,
        stderr: error.message,
        message: 'Program execution failed to start.',
        outputDirectory
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
