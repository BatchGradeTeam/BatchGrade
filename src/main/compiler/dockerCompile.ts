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
import { getCommonWorkingDirectory } from '../utils/sourceFiles'
import { getLanguage } from './languages'
import type { Language } from './languages'

interface DockerCompileRequest {
  sourceFiles: string[]
  language: Language
}

interface DockerCompileResult {
  success: boolean
  executablePath: string | null
  stdout: string
  stderr: string
  message: string
}

async function dockerCompile(request: DockerCompileRequest): Promise<DockerCompileResult> {
  const { sourceFiles, language } = request
  const config = getLanguage(language)

  // Filter files by language extensions
  const sourceFilesForLang = sourceFiles.filter((file) => {
    const ext = file.substring(file.lastIndexOf('.'))
    return config.extensions.includes(ext.toLowerCase())
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

    // Build docker run command
    const dockerArgs = [
      'run',
      '--rm',
      '-v',
      `${workingDir}:/src`,
      '-v',
      `${tempDirectory}:/out`,
      '-w',
      '/src',
      config.dockerImage,
      config.compiler,
      ...relativeFiles,
      '-o',
      `/out/${executableName}`
    ]

    const child = spawn('docker', dockerArgs, { windowsHide: true })

    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, 60000)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timeout)

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
