/**
 * users.ts
 *
 * Description:
 * This file contains database query functions for user management operations.
 * It provides CRUD (Create, Read, Update, Delete) functionality for users
 * in the BatchGrade application, using Drizzle ORM for database interactions.
 *
 * The functions handle data transformation between database schema types
 * and shared application types, ensuring type safety across the application.
 *
 * Exported Functions:
 * - getAllUsers: Retrieves all users from the database
 * - createUser: Creates a new user with provided data
 * - updateUser: Updates an existing user's information
 * - deleteUser: Removes a user from the database
 */

import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import { users } from '../schema'
import type { NewUser, UpdateUser, User as DbUser } from '../schema'
import type { User } from '../../../shared/types'
import { STUDENT_ROLE, INSTRUCTOR_ROLE, VALID_ROLES } from '../schema/user'

/**
 * toIpcUser Function
 *
 * Converts a database user record to the shared User type used by the IPC layer.
 * This ensures type consistency between the database schema and the application's
 * shared types, particularly for the role field which needs explicit typing.
 *
 * @param user - The database user record to convert
 * @returns User - The converted user object for IPC communication
 */
function toIpcUser(user: DbUser): User {
  if (!VALID_ROLES.includes(user.role)) {
    throw new Error(`Invalid role`)
  }
  return {
    uuid: user.uuid,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    password: user.password,
    role: user.role as typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE,
    createdAt: user.createdAt
  }
}

/**
 * getAllUsers Function
 *
 * Retrieves all users from the database and converts them to the shared User type.
 * This function is used by the user management interface to display all users.
 *
 * @returns User[] - Array of all users in the system
 */
export function getAllUsers(): User[] {
  return getDb().select().from(users).all().map(toIpcUser)
}

/**
 * createUser Function
 *
 * Creates a new user in the database with the provided user data.
 * The function validates that the user was successfully created and
 * returns the created user in the shared User format.
 *
 * @param data - The new user data to insert
 * @returns User - The created user object
 * @throws Error - If user creation fails
 */
export function createUser(data: NewUser): User {
  const created = getDb().insert(users).values(data).returning().get()
  if (!created) throw new Error('Failed to create user')
  return toIpcUser(created)
}

/**
 * updateUser Function
 *
 * Updates an existing user's information in the database.
 * Only provided fields are updated, allowing partial updates.
 * The function validates that at least one field is provided for update
 * and that the user exists before attempting the update.
 *
 * @param data - The update data containing uuid and fields to update
 * @returns User - The updated user object
 * @throws Error - If no fields provided or user not found
 */
export function updateUser(data: UpdateUser): User {
  const changes: Partial<Pick<DbUser, 'firstName' | 'lastName' | 'email' | 'password' | 'role'>> = {}

  // If first or last name is changed, update it. Otherwise, keep existing name.
  if (data.firstName !== undefined) {
    changes.firstName = data.firstName
  }

  if (data.lastName !== undefined) {
    changes.lastName = data.lastName
  }

  // If email is changed, update it. Otherwise, keep existing email.
  if (data.email !== undefined) {
    changes.email = data.email
  }

  // If password is changed, update it. Otherwise, keep existing password.
  if (data.password !== undefined) {
    changes.password = data.password
  }

  // If role is changed, update it. Otherwise, keep existing role.
  if (data.role !== undefined) {
    changes.role = data.role
  }

  // If no fields are provided to update, throw an error. Should not allow empty updates.
  if (Object.keys(changes).length === 0) {
    throw new Error('No fields provided to update')
  }

  const updated = getDb()
    .update(users)
    .set(changes)
    .where(eq(users.uuid, data.uuid))
    .returning()
    .get()

  if (!updated) throw new Error(`User not found: ${data.uuid}`)
  return toIpcUser(updated)
}

/**
 * deleteUser Function
 *
 * Removes a user from the database by their UUID.
 * The function validates that the user exists before deletion
 * and returns the deleted user data.
 *
 * @param uuid - The UUID of the user to delete
 * @returns User - The deleted user object
 * @throws Error - If user not found
 */
export function deleteUser(uuid: string): User {
  const deleted = getDb().delete(users).where(eq(users.uuid, uuid)).returning().get()

  if (!deleted) throw new Error(`User not found: ${uuid}`)
  return toIpcUser(deleted)
}
