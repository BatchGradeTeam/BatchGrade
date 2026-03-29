// import { useEffect, useState } from 'react'
// import type { Assignment } from '../../../shared/types'

// /**
//  * @brief Local form state used by AssignmentConfigPanel.
//  *
//  * @details
//  * This state mirrors the instructor-facing form fields for FR9, FR10, and FR11.
//  * It keeps assignment separate from the list of saved assignments.
//  */
// type FormState = {
//   name: string
//   dueDate: string
//   gradingCriteria: string
//   solutionType: 'file' | 'text'
//   expectedOutputText: string
// }

// /**
//  * @brief Empty/default form values for a new assignment.
//  *
//  * @return Default AssignmentConfigPanel form state.
//  */
// const emptyForm: FormState = {
//   name: '',
//   dueDate: '',
//   gradingCriteria: '',
//   solutionType: 'text',
//   expectedOutputText: ''
// }

// /**
//  * @brief Assignment configuration panel for MVP-5.
//  *
//  * @details
//  * This component implements the renderer-side UI for:
//  * - FR9: Instructor-defined assignment creation
//  * - FR10: Instructor solution input mode selection (file or text)
//  * - FR11: Assignment solution submission/saving
//  *
//  * The component:
//  * - loads assignments on mount
//  * - allows creating a new assignment
//  * - allows editing an existing assignment
//  * - allows deleting an assignment
//  * - validates required input before submission
//  *
//  * @return React JSX element for the assignment configuration panel.
//  */
// export function AssignmentConfigPanel(): React.JSX.Element {
//   const [assignments, setAssignments] = useState<Assignment[]>([])
//   const [form, setForm] = useState<FormState>(emptyForm)
//   const [editingUuid, setEditingUuid] = useState<string | null>(null)
//   const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
//   const [error, setError] = useState<string | null>(null)

//   /**
//    * @brief File currently selected by the instructor.
//    *
//    * @details
//    * This is only used when solutionType === 'file'.
//    * For now, the UI stores the selected file name and passes a placeholder path
//    * value until full main-process file persistence is wired in.
//    */
//   const [selectedFile, setSelectedFile] = useState<File | null>(null)

//   /**
//    * @brief Loads all assignments from the preload API.
//    *
//    * @return Promise that resolves when assignments have been loaded.
//    *
//    * @throws Error if the preload or IPC layer fails.
//    */
//   const loadAssignments = async (): Promise<void> => {
//     const result = await window.api.assignments.getAll()
//     setAssignments(result)
//   }

//   /**
//    * @brief Loads assignments when the component mounts.
//    *
//    * @return Nothing.
//    */
//   useEffect(() => {
//     let isMounted = true

//     window.api.assignments
//       .getAll()
//       .then((result) => {
//         if (isMounted) {
//           setAssignments(result)
//         }
//       })
//       .catch((e: unknown) => {
//         if (isMounted) {
//           setError(e instanceof Error ? e.message : 'Something went wrong.')
//         }
//       })

//     return () => {
//       isMounted = false
//     }
//   }, [])

//   /**
//    * @brief Starts editing an existing assignment.
//    *
//    * @param assignment The assignment selected for editing.
//    * @return Nothing.
//    */
//   function startEdit(assignment: Assignment): void {
//     setEditingUuid(assignment.uuid)
//     setForm({
//       name: assignment.name,
//       dueDate: assignment.dueDate,
//       gradingCriteria: assignment.gradingCriteria,
//       solutionType: assignment.solutionType as 'file' | 'text',
//       expectedOutputText: assignment.expectedOutputText ?? ''
//     })
//     setSelectedFile(null)
//     setDeleteConfirm(null)
//     setError(null)
//   }

//   /**
//    * @brief Cancels edit mode and resets the form.
//    *
//    * @return Nothing.
//    */
//   function cancelEdit(): void {
//     setEditingUuid(null)
//     setForm(emptyForm)
//     setSelectedFile(null)
//     setDeleteConfirm(null)
//     setError(null)
//   }

