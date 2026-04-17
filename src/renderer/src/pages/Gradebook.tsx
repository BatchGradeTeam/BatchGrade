/**
 * Gradebook.tsx
 *
 * Description:
 * This component implements the Gradebook interface for instructors
 * within the BatchGrade platform. The Gradebook allows instructors to
 * view the highest score achieved by each student for a selected assignment,
 * along with submission details and class statistics.
 *
 * Key features include:
 *  - Assignment selection dropdown to switch between different assignments
 *  - Search functionality to filter students by name or ID
 *  - Sorting options to organize students by name or score
 *  - Class statistics summary showing average, highest, and lowest scores
 *  - Export functionality to download the currently displayed gradebook as a CSV file
 * MVP-4 Frontend Implementation
 * Displays the highest score each student achieved for a selected assignment.
 */

import { useState, useEffect } from 'react' // Import React hooks used for component state and side effects
import { NavBar } from '../components/Navbar' // Import the navigation bar component
import { Footer } from '../components/Footer' // Import the footer component
import type { GradebookRecord } from '../../../shared/gradebookTypes'
import { loadGradebookRecords } from '../lib/gradebookStorage'

// =============================================================================
// Helper Types
// =============================================================================
type StudentRecord = {
  id: string
  name: string
  score: string
  lastSubmitted: string
  status: string
}

type GradeStats = {
  averageScore: string
  highestScore: number | string
  lowestScore: number | string
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Converts a score string into a numeric value.
 *
 * @param score - Score string (e.g., "92%" or "--")
 * @returns Parsed numeric score, or null if the score is missing
 */
const parseScore = (score: string): number | null => {
  return score === '--' ? null : parseInt(score)
}

/**
 * Filters students based on a search term.
 * Matches against student name (case-insensitive) or student ID.
 *
 * @param students - List of student records
 * @param searchTerm - User input for searching
 * @returns Filtered list of students
 */
const filterStudents = (students: StudentRecord[], searchTerm: string): StudentRecord[] => {
  const normalizedSearch = searchTerm.toLowerCase()

  return students.filter(
    (student) =>
      student.name.toLowerCase().includes(normalizedSearch) || student.id.includes(searchTerm)
  )
}

/**
 * Sorts students based on the selected sort option.
 *
 * Supported options:
 * - "name-asc"
 * - "name-desc"
 * - "score-asc"
 * - "score-desc"
 *
 * @param students - List of student records
 * @param sortOption - Selected sorting option
 * @returns New sorted array of students
 */
const sortStudents = (students: StudentRecord[], sortOption: string): StudentRecord[] => {
  return [...students].sort((a, b) => {
    if (sortOption === 'name-asc') return a.name.localeCompare(b.name)
    if (sortOption === 'name-desc') return b.name.localeCompare(a.name)

    const scoreA = parseScore(a.score) ?? -1
    const scoreB = parseScore(b.score) ?? -1

    if (sortOption === 'score-asc') return scoreA - scoreB
    if (sortOption === 'score-desc') return scoreB - scoreA

    return 0
  })
}

/**
 * Calculates class statistics including average, highest, and lowest scores.
 * Only valid numeric scores are considered.
 *
 * @param students - List of student records
 * @returns Object containing average, highest, and lowest scores
 */
const calculateStats = (students: StudentRecord[]): GradeStats => {
  const validScores = students
    .map((student) => parseScore(student.score))
    .filter((score): score is number => score !== null)

  if (validScores.length === 0) {
    return {
      averageScore: '--',
      highestScore: '--',
      lowestScore: '--'
    }
  }

  const averageScore = (
    validScores.reduce((sum, score) => sum + score, 0) / validScores.length
  ).toFixed(1)

  return {
    averageScore,
    highestScore: Math.max(...validScores),
    lowestScore: Math.min(...validScores)
  }
}

/**
 * Builds CSV-formatted string content for gradebook export.
 *
 * Includes:
 * - Student ID
 * - Student Name
 * - Highest Score
 * - Submission Count
 *
 * @param students - List of student records to export
 * @returns CSV string content
 */
const buildCSVContent = (students: StudentRecord[]): string => {
  const headers = ['Student ID', 'Student Name', 'Highest Score']

  const rows = students.map((student) => [student.id, student.name, student.score])

  return [headers, ...rows].map((row) => row.join(',')).join('\n')
}

/**
 * Formats a saved timestamp into a readable local date/time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string
 */
const formatSubmittedTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString()
}

