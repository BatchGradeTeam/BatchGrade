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
import type { SubmitCppResult } from '../../../../shared/submission'
import type { Assignment } from '../../../../shared/types'

/// Properties for the useSubmitWorkflow hook
type UseSubmitWorkflowProps = {
  compileResult: CompileCppResult | null
  selectedFiles: string[]
  userId: string | undefined
}

// Return type for the useSubmitWorkflow hook
type UseSubmitWorkflowReturn = {
  assignments: Assignment[]
  selectedAssignmentId: string
  selectedAssignment: Assignment | null
  submitResult: SubmitCppResult | null
  errorMessage: string | null
  isSubmitting: boolean
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string>>
  handleSubmit: () => Promise<void>
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
  userId
}: UseSubmitWorkflowProps): UseSubmitWorkflowReturn {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [submitResult, setSubmitResult] = useState<SubmitCppResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Load assignments on component mount
  useEffect(() => {
    window.api.assignments
      .getAll()
      .then((result) => {
        setAssignments(result)
        if (result.length > 0) {
          setSelectedAssignmentId(result[0].uuid)
        }
      })
      .catch((error) => {
        console.error('Error loading assignments:', error)
        setErrorMessage('Could not load assignments.')
      })
  }, [])

  // Reset submit result whenever the relevant inputs change
  useEffect(() => {
    setSubmitResult(null)
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
    setSubmitResult(null)

    // Call the backend API to submit the source files and compile snapshot
    try {
      const result = await window.api.submissions.submitCpp({
        assignmentId: selectedAssignmentId,
        studentId: userId,
        sourceFiles: selectedFiles,
        compileSnapshot: {
          compileSuccess: compileResult.compileSuccess,
          compilerPath: compileResult.compilerPath,
          sourceFiles: compileResult.sourceFiles,
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
          message: compileResult.message
        }
      })

      // Update state with submission result
      setSubmitResult(result)
      if (!result.submissionSuccess) {
        setErrorMessage(result.message)
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
    selectedAssignmentId,
    selectedAssignment,
    submitResult,
    errorMessage,
    isSubmitting,
    setSelectedAssignmentId,
    handleSubmit
  }
}
