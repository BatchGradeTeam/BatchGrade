/*
  dockerCompile:
    - Compiles source files using Docker
    - Supports multiple programming languages (for the future)
    - Currently focused on C++
*/

import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join, basename, extname } from 'path'
import { DOCKER_RUN_ARGS, DOCKER_SANDBOX_ARGS } from '../../shared/compiler'
import type { DockerCompileRequest, DockerCompileResult } from '../../shared/compiler'
import { getCommonWorkingDirectory } from '../utils/sourceFiles'
import { getLanguage } from './languages'
import type { Language } from './languages'

type DockerCompileOptions = DockerCompileRequest & {
  language?: Language
}

function joinWithExistingSeparator(directory: string, filename: string): string {
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}${filename}`
}

function buildDockerCompileResult(
  result: Omit<DockerCompileResult, 'compileSuccess' | 'compilerPath' | 'sourceFiles'>,
  sourceFiles: string[]
): DockerCompileResult {
  return {
    ...result,
    compileSuccess: result.success,
    compilerPath: 'docker',
    sourceFiles
  }
}

/**
 * Compiles source files using Docker.
 * @param request - The compilation request containing source files and language.
 * @returns A promise that resolves to the compilation result.
 */
async function dockerCompile(request: DockerCompileOptions): Promise<DockerCompileResult> {
  const { sourceFiles, language = 'cpp' } = request
  const config = getLanguage(language)

  const sourceFilesForLang =
    language === 'cpp'
      ? sourceFiles.filter((file) => ['.cpp', '.cc', '.cxx'].includes(extname(file).toLowerCase()))
      : sourceFiles.filter((file) => {
          const ext = file.substring(file.lastIndexOf('.'))
          return config.extensions.includes(ext.toLowerCase())
        })

  // If there are no source files error
  if (sourceFilesForLang.length === 0) {
    return buildDockerCompileResult(
      {
        success: false,
        executablePath: null,
        stdout: '',
        stderr: '',
        message:
          language === 'cpp'
            ? 'No C++ source files found. Select at least one C++ source file.'
            : `No ${config.name} source files found.`
      },
      sourceFiles
    )
  }

  // No need to store it long term so use a temp directory
  const tempDirectory = await mkdtemp(join(tmpdir(), 'batchgrade-docker-'))
  let executableName = 'batchgrade-program'
  if (config.exeExtension) {
    executableName += config.exeExtension
  }
  const executablePath = joinWithExistingSeparator(tempDirectory, executableName)
  const workingDir = getCommonWorkingDirectory(sourceFilesForLang)
  const containerName = `batchgrade-compile-${randomUUID()}`

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
      ...compilerArgs
    ]

    // Spawn the Docker process
    const child = spawn('docker', dockerArgs, { windowsHide: true })

    // Program timeout
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      spawn('docker', ['kill', containerName], { windowsHide: true }).on('error', () => {})
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
        resolve(
          buildDockerCompileResult(
            {
              success: false,
              executablePath: null,
              stdout,
              stderr,
              message: 'Compilation timed out.'
            },
            sourceFiles
          )
        )
      } else if (code === 0) {
        resolve(
          buildDockerCompileResult(
            {
              success: true,
              executablePath,
              stdout,
              stderr,
              message: 'Compilation success.'
            },
            sourceFiles
          )
        )
      } else {
        resolve(
          buildDockerCompileResult(
            {
              success: false,
              executablePath: null,
              stdout,
              stderr: stderr || 'Compilation failed.',
              message: 'Compilation failed.'
            },
            sourceFiles
          )
        )
      }
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      resolve(
        buildDockerCompileResult(
          {
            success: false,
            executablePath: null,
            stdout,
            stderr: error.message,
            message: 'Compilation failed to start.'
          },
          sourceFiles
        )
      )
    })
  })
}

export { dockerCompile, type DockerCompileRequest, type DockerCompileResult }
