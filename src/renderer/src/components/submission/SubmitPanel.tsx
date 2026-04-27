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
import type { Assignment } from '../../../../shared/types'
import type { CompileCppResult } from '../../../../shared/compiler'
import type { SubmissionSelfCheckSummary } from '../../../../shared/submission'
import { useEffect } from 'react'
import { useSubmitWorkflow } from './useSubmitWorkflow'
import '../../assets/styles/SubmitPanel.css'

type SubmitPanelProps = {
  compileResult: CompileCppResult | null
  selectedFiles: string[]
  userId: string | undefined
  selectedAssignmentId: string
  selfCheckSummary: SubmissionSelfCheckSummary | null
  isRunningSelfCheck?: boolean
  requiresCompletedSelfCheck?: boolean
  onAssignmentsLoaded?: (assignments: Assignment[]) => void
  onExpectedOutputChange?: (expectedOutput: string | null) => void
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
  userId,
  selectedAssignmentId,
  selfCheckSummary,
  isRunningSelfCheck = false,
  requiresCompletedSelfCheck = false,
  onAssignmentsLoaded,
  onExpectedOutputChange
}: SubmitPanelProps): React.JSX.Element {
  const {
    selectedAssignment,
    submitResult,
    errorMessage,
    statusMessage,
    isSubmitting,
    handleSubmit
  } = useSubmitWorkflow({
    compileResult,
    selectedFiles,
    userId,
    selectedAssignmentId,
    selfCheckSummary,
    onAssignmentsLoaded
  })

  /**
   * @brief FR-5: Notify parent of the initial assignment's expected output.
   *
   * @details
   * The dropdown defaults to the first assignment on load but onChange
   * never fires for the initial value, so OutputDiffPanel has no expected
   * output until the user manually changes the selection. This effect
   * fires whenever selectedAssignment changes — including on first load —
   * ensuring the parent always has the current expected output.
   */
  useEffect(() => {
    onExpectedOutputChange?.(selectedAssignment?.expectedOutputText ?? null)
  }, [onExpectedOutputChange, selectedAssignment])

  const isSubmitDisabled =
    isSubmitting ||
    !compileResult?.compileSuccess ||
    selectedFiles.length === 0 ||
    isRunningSelfCheck ||
    (requiresCompletedSelfCheck && !selfCheckSummary)

  return (
    <section className="submit-section submit-panel panel-shell">
      <h2 className="submit-panel-title">Submit for Grading</h2>
      <p className="submit-panel-description">
        Submission saves a source snapshot and compile log that can be passed into a sandboxed
        grading workflow later.
      </p>

      {errorMessage && (
        <div className="submit-panel-alert submit-panel-alert-error">
          <p>{errorMessage}</p>
        </div>
      )}

      {statusMessage && (
        <div className="submit-panel-alert submit-panel-alert-success">
          <p>{statusMessage}</p>
        </div>
      )}

      {selectedAssignment && (
        <div className="submit-panel-assignment-details">
          <p>
            <strong>Assignment:</strong> {selectedAssignment.name}
          </p>
          <p>Due Date: {selectedAssignment.dueDate}</p>
          <p>Grading Criteria: {selectedAssignment.gradingCriteria}</p>
        </div>
      )}

      {requiresCompletedSelfCheck && (
        <p className="submit-panel-self-check-note">
          {isRunningSelfCheck
            ? 'Saved test cases are still running. Submit will unlock when the self-check finishes.'
            : selfCheckSummary
              ? `Self-check ready: ${selfCheckSummary.score}% (${selfCheckSummary.passedCount}/${selfCheckSummary.totalCount} passed).`
              : 'Run the saved assignment test cases before submitting so your online score is included.'}
        </p>
      )}

      <button
        onClick={() => void handleSubmit()}
        disabled={isSubmitDisabled}
        className={`submit-panel-submit-button ${
          isSubmitDisabled
            ? 'submit-panel-submit-button-disabled'
            : 'submit-panel-submit-button-primary'
        }`}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Code'}
      </button>

      {submitResult && (
        <div className="submit-panel-result">
          <p>Message: {submitResult.message}</p>
          <p>Submission ID: {submitResult.submissionId ?? 'Not created'}</p>
          <p>Submitted At: {submitResult.submittedAt ?? 'Not recorded'}</p>
          <p>Saved Files: {submitResult.submittedFiles.length}</p>
        </div>
      )}
    </section>
  )
}
