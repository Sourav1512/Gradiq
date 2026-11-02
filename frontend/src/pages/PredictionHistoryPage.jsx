import { useEffect, useState } from 'react'
import { Eye, FileCheck, Pencil, Trash2, X } from 'lucide-react'
import {
  deletePrediction, getPrediction, getPredictions, recordActualSemesterResult, updatePrediction,
} from '../services/api'

const MARK_FIELDS = [
  ['attendance_pct', 'Attendance Percentage', 0, 100],
  ['assignment_1_marks', 'Assignment 1', 0, 5],
  ['assignment_2_marks', 'Assignment 2', 0, 5],
  ['class_test_1_marks', 'Class Test 1', 0, 20],
  ['class_test_2_marks', 'Class Test 2', 0, 20],
  ['presentation_marks', 'Presentation', 0, 10],
]

function CategoryBadge({ category }) {
  const classes = {
    Excellent: 'badge badge-excellent',
    Good: 'badge badge-good',
    Average: 'badge badge-average',
    'Needs Improvement': 'badge badge-needs',
  }
  return <span className={classes[category] || 'badge'}>{category || 'Legacy record'}</span>
}

function DetailModal({ predictionId, onClose }) {
  const [prediction, setPrediction] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    getPrediction(predictionId)
      .then(response => setPrediction(response.data.prediction))
      .catch(err => setError(err.response?.data?.error || 'Failed to load prediction details.'))
  }, [predictionId])

  const rows = [
    ['Student Name', prediction?.student_name],
    ['Student Code', prediction?.student_code],
    ['Course', prediction?.course],
    ['Semester', prediction?.semester],
    ['Attendance', prediction?.attendance_pct == null ? null : `${prediction.attendance_pct}%`],
    ['Assignment 1', prediction?.assignment_1_marks == null ? null : `${prediction.assignment_1_marks}/5`],
    ['Assignment 2', prediction?.assignment_2_marks == null ? null : `${prediction.assignment_2_marks}/5`],
    ['Class Test 1', prediction?.class_test_1_marks == null ? null : `${prediction.class_test_1_marks}/20`],
    ['Class Test 2', prediction?.class_test_2_marks == null ? null : `${prediction.class_test_2_marks}/20`],
    ['Combined Class Tests', prediction?.combined_class_test_marks == null ? null : `${prediction.combined_class_test_marks}/20`],
    ['Presentation', prediction?.presentation_marks == null ? null : `${prediction.presentation_marks}/10`],
    ['Internal Assessment (actual)', prediction?.internal_total == null ? null : `${prediction.internal_total}/40`],
    [prediction?.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML Prediction' : 'ML Predicted End-Semester Marks', prediction?.predicted_semester_marks == null ? null : `${prediction.predicted_semester_marks}/60`],
    ['Estimated Overall Marks', prediction?.estimated_overall_marks == null ? null : `${prediction.estimated_overall_marks}/100`],
    ['Actual End-Semester Marks', prediction?.actual_semester_marks == null ? null : `${prediction.actual_semester_marks}/60`],
    ['Prediction Type', prediction?.prediction_type],
    ['Model Version', prediction?.model_version],
    ['Prediction Date', prediction?.created_at ? new Date(prediction.created_at).toLocaleString() : null],
  ]

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Prediction Details</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {error ? <div className="alert alert-error">{error}</div> : !prediction ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : (
            <>
              <table style={{ width: '100%' }}><tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: '7px 0', color: 'var(--text-secondary)', width: 220 }}>{label}</td>
                    <td style={{ padding: '7px 0', fontWeight: 500 }}>{value ?? '—'}</td>
                  </tr>
                ))}
              </tbody></table>
              <div style={{ marginTop: 12 }}><CategoryBadge category={prediction.performance_category} /></div>
            </>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

