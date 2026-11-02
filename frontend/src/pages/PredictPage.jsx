import { useEffect, useState } from 'react'
import { AlertTriangle, BrainCircuit, CheckCircle } from 'lucide-react'
import { getPrediction, getStudents, makePrediction } from '../services/api'

const INITIAL_FORM = {
  student_code: '',
  attendance_pct: '',
  assignment_1_marks: '',
  assignment_2_marks: '',
  class_test_1_marks: '',
  class_test_2_marks: '',
  presentation_marks: '',
  previous_semester_marks: '',
}

const MARK_FIELDS = [
  ['attendance_pct', 'Attendance Percentage', 0, 100, 'required'],
  ['assignment_1_marks', 'Assignment 1 Marks', 0, 5, 'required'],
  ['assignment_2_marks', 'Assignment 2 Marks', 0, 5, 'required'],
  ['class_test_1_marks', 'Class Test 1 Marks', 0, 20, 'required'],
  ['class_test_2_marks', 'Class Test 2 Marks', 0, 20, 'required'],
  ['presentation_marks', 'Presentation Marks', 0, 10, 'required'],
  ['previous_semester_marks', 'Previous Semester Marks', 0, 100, 'optional'],
]

function CategoryBadge({ category }) {
  const classes = {
    Excellent: 'badge badge-excellent',
    Good: 'badge badge-good',
    Average: 'badge badge-average',
    'Needs Improvement': 'badge badge-needs',
  }
  return <span className={classes[category] || 'badge'}>{category}</span>
}

function MarksBar({ marks, maximum }) {
  const percent = Math.max(0, Math.min(100, (marks / maximum) * 100))
  const color = percent >= 80 ? '#16A34A' : percent >= 60 ? '#2563EB' : percent >= 40 ? '#D97706' : '#DC2626'
  return (
    <div className="progress-bar-track" style={{ height: 14, borderRadius: 8 }}>
      <div className="progress-bar-fill" style={{ width: `${percent}%`, background: color, borderRadius: 8 }} />
    </div>
  )
}

function FeatureImportanceSection({ importance = {} }) {
  const labels = {
    attendance_pct: 'Attendance (%)',
    assignment_1_marks: 'Assignment 1',
    assignment_2_marks: 'Assignment 2',
    combined_class_test_marks: 'Combined Class Tests',
    presentation_marks: 'Presentation',
    internal_total: 'Internal Total',
    previous_semester_marks: 'Previous Semester Marks',
  }
  return Object.entries(importance).sort(([, a], [, b]) => b - a).map(([key, value]) => (
    <div key={key} className="feature-bar-row">
      <div className="feature-bar-label">{labels[key] || key}</div>
      <div className="feature-bar-track">
        <div className="feature-bar-fill" style={{ width: `${(value * 100).toFixed(1)}%` }} />
      </div>
      <div className="feature-bar-pct">{(value * 100).toFixed(1)}%</div>
    </div>
  ))
}

