import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getStudentPredictions } from '../services/api'

function CategoryBadge({ category }) {
  const classes = {
    Excellent: 'badge badge-excellent',
    Good: 'badge badge-good',
    Average: 'badge badge-average',
    'Needs Improvement': 'badge badge-needs',
  }
  return <span className={classes[category] || 'badge'}>{category || 'Prediction pending'}</span>
}

function DetailModal({ prediction, onClose }) {
  const rows = [
    ['Attendance', prediction.attendance_pct == null ? '—' : `${prediction.attendance_pct}%`],
    ['Assignment 1', `${prediction.assignment_1_marks ?? '—'}/5`],
    ['Assignment 2', `${prediction.assignment_2_marks ?? '—'}/5`],
    ['Class Test 1', `${prediction.class_test_1_marks ?? '—'}/20`],
    ['Class Test 2', `${prediction.class_test_2_marks ?? '—'}/20`],
    ['Combined Class Tests', `${prediction.combined_class_test_marks ?? '—'}/20`],
    ['Presentation', `${prediction.presentation_marks ?? '—'}/10`],
    ['Actual Internal Assessment', `${prediction.internal_total ?? '—'}/40`],
    [prediction.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML Prediction' : 'ML Predicted End-Semester Marks', `${prediction.predicted_semester_marks ?? '—'}/60`],
    ['Estimated Overall Marks', `${prediction.estimated_overall_marks ?? '—'}/100`],
    ['Prediction Type', prediction.prediction_type === 'ml_prediction' ? 'ML Prediction' : prediction.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML Prediction' : prediction.prediction_type || 'Pending'],
    ['Model Version', prediction.model_version || '—'],
  ]
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Evaluation Report Details</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
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
          {prediction.suggestions?.length > 0 && (
            <ul className="suggestion-list" style={{ marginTop: 12 }}>
              {prediction.suggestions.map((suggestion, index) => <li className="suggestion-item" key={index}>{suggestion}</li>)}
            </ul>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

export default function StudentPredictionsPage() {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getStudentPredictions()
      .then(response => setPredictions(response.data.predictions || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load prediction history.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading your prediction history…</span></div>

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ marginBottom: 16 }}>
        <Link to="/student-dashboard" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: 6 }}>
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">My Academic Prediction History</div>
            <div className="card-subtitle">Your internal marks and predicted end-semester results</div>
          </div>
          <span className="badge badge-student">{predictions.length} Evaluation{predictions.length === 1 ? '' : 's'}</span>
        </div>
        {predictions.length === 0 ? (
          <div className="empty-state"><h3>No Academic Predictions Yet</h3><p>Your assessment history will appear here after faculty evaluation.</p></div>
        ) : (
          <div className="table-wrapper"><table>
            <thead><tr><th>#</th><th>Date</th><th>Internal</th><th>Predicted Semester</th><th>Estimated Overall</th><th>Prediction Type</th><th>Category</th><th>Details</th></tr></thead>
            <tbody>{predictions.map((prediction, index) => (
              <tr key={prediction.id}>
                <td>{index + 1}</td>
                <td>{new Date(prediction.created_at).toLocaleDateString()}</td>
                <td>{prediction.internal_total ?? '—'}/40</td>
                <td>{prediction.predicted_semester_marks ?? '—'}/60</td>
                <td>{prediction.estimated_overall_marks ?? '—'}/100</td>
                <td>{prediction.prediction_type === 'ml_prediction' ? 'ML Prediction' : prediction.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML' : prediction.prediction_type || 'Pending'}</td>
                <td><CategoryBadge category={prediction.performance_category} /></td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelected(prediction)}>
                    <Eye size={13} style={{ marginRight: 4 }} /> View Report
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {selected && <DetailModal prediction={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
