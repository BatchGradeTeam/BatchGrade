import { useEffect, useMemo, useState } from 'react'
import type { GradebookRecord, GradebookScoreSource } from '../../../../shared/gradebookTypes'
import { loadServerStudentGradebookRecords } from '../../lib/serverData'

function formatSubmittedTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function formatScoreSource(scoreSource?: GradebookScoreSource): string {
  if (scoreSource === 'offline-batch-grade') {
    return 'Offline batch grade'
  }

  return 'Submission self-check'
}

export function StudentScoresPanel(): React.JSX.Element {
  const [records, setRecords] = useState<GradebookRecord[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    loadServerStudentGradebookRecords()
      .then((result) => {
        if (!isMounted) {
          return
        }

        setRecords(result)
        setSelectedAssignmentId((current) => current || result[0]?.assignmentId || '')
        setErrorMessage(null)
      })
      .catch((error) => {
        console.error('Error loading student scores:', error)
        if (isMounted) {
          setErrorMessage('Could not load scores yet.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const assignmentOptions = useMemo(
    () =>
      Array.from(
        new Map(
          records.map((record) => [
            record.assignmentId,
            record.assignmentName ?? record.assignmentId
          ])
        ).entries()
      ),
    [records]
  )

  const assignmentIds = assignmentOptions.map(([assignmentId]) => assignmentId)
  const effectiveSelectedAssignmentId = assignmentIds.includes(selectedAssignmentId)
    ? selectedAssignmentId
    : (assignmentOptions[0]?.[0] ?? '')

  const selectedAssignmentRecords = records
    .filter((record) => record.assignmentId === effectiveSelectedAssignmentId)
    .sort((a, b) => {
      const aTime = a.gradedAt ? Date.parse(a.gradedAt) : a.submittedAt
      const bTime = b.gradedAt ? Date.parse(b.gradedAt) : b.submittedAt
      return bTime - aTime
    })

  return (
    <div
      style={{
        border: '1px solid gray',
        padding: '1rem',
        marginTop: '1rem',
        backgroundColor: '#2b2b2b'
      }}
    >
      <h2 style={{ marginBottom: '0.5rem' }}>Submission Scores & Feedback</h2>
      <p style={{ marginTop: 0, marginBottom: '1rem', color: '#cbd5e1' }}>
        These scores come from the self-check that runs when you submit your assignment.
      </p>

      {isLoading ? (
        <p>Loading scores...</p>
      ) : errorMessage ? (
        <div
          style={{
            backgroundColor: '#5a1f1f',
            border: '1px solid red',
            padding: '10px'
          }}
        >
          <p>{errorMessage}</p>
        </div>
      ) : records.length === 0 ? (
        <p>No submission scores are available yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label htmlFor="student-score-assignment" style={{ marginRight: '8px' }}>
              Assignment:
            </label>
            <select
              id="student-score-assignment"
              value={effectiveSelectedAssignmentId}
              onChange={(event) => setSelectedAssignmentId(event.target.value)}
              style={{ padding: '6px', minWidth: '220px' }}
            >
              {assignmentOptions.map(([assignmentId, assignmentName]) => (
                <option key={assignmentId} value={assignmentId}>
                  {assignmentName}
                </option>
              ))}
            </select>
          </div>

          {selectedAssignmentRecords.length === 0 ? (
            <p>No submission score is available for this assignment yet.</p>
          ) : (
            selectedAssignmentRecords.map((record) => (
              <div
                key={record.submissionId ?? `${record.assignmentId}-${record.submittedAt}`}
                style={{ border: '1px solid #555', padding: '10px', backgroundColor: '#1f1f1f' }}
              >
                <p>
                  <strong>{record.assignmentName ?? record.assignmentId}</strong>
                </p>
                <p>Score: {record.score}%</p>
                <p>Source: {formatScoreSource(record.scoreSource)}</p>
                <p>Status: {record.status === 'failed' ? 'Failed' : 'Submitted'}</p>
                <p>Last Updated: {formatSubmittedTime(record.submittedAt)}</p>
                {record.feedback && <p>Feedback: {record.feedback}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
