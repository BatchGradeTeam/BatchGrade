/**
 * SubmitPanel.tsx
 *
 * Description:
 * This component implements the submission interface for students to submit their code for grading.
 * It allows students to select an assignment, review compile results, and submit their code bundle.
 * The panel displays submission status and any relevant messages after submission.
 *
 * The component relies on the useSubmitWorkflow hook to manage the submission logic and state.
 * The UI is designed to be simple and informative, guiding students through the submission process.
 *
 * Future enhancements may include:
 *  - More detailed submission feedback
 *  - Support for multiple programming languages
 *  - Integration with a file upload system for source code bundles
 *  - Real-time validation of submission contents before final submission
 */
import type { CompileCppResult } from '../../../../shared/compiler'
import { useSubmitWorkflow } from './useSubmitWorkflow'

type SubmitPanelProps = {
  compileResult: CompileCppResult | null
  selectedFiles: string[]
  userId: string | undefined
}

/**
 * SubmitPanel Component
 *
 * Provides the interface for students to submit their code for grading.
 * Displays assignment selection, submission status, and feedback messages.
 *
 * @param {SubmitPanelProps} props - The properties for the SubmitPanel component
 * @returns {React.JSX.Element} The rendered SubmitPanel component
 */
export function SubmitPanel({
  compileResult,
  selectedFiles,
  userId
}: SubmitPanelProps): React.JSX.Element {
  const {
    assignments,
    selectedAssignmentId,
    selectedAssignment,
    submitResult,
    errorMessage,
    isSubmitting,
    setSelectedAssignmentId,
    handleSubmit
  } = useSubmitWorkflow({ compileResult, selectedFiles, userId })

  return (
    <div
      className="submit-section"
      style={{
        border: '1px solid gray',
        padding: '1rem',
        marginTop: '1rem',
        backgroundColor: '#2b2b2b'
      }}
    >
      <h2 style={{ marginBottom: '0.5rem' }}>Submit for Grading</h2>
      <p style={{ marginBottom: '1rem' }}>
        Submission saves a source snapshot and compile log that can be passed into a sandboxed
        grading workflow later.
      </p>

      {errorMessage && (
        <div
          style={{
            backgroundColor: '#5a1f1f',
            border: '1px solid red',
            padding: '10px',
            marginBottom: '1rem'
          }}
        >
          <p>{errorMessage}</p>
        </div>
      )}

      <label style={{ display: 'block', marginBottom: '0.5rem' }}>Assignment</label>
      <select
        value={selectedAssignmentId}
        onChange={(e) => {
          setSelectedAssignmentId(e.target.value)
        }}
        className="panel-input"
        style={{ maxWidth: '480px', marginBottom: '1rem' }}
      >
        {assignments.length === 0 && <option value="">No assignments available</option>}
        {assignments.map((assignment) => (
          <option key={assignment.uuid} value={assignment.uuid}>
            {assignment.name}
          </option>
        ))}
      </select>

      {selectedAssignment && (
        <div style={{ marginBottom: '1rem', fontSize: '14px', lineHeight: '1.6' }}>
          <p>Due Date: {selectedAssignment.dueDate}</p>
          <p>Grading Criteria: {selectedAssignment.gradingCriteria}</p>
        </div>
      )}

      <button
        onClick={() => void handleSubmit()}
        disabled={isSubmitting || !compileResult?.compileSuccess || selectedFiles.length === 0}
        className={
          isSubmitting || !compileResult?.compileSuccess || selectedFiles.length === 0
            ? 'cancel-button'
            : 'primary-button'
        }
      >
        {isSubmitting ? 'Submitting...' : 'Submit Code'}
      </button>

      {submitResult && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid gray', paddingTop: '1rem' }}>
          <p>Message: {submitResult.message}</p>
          <p>Submission ID: {submitResult.submissionId ?? 'Not created'}</p>
          <p>Submitted At: {submitResult.submittedAt ?? 'Not recorded'}</p>
          <p>Saved Files: {submitResult.submittedFiles.length}</p>
        </div>
      )}
    </div>
  )
}
