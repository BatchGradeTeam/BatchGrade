/*
  compileCppFiles:
    - Keeps only implementation files: .cpp, .cc, .cxx
    - Ignores header files
    - Compiles all source files together
    - Creates a temporary executable
    - Places executable into a temporary folder
    - Returns compilation output
*/
import { execFile } from 'child_process'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

import type { CompileCppRequest, CompileCppResult } from '../../shared/compiler'
import { getCommonWorkingDirectory, getCppImplementationFiles } from '../utils/sourceFiles'

const execFileAsync = promisify(execFile)

async function compileCppFiles(
  compilerPath: string,
  request: CompileCppRequest
): Promise<CompileCppResult> {
  const cppFiles = getCppImplementationFiles(request.sourceFiles)

  if (cppFiles.length == 0) {
    return {
      compileSuccess: false,
      compilerPath,
      executablePath: null,
      sourceFiles: request.sourceFiles,
      stdout: '',
      stderr: '',
      message: 'Select at least one C++ source file.'
    }
  }

  // The compiled program goes into a temporary folder -> the student's project directory with build artifacts
  const tempDirectory = await mkdtemp(join(tmpdir(), 'batchgrade-'))
  let executableName = 'batchgrade-program'
  if (process.platform === 'win32') {
    executableName = 'batchgrade-program.exe'
  }
  const executablePath = join(tempDirectory, executableName)
  const workingDir = getCommonWorkingDirectory(request.sourceFiles)

  try {
    // Compile all implementation files together into one executable
    const compileRes = await execFileAsync(compilerPath, [...cppFiles, '-o', executablePath], {
      cwd: workingDir,
      windowsHide: true,
      timeout: 15000 // 15 seconds
    })

    return {
      compileSuccess: true,
      compilerPath,
      executablePath,
      sourceFiles: request.sourceFiles,
      stdout: compileRes.stdout,
      stderr: compileRes.stderr,
      message: 'Compilation success.'
    }
  } catch (error) {
    const compileError = error as {
      stdout?: string
      stderr?: string
      message: string
    }

    return {
      compileSuccess: false,
      compilerPath,
      executablePath: null,
      sourceFiles: request.sourceFiles,
      stdout: compileError.stdout ?? '',
      stderr: compileError.stderr ?? compileError.message,
      message: 'Compilation failed.'
    }
  }
}

export { compileCppFiles }
