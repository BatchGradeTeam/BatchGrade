/*
  judgeCppFiles:
    - Judges the output of a compiled C++ program against expected output
    - Executes the program and captures its output
    - Compares the program's output to the expected output
    - Returns a judgment result (Pass/Fail)
    - Returns the actual and expected output
*/
import type { JudgeCppRequest, JudgeCppResult } from '../../shared/compiler'
import { executeCppFiles } from './executeCppFiles'

// Helper function to clean and normalize output for comparison
async function cleanOutput(output: string): Promise<string> {
  // Remove extra whitespace and newlines for simplified comparison
 return output.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+$/, '')
}

// Judges the actual output of a program compared to the expected output.
// The result will include whether the program passed, timed out, and the actual and expected outputs.
async function judgeCppFiles(request: JudgeCppRequest): Promise<JudgeCppResult> {
  // Execute the target program and store its output
  const executionResult = await executeCppFiles({
    executablePath: request.executablePath,
    stdin: request.stdin,
    timeoutMs: request.timeoutMs
  })

  // Compare the cleaned output of the actual and expected output
  const outputMatches = (await cleanOutput(executionResult.stdout)) === (await cleanOutput(request.expectedOutput))
  // Check that the program executed successfully
  const passed = executionResult.executionSuccess && outputMatches

  // Return a JudgeCppResult from src/shared/compiler.ts
  return {
    passed,
    timedOut: executionResult.timedOut,
    expectedOutput: request.expectedOutput,
    actualOutput: executionResult.stdout
  }
}

export { judgeCppFiles }
