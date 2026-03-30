import { describe, it, expect, beforeEach } from 'vitest'

// Wipes all academic-related tables before each test in FK-safe order
beforeEach(async () => {
  const { getDb } = await import('../src/main/database/index')
  const { enrollments, sections, instructors, students, teaching_assistants, courses, users } =
    await import('../src/main/database/schema')
  getDb().delete(enrollments).run()
  getDb().delete(sections).run()
  getDb().delete(instructors).run()
  getDb().delete(students).run()
  getDb().delete(teaching_assistants).run()
  getDb().delete(courses).run()
  getDb().delete(users).run()
})

// ─── Instructors ─────────────────────────────────────────────────────────────

describe('Instructor Schema', () => {
  it('emptyTable_insertInstructor_createsRecordWithCorrectFields', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { instructors, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'prof@test.com', password: 'pw' }).returning().get()

    const result = getDb()
      .insert(instructors)
      .values({ uuid: user.uuid, firstName: 'John', lastName: 'Doe' })
      .returning()
      .get()

    expect(result.uuid).toBe(user.uuid)
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBe('Doe')
  })

  it('existingInstructor_selectAll_returnsOneRecord', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { instructors, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'prof2@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: user.uuid, firstName: 'Jane', lastName: 'Smith' }).run()

    expect(getDb().select().from(instructors).all()).toHaveLength(1)
  })

  it('userDeleted_cascadeDelete_removesInstructor', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { instructors, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'prof3@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: user.uuid, firstName: 'A', lastName: 'B' }).run()

    getDb().delete(users).run()

    expect(getDb().select().from(instructors).all()).toHaveLength(0)
  })
})

// ─── Students ────────────────────────────────────────────────────────────────

describe('Student Schema', () => {
  it('emptyTable_insertStudent_createsRecordWithCorrectFields', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { students, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'stu@test.com', password: 'pw' }).returning().get()

    const result = getDb()
      .insert(students)
      .values({ uuid: user.uuid, firstName: 'Alice', lastName: 'Wonder' })
      .returning()
      .get()

    expect(result.uuid).toBe(user.uuid)
    expect(result.firstName).toBe('Alice')
    expect(result.lastName).toBe('Wonder')
  })

  it('twoStudentsInserted_selectAll_returnsBothRecords', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { students, users } = await import('../src/main/database/schema')
    const u1 = getDb().insert(users).values({ email: 'stu1@test.com', password: 'pw' }).returning().get()
    const u2 = getDb().insert(users).values({ email: 'stu2@test.com', password: 'pw' }).returning().get()
    getDb().insert(students).values({ uuid: u1.uuid, firstName: 'Bob', lastName: 'A' }).run()
    getDb().insert(students).values({ uuid: u2.uuid, firstName: 'Carol', lastName: 'B' }).run()

    expect(getDb().select().from(students).all()).toHaveLength(2)
  })

  it('userDeleted_cascadeDelete_removesStudent', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { students, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'stu3@test.com', password: 'pw' }).returning().get()
    getDb().insert(students).values({ uuid: user.uuid, firstName: 'C', lastName: 'D' }).run()

    getDb().delete(users).run()

    expect(getDb().select().from(students).all()).toHaveLength(0)
  })
})

// ─── Teaching Assistants ─────────────────────────────────────────────────────

describe('Teaching Assistant Schema', () => {
  it('emptyTable_insertTA_createsRecordWithCorrectFields', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { teaching_assistants, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'ta@test.com', password: 'pw' }).returning().get()

    const result = getDb()
      .insert(teaching_assistants)
      .values({ uuid: user.uuid, firstName: 'TA', lastName: 'One' })
      .returning()
      .get()

    expect(result.uuid).toBe(user.uuid)
    expect(result.firstName).toBe('TA')
  })

  it('userDeleted_cascadeDelete_removesTA', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { teaching_assistants, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'ta2@test.com', password: 'pw' }).returning().get()
    getDb().insert(teaching_assistants).values({ uuid: user.uuid, firstName: 'T', lastName: 'A' }).run()

    getDb().delete(users).run()

    expect(getDb().select().from(teaching_assistants).all()).toHaveLength(0)
  })
})

