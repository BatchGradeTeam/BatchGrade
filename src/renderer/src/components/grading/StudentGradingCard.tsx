/**
 * @file: StudentGradingCard.tsx
 * @description: Displays a single student in the Grading+ batch queue.
 * Shows basic info for all students and detailed grading
 * results only when expanded.
 */

import type { BatchStudentSubmission } from '../../../../shared/batchGrading'
import '../../assets/styles/StudentGradingCard.css'

/**
 * Props for StudentGradingCard component.
 *
 * @param student - Student submission data
 * @param isExpanded - Whether the card is expanded
 * @param onToggle - Toggle expand/collapse
 * @param onGrade - Trigger grading for this student
 * @param isBatchGrading - Whether batch grading is currently running
 */
type StudentGradingCardProps = {
  student: BatchStudentSubmission
  isExpanded: boolean
  onToggle: () => void
  onGrade: () => void
  isBatchGrading: boolean
}

/**
 * StudentGradingCard Component
 *
 * Displays:
 * - Student summary (always visible)
 * - Grading details (only when expanded)
 * - Per-student grading action button
 */
export function StudentGradingCard({
  student,
  isExpanded,
  onToggle,
  onGrade,
  isBatchGrading
}: StudentGradingCardProps): React.JSX.Element {
  /**
   * Determines the label for the Grade button based on status.
   */
  function getGradeButtonLabel(): string {
    if (student.status === 'grading' || student.status === 'judging') {
      return 'Running...'
    }

    if (student.status === 'done') {
      return 'Done'
    }

    if (student.status === 'failed') {
      return 'Retry'
    }

    return 'Grade'
  }

  /**
   * Determines whether the Grade button should be disabled.
   */
  const disableGradeButton =
    isBatchGrading ||
    student.status === 'grading' ||
    student.status === 'judging' ||
    student.status === 'done'

  const cardClassName = `student-grading-card${isExpanded ? ' student-grading-card-expanded' : ''}`

  return (
    <div className={cardClassName}>
      {/* Header section (clickable to expand/collapse) */}
      <div onClick={onToggle} className="student-grading-card-header">
        {/* Student name and completion indicator */}
        <div className="student-grading-card-title-wrap">
          <h3 className="student-grading-card-title">
            {student.studentName} {student.status === 'done' ? '✅' : ''}
          </h3>
        </div>

        {/* Action button + expand/collapse arrow */}
        <div className="student-grading-card-actions">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onGrade()
            }}
            disabled={disableGradeButton}
            className={disableGradeButton ? 'cancel-button' : 'primary-button'}
          >
            {getGradeButtonLabel()}
          </button>

          {/* Expand/collapse indicator */}
          <span className="student-grading-card-toggle">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* Expanded content (details) */}
      {isExpanded && (
        <>
          {/* Basic student information */}
          <div className="student-grading-card-meta">
            <p>Student ID: {student.studentId}</p>
            <p>Folder: {student.folderName}</p>
            <p>Status: {student.status}</p>

            {/* List of submitted C++ files */}
            <p className="student-grading-card-files-label">C++ Files:</p>
            <ul className="student-grading-card-files">
              {student.fileNames.map((fileName) => (
                <li key={fileName}>{fileName}</li>
              ))}
            </ul>
          </div>

          {/* Grading details section */}
          <div className="student-grading-card-details">
            <p className="student-grading-card-details-title">Grading Details</p>

            {/* Current grading stage */}
            <p className="student-grading-card-stage">
              {student.status === 'grading' && 'Compiling submission...'}
              {student.status === 'judging' && 'Running judge test cases...'}
              {student.status === 'done' && 'Grading complete.'}
              {student.status === 'failed' && 'Grading failed.'}
              {student.status === 'pending' && 'Waiting to be graded.'}
            </p>

            {/* Compile result */}
            {student.compileResult && (
              <div className="student-grading-card-detail-row">
                <p>Compile Success: {student.compileResult.compileSuccess ? 'Yes' : 'No'}</p>
              </div>
            )}

            {/* Judge result summary */}
            {student.totalCount > 0 && (
              <div className="student-grading-card-detail-row">
                <p>
                  Judge Result: {student.passedCount} / {student.totalCount} passed
                </p>
              </div>
            )}

            {/* Error message */}
            {student.errorMessage && (
              <p className="student-grading-card-error">Error: {student.errorMessage}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
