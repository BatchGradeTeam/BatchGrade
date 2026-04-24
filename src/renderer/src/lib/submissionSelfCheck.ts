import type { SubmissionSelfCheckSummary } from '../../../shared/submission'
import type { OutputComparisonCase } from '../components/OutputDiffPanel'

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ')
}

function toLines(output: string): string[] {
  return output
    .split('\n')
    .map(normalizeLine)
    .filter((line) => line.length > 0)
}

function outputsMatch(expectedOutput: string | null, actualOutput: string | null): boolean | null {
  if (expectedOutput === null || actualOutput === null) {
    return null
  }

  const expectedLines = toLines(expectedOutput)
  const actualLines = toLines(actualOutput)

  if (expectedLines.length !== actualLines.length) {
    return false
  }

  return expectedLines.every((line, index) => line === actualLines[index])
}

export function summarizeComparisonCases(
  comparisonCases: OutputComparisonCase[]
): SubmissionSelfCheckSummary | null {
  if (comparisonCases.length === 0) {
    return null
  }

  const statuses = comparisonCases.map((testCase) =>
    outputsMatch(testCase.expectedOutput, testCase.actualOutput)
  )

  if (statuses.some((status) => status === null)) {
    return null
  }

  const passedCount = statuses.filter((status) => status === true).length
  const totalCount = comparisonCases.length
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0

  return {
    score,
    passedCount,
    totalCount,
    feedback: `${passedCount} / ${totalCount} test cases passed during submission self-check.`,
    completedAt: new Date().toISOString()
  }
}
