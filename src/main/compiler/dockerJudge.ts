/*
  dockerJudge:
    - Judges program output using Docker execution
    - Supports multiple programming languages
    - Currently focused on C++
*/

import type { Language } from './languages'
import { dockerExecute } from './dockerExecute'

interface DockerJudgeRequest {
  executablePath: string
  stdin: string
  expectedOutput: string
  timeoutMs: number
  language: Language
}

interface DockerJudgeResult {
  passed: boolean
  timedOut: boolean
  expectedOutput: string
  actualOutput: string
}

// Helper function to clean and normalize output for comparison
async function cleanOutput(output: string): Promise<string> {
  return output.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+$/, '')
}

async function dockerJudge(request: DockerJudgeRequest): Promise<DockerJudgeResult> {
  const { executablePath, stdin, expectedOutput, timeoutMs, language } = request

  // Execute the program
  const executionResult = await dockerExecute({
    executablePath,
    stdin,
    timeoutMs,
    language
  })

  // Compare cleaned outputs
  const outputMatches =
    (await cleanOutput(executionResult.stdout)) === (await cleanOutput(expectedOutput))

  // Program must execute successfully and output must match
  const passed = executionResult.success && outputMatches

  return {
    passed,
    timedOut: executionResult.timedOut,
    expectedOutput,
    actualOutput: executionResult.stdout
  }
}

export { dockerJudge, type DockerJudgeRequest, type DockerJudgeResult }
