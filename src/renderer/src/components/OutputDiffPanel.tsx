/**
 * OutputDiffPanel.tsx
 *
 * Description:
 * FR-5 Expected Output Display
 *
 * It performs a line-by-line diff between the instructor's expected output
 * (fetched from the selected assignment via FR-9/FR-11) and the student's
 * actual program output (from FR-4).
 *
 * Whitespace is normalized before comparison so students are not penalized
 * for trailing spaces or differing internal spacing.
 *
 * Color scheme:
 *  - White  : line matches expected output
 *  - Red    : line is in expected output but missing or wrong in student output
 *  - Green  : extra line in student output not present in expected output
 *
 * Students cannot supply their own expected output only instructors define it
 * via FR-9/FR-11.
 */
import { useMemo, useState } from 'react'
import type { Assignment } from '../../../shared/types'
import '../assets/styles/OutputDiffPanel.css'

type DiffLineType = 'match' | 'missing' | 'extra'

type DiffLine = {
  type: DiffLineType
  value: string
}

type TestCaseStatus = 'pending' | 'passed' | 'failed'

type OutputDiffPanelProps = {
  /** FR-4: The student's actual program stdout from running their compiled code. */
  actualOutput: string | null
  /** FR-5: The instructor's expected output, fetched from the assignment record. */
  expectedOutput: string | null
  /** List of all available assignments for the dropdown. */
  assignments: Assignment[]
  /** Currently selected assignment UUID. */
  selectedAssignmentId: string
  /** Called when the student changes the assignment dropdown. */
  onAssignmentChange: (uuid: string) => void
  /** One or more assignment test-case runs to display as tabs. */
  comparisonCases?: OutputComparisonCase[]
  /** Whether saved test cases are currently being executed. */
  isRunningTestCases?: boolean
  /** Error from loading or running test cases. */
  testCaseError?: string | null
}

export type OutputComparisonCase = {
  id: string
  label: string
  inputLabel: string | null
  actualOutput: string | null
  expectedOutput: string | null
  executionMessage?: string
  executionSuccess?: boolean
  timedOut?: boolean
}

/**
 * @brief Normalizes a single line for whitespace-insensitive comparison.
 *
 * @details
 * Trims leading/trailing whitespace and collapses all internal whitespace
 * sequences to a single space. Students are not penalized for spacing differences.
 *
 * @param line Raw line of text.
 * @return Normalized line string.
 */
function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ')
}

/**
 * @brief Splits a raw output string into non empty normalized lines.
 *
 * @param output Raw multiline string.
 * @return Array of normalized, non empty lines.
 */
function toLines(output: string): string[] {
  return output
    .split('\n')
    .map(normalizeLine)
    .filter((line) => line.length > 0)
}

/**
 * @brief Computes a line by line diff using the LCS alg
 *
 * @details
 * Line types in the result:
 *  - 'match'   : line appears in both expected and actual (normalized equal)
 *  - 'missing' : line is in expected but absent/wrong in actual (shown in red)
 *  - 'extra'   : line is in actual but not in expected (shown in green)
 *
 * @param expected Normalized expected output lines.
 * @param actual   Normalized actual output lines.
 * @return Ordered array of DiffLine objects.
 */
function computeDiff(expected: string[], actual: string[]): DiffLine[] {
  const m = expected.length
  const n = actual.length

  // Build LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (expected[i - 1] === actual[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff result
  const result: DiffLine[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1]) {
      result.unshift({ type: 'match', value: expected[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'extra', value: actual[j - 1] })
      j--
    } else {
      result.unshift({ type: 'missing', value: expected[i - 1] })
      i--
    }
  }

  return result
}

function lineClass(type: DiffLineType): string {
  switch (type) {
    case 'missing':
      return 'output-diff-line output-diff-line-missing'
    case 'extra':
      return 'output-diff-line output-diff-line-extra'
    case 'match':
    default:
      return 'output-diff-line output-diff-line-match'
  }
}

function linePrefix(type: DiffLineType): string {
  switch (type) {
    case 'missing':
      return '− '
    case 'extra':
      return '+ '
    case 'match':
    default:
      return '  '
  }
}

