// ***********************************************************************
// Detecting Compiler
export type SupportedPlatform = 'win32' | 'darwin' | 'linux' | 'unknown' // TODO: Provide AI assistance citation here - https://chatgpt.com/share/69ba4ac0-5164-800e-a5a5-a253a4ee6de0
export type GccInstallationInfo = {
  compilerId: 'gcc'
  status: 'ready' | 'missing'
  platform: SupportedPlatform
  message: string
  installInstruction: string | null // the user is prompted to install with instructions for their OS if they don't have a compiler installed
  path: string | null
  source: 'auto' | 'manual' | null // User can manually set the path to a GCC installation
}

// ***********************************************************************
// Compilation
export type CompileCppRequest = {
  sourceFiles: string[]
}

export type CompileCppResult = {
  compileSuccess: boolean
  compilerPath: string | null
  executablePath: string | null
  sourceFiles: string[]
  stdout: string
  stderr: string
  message: string
}

// ***********************************************************************
// Execution
export type RunCppRequest = {
  executablePath: string
  stdin: string // Inputs
  timeoutMs: number
}

export type RunCppResult = {
  executionSuccess: boolean
  timedOut: boolean
  stdout: string
  stderr: string
  message: string
}

// ***********************************************************************
// Judge
export type JudgeCppRequest = {
  executablePath: string
  stdin: string // Inputs
  expectedOutput: string // Some output file i.e. output0.txt
  timeoutMs: number // Alloted execution time
}

export type JudgeCppResult = {
  passed: boolean
  timedOut: boolean
  expectedOutput: string
  actualOutput: string  // The actual output from the judged program
}
