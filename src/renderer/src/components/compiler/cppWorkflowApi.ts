import type {
  CompileCppResult,
  GccInstallationInfo,
  RunCppResult
} from '../../../../shared/compiler'

// The point of this entire file is to act as a middle layer, this allows us passing items
// from the cppworkflow to  the workflowapi, ultimately we will use these wrappers to do our bidding
// this is essentially how we interact with everything on the machine.

// A promise is a temporary place holder for a value we will get at a later time

// Pretty much want to look at the window.api.xxxx this will essentially let you know what is going
// on in this :)

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
