/**
 * @file: StudentGradingCard.tsx
 * @description:Displays a single student in the Grading+ batch queue.
 * Shows basic info for all students and detailed grading
 * results only when expanded.
 */

import type { BatchStudentSubmission } from '../../../../shared/batchGrading'

type StudentGradingCardProps = {
  student: BatchStudentSubmission
  isExpanded: boolean
}

/**
 * StudentGradingCard Component
 *
 * @param student - Student submission data
 * @param isExpanded - Whether to show grading details
 */
export function StudentGradingCard({
  student,
  isExpanded
}: StudentGradingCardProps): React.JSX.Element {
  return (
    <div
      key={student.filePath}
      style={{
        border: isExpanded ? '2px solid #22c55e' : '1px solid gray',
        backgroundColor: '#1f1f1f',
        padding: '12px'
      }}
    >
      <h3 style={{ marginBottom: '8px' }}>
        {student.studentName} {student.status === 'done' ? '✅' : ''}
      </h3>

      <p style={{ fontSize: '14px' }}>Student ID: {student.studentId}</p>
      <p style={{ fontSize: '14px', overflowWrap: 'anywhere' }}>File: {student.fileName}</p>
      <p style={{ fontSize: '14px' }}>Status: {student.status}</p>

      {isExpanded && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            border: '1px solid #4b5563',
            backgroundColor: '#111827'
          }}
        >
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
            Grading Details
          </p>

          <p style={{ fontSize: '14px', marginBottom: '8px' }}>
            {student.status === 'grading' && 'Compiling submission...'}
            {student.status === 'judging' && 'Running judge test cases...'}
            {student.status === 'done' && 'Grading complete.'}
            {student.status === 'failed' && 'Grading failed.'}
            {student.status === 'pending' && 'Waiting to be graded.'}
          </p>

          {student.compileResult && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '14px' }}>
                Compile Success: {student.compileResult.compileSuccess ? 'Yes' : 'No'}
              </p>
            </div>
          )}

          {student.totalCount > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '14px' }}>
                Judge Result: {student.passedCount} / {student.totalCount} passed
              </p>
            </div>
          )}

          {student.errorMessage && (
            <p style={{ marginTop: '10px', color: '#f87171' }}>Error: {student.errorMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}