// ─── Courses ─────────────────────────────────────────────────────────────────

describe('Course Schema', () => {
  it('emptyTable_insertCourse_generatesUuidAndStoresFields', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { courses } = await import('../src/main/database/schema')

    const result = getDb()
      .insert(courses)
      .values({ courseCode: 'CS101', title: 'Intro to CS', credits: 3 })
      .returning()
      .get()

    expect(result.uuid).toBeTruthy()
    expect(result.courseCode).toBe('CS101')
    expect(result.title).toBe('Intro to CS')
    expect(result.credits).toBe(3)
  })

  it('courseWithOptionalDescription_insert_storesDescription', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { courses } = await import('../src/main/database/schema')

    const result = getDb()
      .insert(courses)
      .values({ courseCode: 'CS201', title: 'Data Structures', description: 'Arrays and trees', credits: 3 })
      .returning()
      .get()

    expect(result.description).toBe('Arrays and trees')
  })

  it('duplicateCourseCode_insert_throwsUniqueConstraint', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { courses } = await import('../src/main/database/schema')
    getDb().insert(courses).values({ courseCode: 'CS301', title: 'Algorithms', credits: 3 }).run()

    expect(() =>
      getDb().insert(courses).values({ courseCode: 'CS301', title: 'Algorithms 2', credits: 3 }).run()
    ).toThrow(/UNIQUE constraint failed/i)
  })
})

// ─── Sections ────────────────────────────────────────────────────────────────

describe('Section Schema', () => {
  it('existingCourseAndInstructor_insertSection_generatesUuidAndStoresFields', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { sections, instructors, courses, users } = await import('../src/main/database/schema')
    const user = getDb().insert(users).values({ email: 'sec_prof@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: user.uuid, firstName: 'F', lastName: 'L' }).run()
    const course = getDb()
      .insert(courses)
      .values({ courseCode: 'CS401', title: 'OS', credits: 3 })
      .returning()
      .get()

    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: user.uuid, semester: 'Spring 2026' })
      .returning()
      .get()

    expect(section.uuid).toBeTruthy()
    expect(section.semester).toBe('Spring 2026')
    expect(section.courseId).toBe(course.uuid)
  })
})

// ─── Enrollments ─────────────────────────────────────────────────────────────

describe('Enrollment Schema', () => {
  it('existingStudentAndSection_insertEnrollment_generatesUuidAndLinksCorrectly', async () => {
    const { getDb } = await import('../src/main/database/index')
    const { sections, instructors, students, enrollments, courses, users } = await import(
      '../src/main/database/schema'
    )
    const profUser = getDb().insert(users).values({ email: 'enr_prof@test.com', password: 'pw' }).returning().get()
    const stuUser = getDb().insert(users).values({ email: 'enr_stu@test.com', password: 'pw' }).returning().get()
    getDb().insert(instructors).values({ uuid: profUser.uuid, firstName: 'F', lastName: 'L' }).run()
    getDb().insert(students).values({ uuid: stuUser.uuid, firstName: 'S', lastName: 'T' }).run()
    const course = getDb()
      .insert(courses)
      .values({ courseCode: 'CS501', title: 'Networks', credits: 3 })
      .returning()
      .get()
    const section = getDb()
      .insert(sections)
      .values({ courseId: course.uuid, instructorId: profUser.uuid, semester: 'Fall 2026' })
      .returning()
      .get()

    const enrollment = getDb()
      .insert(enrollments)
      .values({ studentId: stuUser.uuid, sectionId: section.uuid })
      .returning()
      .get()

    expect(enrollment.uuid).toBeTruthy()
    expect(enrollment.studentId).toBe(stuUser.uuid)
    expect(enrollment.sectionId).toBe(section.uuid)
  })
})