/**
 * Builds Gradebook table rows from saved Gradebook records.
 * Keeps the highest score per student and counts total submissions.
 *
 * @param records - All saved Gradebook records
 * @param assignmentId - Selected assignment id
 * @returns Student records for the Gradebook table
 */
const buildStudentRecordsFromGradebook = (
  records: GradebookRecord[],
  assignmentId: string
): StudentRecord[] => {
  const assignmentRecords = records.filter((record) => record.assignmentId === assignmentId)

  const groupedRecords = new Map<string, GradebookRecord[]>()

  assignmentRecords.forEach((record) => {
    const existing = groupedRecords.get(record.studentId) ?? []
    groupedRecords.set(record.studentId, [...existing, record])
  })

  return Array.from(groupedRecords.values()).map((studentRecords) => {
    const highestRecord = studentRecords.reduce((best, current) =>
      current.score > best.score ? current : best
    )

    const latestRecord = studentRecords.reduce((latest, current) =>
      current.submittedAt > latest.submittedAt ? current : latest
    )

    return {
      id: latestRecord.studentId,
      name: latestRecord.studentName,
      score: `${highestRecord.score}%`,
      lastSubmitted: formatSubmittedTime(latestRecord.submittedAt),
      status: latestRecord.status === 'failed' ? 'Failed' : 'Submitted'
    }
  })
}

