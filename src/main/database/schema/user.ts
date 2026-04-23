import { sql, InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const STUDENT_ROLE = 'student'
export const INSTRUCTOR_ROLE = 'instructor'
export const VALID_ROLES = [STUDENT_ROLE, INSTRUCTOR_ROLE]

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
export type UpdateUser = Pick<User, 'uuid'> &
  Partial<Pick<User, 'firstName' | 'lastName' | 'email' | 'password' | 'role'>>

export const users = sqliteTable('users', {
  uuid: text('uuid')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull().default(STUDENT_ROLE),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(unixepoch())`)
})