function EditModal({ prediction, onClose, onSaved }) {
  const [form, setForm] = useState({
    student_code: prediction.student_code,
    previous_semester_marks: prediction.previous_semester_marks ?? '',
    ...Object.fromEntries(MARK_FIELDS.map(([key]) => [key, prediction[key] ?? ''])),
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updatePrediction(prediction.id, {
        ...Object.fromEntries(MARK_FIELDS.map(([key]) => [key, Number(form[key])])),
        student_code: form.student_code,
        previous_semester_marks: form.previous_semester_marks === '' ? null : Number(form.previous_semester_marks),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update marks.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Update Academic Marks</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <p className="card-subtitle" style={{ marginBottom: 14 }}>{prediction.student_name} · {prediction.student_code}</p>
          <form id="edit-prediction-form" onSubmit={submit}>
            {MARK_FIELDS.map(([key, label, min, max]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label} ({min}–{max}) *</label>
                <input className="form-input" type="number" min={min} max={max} step="0.01"
                  required value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Previous Semester Marks (optional, 0–100)</label>
              <input className="form-input" type="number" min="0" max="100" step="0.01"
                value={form.previous_semester_marks} onChange={event => setForm(current => ({ ...current, previous_semester_marks: event.target.value }))} />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="edit-prediction-form" disabled={saving}>
            {saving ? 'Updating…' : 'Save and Recalculate'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActualResultModal({ prediction, onClose, onSaved }) {
  const [marks, setMarks] = useState(prediction.actual_semester_marks ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    if (marks === '' || !Number.isFinite(Number(marks)) || Number(marks) < 0 || Number(marks) > 60) {
      setError('Actual end-semester marks must be between 0 and 60.')
      return
    }
    setSaving(true)
    try {
      await recordActualSemesterResult(prediction.id, Number(marks))
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save actual exam result.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="modal-title">Record Actual Exam Result</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="card-subtitle" style={{ marginBottom: 14 }}>{prediction.student_name} · {prediction.student_code}</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form id="actual-result-form" onSubmit={submit}>
            <label className="form-label">Actual End-Semester Marks (0–60) *</label>
            <input className="form-input" type="number" min="0" max="60" step="0.01" required
              value={marks} onChange={event => setMarks(event.target.value)} />
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="actual-result-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save Actual Result'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Prediction</h3>
          <button className="close-btn" onClick={onCancel}><X size={18} /></button>
        </div>
        <div className="modal-body"><p>Are you sure you want to delete this prediction record?</p></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

export default function PredictionHistoryPage() {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewId, setViewId] = useState(null)
  const [editPrediction, setEditPrediction] = useState(null)
  const [actualResultPrediction, setActualResultPrediction] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const fetchAll = () => {
    setLoading(true)
    getPredictions()
      .then(response => setPredictions(response.data.predictions))
      .catch(err => setError(err.response?.data?.error || 'Failed to load predictions'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchAll() }, [])

  const handleDelete = async () => {
    try {
      await deletePrediction(deleteId)
      fetchAll()
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}<button className="close-btn" onClick={() => setError('')}><X size={16} /></button></div>}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">Prediction History</div><div className="card-subtitle">{predictions.length} saved record{predictions.length === 1 ? '' : 's'}</div></div>
        </div>
        {loading ? <div className="loading-state"><div className="spinner" /><span>Loading…</span></div> : predictions.length === 0 ? (
          <div className="empty-state"><h3>No predictions yet</h3><p>Go to Predict Marks to record an assessment.</p></div>
        ) : (
          <div className="table-wrapper"><table>
            <thead><tr><th>#</th><th>Student</th><th>Student Code</th><th>Internal /40</th><th>Predicted Semester /60</th><th>Overall /100</th><th>Type</th><th>Category</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>{predictions.map((prediction, index) => (
              <tr key={prediction.id}>
                <td>{index + 1}</td>
                <td><strong>{prediction.student_name}</strong></td>
                <td><code>{prediction.student_code}</code></td>
                <td>{prediction.internal_total ?? '—'}</td>
                <td>{prediction.predicted_semester_marks ?? '—'}</td>
                <td>{prediction.estimated_overall_marks ?? '—'}</td>
                <td>{prediction.prediction_type === 'ml_prediction' ? 'ML Prediction' : prediction.prediction_type === 'rule_based_estimate' ? 'Estimate – Not ML Prediction' : prediction.prediction_type || 'Legacy'}</td>
                <td><CategoryBadge category={prediction.performance_category} /></td>
                <td>{new Date(prediction.created_at).toLocaleDateString()}</td>
                <td><div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" title="View details" onClick={() => setViewId(prediction.id)}><Eye size={14} /></button>
                  <button className="btn-icon" title="Update marks" onClick={() => setEditPrediction(prediction)}><Pencil size={14} /></button>
                  <button className="btn-icon" title="Record actual exam result" onClick={() => setActualResultPrediction(prediction)}><FileCheck size={14} /></button>
                  <button className="btn-icon danger" title="Delete" onClick={() => setDeleteId(prediction.id)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {viewId && <DetailModal predictionId={viewId} onClose={() => setViewId(null)} />}
      {editPrediction && <EditModal prediction={editPrediction} onClose={() => setEditPrediction(null)} onSaved={fetchAll} />}
      {actualResultPrediction && <ActualResultModal prediction={actualResultPrediction} onClose={() => setActualResultPrediction(null)} onSaved={fetchAll} />}
      {deleteId && <ConfirmDialog onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  )
}
