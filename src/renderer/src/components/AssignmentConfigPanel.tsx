import { useEffect, useState } from 'react'
import type { Assignment } from '../../../shared/types'

/**
 * @brief Local form state used by AssignmentConfigPanel.
 *
 * @details
 * This state mirrors the instructor-facing form fields for:
 * - FR9: Assignment Creation Button & Display
 * - FR10: Solution Upload Buttons & Display
 * - FR11: Solution Submission Button & Display
 *
 * This version preserves the current assignment schema used by the project:
 * name, dueDate, gradingCriteria, solutionType, and expectedOutputText.
 */
type FormState = {
  name: string
  dueDate: string
  gradingCriteria: string
  solutionType: 'file' | 'text'
  expectedOutputText: string
}

/**
 * @brief Empty/default form values for a new assignment.
 *
 * @return Default AssignmentConfigPanel form state.
 */
const emptyForm: FormState = {
  name: '',
  dueDate: '',
  gradingCriteria: '',
  solutionType: 'text',
  expectedOutputText: ''
}

/**
 * @brief Assignment configuration panel for instructor workflows.
 *
 * @details
 * This component implements the renderer-side UI for:
 * - FR9: Assignment creation and metadata entry
 * - FR10: Solution input selection via file upload or text entry
 * - FR11: Assignment solution submission with validation and feedback
 *
 * The component:
 * - loads assignments on mount
 * - allows creating a new assignment
 * - allows editing an existing assignment
 * - allows deleting an existing assignment
 * - validates required input before submission
 * - shows a success or error message after actions
 *
 * @return React JSX element for the assignment configuration panel.
 */
