import { describe, it, expect, beforeEach } from 'vitest'
import { assignments, submissions, grades, compileLogs } from '../../src/main/database/schema/local.ts'
import { getDb } from '../../src/main/database/index'

// Wipes the tables before each test to ensure a clean state
beforeEach(async () => {
    const db = getDb()
    // Delete in order of dependency (child to parent) to avoid FK errors
    db.delete(grades).run()
    db.delete(compileLogs).run()
    db.delete(submissions).run()
    db.delete(assignments).run()
    })

    describe('Local Schema Coverage', () => {
    it('covers line 8: assignment uuid defaultFn', () => {
        // Omitting 'uuid' and 'createdAt' forces the engine to run lines 9 and 14
        const inserted = getDb().insert(assignments).values({
        title: 'Coverage Test Assignment',
        }).returning().get()

        expect(inserted.uuid).toBeTruthy()
        expect(typeof inserted.createdAt).toBe('number')
    })

    it('covers line 23: submission status default', () => {
        const a = getDb().insert(assignments).values({ title: 'Parent' }).returning().get()

        // Omitting 'status' forces the engine to run line 33
        const sub = getDb().insert(submissions).values({
        assignmentId: a.uuid,
        fileContent: 'test data',
        fileSize: 1024,
        }).returning().get()

        expect(sub.status).toBe('not submitted')
        expect(sub.uuid).toBeTruthy() // Also hits line 24
    })

    it('covers line 56: compileLog uuid defaultFn', () => {
        const a = getDb().insert(assignments).values({ title: 'Log Parent' }).returning().get()

        // Omitting 'uuid' forces the engine to run line 41
        const log = getDb().insert(compileLogs).values({
        submissionId: a.uuid,
        status: 'success',
        }).returning().get()

        expect(log.uuid).toBeTruthy()
    })

    it('covers grades table defaults', () => {
        const a = getDb().insert(assignments).values({ title: 'Grade Parent' }).returning().get()
        const s = getDb().insert(submissions).values({ 
        assignmentId: a.uuid, 
        fileContent: 'grading', 
        fileSize: 50 
        }).returning().get()

        // Omitting 'gradedAt' triggers the unixepoch default
        const grade = getDb().insert(grades).values({
        submissionId: s.uuid,
        score: 100,
        }).returning().get()

        expect(grade.uuid).toBeTruthy() 
        expect(grade.gradedAt).toBeDefined()
    })
})
