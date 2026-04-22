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

function lineStyle(type: DiffLineType): React.CSSProperties {
  switch (type) {
    case 'missing':
      return { backgroundColor: '#3b0000', color: '#ff6b6b', borderLeft: '3px solid #ff4444' }
    case 'extra':
      return { backgroundColor: '#002200', color: '#69db7c', borderLeft: '3px solid #40c057' }
    case 'match':
    default:
      return {
        backgroundColor: 'transparent',
        color: '#e0e0e0',
        borderLeft: '3px solid transparent'
      }
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

function testCaseTabStyle(status: TestCaseStatus, isActive: boolean): React.CSSProperties {
  const palette: Record<
    TestCaseStatus,
    {
      backgroundColor: string
      borderColor: string
      color: string
    }
  > = {
    passed: {
      backgroundColor: '#15803d',
      borderColor: '#22c55e',
      color: '#f0fdf4'
    },
    failed: {
      backgroundColor: '#991b1b',
      borderColor: '#ef4444',
      color: '#fef2f2'
    },
    pending: {
      backgroundColor: '#374151',
      borderColor: '#6b7280',
      color: '#f9fafb'
    }
  }

  return {
    ...palette[status],
    border: `1px solid ${palette[status].borderColor}`,
    opacity: isActive ? 1 : 0.78,
    boxShadow: isActive ? `0 0 0 2px ${palette[status].borderColor}55` : 'none'
  }
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

  return (
    <div
      style={{
        border: '1px solid gray',
        padding: '1rem',
        marginTop: '1rem',
        backgroundColor: '#2b2b2b'
      }}
    >
      <h2 style={{ marginBottom: '0.5rem' }}>Output Comparison</h2>
      <p style={{ marginBottom: '1rem', fontSize: '14px', color: '#ccc' }}>
        Your code is run against the assignment&apos;s test cases and compared line-by-line.
        Whitespace differences are ignored.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{ display: 'block', marginBottom: '0.4rem', fontSize: '14px', color: '#ccc' }}
        >
          Assignment
        </label>
        <select
          value={selectedAssignmentId}
          onChange={(e) => onAssignmentChange(e.target.value)}
          className="panel-input"
          style={{ maxWidth: '480px' }}
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {comparisonCases.map((testCase, index) => {
            const isActive = index === activeCaseIndex
            const status = getComparisonCaseStatus(testCase)

            return (
              <button
                key={testCase.id}
                type="button"
                onClick={() => setActiveCaseId(testCase.id)}
                className="compact-button output-case-tab"
                style={testCaseTabStyle(status, isActive)}
                title={`${testCase.label}: ${status}`}
              >
                {testCase.label}
              </button>
            )
          })}
        </div>
      )}

      {activeCase && (
        <div
          style={{
            border: '1px solid #444',
            padding: '10px',
            marginBottom: '1rem',
            backgroundColor: '#1f1f1f',
            fontSize: '13px'
          }}
        >
          <p>Input: {activeCase.inputLabel ?? 'No input'}</p>
          {activeCase.executionMessage && <p>Run result: {activeCase.executionMessage}</p>}
          {activeCase.timedOut && <p style={{ color: '#ff6b6b' }}>Timed out.</p>}
        </div>
      )}

      {isRunningTestCases && (
        <div
          style={{
            border: '1px solid #2f6690',
            padding: '10px',
            marginBottom: '1rem',
            backgroundColor: '#102536',
            color: '#81c3d7',
            fontSize: '14px'
          }}
        >
          Running assignment test cases...
        </div>
      )}

      {testCaseError && (
        <div
          style={{
            border: '1px solid #ff4444',
            padding: '10px',
            marginBottom: '1rem',
            backgroundColor: '#3b0000',
            color: '#ff6b6b',
            fontSize: '14px'
          }}
        >
          {testCaseError}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '1rem',
          fontSize: '13px',
          flexWrap: 'wrap'
        }}
      >
        <span style={{ color: '#e0e0e0' }}>
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              backgroundColor: '#555',
              marginRight: '6px',
              verticalAlign: 'middle'
            }}
          />
          Match
        </span>
        <span style={{ color: '#ff6b6b' }}>
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              backgroundColor: '#3b0000',
              border: '1px solid #ff4444',
              marginRight: '6px',
              verticalAlign: 'middle'
            }}
          />
          Missing / Wrong Output
        </span>
        <span style={{ color: '#69db7c' }}>
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              backgroundColor: '#002200',
              border: '1px solid #40c057',
              marginRight: '6px',
              verticalAlign: 'middle'
            }}
          />
          Superfluous Output
        </span>
      </div>

      {!isReady && (
        <div
          style={{
            border: '1px solid #444',
            padding: '12px',
            backgroundColor: '#1f1f1f',
            color: '#aaa',
            fontSize: '14px'
          }}
        >
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
          style={{
            border: `1px solid ${missingCount === 0 && extraCount === 0 ? '#2f9e44' : '#c92a2a'}`,
            backgroundColor: missingCount === 0 && extraCount === 0 ? '#1a3a1a' : '#3b0000',
            padding: '10px',
            marginBottom: '1rem',
            fontSize: '14px'
          }}
        >
          {missingCount === 0 && extraCount === 0 ? (
            <p style={{ color: '#69db7c' }}>
              ✓ All {matchCount} line{matchCount === 1 ? '' : 's'} match. Output is correct.
            </p>
          ) : (
            <p style={{ color: '#ff6b6b' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Actual output column */}
          <div>
            <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>
              Your Output{' '}
              <span style={{ fontWeight: 'normal', color: '#aaa', fontSize: '13px' }}>
                (actual)
              </span>
            </h4>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                backgroundColor: '#111',
                border: '1px solid #444',
                padding: 0,
                margin: 0,
                maxHeight: '320px',
                overflowY: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            >
              {diffLines.map((line, idx) =>
                line.type !== 'missing' ? (
                  <div key={idx} style={{ ...lineStyle(line.type), padding: '2px 8px' }}>
                    {linePrefix(line.type)}
                    {line.value}
                  </div>
                ) : (
                  /* Transparent placeholder to keep rows aligned with actual column */
                  <div
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      color: 'transparent',
                      borderLeft: '3px solid transparent'
                    }}
                  >
                    {'  —'}
                  </div>
                )
              )}
            </pre>
          </div>

          {/* Expected output column */}
          <div>
            <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>
              Expected Output{' '}
              <span style={{ fontWeight: 'normal', color: '#aaa', fontSize: '13px' }}>
                (instructor)
              </span>
            </h4>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                backgroundColor: '#111',
                border: '1px solid #444',
                padding: 0,
                margin: 0,
                maxHeight: '320px',
                overflowY: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            >
              {diffLines.map((line, idx) =>
                line.type !== 'extra' ? (
                  <div key={idx} style={{ ...lineStyle(line.type), padding: '2px 8px' }}>
                    {linePrefix(line.type === 'match' ? 'match' : 'missing')}
                    {line.value}
                  </div>
                ) : (
                  /* Transparent placeholder to keep rows aligned with expected column */
                  <div
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      color: 'transparent',
                      borderLeft: '3px solid transparent'
                    }}
                  >
                    {'  —'}
                  </div>
                )
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default OutputDiffPanel