//   /**
//    * @brief Validates the current form before create/update.
//    *
//    * @return True if the form is valid; otherwise false.
//    */
//   function validateForm(): boolean {
//     const trimmedName = form.name.trim()
//     const trimmedDueDate = form.dueDate.trim()
//     const trimmedCriteria = form.gradingCriteria.trim()
//     const trimmedExpectedOutput = form.expectedOutputText.trim()

//     if (!trimmedName) {
//       setError('Assignment name is required.')
//       return false
//     }

//     if (!trimmedDueDate) {
//       setError('Due date is required.')
//       return false
//     }

//     if (!trimmedCriteria) {
//       setError('Grading criteria is required.')
//       return false
//     }

//     if (form.solutionType === 'text' && !trimmedExpectedOutput) {
//       setError('Expected output text is required for text solution mode.')
//       return false
//     }

//     if (form.solutionType === 'file' && !selectedFile && !editingUuid) {
//       setError('Please select a solution file.')
//       return false
//     }

//     setError(null)
//     return true
//   }

//   /**
//    * @brief Creates a new assignment or updates an existing one.
//    *
//    * @details
//    * For file mode, this version stores the selected file name and a temporary
//    * placeholder path value. Once your Electron main-process file-saving logic
//    * is ready, replace that placeholder with the real persisted path returned
//    * from IPC.
//    *
//    * @return Promise that resolves when the save operation completes.
//    */
//   async function handleSubmit(): Promise<void> {
//     if (!validateForm()) {
//       return
//     }

//     const trimmedName = form.name.trim()
//     const trimmedDueDate = form.dueDate.trim()
//     const trimmedCriteria = form.gradingCriteria.trim()
//     const trimmedExpectedOutput = form.expectedOutputText.trim()

//     try {
//       if (editingUuid) {
//         await window.api.assignments.update({
//           uuid: editingUuid,
//           name: trimmedName,
//           dueDate: trimmedDueDate,
//           gradingCriteria: trimmedCriteria,
//           solutionType: form.solutionType,
//           solutionFileName: form.solutionType === 'file' ? selectedFile?.name : undefined,
//           /**
//            * Replace this with a real saved file path later when
//            * main-process file persistence is implemented.
//            */
//           solutionFilePath:
//             form.solutionType === 'file' && selectedFile
//               ? `pending://${selectedFile.name}`
//               : undefined,
//           expectedOutputText: form.solutionType === 'text' ? trimmedExpectedOutput : undefined
//         })
//       } else {
//         await window.api.assignments.create({
//           name: trimmedName,
//           dueDate: trimmedDueDate,
//           gradingCriteria: trimmedCriteria,
//           solutionType: form.solutionType,
//           solutionFileName: form.solutionType === 'file' ? (selectedFile?.name ?? null) : null,
//           solutionFilePath:
//             form.solutionType === 'file' && selectedFile
//               ? // This is a placeholder path value.
//                 // Update with real path from IPC once file saving
//                 // is implemented. - AS
//                 `pending://${selectedFile.name}`
//               : null,
//           expectedOutputText: form.solutionType === 'text' ? trimmedExpectedOutput : null,
//           createdByUserUuid: null
//         })
//       }

//       setForm(emptyForm)
//       setSelectedFile(null)
//       setEditingUuid(null)
//       await loadAssignments()
//     } catch (e: unknown) {
//       setError(e instanceof Error ? e.message : 'Something went wrong.')
//     }
//   }

//   /**
//    * @brief Deletes an assignment by UUID.
//    *
//    * @param uuid UUID of the assignment to delete.
//    * @return Promise that resolves when deletion completes.
//    */
//   async function handleDelete(uuid: string): Promise<void> {
//     await window.api.assignments.delete(uuid)
//     setDeleteConfirm(null)
//     await loadAssignments()
//   }