// =============================================================================
// Gradebook page component
// Displays the highest score each student achieved for the selected assignment
// =============================================================================
export function Gradebook(): React.JSX.Element {
  // Stores the currently selected assignment id.
  const [selectedAssignment, setSelectedAssignment] = useState('assignment-1')

  // Stores all saved Gradebook records loaded from localStorage.
  const [gradebookRecords, setGradebookRecords] = useState<GradebookRecord[]>([])

  // Tracks text entered in the search box
  const [searchTerm, setSearchTerm] = useState('')

  // Tracks which sorting option is selected
  const [sortOption, setSortOption] = useState('name-asc')

  /**
   * Loads saved Gradebook records when the page is opened.
   */
  useEffect(() => {
    async function fetchGradebookRecords(): Promise<void> {
      const records = await loadGradebookRecords()
      setGradebookRecords(records)
    }

    void fetchGradebookRecords()
  }, [])

  // Build assignment dropdown options from saved Gradebook records.
  const assignmentOptions = Array.from(
    new Set(gradebookRecords.map((record) => record.assignmentId))
  )

  const effectiveSelectedAssignment = assignmentOptions.includes(selectedAssignment)
    ? selectedAssignment
    : (assignmentOptions[0] ?? 'assignment-1')

  // Build Gradebook student rows for the selected assignment.
  const students = buildStudentRecordsFromGradebook(gradebookRecords, effectiveSelectedAssignment)

  // Filter students by name or ID based on search input
  const filteredStudents = filterStudents(students, searchTerm)

  // Sort filtered students based on selected sort option
  const sortedStudents = sortStudents(filteredStudents, sortOption)

  // Calculate class statistics for the selected assignment
  const { averageScore, highestScore, lowestScore } = calculateStats(students)

  // ai-gen start (ChatGPT-5.3, 1)
  // Export currently displayed gradebook rows to a CSV file
  const handleExportCSV = (): void => {
    // Build CSV content from the currently displayed students
    const csvContent = buildCSVContent(sortedStudents)

    // Create downloadable file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    // Creates a hidden link
    // Sets file name like:
    // Assignment 1-gradebook.csv
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${effectiveSelectedAssignment}-gradebook.csv`)
    document.body.appendChild(link)

    // Simulates user clicking download
    link.click()

    // Removes the temporary link and frees memory
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  // ai-gen end

  return (
    // Main page container
    <div style={{ color: 'var(--ev-c-gray-1)' }}>
      <NavBar />
      <div style={{ paddingTop: '100px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          {/* Page title */}
          <h1>Assignment Gradebook</h1>

          {/* Assignment selection dropdown */}
          <div style={{ margin: '16px 0' }}>
            <label htmlFor="assignment-select">Select Assignment: </label>

            {/* Dropdown that allows instructors to switch assignments (FR-8) */}
            <select
              id="assignment-select"
              value={effectiveSelectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
            >
              {assignmentOptions.length > 0 ? (
                assignmentOptions.map((assignmentId) => (
                  <option key={assignmentId} value={assignmentId}>
                    {assignmentId}
                  </option>
                ))
              ) : (
                <option value="assignment-1">assignment-1</option>
              )}
            </select>
          </div>

          {/* Class statistics summary */}
          <div style={{ display: 'flex', gap: '24px', margin: '20px 0', fontWeight: 'bold' }}>
            <div>
              <span>Class Average: {averageScore === '--' ? '--' : `${averageScore}%`}</span>
              <span style={{ marginLeft: '24px' }}>
                Highest Score: {highestScore === '--' ? '--' : `${highestScore}%`}
              </span>
              <span style={{ marginLeft: '24px' }}>
                Lowest Score: {lowestScore === '--' ? '--' : `${lowestScore}%`}
              </span>
            </div>
          </div>

          {/* Student search input */}
          <div style={{ margin: '16px 0' }}>
            <label htmlFor="student-search">Search Student: </label>
            <input
              id="student-search"
              type="text"
              placeholder="Enter student name or ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ marginLeft: '8px', padding: '6px', width: '260px' }}
            />
          </div>

          {/* Sort dropdown */}
          <div style={{ margin: '16px 0' }}>
            <label htmlFor="sort-select">Sort By: </label>
            <select
              id="sort-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              style={{ marginLeft: '8px', padding: '6px' }}
            >
              <option value="name-asc">Student Name (A-Z)</option>
              <option value="name-desc">Student Name (Z-A)</option>
              <option value="score-asc">Highest Score (Low to High)</option>
              <option value="score-desc">Highest Score (High to Low)</option>
            </select>
          </div>

          {/* Table displaying students and their highest scores */}
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              {/* Table header */}
              <thead>
                <tr>
                  <th style={cellStyle}>Student ID</th>
                  <th style={cellStyle}>Student Name</th>
                  <th style={cellStyle}>Highest Score</th>
                  <th style={cellStyle}>Last Submission Time</th>
                  <th style={cellStyle}>Status</th>
                </tr>
              </thead>

              {/* Table body generated dynamically from student data */}
              <tbody>
                {sortedStudents.length > 0 ? (
                  sortedStudents.map((student) => (
                    <tr key={student.id}>
                      <td style={cellStyle}>{student.id}</td>
                      <td style={cellStyle}>{student.name}</td>
                      <td style={cellStyle}>{student.score}</td>
                      <td style={cellStyle}>{student.lastSubmitted}</td>
                      <td style={cellStyle}>{student.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td style={cellStyle} colSpan={5}>
                      No Gradebook records found for this assignment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Export CSV Button at the bottom-right corner of the table */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={handleExportCSV}
              disabled={sortedStudents.length === 0}
              style={{
                fontSize: '12px', // smaller text
                padding: '4px 8px', // smaller button
                opacity: 0.8, // slightly subtle
                cursor: 'pointer'
              }}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

// Reusable styling for table cells
const cellStyle: React.CSSProperties = {
  border: '1px solid #555',
  padding: '10px',
  textAlign: 'left'
}
