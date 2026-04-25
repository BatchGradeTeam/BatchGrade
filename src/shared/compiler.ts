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
  actualOutput: string // The actual output from the judged program
}

// ***********************************************************************
// Docker Detection
export type DockerInstallationInfo = {
  containerId: 'docker'
  status: 'ready' | 'missing' | 'not-running'
  platform: SupportedPlatform
  message: string
  installInstruction: string | null
  path: string | null
  version: string | null
  source: 'auto' | 'manual' | null
}

// ***********************************************************************
// Docker Runtime Arguments
export const DOCKER_RUN_ARGS = [
  'run',
  '--rm' // Remove the container after it exits
]

export const DOCKER_SANDBOX_ARGS = [
  '--network',
  'none', // Disable network access
  '--cap-drop',
  'ALL', // Default to no capabilities
  '--security-opt',
  'no-new-privileges', // Help prevent privilege escalation
  '--pids-limit',
  '5' // Prevent fork bombs. For simple programs this is ok. For more complex programs, this may need to be increased.
  // More arguments will be added as needed
]

// ***********************************************************************
// Docker Compilation
export type DockerCompileRequest = {
  sourceFiles: string[]
}

export type DockerCompileResult = CompileCppResult & {
  success: boolean
}

// ***********************************************************************
// Docker Judge
export type DockerJudgeRequest = {
  executablePath: string
  stdin: string // Inputs
  expectedOutput: string // Some output file i.e. output0.txt
  timeoutMs: number // Alloted execution time
}

export type DockerJudgeResult = {
  passed: boolean
  timedOut: boolean
  expectedOutput: string
  actualOutput: string // The actual output from the judged program
}
