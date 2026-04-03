/**
 * UserPanel.tsx
 *
 * Description:
 * This component provides a complete user management interface for the
 * BatchGrade application. It allows administrators to view, create, edit,
 * and delete user accounts. The panel displays users in a list format with
 * inline editing capabilities and includes form validation and error handling.
 *
 * Features:
 * - Display list of all users with creation dates and UUIDs
 * - Add new users with email and password
 * - Edit existing users (email and optional password update)
 * - Delete users with confirmation
 * - Real-time form validation and error display
 * - Responsive design with Tailwind CSS styling
 */

import { useEffect, useState } from 'react'
import type { User } from '../../../shared/types'
import { VALID_ROLES, STUDENT_ROLE, INSTRUCTOR_ROLE } from '../../../shared/types'

/**
 * Form State Type
 *
 * Represents the state of the user creation/editing form.
 * Contains the current values of form inputs.
 */
type FormState = {
  email: string
  password: string
  role: typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE
}

/** Default empty form state */
const emptyForm: FormState = { email: '', password: '', role: STUDENT_ROLE }

/**
 * UserPanel Component
 *
 * Main component for user management. Handles all CRUD operations
 * for users through the Electron API and provides a clean UI for
 * administrators to manage the user base.
 *
 * @returns UserPanel(): React.JSX.Element
 */
export function UserPanel(): React.JSX.Element {
  // State management for users list, form data, and UI states
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUsers, setShowUsers] = useState(false)

  /**
   * Load Users Function
   *
   * Fetches all users from the database via the Electron API
   * and updates the local state. Used after create, update, or delete operations.
   */
  const loadUsers = async (): Promise<void> => {
    const result = await window.api.users.getAll()
    setUsers(result)
  }

  // Load users on component mount with cleanup to prevent state updates on unmounted component
  useEffect(() => {
    let isMounted = true

    window.api.users
      .getAll()
      .then((result) => {
        if (isMounted) {
          setUsers(result)
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
   * Start Edit Function
   *
   * Initiates editing mode for a specific user. Populates the form
   * with the user's current email, role, and clears any existing errors.
   *
   * @param user - The user object to edit
   */
  function startEdit(user: User): void {
    // Hide the user list modal
    setShowUsers(false)
    setEditingUuid(user.uuid)
    setForm({
      email: user.email,
      password: '',
      role: VALID_ROLES.includes(user.role as typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE)
        ? (user.role as typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE)
        : STUDENT_ROLE
    })
    setError(null)
  }

  /**
   * Cancel Edit Function
   *
   * Exits editing mode, resets the form to empty state,
   * and clears any errors.
   */
  function cancelEdit(): void {
    setEditingUuid(null)
    setForm(emptyForm)
    setError(null)
  }

  /**
   * Handle Submit Function
   *
   * Processes form submission for both creating new users and updating
   * existing users. Performs validation, calls the appropriate API method,
   * and refreshes the user list on success.
   */
  async function handleSubmit(): Promise<void> {
    const trimmedEmail = form.email.trim()
    const trimmedPassword = form.password.trim()

    if (!trimmedEmail) {
      setError('Email is required.')
      return
    }

    if (!editingUuid && !trimmedPassword) {
      setError('Password is required.')
      return
    }

    setError(null)

    try {
      if (editingUuid) {
        await window.api.users.update({
          uuid: editingUuid,
          email: trimmedEmail,
          role: form.role,
          ...(trimmedPassword ? { password: trimmedPassword } : {})
        })
      } else {
        await window.api.users.create({
          email: trimmedEmail,
          password: trimmedPassword,
          role: form.role
        })
      }

      setForm(emptyForm)
      setEditingUuid(null)
      await loadUsers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  /**
   * Handle Delete Function
   *
   * Deletes a user by UUID, clears the delete confirmation state,
   * and refreshes the user list.
   *
   * @param uuid - The UUID of the user to delete
   */
  async function handleDelete(uuid: string): Promise<void> {
    await window.api.users.delete(uuid)
    setDeleteConfirm(null)
    await loadUsers()
  }

  return (
    <div className="userpanel-container">
      {/* Header section with user count and cancel edit button */}

      {/* Form section for adding/editing users */}
      <div className="userpanel-form">
        <input
          type="email"
          placeholder="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="userpanel-input"
        />
        <input
          type="password"
          placeholder="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="userpanel-input"
        />
        <select
          value={form.role}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              role: e.target.value as typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE
            }))
          }
          className="userpanel-input"
        >
          <option value={STUDENT_ROLE}>student</option>
          <option value={INSTRUCTOR_ROLE}>instructor</option>
        </select>
        <div className="userpanel-buttons">
          <button onClick={handleSubmit} className="primary-button">
            {editingUuid ? 'Update' : '+ Add'}
          </button>

          <button
            className="secondary-button"
            onClick={editingUuid ? cancelEdit : () => setShowUsers(true)}
          >
            {editingUuid ? 'Cancel Edit' : 'Show Users'}
          </button>
        </div>
      </div>

      {/* Error message display */}
      {error && <div className="error">⚠ {error}</div>}

      {/* Users list or empty state, toggled by showUsers */}
      {showUsers && (
        <div className="userpanel-modal-overlay" onClick={() => setShowUsers(false)}>
          <div className="userpanel-modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs uppercase tracking-widest opacity-50">
              users · {users.length} row{users.length !== 1 ? 's' : ''}
            </span>
            {/* User list or empty state message */}
            {users.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs opacity-30">no users yet</div>
            ) : (
              <ul>
                {users.map((user, i) => (
                  <li
                    key={user.uuid}
                    className={`flex items-center justify-between gap-2 px-4 py-2.5 transition-colors
                      ${i < users.length - 1 ? 'border-b border-white/[0.06]' : ''}
                      ${editingUuid === user.uuid ? 'bg-sky-400/5' : 'hover:bg-white/[0.03]'}
                    `}
                  >
                    {/* User information display */}
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="font-medium truncate">{user.email}</span>
                      <span className="text-xs opacity-35">
                        {user.role} · {new Date(user.createdAt * 1000).toLocaleString()} ·{' '}
                        {user.uuid.slice(0, 8)}…
                      </span>
                    </div>

                    {/* Action buttons for edit and delete */}
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => startEdit(user)} className="btn-ghost text-xs">
                        edit
                      </button>
                      {deleteConfirm === user.uuid ? (
                        <button
                          onClick={() => handleDelete(user.uuid)}
                          className="btn-ghost text-xs text-red-400 border-red-400/40 hover:bg-red-400/10"
                        >
                          confirm?
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(user.uuid)}
                          className="btn-ghost text-xs"
                        >
                          delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
