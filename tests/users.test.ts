import { describe, it, expect, beforeEach } from 'vitest'
import { createUser, getAllUsers, updateUser, deleteUser } from '../src/main/database/queries/users'

// Wipes the users table before each test so they don't affect each other
beforeEach(async () => {
  const { getDb } = await import('../src/main/database/index')
  const { users } = await import('../src/main/database/schema')
  getDb().delete(users).run()
})

describe('User Queries', () => {
  it('Creates a user', () => {
    const user = createUser({ email: 'test@test.com', password: 'hashed_pw' })
    expect(user.email).toBe('test@test.com')
    expect(user.uuid).toBeTruthy()
  })

  it('Gets all users', () => {
    createUser({ email: 'a@test.com', password: 'pw' })
    createUser({ email: 'b@test.com', password: 'pw' })
    expect(getAllUsers()).toHaveLength(2)
  })

  it('Updates a user email', () => {
    const user = createUser({ email: 'old@test.com', password: 'pw' })
    const updated = updateUser({ uuid: user.uuid, email: 'new@test.com', password: 'pw' })
    expect(updated.email).toBe('new@test.com')
  })

  it('Updates only one field when partial payload is provided', () => {
    const user = createUser({ email: 'keep@test.com', password: 'secret' })
    const updated = updateUser({ uuid: user.uuid, email: 'changed@test.com' })
    expect(updated.email).toBe('changed@test.com')
    expect(updated.password).toBe('secret')
  })

  it('Deletes a user', () => {
    const user = createUser({ email: 'gone@test.com', password: 'pw' })
    deleteUser(user.uuid)
    expect(getAllUsers()).toHaveLength(0)
  })

  it('Throws when updating a user that does not exist', () => {
    expect(() =>
      updateUser({ uuid: 'fake-uuid', email: '~x~@~x~.com', password: 'pw' })
    ).toThrow('User not found')
  })

  it('Throws when deleting a user that does not exist', () => {
    expect(() => deleteUser('fake-uuid')).toThrow('User not found')
  })

  it('Throws when updating without any fields', () => {
    const user = createUser({ email: 'blank@test.com', password: 'pw' })
    expect(() => updateUser({ uuid: user.uuid })).toThrow('No fields provided to update')
  })

  it('Throws when creating a duplicate email', () => {
    createUser({ email: 'dupe@test.com', password: 'pw' })
    expect(() => createUser({ email: 'dupe@test.com', password: 'pw2' })).toThrow(
      /UNIQUE constraint failed/i
    )
  })
})


it('userWithInvalidRole_getAllUsers_throwsInvalidRole', async () => {
    // Insert a row directly bypassing createUser so we can force an invalid role
    const { getDb } = await import('../src/main/database/index')
    const { users } = await import('../src/main/database/schema')
    getDb()
      .insert(users)
      .values({ email: 'badrole@test.com', password: 'pw', role: 'superadmin' })
      .run()
 
    expect(() => getAllUsers()).toThrow('Invalid role')
  })
 
  it('userWithValidInstructorRole_updateRole_reflectsNewRole', () => {
    const user = createUser({ email: 'rolechange@test.com', password: 'pw' })
    const updated = updateUser({ uuid: user.uuid, role: 'instructor' })
    expect(updated.role).toBe('instructor')
  })
