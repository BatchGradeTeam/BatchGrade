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
  onToggle: () => void
}

/**
 * StudentGradingCard Component
 *
 * @param student - Student submission data
 * @param isExpanded - Whether to show grading details
 */
export function StudentGradingCard({
  student,
  isExpanded,
  onToggle
}: StudentGradingCardProps): React.JSX.Element {
  return (
    <div
      style={{
        border: isExpanded ? '2px solid #22c55e' : '1px solid gray',
        backgroundColor: '#1f1f1f',
        padding: '12px'
      }}
    >
      <div
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px'
        }}
      >
        <h3 style={{ marginBottom: '8px' }}>
          {student.studentName} {student.status === 'done' ? '✅' : ''}
        </h3>

        <span style={{ fontSize: '18px', marginLeft: '12px' }}>{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <>
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '14px' }}>Student ID: {student.studentId}</p>
            <p style={{ fontSize: '14px' }}>Folder: {student.folderName}</p>
            <p style={{ fontSize: '14px' }}>Status: {student.status}</p>

            <p style={{ fontSize: '14px', marginTop: '10px' }}>C++ Files:</p>
            <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
              {student.fileNames.map((fileName) => (
                <li key={fileName} style={{ fontSize: '14px', overflowWrap: 'anywhere' }}>
                  {fileName}
                </li>
              ))}
            </ul>
          </div>

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
        </>
      )}
    </div>
  )
}