function getComparisonCaseStatus(testCase: OutputComparisonCase): TestCaseStatus {
  if (testCase.actualOutput === null || testCase.expectedOutput === null) {
    return 'pending'
  }

  const diff = computeDiff(toLines(testCase.expectedOutput), toLines(testCase.actualOutput))
  return diff.every((line) => line.type === 'match') ? 'passed' : 'failed'
}

function testCaseTabClass(status: TestCaseStatus, isActive: boolean): string {
  const activeClass = isActive ? ' is-active' : ''
  return `output-case-tab compact-button output-case-tab-${status}${activeClass}`
}

/**
 * @brief Side by side diff of instructor expected output vs student actual output.
 *
 * @details
 * The instructor's stored expected output (from the selected assignment) is used
 * as the reference. Students cannot supply their own expected output file.
 * Whitespace differences are ignored in the comparison.
 *
 * @param actualOutput   The student's program stdout
 * @param expectedOutput The instructor's stored expected output
 * @param assignments   All available assignments for the dropdown
 * @param selectedAssignmentId Currently selected assignment UUID
 * @param onAssignmentChange  Called when student changes the dropdown
 * @return React JSX element for the output diff panel.
 */
export function OutputDiffPanel({
  actualOutput,
  expectedOutput,
  assignments,
  selectedAssignmentId,
  onAssignmentChange,
  comparisonCases = [],
  isRunningTestCases = false,
  testCaseError = null
}: OutputDiffPanelProps): React.JSX.Element {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const activeCaseIndex = Math.max(
    0,
    comparisonCases.findIndex((testCase) => testCase.id === activeCaseId)
  )
  const activeCase = comparisonCases[activeCaseIndex] ?? null
  const displayedActualOutput = activeCase ? activeCase.actualOutput : actualOutput
  const displayedExpectedOutput = activeCase ? activeCase.expectedOutput : expectedOutput

  /**
   * @brief Memoized diff, recomputed only when inputs change.
   */
  const diffLines = useMemo<DiffLine[]>(() => {
    if (!displayedExpectedOutput || !displayedActualOutput) return []
    return computeDiff(toLines(displayedExpectedOutput), toLines(displayedActualOutput))
  }, [displayedExpectedOutput, displayedActualOutput])

  const matchCount = diffLines.filter((l) => l.type === 'match').length
  const missingCount = diffLines.filter((l) => l.type === 'missing').length
  const extraCount = diffLines.filter((l) => l.type === 'extra').length
  const totalExpected = diffLines.filter((l) => l.type !== 'extra').length

  const isReady = displayedExpectedOutput !== null && displayedActualOutput !== null
  const hasPerfectMatch = missingCount === 0 && extraCount === 0

  return (
    <section className="output-diff-panel panel-shell">
      <h2 className="output-diff-title">Output Comparison</h2>
      <p className="output-diff-description">
        Your code is run against the assignment&apos;s test cases and compared line-by-line.
        Whitespace differences are ignored.
      </p>

      <div className="output-diff-assignment-group">
        <label className="output-diff-assignment-label">Assignment</label>
        <select
          value={selectedAssignmentId}
          onChange={(e) => onAssignmentChange(e.target.value)}
          className="panel-input output-diff-assignment-select"
        >
          {assignments.length === 0 && <option value="">No assignments available</option>}
          {assignments.map((a) => (
            <option key={a.uuid} value={a.uuid}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {comparisonCases.length > 0 && (
        <div className="output-diff-tabs">
          {comparisonCases.map((testCase, index) => {
            const isActive = index === activeCaseIndex
            const status = getComparisonCaseStatus(testCase)

            return (
              <button
                key={testCase.id}
                type="button"
                onClick={() => setActiveCaseId(testCase.id)}
                className={testCaseTabClass(status, isActive)}
                title={`${testCase.label}: ${status}`}
              >
                {testCase.label}
              </button>
            )
          })}
        </div>
      )}

      {activeCase && (
        <div className="output-diff-active-case">
          <p>Input: {activeCase.inputLabel ?? 'No input'}</p>
          {activeCase.executionMessage && <p>Run result: {activeCase.executionMessage}</p>}
          {activeCase.timedOut && <p className="output-diff-active-case-timeout">Timed out.</p>}
        </div>
      )}

      {isRunningTestCases && (
        <div className="output-diff-banner output-diff-banner-running">
          Running assignment test cases...
        </div>
      )}

      {testCaseError && (
        <div className="output-diff-banner output-diff-banner-error">{testCaseError}</div>
      )}

      <div className="output-diff-legend">
        <span className="output-diff-legend-item output-diff-legend-item-match">
          <span className="output-diff-legend-swatch output-diff-legend-swatch-match" />
          Match
        </span>
        <span className="output-diff-legend-item output-diff-legend-item-missing">
          <span className="output-diff-legend-swatch output-diff-legend-swatch-missing" />
          Missing / Wrong Output
        </span>
        <span className="output-diff-legend-item output-diff-legend-item-extra">
          <span className="output-diff-legend-swatch output-diff-legend-swatch-extra" />
          Superfluous Output
        </span>
      </div>

      {!isReady && (
        <div className="output-diff-info-box">
          {displayedActualOutput === null && displayedExpectedOutput === null && (
            <p>Select an assignment and run your program to see the output comparison.</p>
          )}
          {displayedActualOutput === null && displayedExpectedOutput !== null && (
            <p>Compile your code to run the assignment test cases.</p>
          )}
          {displayedActualOutput !== null && displayedExpectedOutput === null && (
            <p>Select an assignment above to load the expected output for comparison.</p>
          )}
        </div>
      )}

      {isReady && diffLines.length > 0 && (
        <div
          className={`output-diff-summary-banner ${
            hasPerfectMatch
              ? 'output-diff-summary-banner-success'
              : 'output-diff-summary-banner-failed'
          }`}
        >
          {hasPerfectMatch ? (
            <p className="output-diff-summary-text output-diff-summary-text-success">
              ✓ All {matchCount} line{matchCount === 1 ? '' : 's'} match. Output is correct.
            </p>
          ) : (
            <p className="output-diff-summary-text output-diff-summary-text-failed">
              {matchCount} / {totalExpected} line{totalExpected === 1 ? '' : 's'} matched.
              {missingCount > 0 && ` ${missingCount} missing.`}
              {extraCount > 0 && ` ${extraCount} extra.`}
            </p>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------
          Side-by-side diff
      ---------------------------------------------------------------- */}
      {isReady && (
        <div className="output-diff-grid">
          {/* Actual output column */}
          <div className="output-diff-column">
            <h4 className="output-diff-column-title">
              Your Output <span className="output-diff-column-subtitle">(actual)</span>
            </h4>
            <pre className="output-diff-pre">
              {diffLines.map((line, idx) =>
                line.type !== 'missing' ? (
                  <div key={idx} className={lineClass(line.type)}>
                    {linePrefix(line.type)}
                    {line.value}
                  </div>
                ) : (
                  /* Transparent placeholder to keep rows aligned with actual column */
                  <div key={idx} className="output-diff-line output-diff-line-placeholder">
                    {'  —'}
                  </div>
                )
              )}
            </pre>
          </div>

          {/* Expected output column */}
          <div className="output-diff-column">
            <h4 className="output-diff-column-title">
              Expected Output <span className="output-diff-column-subtitle">(instructor)</span>
            </h4>
            <pre className="output-diff-pre">
              {diffLines.map((line, idx) =>
                line.type !== 'extra' ? (
                  <div key={idx} className={lineClass(line.type)}>
                    {linePrefix(line.type === 'match' ? 'match' : 'missing')}
                    {line.value}
                  </div>
                ) : (
                  /* Transparent placeholder to keep rows aligned with expected column */
                  <div key={idx} className="output-diff-line output-diff-line-placeholder">
                    {'  —'}
                  </div>
                )
              )}
            </pre>
          </div>
        </div>
      )}
    </section>
  )
}

export default OutputDiffPanel
