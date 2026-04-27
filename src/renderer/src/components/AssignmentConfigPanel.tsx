import { useCallback, useEffect, useState } from 'react'
import type { Assignment, AssignmentTestCase } from '../../../shared/types'
import { useAuth } from './AuthContext'
import {
  deleteServerAssignment,
  loadAssignmentTestCases,
  loadServerAssignments,
  publishAssignmentTestCases,
  publishServerAssignment,
  updateServerAssignment
} from '../lib/serverData'
import '../assets/styles/AssignmentConfigPanel.css'

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

type TestCaseFormState = {
  inputFileName: string | null
  inputFilePath: string | null
  inputText: string
  expectedOutputFileName: string | null
  expectedOutputFilePath: string | null
  expectedOutputText: string
}

type TestCaseSaveInput = {
  caseOrder: number
  inputFileName: string | null
  inputFilePath: string | null
  inputText: string | null
  expectedOutputFileName: string | null
  expectedOutputFilePath: string | null
  expectedOutputText: string
}

type AssignmentListSource = 'local' | 'server'

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

function createEmptyTestCase(): TestCaseFormState {
  return {
    inputFileName: null,
    inputFilePath: null,
    inputText: '',
    expectedOutputFileName: null,
    expectedOutputFilePath: null,
    expectedOutputText: ''
  }
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function toTestCaseForm(testCase: AssignmentTestCase): TestCaseFormState {
  return {
    inputFileName: testCase.inputFileName,
    inputFilePath: testCase.inputFilePath,
    inputText: testCase.inputText ?? '',
    expectedOutputFileName: testCase.expectedOutputFileName,
    expectedOutputFilePath: testCase.expectedOutputFilePath,
    expectedOutputText: testCase.expectedOutputText
  }
}

function isAssignmentNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Assignment not found:')
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
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignmentListSource, setAssignmentListSource] = useState<AssignmentListSource>('local')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [testCases, setTestCases] = useState<TestCaseFormState[]>([])
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
  const loadAssignments = useCallback(async (): Promise<void> => {
    try {
      const result = user ? await loadServerAssignments() : await window.api.assignments.getAll()
      setAssignments(result)
      setAssignmentListSource(user ? 'server' : 'local')
    } catch (e: unknown) {
      console.error('Failed to load server assignments, using local assignments:', e)
      try {
        const fallback = await window.api.assignments.getAll()
        setAssignments(fallback)
        setAssignmentListSource('local')
      } catch (fallbackError: unknown) {
        setError(
          fallbackError instanceof Error ? fallbackError.message : 'Failed to load assignments.'
        )
      }
    }
  }, [user])

  async function publishAssignmentAfterLocalSave(
    action: 'created' | 'updated',
    assignment: Assignment,
    testCaseInputs: TestCaseSaveInput[]
  ): Promise<void> {
    if (!user) {
      setStatusMessage(`Assignment ${action} locally.`)
      return
    }

    try {
      if (action === 'created') {
        await publishServerAssignment(assignment)
      } else {
        await updateServerAssignment(assignment)
      }
      await publishAssignmentTestCases(assignment.uuid, testCaseInputs)

      setStatusMessage(`Assignment ${action} and published successfully.`)
    } catch (publishError) {
      console.error('Assignment was saved locally but could not be published:', publishError)
      setStatusMessage(`Assignment ${action} locally.`)
      setError(
        publishError instanceof Error
          ? `Could not publish to Supabase: ${publishError.message}`
          : 'Could not publish to Supabase.'
      )
    }
  }

  /**
   * @brief Loads assignments when the component mounts.
   *
   * @return Nothing.
   */
  useEffect(() => {
    let isMounted = true

    loadAssignments()
      .then(() => {
        if (isMounted) {
          setError(null)
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
  }, [loadAssignments])

  /**
   * @brief Starts editing an existing assignment.
   *
   * @param assignment The assignment selected for editing.
   * @return Nothing.
   */
  async function startEdit(assignment: Assignment): Promise<void> {
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

    try {
      const savedTestCases = user
        ? await loadAssignmentTestCases(assignment.uuid)
        : await window.api.assignments.getTestCases(assignment.uuid)
      setTestCases(savedTestCases.map(toTestCaseForm))
    } catch (loadError) {
      console.error('Could not load assignment test cases:', loadError)
      setTestCases([])
      setError(
        loadError instanceof Error
          ? `Could not load test cases: ${loadError.message}`
          : 'Could not load test cases.'
      )
    }
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
    setTestCases([])
    setDeleteConfirm(null)
    setStatusMessage(null)
    setError(null)
  }

  async function handleSelectTestCaseFile(
    index: number,
    kind: 'input' | 'expectedOutput'
  ): Promise<void> {
    try {
      const filePath = await window.api.file.select()

      if (!filePath) {
        return
      }

      const fileName = getFileName(filePath)
      const content = await window.api.file.stringify(filePath)

      setTestCases((currentTestCases) =>
        currentTestCases.map((testCase, testCaseIndex) => {
          if (testCaseIndex !== index) {
            return testCase
          }

          return kind === 'input'
            ? {
                ...testCase,
                inputFileName: fileName,
                inputFilePath: filePath,
                inputText: content
              }
            : {
                ...testCase,
                expectedOutputFileName: fileName,
                expectedOutputFilePath: filePath,
                expectedOutputText: content
              }
        })
      )
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load test case file.')
    }
  }

  function buildTestCaseInputs(): TestCaseSaveInput[] {
    return testCases.map((testCase, index) => ({
      caseOrder: index + 1,
      inputFileName: testCase.inputFileName,
      inputFilePath: testCase.inputFilePath,
      inputText:
        testCase.inputText.length > 0 || testCase.inputFilePath ? testCase.inputText : null,
      expectedOutputFileName: testCase.expectedOutputFileName,
      expectedOutputFilePath: testCase.expectedOutputFilePath,
      expectedOutputText: testCase.expectedOutputText
    }))
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

    if (!/^(0|[1-9]\d*)$/.test(trimmedCriteria)) {
      setError('Grading criteria must be a non-negative whole number. Please use numbers only.')
      return false
    }

    if (form.solutionType === 'text' && !trimmedExpectedOutput && testCases.length === 0) {
      setError('Expected output text is required unless automated test cases are provided.')
      return false
    }

    if (form.solutionType === 'file' && !selectedFilePath && !editingUuid) {
      setError('Please select a solution file before submission.')
      return false
    }

    const invalidTestCaseIndex = testCases.findIndex(
      (testCase) =>
        testCase.expectedOutputText.trim().length === 0 && !testCase.expectedOutputFilePath
    )

    if (invalidTestCaseIndex !== -1) {
      setError(`Expected output is required for test case ${invalidTestCaseIndex + 1}.`)
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
      const testCaseInputs = buildTestCaseInputs()

      if (editingUuid) {
        const updatedAssignment = await window.api.assignments.update({
          uuid: editingUuid,
          name: trimmedName,
          dueDate: trimmedDueDate,
          gradingCriteria: trimmedCriteria,
          solutionType: form.solutionType,
          solutionFileName:
            form.solutionType === 'file' ? (selectedFileName ?? undefined) : undefined,
          solutionFilePath:
            form.solutionType === 'file' ? (selectedFilePath ?? undefined) : undefined,
          expectedOutputText:
            form.solutionType === 'text'
              ? trimmedExpectedOutput || null
              : (compiledOutput ?? undefined)
        })
        await window.api.assignments.replaceTestCases(updatedAssignment.uuid, testCaseInputs)
        await publishAssignmentAfterLocalSave('updated', updatedAssignment, testCaseInputs)
      } else {
        const createdAssignment = await window.api.assignments.create({
          name: trimmedName,
          dueDate: trimmedDueDate,
          gradingCriteria: trimmedCriteria,
          solutionType: form.solutionType,
          solutionFileName: form.solutionType === 'file' ? (selectedFileName ?? null) : null,
          solutionFilePath: form.solutionType === 'file' ? (selectedFilePath ?? null) : null,
          expectedOutputText:
            form.solutionType === 'text' ? trimmedExpectedOutput || null : compiledOutput,
          createdByUserUuid: user?.uuid ?? null
        })
        await window.api.assignments.replaceTestCases(createdAssignment.uuid, testCaseInputs)
        await publishAssignmentAfterLocalSave('created', createdAssignment, testCaseInputs)
      }

      setForm(emptyForm)
      setSelectedFilePath(null)
      setSelectedFileName(null)
      setCompiledOutput(null)
      setTestCases([])
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
      setError(null)
      setStatusMessage(null)

      if (user && assignmentListSource === 'server') {
        try {
          await deleteServerAssignment(uuid)
        } catch (deleteError) {
          console.error('Could not delete assignment from Supabase:', deleteError)
          setError(
            deleteError instanceof Error
              ? `Could not delete from Supabase: ${deleteError.message}`
              : 'Could not delete from Supabase.'
          )
          return
        }

        try {
          await window.api.assignments.delete(uuid)
        } catch (localDeleteError) {
          if (!isAssignmentNotFoundError(localDeleteError)) {
            throw localDeleteError
          }

          console.info(
            'Assignment existed on Supabase but not in local storage during delete:',
            uuid
          )
        }

        setStatusMessage('Assignment deleted from Supabase.')
      } else {
        await window.api.assignments.delete(uuid)
        setStatusMessage('Assignment deleted locally.')
      }
      setDeleteConfirm(null)
      await loadAssignments()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete assignment.')
    }
  }

  return (
    <div className="panel-shell assignment-config-panel">
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
        <section className="assignment-config-content-card">
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

          <div>
            <label className="field-label">Grading criteria score</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Enter score"
              value={form.gradingCriteria}
              onChange={(e) => {
                const value = e.target.value

                if (value === '' || /^(0|[1-9]\d*)$/.test(value)) {
                  setForm((f) => ({ ...f, gradingCriteria: value }))
                  setError(null)
                } else {
                  setError(
                    'Grading criteria must be a non-negative whole number. Please use numbers only.'
                  )
                }
              }}
              className="panel-input"
            />
          </div>
        </section>

        <section className="assignment-config-content-card">
          <div className="assignment-section-header">
            <div>
              <h3>Reference Solution</h3>
              <p>Instructor answer source or fallback expected output.</p>
            </div>
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
              Text output
            </label>

            <label className="solution-type-option solution-type-option-spaced">
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
              C++ file
            </label>
          </div>

          {form.solutionType === 'text' ? (
            <div className="solution-box reference-solution-box">
              <label className="field-label">Fallback expected output</label>
              <textarea
                placeholder="Used when no grading test cases are added"
                value={form.expectedOutputText}
                onChange={(e) => setForm((f) => ({ ...f, expectedOutputText: e.target.value }))}
                className="panel-input panel-textarea"
                rows={5}
              />
            </div>
          ) : (
            <div className="solution-box reference-solution-box">
              <label className="field-label">Reference C++ file</label>

              <button
                type="button"
                onClick={() => void handleSelectFile()}
                className="secondary-button compact-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Compiling...' : 'Select .cpp File'}
              </button>

              {selectedFileName ? (
                <p className="helper-text">Selected: {selectedFileName}</p>
              ) : (
                <p className="helper-text">No reference file selected.</p>
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
        </section>

        <section className="assignment-config-content-card">
          <div className="assignment-section-header assignment-section-header--tests">
            <div>
              <h3>Grading Test Cases</h3>
              <p>Input and expected-output pairs used by Grading+.</p>
            </div>

            <button
              type="button"
              className="primary-button compact-button"
              onClick={() =>
                setTestCases((currentTestCases) => [...currentTestCases, createEmptyTestCase()])
              }
            >
              + Add Test Case
            </button>
          </div>

          <div className="test-case-list">
            {testCases.length === 0 ? (
              <div className="panel-empty">No grading test cases added.</div>
            ) : (
              testCases.map((testCase, index) => (
                <div key={index} className="test-case-card">
                  <div className="test-case-card-header">
                    <div>
                      <h4>Test case {index + 1}</h4>
                      <p>{testCase.expectedOutputFileName ?? 'Expected output required'}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost assignment-config-action-button"
                      onClick={() =>
                        setTestCases((currentTestCases) =>
                          currentTestCases.filter((_, testCaseIndex) => testCaseIndex !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>

                  <div className="test-case-grid">
                    <div className="test-case-field">
                      <label className="field-label">Input</label>
                      <textarea
                        placeholder="Optional stdin"
                        value={testCase.inputText}
                        onChange={(e) =>
                          setTestCases((currentTestCases) =>
                            currentTestCases.map((currentTestCase, testCaseIndex) =>
                              testCaseIndex === index
                                ? {
                                    ...currentTestCase,
                                    inputText: e.target.value,
                                    inputFileName: null,
                                    inputFilePath: null
                                  }
                                : currentTestCase
                            )
                          )
                        }
                        className="panel-input panel-textarea"
                        rows={5}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSelectTestCaseFile(index, 'input')}
                        className="secondary-button compact-button"
                      >
                        Select Input
                      </button>
                      {testCase.inputFileName && (
                        <p className="helper-text">Input file: {testCase.inputFileName}</p>
                      )}
                    </div>

                    <div className="test-case-field test-case-field--required">
                      <label className="field-label">Expected Output</label>
                      <textarea
                        placeholder="Required expected stdout"
                        value={testCase.expectedOutputText}
                        onChange={(e) =>
                          setTestCases((currentTestCases) =>
                            currentTestCases.map((currentTestCase, testCaseIndex) =>
                              testCaseIndex === index
                                ? {
                                    ...currentTestCase,
                                    expectedOutputText: e.target.value,
                                    expectedOutputFileName: null,
                                    expectedOutputFilePath: null
                                  }
                                : currentTestCase
                            )
                          )
                        }
                        className="panel-input panel-textarea"
                        rows={5}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSelectTestCaseFile(index, 'expectedOutput')}
                        className="secondary-button compact-button"
                      >
                        Select Output
                      </button>
                      {testCase.expectedOutputFileName && (
                        <p className="helper-text">
                          Expected output file: {testCase.expectedOutputFileName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="assignment-config-content-card assignment-config-content-card-submit">
          <div className="panel-subheader">
            <h3>Save Assignment</h3>
            <p>Create or update the assignment configuration.</p>
          </div>

          <button
            onClick={() => void handleSubmit()}
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : editingUuid ? 'Update Assignment' : '+ Create Assignment'}
          </button>

          {statusMessage && <div className="panel-success">✓ {statusMessage}</div>}
          {error && <div className="panel-error">⚠ {error}</div>}
        </section>
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
                  <button
                    onClick={() => void startEdit(assignment)}
                    className="btn-ghost assignment-config-action-button"
                  >
                    Edit
                  </button>

                  {deleteConfirm === assignment.uuid ? (
                    <button
                      onClick={() => void handleDelete(assignment.uuid)}
                      className="btn-ghost assignment-config-action-button assignment-config-action-button-danger"
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(assignment.uuid)}
                      className="btn-ghost assignment-config-action-button"
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
