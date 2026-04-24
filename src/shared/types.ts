export type {
  User,
  NewUser,
  UpdateUser,
  Assignment,
  NewAssignment,
  UpdateAssignment,
  AssignmentTestCase,
  NewAssignmentTestCase
} from '../main/database/schema'
/**
 * types.ts
 *
 * Description:
 * This file defines shared TypeScript types used across the BatchGrade
 * application. These types ensure type safety and consistency between
 * the main process, renderer process, and database schemas.
 *
 * Exported Types:
 * - User: Represents a user entity with authentication and role information
 * - NewUser, UpdateUser: Database operation types for user management
 */
// export type { User, NewUser, UpdateUser } from '../main/database/schema'
export { VALID_ROLES, STUDENT_ROLE, INSTRUCTOR_ROLE } from '../main/database/schema'
