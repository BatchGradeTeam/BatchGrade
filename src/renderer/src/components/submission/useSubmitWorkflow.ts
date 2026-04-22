/**
 * useSubmitWorkflow.ts
 *
 * Description:
 * This custom React hook manages the state and logic for the submission workflow
 * in the SubmitPanel component. It handles loading assignments, managing user input,
 * and performing the submission process while providing feedback on submission status.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CompileCppResult } from '../../../../shared/compiler'
import type { SubmissionCompileSnapshot, SubmitCppResult } from '../../../../shared/submission'
import type { Assignment } from '../../../../shared/types'
import { loadServerAssignments, publishServerSubmission } from '../../lib/serverData'

/// Properties for the useSubmitWorkflow hook
type UseSubmitWorkflowProps = {
  compileResult: CompileCppResult | null
  selectedFiles: string[]
  userId: string | undefined
  selectedAssignmentId: string
  onAssignmentsLoaded?: (assignments: Assignment[]) => void
}

// Return type for the useSubmitWorkflow hook
type UseSubmitWorkflowReturn = {
  assignments: Assignment[]
  selectedAssignment: Assignment | null
  submitResult: SubmitCppResult | null
  errorMessage: string | null
  statusMessage: string | null
  isSubmitting: boolean
  handleSubmit: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
      error_description?: unknown
    }

    return [maybeError.message, maybeError.details, maybeError.hint, maybeError.code]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ')
  }

  return String(error)
}

/**
 * useSubmitWorkflow Hook
 * 
 * Manages the state and logic for the submission workflow in the SubmitPanel component.
 * It handles loading assignments, managing user input, and performing the submission process
 * while providing feedback on submission status.

 * 
 * @param param0 - The properties for the useSubmitWorkflow hook
 * @returns The state and handlers for the submission workflow
 */
export function useSubmitWorkflow({
  compileResult,
  selectedFiles,
  userId,
  selectedAssignmentId,
  onAssignmentsLoaded
}: UseSubmitWorkflowProps): UseSubmitWorkflowReturn {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submitResult, setSubmitResult] = useState<SubmitCppResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Load assignments on component mount
  useEffect(() => {
    async function loadAssignments(): Promise<void> {
      if (userId) {
        try {
          const serverAssignments = await loadServerAssignments()
          setAssignments(serverAssignments)
          onAssignmentsLoaded?.(serverAssignments)
          setErrorMessage(
            serverAssignments.length === 0 ? 'No published assignments are available yet.' : null
          )
        } catch (error) {
          console.error('Error loading server assignments:', error)
          setAssignments([])
          onAssignmentsLoaded?.([])
          setErrorMessage(
            `Could not load published assignments from Supabase: ${getErrorMessage(error)}`
          )
        }
        return
      }

      try {
        const localAssignments = await window.api.assignments.getAll()
        setAssignments(localAssignments)
        onAssignmentsLoaded?.(localAssignments)
        setErrorMessage(localAssignments.length === 0 ? 'No assignments available yet.' : null)
      } catch (error) {
        console.error('Error loading assignments:', error)
        setErrorMessage('Could not load assignments.')
      }
    }

    void loadAssignments()
  }, [onAssignmentsLoaded, userId])

  // Reset submit result whenever the relevant inputs change
  useEffect(() => {
    setSubmitResult(null)
    setStatusMessage(null)
  }, [selectedFiles, compileResult])

  // Memoized selected assignment based on the selected ID
  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.uuid === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId]
  )

  // Handler for performing the submission process
  async function handleSubmit(): Promise<void> {
    // Validation checks before submission
    if (!userId) {
      setErrorMessage('Log in before submitting.')
      return
    }
    // Assignment selection validation
    if (!selectedAssignmentId) {
      setErrorMessage('Select an assignment before submitting.')
      return
    }

    // Source file selection validation
    if (selectedFiles.length === 0) {
      setErrorMessage('Select at least one source file before submitting.')
      return
    }

    // Compile result validation
    if (!compileResult?.compileSuccess) {
      setErrorMessage('Compile successfully before submitting.')
      return
    }

    // Perform submission
    setIsSubmitting(true)
    setErrorMessage(null)
    setStatusMessage(null)
    setSubmitResult(null)

    // Call the backend API to submit the source files and compile snapshot
    try {
      const compileSnapshot: SubmissionCompileSnapshot = {
        compileSuccess: compileResult.compileSuccess,
        compilerPath: compileResult.compilerPath,
        sourceFiles: compileResult.sourceFiles,
        stdout: compileResult.stdout,
        stderr: compileResult.stderr,
        message: compileResult.message
      }

      const result = await window.api.submissions.submitCpp({
        assignmentId: selectedAssignmentId,
        studentId: userId,
        sourceFiles: selectedFiles,
        compileSnapshot
      })

      // Update state with submission result
      setSubmitResult(result)
      if (!result.submissionSuccess) {
        setErrorMessage(result.message)
        return
      }

      try {
        await publishServerSubmission(result, compileSnapshot)
        setStatusMessage('Submission uploaded and published.')
      } catch (publishError) {
        console.error('Submission saved locally but could not be published:', publishError)
        setStatusMessage('Submission saved locally.')
        setErrorMessage(`Could not publish submission to Supabase: ${getErrorMessage(publishError)}`)
      }
      // Catch and handle any errors that occur during the submission process
    } catch (error) {
      console.error('Error submitting source files:', error)
      setErrorMessage('Could not save the submission.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    assignments,
    selectedAssignment,
    submitResult,
    errorMessage,
    statusMessage,
    isSubmitting,
    handleSubmit
  }
}
