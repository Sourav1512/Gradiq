import { useState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getStudentProfile } from '../services/api'

export default function StudentProfilePage() {
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getStudentProfile()
      .then(res => setStudent(res.data.student))
      .catch(err => setError(err.response?.data?.error || 'Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Loading academic profile…</span>
      </div>
    )
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>
  }

  const hasAttendance = student?.attendance != null
  const isEligible = hasAttendance && student.attendance >= 75
  const statusColor = !hasAttendance ? 'var(--text-secondary)' : isEligible ? '#166534' : '#991B1B'

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Profile Overview Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">My Academic Profile</div>
            <div className="card-subtitle">Verified university student record</div>
          </div>
          <span className="badge badge-student">Student</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'white',
              fontSize: 24,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {student?.full_name?.charAt(0)?.toUpperCase() || 'S'}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{student?.full_name}</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                Enrolled Student · {student?.email}
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 16 }}>
            <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
                Student Code
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                <code>{student?.student_id}</code>
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
                Enrolled Course
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                {student?.course}
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
                Current Semester
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                Semester {student?.semester}
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
                Registered Account Email
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {student?.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Standing & Eligibility Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Academic Standing & Eligibility</div>
            <div className="card-subtitle">Official examination qualifications</div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid-2" style={{ gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Recorded Attendance</span>
                <span style={{ fontWeight: 700, color: !hasAttendance ? 'var(--text-muted)' : isEligible ? 'var(--success)' : 'var(--danger)' }}>
                  {hasAttendance ? `${student.attendance}%` : 'Not recorded'}
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${student?.attendance ?? 0}%`,
                    background: !hasAttendance ? 'var(--text-muted)' : isEligible ? 'var(--success)' : 'var(--danger)'
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                {hasAttendance ? 'Minimum required attendance for semester examinations is 75.0%.' : 'Attendance has not yet been recorded by the administrator.'}
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Previous Exam Marks</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {student?.previous_marks == null ? 'Not recorded' : `${student.previous_marks} / 100`}
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${student?.previous_marks ?? 0}%`,
                    background: 'var(--primary)'
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Historical examination average maintained on university record.
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 24,
            padding: '14px 18px',
            background: !hasAttendance ? 'var(--bg)' : isEligible ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${!hasAttendance ? 'var(--border)' : isEligible ? '#BBF7D0' : '#FECACA'}`,
            borderRadius: 'var(--radius)',
            color: statusColor
          }}>
            <ShieldCheck size={20} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>
              <strong>Examination Status: </strong>
              {!hasAttendance
                ? 'Your attendance record has not yet been entered.'
                : isEligible
                ? 'Your attendance and examination records satisfy the university exam qualification criteria.'
                : 'Warning: Your attendance is currently below the mandatory 75% requirement. Please contact your department coordinator.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
