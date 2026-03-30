import { describe, it, expect, beforeEach } from 'vitest'

// Wipes gradebook tables before each test in FK-safe order
beforeEach(async () => {
  const { getDb } = await import('../src/main/database/index')
  const { grades, submissions, assignments, sections, courses, instructors, users } = await import(
    '../src/main/database/schema'
  )
  getDb().delete(grades).run()
  getDb().delete(submissions).run()
  getDb().delete(assignments).run()
  getDb().delete(sections).run()
  getDb().delete(instructors).run()
  getDb().delete(courses).run()
  getDb().delete(users).run()
})

// ─── Assignments ─────────────────────────────────────────────────────────────

describe('Gradebook Assignment Schema', () => {
  it('existingSection_insertAssignment_generatesUuidAndStoresFields', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignments, sections, instructors, courses, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'prof@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: user.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS101', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: user.uuid, semester: 'Spring 2026' })
      .returning()
      .get()

    const result = getDb()
      .insert(assignments)
      .values({ sectionId: section.uuid, title: 'PA1', dueDate: 1743465600 })
      .returning()
      .get()

    expect(result.uuid).toBeTruthy()
    expect(result.title).toBe('PA1')
    expect(result.sectionId).toBe(section.uuid)
  })

  it('twoAssignments_selectAll_returnsBothRecords', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { assignments, sections, instructors, courses, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'prof2@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: user.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS102', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: user.uuid, semester: 'Spring 2026' })
      .returning()
      .get()

    getDb().insert(assignments).values({ sectionId: section.uuid, title: 'PA1', dueDate: 1743465600 }).run()
    getDb().insert(assignments).values({ sectionId: section.uuid, title: 'PA2', dueDate: 1744070400 }).run()

    expect(getDb().select().from(assignments).all()).toHaveLength(2)
  })
})

// ─── Submissions ─────────────────────────────────────────────────────────────

describe('Submission Schema', () => {
  it('existingAssignmentAndStudent_insertSubmission_defaultsToNotSubmittedStatus', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { submissions, assignments, sections, instructors, courses, users } = await import(
      '../src/main/database/schema'
    )
    const profUser = getDb().insert(users).values({ email: 'prof3@test.com', password: 'pw' }).returning().get()
    const stuUser = getDb().insert(users).values({ email: 'stu@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: profUser.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS103', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: profUser.uuid, semester: 'Spring 2026' })
      .returning()
      .get()
    const assignment = getDb()
      .insert(assignments)
      .values({ sectionId: section.uuid, title: 'HW1', dueDate: 1743465600 })
      .returning()
      .get()

    const result = getDb()
      .insert(submissions)
      .values({ assignmentId: assignment.uuid, studentId: stuUser.uuid, fileName: 'main.cpp', fileSize: 1024 })
      .returning()
      .get()

    expect(result.uuid).toBeTruthy()
    expect(result.status).toBe('not submitted')
    expect(result.fileName).toBe('main.cpp')
    expect(result.fileSize).toBe(1024)
  })

  it('submissionWithFileContent_insert_storesContent', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { submissions, assignments, sections, instructors, courses, users } = await import(
      '../src/main/database/schema'
    )
    const profUser = getDb().insert(users).values({ email: 'prof4@test.com', password: 'pw' }).returning().get()
    const stuUser = getDb().insert(users).values({ email: 'stu2@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: profUser.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS104', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: profUser.uuid, semester: 'Spring 2026' })
      .returning()
      .get()
    const assignment = getDb()
      .insert(assignments)
      .values({ sectionId: section.uuid, title: 'HW2', dueDate: 1743465600 })
      .returning()
      .get()

    const result = getDb()
      .insert(submissions)
      .values({
        assignmentId: assignment.uuid,
        studentId: stuUser.uuid,
        fileName: 'solution.cpp',
        fileSize: 512,
        fileContent: '#include<iostream>',
        status: 'submitted'
      })
      .returning()
      .get()

    expect(result.fileContent).toBe('#include<iostream>')
    expect(result.status).toBe('submitted')
  })

  it('submissionWithDefaultFileName_insert_usesNADefault', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { submissions, assignments, sections, instructors, courses, users } = await import(
      '../src/main/database/schema'
    )
    const profUser = getDb().insert(users).values({ email: 'prof5@test.com', password: 'pw' }).returning().get()
    const stuUser = getDb().insert(users).values({ email: 'stu3@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: profUser.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS105', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: profUser.uuid, semester: 'Spring 2026' })
      .returning()
      .get()
    const assignment = getDb()
      .insert(assignments)
      .values({ sectionId: section.uuid, title: 'HW3', dueDate: 1743465600 })
      .returning()
      .get()

    const result = getDb()
      .insert(submissions)
      .values({ assignmentId: assignment.uuid, studentId: stuUser.uuid })
      .returning()
      .get()

    expect(result.fileName).toBe('N/A')
    expect(result.fileSize).toBe(0)
  })
})