export default function PredictPage() {
  const [students, setStudents] = useState([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getStudents()
      .then(response => setStudents(response.data.students))
      .catch(err => setError(err.response?.data?.error || 'Failed to load students'))
      .finally(() => setLoadingStudents(false))
  }, [])

  useEffect(() => {
    const savedPredictionId = sessionStorage.getItem('gradiq_last_prediction_id')
    if (!savedPredictionId) return

    getPrediction(savedPredictionId)
      .then(response => {
        const prediction = response.data.prediction
        setForm({
          ...INITIAL_FORM,
          student_code: prediction.student_code,
          attendance_pct: String(prediction.attendance_pct),
          assignment_1_marks: String(prediction.assignment_1_marks),
          assignment_2_marks: String(prediction.assignment_2_marks),
          class_test_1_marks: String(prediction.class_test_1_marks),
          class_test_2_marks: String(prediction.class_test_2_marks),
          presentation_marks: String(prediction.presentation_marks),
          previous_semester_marks: prediction.previous_semester_marks == null
            ? '' : String(prediction.previous_semester_marks),
        })
        setResult({
          ...prediction,
          prediction_available: prediction.predicted_semester_marks != null,
          student: {
            student_code: prediction.student_code,
            full_name: prediction.student_name,
          },
          explanation: prediction.prediction_type === 'rule_based_estimate'
            ? `Provisional rule-based estimate: ${prediction.predicted_semester_marks}/60 for the end-semester exam. Estimated overall marks are ${prediction.estimated_overall_marks}/100 using ${prediction.internal_total}/40 actual internal marks.`
            : `Estimated overall marks are ${prediction.estimated_overall_marks}/100 using actual internal and ML-predicted examination marks.`,
          disclaimer: prediction.prediction_type === 'rule_based_estimate'
            ? 'Estimate – Not ML Prediction. This is a provisional rule-based estimate, not an actual exam result or trained-model prediction.'
            : 'ML-predicted end-semester marks are an estimate; internal marks are actual recorded assessment marks.',
          suggestions: [],
          feature_importance: {},
        })
      })
      .catch(err => {
        sessionStorage.removeItem('gradiq_last_prediction_id')
        setError(err.response?.data?.error || 'Failed to restore the saved prediction.')
      })
  }, [])

  const selectedStudent = students.find(student => student.student_id === form.student_code)
  const handleChange = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }))

  const handleStudentSelect = event => {
    const code = event.target.value
    const student = students.find(item => item.student_id === code)
    setForm({
      ...INITIAL_FORM,
      student_code: code,
      attendance_pct: student?.attendance ?? '',
      previous_semester_marks: student?.previous_marks ?? '',
    })
    setResult(null)
    setError('')
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    setResult(null)
    if (!form.student_code) {
      setError('Please select a student.')
      return
    }
    for (const [field, label, minimum, maximum, requirement] of MARK_FIELDS) {
      const raw = form[field]
      if (requirement === 'required' && raw === '') {
        setError(`${label} is required.`)
        return
      }
      if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < minimum || Number(raw) > maximum)) {
        setError(`${label} must be between ${minimum} and ${maximum}.`)
        return
      }
    }

    const payload = {
      student_code: form.student_code,
      attendance_pct: Number(form.attendance_pct),
      assignment_1_marks: Number(form.assignment_1_marks),
      assignment_2_marks: Number(form.assignment_2_marks),
      class_test_1_marks: Number(form.class_test_1_marks),
      class_test_2_marks: Number(form.class_test_2_marks),
      presentation_marks: Number(form.presentation_marks),
      previous_semester_marks: form.previous_semester_marks === '' ? null : Number(form.previous_semester_marks),
    }
    setLoading(true)
    try {
      const response = await makePrediction(payload)
      setResult(response.data)
      sessionStorage.setItem('gradiq_last_prediction_id', String(response.data.prediction_id))
    } catch (err) {
      setError(err.response?.data?.error || 'Prediction failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    sessionStorage.removeItem('gradiq_last_prediction_id')
    setForm(INITIAL_FORM)
    setResult(null)
    setError('')
  }

  const combinedClassTest = result
    ? (result.class_test_1_marks + result.class_test_2_marks) / 2
    : null

  return (
    <div style={{ maxWidth: 780 }}>
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Prediction Input Form</div>
            <div className="card-subtitle">Record internal assessments and predict the end-semester examination out of 60.</div>
          </div>
          <BrainCircuit size={22} color="var(--primary)" />
        </div>
        <div className="card-body">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Student Code *</label>
                <select name="student_code" className="form-select" value={form.student_code} onChange={handleStudentSelect} required>
                  <option value="">— Choose a student —</option>
                  {students.map(student => (
                    <option key={student.id} value={student.student_id}>{student.student_id}</option>
                  ))}
                </select>
                {students.length === 0 && !loadingStudents && <p className="form-hint">Add students first from Student Management.</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input className="form-input" value={selectedStudent?.full_name || ''} readOnly placeholder="Linked to selected student" />
              </div>
            </div>

            <div className="form-row">
              {MARK_FIELDS.slice(0, 1).concat(MARK_FIELDS.slice(6)).map(([field, label, min, max, requirement]) => (
                <div className="form-group" key={field}>
                  <label className="form-label">{label}{requirement === 'required' ? ' *' : ' (optional)'}</label>
                  <input
                    name={field}
                    type="number"
                    min={min}
                    max={max}
                    step="0.01"
                    className="form-input"
                    placeholder={`0 – ${max}`}
                    value={form[field]}
                    onChange={handleChange}
                    required={requirement === 'required'}
                  />
                </div>
              ))}
            </div>

            <div className="card-subtitle" style={{ margin: '4px 0 12px' }}>Internal Assessment Components (40 marks)</div>
            <div className="form-row">
              {MARK_FIELDS.slice(1, 3).map(([field, label, min, max]) => (
                <div className="form-group" key={field}>
                  <label className="form-label">{label} *</label>
                  <input name={field} type="number" min={min} max={max} step="0.01" className="form-input"
                    placeholder={`0 – ${max}`} value={form[field]} onChange={handleChange} required />
                </div>
              ))}
            </div>
            <div className="form-row">
              {MARK_FIELDS.slice(3, 5).map(([field, label, min, max]) => (
                <div className="form-group" key={field}>
                  <label className="form-label">{label} *</label>
                  <input name={field} type="number" min={min} max={max} step="0.01" className="form-input"
                    placeholder={`0 – ${max}`} value={form[field]} onChange={handleChange} required />
                </div>
              ))}
            </div>
            <div className="form-group" style={{ maxWidth: 'calc(50% - 8px)' }}>
              <label className="form-label">Presentation Marks *</label>
              <input name="presentation_marks" type="number" min="0" max="10" step="0.01" className="form-input"
                placeholder="0 – 10" value={form.presentation_marks} onChange={handleChange} required />
            </div>
            <div className="alert alert-info" style={{ marginTop: 4 }}>
              Combined Class Test = (CT1 + CT2) / 2. Internal Total = A1 + A2 + Combined Class Test + Presentation (maximum 40).
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading || loadingStudents || students.length === 0}>
                <BrainCircuit size={16} />{loading ? 'Predicting…' : 'Predict End-Semester Marks'}
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={handleReset}>Reset</button>
            </div>
          </form>
        </div>
      </div>

      {result && (
        <div className="prediction-result">
          <div className="alert alert-warning" style={{ marginBottom: 24 }}>
            <AlertTriangle size={15} /><span>{result.disclaimer || result.message}</span>
          </div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Marks Breakdown — {result.student.full_name}</div>
                <div className="card-subtitle">{result.student.student_code}</div>
              </div>
                {result.prediction_type === 'rule_based_estimate'
                  ? <span className="badge badge-average">Estimate</span>
                  : <CategoryBadge category={result.performance_category} />}
            </div>
            <div className="card-body">
              <div className="grid-2">
                <div>
                  <div className="card-subtitle">Actual Internal Assessment Components</div>
                  <table style={{ width: '100%', marginTop: 10 }}>
                    <tbody>
                      <tr><td>Assignment 1</td><td style={{ textAlign: 'right' }}>{form.assignment_1_marks}/5</td></tr>
                      <tr><td>Assignment 2</td><td style={{ textAlign: 'right' }}>{form.assignment_2_marks}/5</td></tr>
                      <tr><td>Class Test 1</td><td style={{ textAlign: 'right' }}>{form.class_test_1_marks}/20</td></tr>
                      <tr><td>Class Test 2</td><td style={{ textAlign: 'right' }}>{form.class_test_2_marks}/20</td></tr>
                      <tr><td>Combined Class Tests</td><td style={{ textAlign: 'right' }}>{combinedClassTest.toFixed(2)}/20</td></tr>
                      <tr><td>Presentation</td><td style={{ textAlign: 'right' }}>{form.presentation_marks}/10</td></tr>
                      <tr><td><strong>Internal Assessment</strong></td><td style={{ textAlign: 'right' }}><strong>{result.internal_total}/40</strong></td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="stat-card" style={{ marginBottom: 12 }}>
                    <div className="stat-card-label">
                      {result.prediction_type === 'rule_based_estimate'
                        ? 'Estimate – Not ML Prediction'
                        : 'ML Predicted End-Semester Marks'}
                    </div>
                    <div className="stat-card-value">{result.predicted_semester_marks}/60</div>
                    <MarksBar marks={result.predicted_semester_marks} maximum={60} />
                  </div>
                  <div className="stat-card" style={{ marginBottom: 12 }}>
                    <div className="stat-card-label">Estimated Overall Marks</div>
                    <div className="stat-card-value">{result.estimated_overall_marks}/100</div>
                    <MarksBar marks={result.estimated_overall_marks} maximum={100} />
                  </div>
                  <p className="card-subtitle">{result.explanation}</p>
                  {result.disclaimer && <p className="form-hint">{result.disclaimer}</p>}
                  {result.prediction_type === 'ml_prediction' && (
                    <p className="form-hint">ML prediction · Model version {result.model_version || 'not reported'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {result.prediction_available !== false && (
            <div className="grid-2">
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  <CheckCircle size={15} style={{ verticalAlign: 'middle', color: 'var(--success)', marginRight: 6 }} />
                  Performance Explanation
                </h4>
                <ul className="suggestion-list">
                  {(result.suggestions || []).map((suggestion, index) => <li key={index} className="suggestion-item">{suggestion}</li>)}
                </ul>
              </div>
              {result.prediction_type === 'ml_prediction' && <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Model Feature Importance</h4>
                <FeatureImportanceSection importance={result.feature_importance} />
              </div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
