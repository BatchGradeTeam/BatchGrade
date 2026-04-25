/*
  dockerCompile:
    - Compiles source files using Docker
    - Supports multiple programming languages (for the future)
    - Currently focused on C++
*/

import { spawn } from 'child_process'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join, basename } from 'path'
import { DOCKER_RUN_ARGS, DOCKER_SANDBOX_ARGS } from '../../shared/compiler'
import { getCommonWorkingDirectory } from '../utils/sourceFiles'
import { getLanguage } from './languages'
import type { Language } from './languages'

// This is used when requesting a file to be compiled.
interface DockerCompileRequest {
  sourceFiles: string[]
  language: Language
}

// This is the result of a compilation request.
interface DockerCompileResult {
  success: boolean
  executablePath: string | null
  stdout: string
  stderr: string
  message: string
}

/**
 * Compiles source files using Docker.
 * @param request - The compilation request containing source files and language.
 * @returns A promise that resolves to the compilation result.
 */
async function dockerCompile(request: DockerCompileRequest): Promise<DockerCompileResult> {
  const { sourceFiles, language } = request
  const config = getLanguage(language)
  const compileExtensions = language === 'cpp' ? ['.cpp', '.cc', '.cxx', '.cp'] : config.extensions

  // Filter files by language extensions
  const sourceFilesForLang = sourceFiles.filter((file) => {
    const ext = file.substring(file.lastIndexOf('.'))
    return compileExtensions.includes(ext.toLowerCase())
  })

  // If there are no source files error
  if (sourceFilesForLang.length === 0) {
    return {
      success: false,
      executablePath: null,
      stdout: '',
      stderr: '',
      message: `No ${config.name} source files found.`
    }
  }

  // No need to store it long term so use a temp directory
  const tempDirectory = await mkdtemp(join(tmpdir(), 'batchgrade-docker-'))
  let executableName = 'batchgrade-program'
  if (config.exeExtension) {
    executableName += config.exeExtension
  }
  const executablePath = join(tempDirectory, executableName)
  const workingDir = getCommonWorkingDirectory(sourceFilesForLang)

  // Get relative paths for compilation
  const relativeFiles = sourceFilesForLang.map((file) => {
    const relative = file.startsWith(workingDir)
      ? file.slice(workingDir.length).replace(/^[\\/]/, '')
      : basename(file)
    return relative
  })

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''

    const dockerMountArgs = [
      '-v',
      `${workingDir}:/src:ro`, // Mount source files read-only
      '-v',
      `${tempDirectory}:/out`, // Keep compiled output in a temporary host folder
      '-w',
      '/src' // Compile from the mounted source directory
    ]

    const compilerArgs = [
      config.dockerImage,
      config.compiler,
      ...relativeFiles,
      '-o',
      `/out/${executableName}`
    ]

    // On macOS/Linux, run as the host user so Docker can write to the temp output folder.
    // Windows does not use POSIX uid/gid values, so skip this Docker option there.
    const hostUserArgs =
      process.platform === 'win32' ? [] : ['--user', `${process.getuid!()}:${process.getgid!()}`]

    // Build docker run command
    const dockerArgs = [
      ...DOCKER_RUN_ARGS,
      ...DOCKER_SANDBOX_ARGS,
      ...hostUserArgs,
      ...dockerMountArgs,
      ...compilerArgs
    ]

    // Spawn the Docker process
    const child = spawn('docker', dockerArgs, { windowsHide: true })

    // Program timeout
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, 60000)

    // Store the output from stdout
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    // Store the output from stderr
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      // Determine compilation result timed out, success, or failed
      if (timedOut) {
        resolve({
          success: false,
          executablePath: null,
          stdout,
          stderr,
          message: 'Compilation timed out.'
        })
      } else if (code === 0) {
        resolve({
          success: true,
          executablePath,
          stdout,
          stderr,
          message: 'Compilation success.'
        })
      } else {
        resolve({
          success: false,
          executablePath: null,
          stdout,
          stderr: stderr || 'Compilation failed.',
          message: 'Compilation failed.'
        })
      }
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      resolve({
        success: false,
        executablePath: null,
        stdout,
        stderr: error.message,
        message: 'Compilation failed to start.'
      })
    })
  })
}

export { dockerCompile, type DockerCompileRequest, type DockerCompileResult }