// ─── Grades ──────────────────────────────────────────────────────────────────

describe('Grade Schema', () => {
  it('existingSubmissionAndInstructor_insertGrade_generatesUuidAndStoresScore', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { grades, submissions, assignments, sections, instructors, courses, users } = await import(
      '../src/main/database/schema'
    )
    const profUser = getDb().insert(users).values({ email: 'prof6@test.com', password: 'pw' }).returning().get()
    const stuUser = getDb().insert(users).values({ email: 'stu4@test.com', password: 'pw' }).returning().get()
    const graderUser = getDb().insert(users).values({ email: 'grader@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: profUser.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS106', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: profUser.uuid, semester: 'Spring 2026' })
      .returning()
      .get()
    const assignment = getDb()
      .insert(assignments)
      .values({ sectionId: section.uuid, title: 'HW4', dueDate: 1743465600 })
      .returning()
      .get()
    const submission = getDb()
      .insert(submissions)
      .values({ assignmentId: assignment.uuid, studentId: stuUser.uuid })
      .returning()
      .get()

    const result = getDb()
      .insert(grades)
      .values({ submissionId: submission.uuid, instructorId: graderUser.uuid, score: 95 })
      .returning()
      .get()

    expect(result.uuid).toBeTruthy()
    expect(result.score).toBe(95)
    expect(result.instructorId).toBe(graderUser.uuid)
  })

  it('gradeWithFeedback_insert_storesFeedbackText', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { grades, submissions, assignments, sections, instructors, courses, users } = await import(
      '../src/main/database/schema'
    )
    const profUser = getDb().insert(users).values({ email: 'prof7@test.com', password: 'pw' }).returning().get()
    const stuUser = getDb().insert(users).values({ email: 'stu5@test.com', password: 'pw' }).returning().get()
    const graderUser = getDb().insert(users).values({ email: 'grader2@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: profUser.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS107', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: profUser.uuid, semester: 'Spring 2026' })
      .returning()
      .get()
    const assignment = getDb()
      .insert(assignments)
      .values({ sectionId: section.uuid, title: 'HW5', dueDate: 1743465600 })
      .returning()
      .get()
    const submission = getDb()
      .insert(submissions)
      .values({ assignmentId: assignment.uuid, studentId: stuUser.uuid })
      .returning()
      .get()

    const result = getDb()
      .insert(grades)
      .values({
        submissionId: submission.uuid,
        instructorId: graderUser.uuid,
        score: 80,
        feedback: 'Good work but missing edge cases'
      })
      .returning()
      .get()

    expect(result.feedback).toBe('Good work but missing edge cases')
    expect(result.gradedAt).toBeTruthy()
  })

  it('gradeWithZeroScore_insert_storesZero', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { grades, submissions, assignments, sections, instructors, courses, users } = await import(
      '../src/main/database/schema'
    )
    const profUser = getDb().insert(users).values({ email: 'prof8@test.com', password: 'pw' }).returning().get()
    const stuUser = getDb().insert(users).values({ email: 'stu6@test.com', password: 'pw' }).returning().get()
    const graderUser = getDb().insert(users).values({ email: 'grader3@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: profUser.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb().insert(courses).values({ courseCode: 'CS108', title: 'Course', credits: 3 }).returning().get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: profUser.uuid, semester: 'Spring 2026' })
      .returning()
      .get()
    const assignment = getDb()
      .insert(assignments)
      .values({ sectionId: section.uuid, title: 'HW6', dueDate: 1743465600 })
      .returning()
      .get()
    const submission = getDb()
      .insert(submissions)
      .values({ assignmentId: assignment.uuid, studentId: stuUser.uuid })
      .returning()
      .get()

    const result = getDb()
      .insert(grades)
      .values({ submissionId: submission.uuid, instructorId: graderUser.uuid, score: 0 })
      .returning()
      .get()

    expect(result.score).toBe(0)
  })
})
