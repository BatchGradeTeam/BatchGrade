import { useState, type CSSProperties } from 'react'

// =============================================================================
// Helper Types
// =============================================================================
type StudentRecord = {
  id: string
  name: string
  score: string
  submissions: number
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
  return score === '--' ? null : parseInt(score)
}

/**
 * Filters students based on a search term.
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
 */
const buildCSVContent = (students: StudentRecord[]): string => {
  const headers = ['Student ID', 'Student Name', 'Highest Score', 'Submission Count']

  const rows = students.map((student) => [
    student.id,
    student.name,
    student.score,
    student.submissions.toString()
  ])

  return [headers, ...rows].map((row) => row.join(',')).join('\n')
}

const gradebookData = {
  'Assignment 1': [
    {
      id: '1001',
      name: 'Garen Crownguard',
      score: '92%',
      submissions: 3,
      lastSubmitted: '2026-03-10 11:42 AM',
      status: 'Submitted'
    },
    {
      id: '1002',
      name: 'Wu Kong',
      score: '88%',
      submissions: 2,
      lastSubmitted: '2026-03-10 09:15 AM',
      status: 'Submitted'
    },
    {
      id: '1003',
      name: 'Quinn Valor',
      score: '95%',
      submissions: 4,
      lastSubmitted: '2026-03-11 02:30 PM',
      status: 'Submitted'
    },
    {
      id: '1004',
      name: 'Govos Usan',
      score: '--',
      submissions: 0,
      lastSubmitted: '--',
      status: 'Missing'
    }
  ],
  'Assignment 2': [
    {
      id: '1001',
      name: 'Garen Crownguard',
      score: '95%',
      submissions: 4,
      lastSubmitted: '2026-03-12 10:05 AM',
      status: 'Submitted'
    },
    {
      id: '1002',
      name: 'Wu Kong',
      score: '90%',
      submissions: 3,
      lastSubmitted: '2026-03-11 04:20 PM',
      status: 'Submitted'
    },
    {
      id: '1003',
      name: 'Quinn Valor',
      score: '91%',
      submissions: 2,
      lastSubmitted: '2026-03-12 08:45 AM',
      status: 'Submitted'
    },
    {
      id: '1004',
      name: 'Govos Usan',
      score: '--',
      submissions: 0,
      lastSubmitted: '--',
      status: 'Missing'
    }
  ]
}

const cellStyle: CSSProperties = {
  border: '1px solid #555',
  padding: '10px',
  textAlign: 'left'
}

export function GradebookPanel(): React.JSX.Element {
  const [selectedAssignment, setSelectedAssignment] = useState('Assignment 1')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState('name-asc')

  const students = gradebookData[selectedAssignment as keyof typeof gradebookData]
  const filteredStudents = filterStudents(students, searchTerm)
  const sortedStudents = sortStudents(filteredStudents, sortOption)
  const { averageScore, highestScore, lowestScore } = calculateStats(students)

  const handleExportCSV = (): void => {
    const csvContent = buildCSVContent(sortedStudents)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${selectedAssignment}-gradebook.csv`)
    document.body.appendChild(link)

    link.click()

    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel-shell">
      <div style={{ color: 'var(--ev-c-gray-1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          <h1>Assignment Gradebook</h1>

          <div style={{ margin: '16px 0' }}>
            <label htmlFor="assignment-select">Select Assignment: </label>
            <select
              id="assignment-select"
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
            >
              <option>Assignment 1</option>
              <option>Assignment 2</option>
            </select>
          </div>

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

          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={cellStyle}>Student ID</th>
                  <th style={cellStyle}>Student Name</th>
                  <th style={cellStyle}>Highest Score</th>
                  <th style={cellStyle}>Submission Count</th>
                  <th style={cellStyle}>Last Submission Time</th>
                  <th style={cellStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student) => (
                  <tr key={student.id}>
                    <td style={cellStyle}>{student.id}</td>
                    <td style={cellStyle}>{student.name}</td>
                    <td style={cellStyle}>{student.score}</td>
                    <td style={cellStyle}>{student.submissions}</td>
                    <td style={cellStyle}>{student.lastSubmitted}</td>
                    <td style={cellStyle}>{student.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={handleExportCSV}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                opacity: 0.8,
                cursor: 'pointer'
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
