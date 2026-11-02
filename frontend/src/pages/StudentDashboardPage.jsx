import { useEffect, useState } from 'react'
import { Award, Calendar, Eye, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getStudentDashboard } from '../services/api'
import { useAuth } from '../context/AuthContext'

function CategoryBadge({ category }) {
  const classes = {
    Excellent: 'badge badge-excellent',
    Good: 'badge badge-good',
    Average: 'badge badge-average',
    'Needs Improvement': 'badge badge-needs',
  }
  return <span className={classes[category] || 'badge'}>{category || 'Not Evaluated'}</span>
}

function PredictionDetailModal({ prediction, onClose }) {
  if (!prediction) return null
  const rows = [
    ['Attendance', prediction.attendance_pct == null ? '—' : `${prediction.attendance_pct}%`],
    ['Assignment 1', `${prediction.assignment_1_marks ?? '—'}/5`],
    ['Assignment 2', `${prediction.assignment_2_marks ?? '—'}/5`],
    ['Class Test 1', `${prediction.class_test_1_marks ?? '—'}/20`],
    ['Class Test 2', `${prediction.class_test_2_marks ?? '—'}/20`],
    ['Combined Class Tests', `${prediction.combined_class_test_marks ?? '—'}/20`],
    ['Presentation', `${prediction.presentation_marks ?? '—'}/10`],
    ['Internal Assessment (actual)', `${prediction.internal_total ?? '—'}/40`],
    [prediction.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML Prediction' : 'ML Predicted End-Semester Marks', `${prediction.predicted_semester_marks ?? '—'}/60`],
    ['Estimated Overall Marks', `${prediction.estimated_overall_marks ?? '—'}/100`],
    ['Prediction Type', prediction.prediction_type === 'ml_prediction' ? 'ML Prediction' : prediction.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML Prediction' : prediction.prediction_type || 'Pending'],
  ]
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Prediction Report</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <table style={{ width: '100%' }}><tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '7px 0', color: 'var(--text-secondary)' }}>{label}</td>
                <td style={{ padding: '7px 0', fontWeight: 600, textAlign: 'right' }}>{value ?? '—'}</td>
              </tr>
            ))}
          </tbody></table>
          <div style={{ marginTop: 16 }}><CategoryBadge category={prediction.performance_category} /></div>
          <p className="card-subtitle" style={{ marginTop: 12 }}>{prediction.suggestions?.join(' ')}</p>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

