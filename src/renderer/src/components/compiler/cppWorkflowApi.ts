import type {
  CompileCppResult,
  GccInstallationInfo,
  RunCppResult
} from '../../../../shared/compiler'

export function getCompilerStatus(): Promise<GccInstallationInfo> {
  return window.api.compiler.getGccStatus()
}

export function setCompilerPath(path: string): Promise<GccInstallationInfo> {
  return window.api.compiler.setGccPath(path)
}

export function selectCppFiles(): Promise<string[]> {
  return window.api.file.selectCppFiles()
}

export function compileCppFiles(sourceFiles: string[]): Promise<CompileCppResult> {
  return window.api.compiler.compileCpp({
    sourceFiles
  })
}

export function runCompiledProgram(
  executablePath: string,
  stdin: string,
  timeoutMs = 5000
): Promise<RunCppResult> {
  return window.api.compiler.runCompiledProgram({
    executablePath,
    stdin,
    timeoutMs
  })
}