//   return (
//     <div className="panel-shell">
//       <div className="panel-header">
//         <div>
//           <h2>Assignment Configuration</h2>
//           <p>
//             assignments · {assignments.length} row
//             {assignments.length !== 1 ? 's' : ''}
//           </p>
//         </div>

//         {editingUuid && (
//           <button onClick={cancelEdit} className="btn-ghost">
//             cancel edit
//           </button>
//         )}
//       </div>

//       <div className="panel-form">
//         <input
//           type="text"
//           placeholder="Assignment name"
//           value={form.name}
//           onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
//           className="panel-input"
//         />

//         <input
//           type="date"
//           value={form.dueDate}
//           onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
//           className="panel-input"
//         />

//         <textarea
//           placeholder="Grading criteria"
//           value={form.gradingCriteria}
//           onChange={(e) => setForm((f) => ({ ...f, gradingCriteria: e.target.value }))}
//           className="panel-input"
//           rows={4}
//         />

//         <div className="panel-section">
//           <label>
//             <input
//               type="radio"
//               name="solutionType"
//               checked={form.solutionType === 'text'}
//               onChange={() =>
//                 setForm((f) => ({
//                   ...f,
//                   solutionType: 'text'
//                 }))
//               }
//             />
//             text solution
//           </label>

//           <label style={{ marginLeft: '1rem' }}>
//             <input
//               type="radio"
//               name="solutionType"
//               checked={form.solutionType === 'file'}
//               onChange={() =>
//                 setForm((f) => ({
//                   ...f,
//                   solutionType: 'file',
//                   expectedOutputText: ''
//                 }))
//               }
//             />
//             file solution
//           </label>
//         </div>

//         {form.solutionType === 'text' ? (
//           <textarea
//             placeholder="Expected output text"
//             value={form.expectedOutputText}
//             onChange={(e) => setForm((f) => ({ ...f, expectedOutputText: e.target.value }))}
//             className="panel-input"
//             rows={5}
//           />
//         ) : (
//           <div className="panel-section">
//             <input
//               type="file"
//               onChange={(e) => {
//                 const file = e.target.files?.[0] ?? null
//                 setSelectedFile(file)
//               }}
//               className="panel-input"
//             />
//             {selectedFile && <p className="text-xs">selected file: {selectedFile.name}</p>}
//           </div>
//         )}

//         <button onClick={handleSubmit} className="btn-primary">
//           {editingUuid ? 'update assignment' : '+ create assignment'}
//         </button>

//         {error && <div className="panel-error">⚠ {error}</div>}
//       </div>

//       {assignments.length === 0 ? (
//         <div className="panel-empty">no assignments yet — add one above</div>
//       ) : (
//         <ul className="panel-list">
//           {assignments.map((assignment) => (
//             <li key={assignment.uuid} className="panel-list-item">
//               <div>
//                 <strong>{assignment.name}</strong>
//                 <div>due: {assignment.dueDate}</div>
//                 <div>solution type: {assignment.solutionType}</div>

//                 {assignment.solutionType === 'text' && assignment.expectedOutputText && (
//                   <div>expected output: {assignment.expectedOutputText}</div>
//                 )}

//                 {assignment.solutionType === 'file' && assignment.solutionFileName && (
//                   <div>solution file: {assignment.solutionFileName}</div>
//                 )}

//                 <div>created: {new Date(assignment.createdAt * 1000).toLocaleString()}</div>
//                 <div>uuid: {assignment.uuid.slice(0, 8)}…</div>
//               </div>

//               <div className="panel-actions">
//                 <button onClick={() => startEdit(assignment)} className="btn-ghost text-xs">
//                   edit
//                 </button>

//                 {deleteConfirm === assignment.uuid ? (
//                   <button
//                     onClick={() => handleDelete(assignment.uuid)}
//                     className="btn-ghost text-xs text-red-400"
//                   >
//                     confirm?
//                   </button>
//                 ) : (
//                   <button
//                     onClick={() => setDeleteConfirm(assignment.uuid)}
//                     className="btn-ghost text-xs"
//                   >
//                     delete
//                   </button>
//                 )}
//               </div>
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   )
// }

