import { useEffect, useState, type CSSProperties } from 'react'
import type { GradebookRecord, GradebookScoreSource } from '../../../../shared/gradebookTypes'
import { loadAllStudents, loadServerAssignments} from '../../lib/serverData'
import {
  clearGradebookRecords,
  loadGradebookRecords,
  type GradebookStorageMode
} from '../../lib/gradebookStorage'

// =============================================================================
// Helper Types
// =============================================================================
type StudentRecord = {
  id: string
  name: string
  score: string
  scoreSource: string
  lastSubmitted: string
  status: string
}

type GradeStats = {
  averageScore: string
  highestScore: number | string
  lowestScore: number | string
}

/**
 * Converts a score string into a numeric value.
 */
const parseScore = (score: string): number | null => {
  return score === '-' ? null : parseFloat(score)
}

/**
 * Filters students based on a search term.
 */
const filterStudents = (students: StudentRecord[], searchTerm: string): StudentRecord[] => {
  const normalizedSearch = searchTerm.toLowerCase()

  return students.filter(
    (student) =>
      student.name.toLowerCase().includes(normalizedSearch) //|| student.id.includes(searchTerm)
  )
}

/**
 * Sorts students based on the selected sort option.
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
 */
const calculateStats = (students: StudentRecord[]): GradeStats => {
  const validScores = students
    .map((student) => parseScore(student.score))
    .filter((score): score is number => score !== null)

  if (validScores.length === 0) {
    return {
      averageScore: '-',
      highestScore: '-',
      lowestScore: '-'
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
 */
const buildCSVContent = (students: StudentRecord[]): string => {
  const headers = ['Student Name', 'Score']

  const rows = students.map((student) => [
    student.name,
    student.score,  // highest score or '-' if not submitted
  ])

  return [headers, ...rows].map((row) => row.join(',')).join('\n')
}

/**
 * Formats a saved timestamp into a readable local date/time string.
 */
const formatSubmittedTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString()
}

function formatScoreSource(scoreSource?: GradebookScoreSource): string {
  if (scoreSource === 'offline-batch-grade') {
    return 'Batch Grading'
  }

  return 'Assignment Submission'
}

function formatStudentStatus(record: GradebookRecord): string {
  if (record.status === 'failed') {
    return 'Failed'
  }

  return record.scoreSource === 'offline-batch-grade' ? 'Graded' : 'Submitted'
}

/**
 * Builds Gradebook table rows from saved Gradebook records.
 */
const buildStudentRecordsFromGradebook = (
  records: GradebookRecord[],
  assignmentId: string,
  defaultScoreSource: GradebookScoreSource,
  dataMode: GradebookStorageMode,
  allStudents: { id: string; name: string }[]
): StudentRecord[] => {
  const assignmentRecords = records.filter((record) => record.assignmentId === assignmentId)

  const groupedRecords = new Map<string, GradebookRecord[]>()
  assignmentRecords.forEach((record) => {
    const existing = groupedRecords.get(record.studentId) ?? []
    groupedRecords.set(record.studentId, [...existing, record])
  })

  // Get the highest score of a student's submission
  const submittedStudents: StudentRecord[] = Array.from(groupedRecords.values()).map((studentRecords) => {
    const highestRecord = studentRecords.reduce((best, current) =>
      current.score > best.score ? current : best
    )

    const latestRecord = studentRecords.reduce((latest, current) =>
      current.submittedAt > latest.submittedAt ? current : latest
    )
    const effectiveScoreSource = highestRecord.scoreSource ?? defaultScoreSource

    return {
      id: latestRecord.studentId,
      name: latestRecord.studentName,
      score: `${highestRecord.score}%`,
      scoreSource: formatScoreSource(effectiveScoreSource),
      // Get submission time of highest score rather than latest
      lastSubmitted: formatSubmittedTime(highestRecord.submittedAt),
      status: formatStudentStatus({ ...highestRecord, scoreSource: effectiveScoreSource })
    }
  })

  // For server mode, show all students in Student Name column
  if (dataMode === 'server' && allStudents.length > 0) {
    const submittedStudentIds = new Set(submittedStudents.map((s) => s.id))
    
    // Students who have not made a submission have a status of Missing
    const nonSubmittedStudents: StudentRecord[] = allStudents
      .filter((student) => !submittedStudentIds.has(student.id))
      .map((student) => ({
        id: student.id,
        name: student.name,
        score: '-',
        scoreSource: '-',
        lastSubmitted: '-',
        status: 'Missing'
      }))

    return [...submittedStudents, ...nonSubmittedStudents]
  }

  return submittedStudents
}

const cellStyle: CSSProperties = {
  border: '1px solid #555',
  padding: '10px',
  textAlign: 'left'
}

const sourceTagStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '999px',
  backgroundColor: '#334155',
  color: '#e2e8f0',
  fontSize: '12px',
  fontWeight: 600
}

interface GradebookPanelProps {
  dataMode?: GradebookStorageMode
  title?: string
  description?: string
  allowClear?: boolean
}

export function GradebookPanel({
  dataMode = 'server',
  title = 'Assignment Gradebook',
  description,
  allowClear
}: GradebookPanelProps): React.JSX.Element {
  const [selectedAssignment, setSelectedAssignment] = useState('')
  const [allStudents, setAllStudents] = useState<{ id: string; name: string }[]>([])
  const [gradebookRecords, setGradebookRecords] = useState<GradebookRecord[]>([])
  const [allAssignments, setAllAssignments] = useState<{ id: string; name: string;gradingCriteria?: string }[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState('name-asc')
  const canClearRecords = allowClear ?? dataMode === 'local'

  useEffect(() => {
    async function fetchGradebookRecords(): Promise<void> {

      // Load grades
      const records = await loadGradebookRecords(dataMode)
      setGradebookRecords(records)

      // For server mode,
      if (dataMode === 'server') {
        try {
          // Load all students
          const students = await loadAllStudents()
          setAllStudents(students)
        } catch (error) {
          console.error('Failed to load all students', error)
        }

        try {
          // Load all assignments made by instructor
          const assignments = await loadServerAssignments()
          setAllAssignments(assignments.map(a => ({ id: a.uuid, name: a.name, gradingCriteria: a.gradingCriteria})))
        } catch (error) {
          console.error('Failed to load all assignments', error)
        }
      } else {
        setAllStudents([])
        setAllAssignments([])
      }
    }

    void fetchGradebookRecords()
  }, [dataMode])

  const assignmentOptions: [string, string][] = dataMode === 'server'
    ? allAssignments.map((a) => [a.id, a.name]) :
      Array.from(
        new Map(
          gradebookRecords.map((record) => [
            record.assignmentId,
            record.assignmentName ?? record.assignmentId
          ])
        ).entries()
  )
  const hasAssignments = assignmentOptions.length > 0

  const assignmentIds = assignmentOptions.map(([assignmentId]) => assignmentId)
  const effectiveSelectedAssignment = assignmentIds.includes(selectedAssignment)
    ? selectedAssignment
    : (assignmentOptions[0]?.[0] ?? '')
  const defaultScoreSource: GradebookScoreSource =
    dataMode === 'local' ? 'offline-batch-grade' : 'assignment-submission'
  
  // Get assignment's grading criteria (total available points)
  //const effectiveSelectedCriteria = 
  //  allAssignments.find((a) => a.id === effectiveSelectedAssignment)?.gradingCriteria ?? '100'
  //const criteria = parseInt(effectiveSelectedCriteria, 10)
  
  const students = buildStudentRecordsFromGradebook(
    gradebookRecords,
    effectiveSelectedAssignment,
    defaultScoreSource,
    dataMode,
    allStudents
  )
  const filteredStudents = filterStudents(students, searchTerm)
  const sortedStudents = sortStudents(filteredStudents, sortOption)
  const { averageScore, highestScore, lowestScore } = calculateStats(students)

  const handleClearRecentlyGraded = async (): Promise<void> => {
    await clearGradebookRecords()
    setGradebookRecords([])
    setSelectedAssignment('')
  }

  const handleExportCSV = (): void => {
    const csvContent = buildCSVContent(sortedStudents)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${effectiveSelectedAssignment}-gradebook.csv`)
    document.body.appendChild(link)

    link.click()

    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel-shell">
      <div style={{ color: 'var(--ev-c-gray-1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          <h1>{title}</h1>
          {description && <p style={{ marginTop: '8px', color: '#cbd5e1' }}>{description}</p>}

          <div style={{ margin: '16px 0' }}>
            <label htmlFor="assignment-select">Select Assignment: </label>
            <select
              id="assignment-select"
              value={hasAssignments ? effectiveSelectedAssignment : ''}
              onChange={(e) => setSelectedAssignment(e.target.value)}
              disabled={!hasAssignments}
            >
              {hasAssignments ? (
                assignmentOptions.map(([assignmentId, assignmentName]) => (
                  <option key={assignmentId} value={assignmentId}>
                    {assignmentName}
                  </option>
                ))
              ) : (
                <option value="">No assignments</option>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '24px', margin: '20px 0', fontWeight: 'bold' }}>
            <div>
              <span>Average Score: {averageScore === '--' ? '--' : `${averageScore}%`}</span>
              <span style={{ marginLeft: '24px' }}>
                Highest Score: {highestScore === '--' ? '--' : `${highestScore}%`}
              </span>
              <span style={{ marginLeft: '24px' }}>
                Lowest Score: {lowestScore === '--' ? '--' : `${lowestScore}%`}
              </span>
            </div>
          </div>

          <div style={{ margin: '16px 0' }}>
            <label htmlFor="student-search">Search Student: </label>
            <input
              id="student-search"
              type="text"
              placeholder="Enter student name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ marginLeft: '8px', padding: '6px', width: '260px' }}
            />
          </div>

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
              <option value="score-asc">Score (Low to High)</option>
              <option value="score-desc">Score (High to Low)</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={cellStyle}>Student Name</th>
                  <th style={cellStyle}>Score</th>
                  <th style={cellStyle}>Score Source</th>
                  <th style={cellStyle}>Submission Time</th>
                  <th style={cellStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {!hasAssignments ? (
                  <tr>
                    <td style={cellStyle} colSpan={6}>
                      No graded assignments available.
                    </td>
                  </tr>
                ) : dataMode === 'local' && sortedStudents.length === 0 ? (
                  <tr>
                    <td style={cellStyle} colSpan={6}>
                      No records for this assignment.
                    </td>
                  </tr>
                ) : dataMode === 'server' && sortedStudents.length === 0 ? (
                  <tr>
                    <td style={cellStyle} colSpan={6}>
                      Loading all students...
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map((student) => (
                    <tr key={student.id}>
                      <td style={cellStyle}>{student.name}</td>
                      <td style={cellStyle}>{student.score}</td>
                      <td style={cellStyle}>
                        <span style={sourceTagStyle}>{student.scoreSource}</span>
                      </td>
                      <td style={cellStyle}>{student.lastSubmitted}</td>
                      <td style={cellStyle}>{student.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}
          >
            {canClearRecords && (
              <button
                onClick={() => void handleClearRecentlyGraded()}
                disabled={!hasAssignments}
                style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  opacity: hasAssignments ? 0.8 : 0.5,
                  cursor: hasAssignments ? 'pointer' : 'not-allowed'
                }}
              >
                Clear Recently Graded
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={sortedStudents.length === 0}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                opacity: sortedStudents.length === 0 ? 0.5 : 0.8,
                cursor: sortedStudents.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