export function AssignmentConfigPanel(): React.JSX.Element {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  /**
   * @brief Absolute path of the .cpp file chosen via
   * Electron's native file-open dialog.
   *
   * @details
   * Replaces the old browser File object.  
   * The path is passed directly to the compiler 
   * handler so the main process can resolve it on disk.
   */
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  /**
   * @brief Display name of the selected solution file.
   *
   * @details
   * Derived from selectedFilePath and shown in the UI so the instructor
   * can confirm which file is staged.
   */
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  /**
   * @brief Tracks whether the compile-and-run pipeline is in progress.
   *
   * @details
   * Set to true while the submit handler is awaiting compilation and execution.
   * Used to disable the submit button and show a loading label so the instructor
   * knows the system is working.
   */
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  /**
   * @brief Preview of the compiled solution's stdout.
   *
   * @details
   * Populated after a successful compile + run in file mode.
   * Displayed beneath the file picker so the instructor can verify the output
   * before the assignment record is persisted.
   */
  const [compiledOutput, setCompiledOutput] = useState<string | null>(null)

  /**
   * @brief Loads all assignments from the preload API.
   *
   * @return Promise that resolves when assignments have been loaded.
   *
   * @throws Error if the preload or IPC layer fails.
   */
  const loadAssignments = async (): Promise<void> => {
    try {
      const result = await window.api.assignments.getAll()
      setAssignments(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments.')
    }
  }

  /**
   * @brief Loads assignments when the component mounts.
   *
   * @return Nothing.
   */
  useEffect(() => {
    let isMounted = true

    window.api.assignments
      .getAll()
      .then((result) => {
        if (isMounted) {
          setAssignments(result)
        }
      })
      .catch((e: unknown) => {
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Something went wrong.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  /**
   * @brief Starts editing an existing assignment.
   *
   * @param assignment The assignment selected for editing.
   * @return Nothing.
   */
  function startEdit(assignment: Assignment): void {
    setEditingUuid(assignment.uuid)
    setForm({
      name: assignment.name ?? '',
      dueDate: assignment.dueDate ?? '',
      gradingCriteria: assignment.gradingCriteria ?? '',
      solutionType: (assignment.solutionType ?? 'text') as 'file' | 'text',
      expectedOutputText: assignment.expectedOutputText ?? ''
    })
    setSelectedFilePath(null)
    setSelectedFileName(null)
    setCompiledOutput(null)
    setDeleteConfirm(null)
    setStatusMessage(null)
    setError(null)
  }

  /**
   * @brief Cancels edit mode and resets the form.
   *
   * @return Nothing.
   */
  function cancelEdit(): void {
    setEditingUuid(null)
    setForm(emptyForm)
    setSelectedFilePath(null)
    setSelectedFileName(null)
    setCompiledOutput(null)
    setDeleteConfirm(null)
    setStatusMessage(null)
    setError(null)
  }

  /**
   * @brief  Opens Electron's file open dialog and stores the selected .cpp file path.
   *
   * @details
   * Uses window.api.file.selectCppFiles() which calls the main-process
   * file:selectCppFiles IPC handler.  Only the first selected file is used.
   * Clears any previously compiled output whenever a new file is chosen.
   *
   * @return Promise that resolves when the dialog closes.
   */
  async function handleSelectFile(): Promise<void> {
    try {
      const paths = await window.api.file.selectCppFiles()
      if (!paths || paths.length === 0) return

      const filePath = paths[0]
      // Extract basename for display
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath

      setSelectedFilePath(filePath)
      setSelectedFileName(fileName)
      setCompiledOutput(null)
      setError(null)
      setIsSubmitting(true)

      // Step 1: Compile
      const compileResult = await window.api.compiler.compileCpp({
        sourceFiles: [filePath]
      })

      if (!compileResult.compileSuccess || !compileResult.executablePath) {
        setError(
          `Compilation failed:\n${compileResult.stderr || compileResult.message || 'Unknown compile error.'}`
        )
        return
      }

      // Step 2: Run and capture stdout as expected output
      const runResult = await window.api.compiler.runCompiledProgram({
        executablePath: compileResult.executablePath,
        stdin: '',
        timeoutMs: 10000
      })

      if (!runResult.executionSuccess) {
        setError(
          `Execution failed:\n${runResult.stderr || runResult.message || 'Unknown execution error.'}`
        )
        return
      }

      setCompiledOutput(runResult.stdout)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open file dialog.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * @brief Validates the current form before create/update.
   *
   * @details
   * Validation reflects FR9, FR10, and FR11:
   * - assignment metadata is required
   * - text mode requires expected output text
   * - file mode requires an uploaded file before submission
   *
   * @return True if the form is valid; otherwise false.
   */
  function validateForm(): boolean {
    const trimmedName = form.name.trim()
    const trimmedDueDate = form.dueDate.trim()
    const trimmedCriteria = form.gradingCriteria.trim()
    const trimmedExpectedOutput = form.expectedOutputText.trim()

    if (!trimmedName) {
      setError('Assignment name is required.')
      return false
    }

    if (!trimmedDueDate) {
      setError('Due date is required.')
      return false
    }

    if (!trimmedCriteria) {
      setError('Grading criteria is required.')
      return false
    }

    if (form.solutionType === 'text' && !trimmedExpectedOutput) {
      setError('Expected output text is required for text solution mode.')
      return false
    }

    if (form.solutionType === 'file' && !selectedFilePath && !editingUuid) {
      setError('Please select a solution file before submission.')
      return false
    }

    setError(null)
    return true
  }

  /**
   * @brief Creates or updates an assignment using already-captured output.
   *
   * @details
   * Compile and run now happen at file selection time in handleSelectFile,
   * so handleSubmit is a pure save operation. For file mode, compiledOutput
   * already holds the captured stdout from the earlier compile+run step.
   * For text mode, the typed expected output is stored directly.
   *
   * @return Promise that resolves when the save operation completes.
   */
  async function handleSubmit(): Promise<void> {
    if (!validateForm()) return

    const trimmedName = form.name.trim()
    const trimmedDueDate = form.dueDate.trim()
    const trimmedCriteria = form.gradingCriteria.trim()
    const trimmedExpectedOutput = form.expectedOutputText.trim()

    setIsSubmitting(true)
    setError(null)
    setStatusMessage(null)

    try {
      if (editingUuid) {
        await window.api.assignments.update({
          uuid: editingUuid,
          name: trimmedName,
          dueDate: trimmedDueDate,
          gradingCriteria: trimmedCriteria,
          solutionType: form.solutionType,
          solutionFileName: form.solutionType === 'file' ? (selectedFileName ?? undefined) : undefined,
          solutionFilePath: form.solutionType === 'file' ? (selectedFilePath ?? undefined) : undefined,
          expectedOutputText: form.solutionType === 'text' ? trimmedExpectedOutput : (compiledOutput ?? undefined)
        })
        setStatusMessage('Assignment updated successfully.')
      } else {
        await window.api.assignments.create({
          name: trimmedName,
          dueDate: trimmedDueDate,
          gradingCriteria: trimmedCriteria,
          solutionType: form.solutionType,
          solutionFileName: form.solutionType === 'file' ? (selectedFileName ?? null) : null,
          solutionFilePath: form.solutionType === 'file' ? (selectedFilePath ?? null) : null,
          expectedOutputText: form.solutionType === 'text' ? trimmedExpectedOutput : compiledOutput,
          createdByUserUuid: null
        })
        setStatusMessage('Assignment created successfully.')
      }

      setForm(emptyForm)
      setSelectedFilePath(null)
      setSelectedFileName(null)
      setCompiledOutput(null)
      setEditingUuid(null)
      setDeleteConfirm(null)
      await loadAssignments()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * @brief Deletes an assignment by UUID.
   *
   * @param uuid UUID of the assignment to delete.
   * @return Promise that resolves when deletion completes.
   */
  async function handleDelete(uuid: string): Promise<void> {
    try {
      await window.api.assignments.delete(uuid)
      setDeleteConfirm(null)
      setStatusMessage('Assignment deleted successfully.')
      await loadAssignments()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete assignment.')
    }
  }

  return (
    <div className="panel-shell">
      <div className="panel-header">
        <div>
          <h2>Assignment Configuration</h2>
          <p>
            Use this workspace to create assignments, provide solutions, and manage instructor
            assignment configurations.
          </p>
        </div>

        {editingUuid && (
          <button onClick={cancelEdit} className="btn-ghost">
            Cancel Edit
          </button>
        )}
      </div>

      <div className="panel-form">
        <div className="panel-subheader">
          <h3>Assignment Creation</h3>
          <p>Enter assignment metadata before creating the assignment.</p>
        </div>

        <input
          type="text"
          placeholder="Assignment name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="panel-input"
        />

        <div>
          <label className="field-label">Due date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            className="panel-input"
          />
        </div>

        <textarea
          placeholder="Grading criteria"
          value={form.gradingCriteria}
          onChange={(e) => setForm((f) => ({ ...f, gradingCriteria: e.target.value }))}
          className="panel-input"
          rows={4}
        />

        <div className="panel-subheader">
          <h3>Solution Upload</h3>
          <p>Choose whether the instructor solution will be provided as text or as a file.</p>
        </div>

        <div className="panel-section">
          <label>
            <input
              type="radio"
              name="solutionType"
              checked={form.solutionType === 'text'}
              onChange={() =>
                setForm((f) => ({
                  ...f,
                  solutionType: 'text'
                }))
              }
            />
            text solution
          </label>

          <label style={{ marginLeft: '1rem' }}>
            <input
              type="radio"
              name="solutionType"
              checked={form.solutionType === 'file'}
              onChange={() =>
                setForm((f) => ({
                  ...f,
                  solutionType: 'file',
                  expectedOutputText: ''
                }))
              }
            />
            file solution
          </label>
        </div>

        {form.solutionType === 'text' ? (
          <div className="solution-box">
            <label className="field-label">Expected output text</label>
            <textarea
              placeholder="Enter the expected solution output"
              value={form.expectedOutputText}
              onChange={(e) => setForm((f) => ({ ...f, expectedOutputText: e.target.value }))}
              className="panel-input"
              rows={5}
            />
          </div>
        ) : (
          <div className="solution-box">
            <label className="field-label">Upload solution file (.cpp)</label>

            <button
              type="button"
              onClick={() => void handleSelectFile()}
              className="btn-ghost"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Compiling solution…' : 'Select .cpp File'}
            </button>

            {selectedFileName && (
              <p className="helper-text">Selected file: {selectedFileName}</p>
            )}

            {/* FR11: Preview compiled output once the pipeline has run */}
            {compiledOutput !== null && (
              <div className="panel-output-preview">
                <label className="field-label">Compiled solution output (preview)</label>
                <pre className="panel-pre">{compiledOutput}</pre>
              </div>
            )}
          </div>
        )}

        <div className="panel-subheader">
          <h3>Solution Submission</h3>
          <p>Submit the assignment only after the solution input has been provided.</p>
        </div>

        <button onClick={() => void handleSubmit()} className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' 
            : editingUuid ? 'Update Assignment' : '+ Create Assignment'}
        </button>

        {statusMessage && <div className="panel-success">✓ {statusMessage}</div>}
        {error && <div className="panel-error">⚠ {error}</div>}
      </div>

      <div className="panel-list-shell">
        <h3>Existing Assignments</h3>

        {assignments.length === 0 ? (
          <div className="panel-empty">No assignments yet — add one above.</div>
        ) : (
          <ul className="panel-list">
            {assignments.map((assignment) => (
              <li key={assignment.uuid} className="panel-list-item">
                <div>
                  <strong>{assignment.name}</strong>
                  <div>Due: {assignment.dueDate}</div>
                  <div>Solution type: {assignment.solutionType}</div>

                  {assignment.solutionType === 'text' && assignment.expectedOutputText && (
                    <div>Expected output: {assignment.expectedOutputText}</div>
                  )}

                  {assignment.solutionType === 'file' && assignment.solutionFileName && (
                    <div>Solution file: {assignment.solutionFileName}</div>
                  )}

                  <div>Created: {new Date(assignment.createdAt * 1000).toLocaleString()}</div>
                  <div>UUID: {assignment.uuid.slice(0, 8)}…</div>
                </div>

                <div className="panel-actions">
                  <button onClick={() => startEdit(assignment)} className="btn-ghost text-xs">
                    Edit
                  </button>

                  {deleteConfirm === assignment.uuid ? (
                    <button
                      onClick={() => void handleDelete(assignment.uuid)}
                      className="btn-ghost text-xs text-red-400"
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(assignment.uuid)}
                      className="btn-ghost text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default AssignmentConfigPanel