// export default AssignmentConfigPanel

import { useEffect, useState } from 'react'
import type { Assignment } from '../../../shared/types'

/**
 * @brief Local form state used by AssignmentConfigPanel.
 *
 * @details
 * This state mirrors the instructor-facing form fields for:
 * - UC9: Assignment Creation Button & Display
 * - UC10: Solution Upload Buttons & Display
 * - UC11: Solution Submission Button & Display
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
 * - UC9: Assignment creation and metadata entry
 * - UC10: Solution input selection via file upload or text entry
 * - UC11: Assignment solution submission with validation and feedback
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
   * @brief File currently selected by the instructor.
   *
   * @details
   * This is only used when solutionType === 'file'.
   * For now, the UI stores the selected file name and passes a placeholder path
   * value until full main-process file persistence is wired in.
   */
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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
    setSelectedFile(null)
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
    setSelectedFile(null)
    setDeleteConfirm(null)
    setStatusMessage(null)
    setError(null)
  }

  /**
   * @brief Validates the current form before create/update.
   *
   * @details
   * Validation reflects UC9, UC10, and UC11:
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

    if (form.solutionType === 'file' && !selectedFile && !editingUuid) {
      setError('Please select a solution file before submission.')
      return false
    }

    setError(null)
    return true
  }

  /**
   * @brief Creates a new assignment or updates an existing one.
   *
   * @details
   * For file mode, this version stores the selected file name and a temporary
   * placeholder path value. Once main-process file persistence is implemented,
   * replace the placeholder path with the real persisted path returned from IPC.
   *
   * @return Promise that resolves when the save operation completes.
   */
  async function handleSubmit(): Promise<void> {
    if (!validateForm()) {
      return
    }

    const trimmedName = form.name.trim()
    const trimmedDueDate = form.dueDate.trim()
    const trimmedCriteria = form.gradingCriteria.trim()
    const trimmedExpectedOutput = form.expectedOutputText.trim()

    try {
      if (editingUuid) {
        await window.api.assignments.update({
          uuid: editingUuid,
          name: trimmedName,
          dueDate: trimmedDueDate,
          gradingCriteria: trimmedCriteria,
          solutionType: form.solutionType,
          solutionFileName: form.solutionType === 'file' ? selectedFile?.name : undefined,
          solutionFilePath:
            form.solutionType === 'file' && selectedFile
              ? `pending://${selectedFile.name}`
              : undefined,
          expectedOutputText: form.solutionType === 'text' ? trimmedExpectedOutput : undefined
        })

        setStatusMessage('Assignment updated successfully.')
      } else {
        await window.api.assignments.create({
          name: trimmedName,
          dueDate: trimmedDueDate,
          gradingCriteria: trimmedCriteria,
          solutionType: form.solutionType,
          solutionFileName: form.solutionType === 'file' ? (selectedFile?.name ?? null) : null,
          solutionFilePath:
            form.solutionType === 'file' && selectedFile
              ? `pending://${selectedFile.name}`
              : null,
          expectedOutputText: form.solutionType === 'text' ? trimmedExpectedOutput : null,
          createdByUserUuid: null
        })

        setStatusMessage('Assignment created successfully.')
      }

      setForm(emptyForm)
      setSelectedFile(null)
      setEditingUuid(null)
      setDeleteConfirm(null)
      await loadAssignments()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
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

        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          className="panel-input"
        />

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
            <label className="field-label">Upload solution file</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setSelectedFile(file)
              }}
              className="panel-input"
            />
            {selectedFile && <p className="helper-text">Selected file: {selectedFile.name}</p>}
          </div>
        )}

        <div className="panel-subheader">
          <h3>Solution Submission</h3>
          <p>Submit the assignment only after the solution input has been provided.</p>
        </div>

        <button onClick={() => void handleSubmit()} className="btn-primary">
          {editingUuid ? 'Update Assignment' : '+ Create Assignment'}
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