export default function StudentDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getStudentDashboard()
      .then(response => setData(response.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load your student dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading your academic dashboard…</span></div>
  if (error) return <div className="alert alert-error">{error}</div>

  const student = data.student
  const latest = data.latest_prediction
  const predictions = data.predictions || []
  const stats = [
    { label: 'Current Attendance', value: student.attendance == null ? '—' : `${student.attendance}%`, icon: Calendar },
    { label: 'Actual Internal Marks', value: latest?.internal_total != null ? `${latest.internal_total}/40` : 'Pending', icon: Award },
    { label: 'Predicted Semester Marks', value: latest?.predicted_semester_marks != null ? `${latest.predicted_semester_marks}/60` : 'Pending', icon: TrendingUp },
    { label: 'Estimated Overall Marks', value: latest?.estimated_overall_marks != null ? `${latest.estimated_overall_marks}/100` : 'Pending', icon: Award },
  ]

  return (
    <div>
      <div className="card" style={{ marginBottom: 24, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>Welcome back, {student.full_name || user?.full_name}!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Course: <strong>{student.course}</strong> · Semester: <strong>{student.semester}</strong> · Student Code: <code>{student.student_id}</code>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/student/profile" className="btn btn-secondary btn-sm">View Profile</Link>
            <Link to="/student/history" className="btn btn-primary btn-sm">My History</Link>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {stats.map(({ label, value, icon: Icon }, index) => (
          <div className="stat-card" key={label}>
            <div className="stat-card-header">
              <span className="stat-card-label">{label}</span>
              <div className={`stat-icon ${['blue', 'teal', 'green', 'orange'][index]}`}><Icon size={18} /></div>
            </div>
            <div className="stat-card-value">{value}</div>
          </div>
        ))}
      </div>

      {latest ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Latest Academic Assessment</div>
              <div className="card-subtitle">Updated {new Date(latest.created_at).toLocaleString()}</div>
            </div>
            <CategoryBadge category={latest.performance_category} />
          </div>
          <div className="card-body">
            <div className="grid-2">
              <div>
                <h4 style={{ marginBottom: 8 }}>Actual Internal Assessment</h4>
                <table style={{ width: '100%' }}><tbody>
                  <tr><td>Assignment 1</td><td style={{ textAlign: 'right' }}>{latest.assignment_1_marks ?? '—'}/5</td></tr>
                  <tr><td>Assignment 2</td><td style={{ textAlign: 'right' }}>{latest.assignment_2_marks ?? '—'}/5</td></tr>
                  <tr><td>Class Test 1</td><td style={{ textAlign: 'right' }}>{latest.class_test_1_marks ?? '—'}/20</td></tr>
                  <tr><td>Class Test 2</td><td style={{ textAlign: 'right' }}>{latest.class_test_2_marks ?? '—'}/20</td></tr>
                  <tr><td>Combined Class Tests</td><td style={{ textAlign: 'right' }}>{latest.combined_class_test_marks ?? '—'}/20</td></tr>
                  <tr><td>Presentation</td><td style={{ textAlign: 'right' }}>{latest.presentation_marks ?? '—'}/10</td></tr>
                  <tr><td><strong>Internal Total</strong></td><td style={{ textAlign: 'right' }}><strong>{latest.internal_total ?? '—'}/40</strong></td></tr>
                </tbody></table>
              </div>
              <div>
                <div className="stat-card" style={{ marginBottom: 12 }}>
                  <div className="stat-card-label">{latest.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML Prediction' : latest.prediction_type === 'ml_prediction' ? 'ML Predicted End-Semester Marks' : 'Predicted End-Semester Marks'}</div>
                  <div className="stat-card-value">{latest.predicted_semester_marks == null ? 'Pending' : `${latest.predicted_semester_marks}/60`}</div>
                  <div className="stat-card-sub">{latest.predicted_semester_marks == null ? 'Model needs genuine past exam results' : 'Model estimate, not actual exam marks'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Estimated Overall Marks</div>
                  <div className="stat-card-value">{latest.estimated_overall_marks == null ? 'Pending' : `${latest.estimated_overall_marks}/100`}</div>
                  <div className="stat-card-sub">Actual internal + predicted examination score</div>
                </div>
              </div>
            </div>
            {latest.predicted_semester_marks != null ? (
              <div className="alert alert-info" style={{ marginTop: 16 }}>{latest.suggestions?.join(' ')}</div>
            ) : (
              <div className="alert alert-warning" style={{ marginTop: 16 }}>
                Internal marks are saved. An examination prediction will be available after genuine historical exam results are used to train the model.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="empty-state">
            <h3>No prediction recorded</h3>
            <p>Your administrator has not entered assessment marks and generated an examination prediction yet.</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">My Prediction History</div>
            <div className="card-subtitle">{predictions.length} saved record{predictions.length === 1 ? '' : 's'}</div>
          </div>
          <Link to="/student/history" className="btn btn-secondary btn-sm">View All</Link>
        </div>
        {predictions.length ? (
          <div className="table-wrapper"><table>
            <thead><tr><th>Date</th><th>Internal</th><th>Predicted Semester</th><th>Overall</th><th>Prediction Type</th><th>Category</th><th>Details</th></tr></thead>
            <tbody>{predictions.slice(0, 5).map(prediction => (
              <tr key={prediction.id}>
                <td>{new Date(prediction.created_at).toLocaleDateString()}</td>
                <td>{prediction.internal_total ?? '—'}/40</td>
                <td>{prediction.predicted_semester_marks ?? '—'}/60</td>
                <td>{prediction.estimated_overall_marks ?? '—'}/100</td>
                <td>{prediction.prediction_type === 'ml_prediction' ? 'ML Prediction' : prediction.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML' : prediction.prediction_type || 'Pending'}</td>
                <td><CategoryBadge category={prediction.performance_category} /></td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => setSelected(prediction)}><Eye size={13} /> Details</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><p>No prediction history is available.</p></div>}
      </div>
      {selected && <PredictionDetailModal prediction={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
