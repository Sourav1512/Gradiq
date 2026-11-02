import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getModelInfo } from '../services/api'

const FEATURE_LABELS = {
  attendance_pct: 'Attendance Percentage',
  assignment_1_marks: 'Assignment 1 (out of 5)',
  assignment_2_marks: 'Assignment 2 (out of 5)',
  class_test_1_marks: 'Class Test 1 (out of 20)',
  class_test_2_marks: 'Class Test 2 (out of 20)',
  combined_class_test_marks: 'Combined Class Tests (out of 20)',
  presentation_marks: 'Presentation (out of 10)',
  internal_total: 'Internal Assessment Total (out of 40)',
  previous_semester_marks: 'Previous Semester Marks (optional)',
}

export default function ModelInfoPage() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getModelInfo()
      .then(response => setInfo(response.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load model info'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading model information…</span></div>
  if (error) return <div className="alert alert-error">{error}</div>
  if (!info) return null

  const trained = info.training_status === 'trained' && info.metrics
  const metrics = info.metrics

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">Model & Dataset Information</div></div>
        <div className="card-body">
          <div className={`alert ${trained ? 'alert-info' : 'alert-warning'}`} style={{ marginBottom: 20 }}>
            <strong>{trained ? 'Training data:' : 'Model unavailable:'}</strong> {trained ? info.dataset_note : info.status_message || 'Model Not Trained – Genuine Historical Examination Data Required.'}
          </div>
          <div className="grid-3" style={{ gap: 16 }}>
            {[
              ['Genuine Records', info.dataset_size ?? 0],
              ['Training Rows', info.train_size ?? 0],
              ['Evaluation Rows', info.test_size ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="metric-card">
                <div className="metric-value">{value}</div>
                <div className="metric-label">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">End-Semester Model Evaluation</div>
            <div className="card-subtitle">Target: actual examination marks out of 60</div>
          </div>
          {trained && <span className="badge badge-good">{info.model_name}</span>}
        </div>
        <div className="card-body">
          {trained ? (
            <>
              <div className="alert alert-info">Selected model: {info.model_name} · Version {info.model_version}. Evaluation uses a reproducible 80:20 held-out split of genuine labeled records.</div>
              <div className="table-wrapper"><table>
                <thead><tr><th>Algorithm</th><th>MAE</th><th>MSE</th><th>RMSE</th><th>R² Score</th></tr></thead>
                <tbody>
                  {Object.entries(info.algorithm_comparison || { [info.model_name]: metrics }).map(([name, result]) => (
                    <tr key={name}>
                      <td><strong>{name}{name === info.model_name ? ' (selected)' : ''}</strong></td>
                      <td>{result.mae}</td><td>{result.mse}</td><td>{result.rmse}</td><td>{result.r2}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <p className="form-hint" style={{ marginTop: 10 }}>MAE, MSE and RMSE are in marks/marks²; R² can be negative. Lower errors and higher R² generally indicate better held-out performance.</p>
            </>
          ) : (
            <div className="alert alert-warning">
              {info.status_message || 'Model Not Trained – Genuine Historical Examination Data Required.'} No evaluation metrics are reported until genuine labeled records are imported and evaluated.
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Features and Target</div>
          <div className="card-subtitle">Internal marks are predictors, never the training target.</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {(info.features || []).map(feature => (
              <span key={feature} style={{
                background: 'var(--primary-light)', color: 'var(--primary)',
                border: '1px solid #BFDBFE', borderRadius: 20,
                padding: '4px 12px', fontSize: 13, fontWeight: 500,
              }}>{FEATURE_LABELS[feature] || feature}</span>
            ))}
          </div>
          <div className="alert alert-info">
            <strong>Target label:</strong> {info.target || 'actual_semester_marks'} (actual end-semester marks, 0–60). Predicted marks are clipped to this range. Daily Study Hours is not a feature.
          </div>
          {Object.keys(info.feature_importance || {}).length > 0 && (
            <div style={{ marginTop: 16 }}>
              {Object.entries(info.feature_importance).sort(([, a], [, b]) => b - a).map(([feature, importance]) => (
                <div key={feature} className="feature-bar-row">
                  <div className="feature-bar-label">{FEATURE_LABELS[feature] || feature}</div>
                  <div className="feature-bar-track"><div className="feature-bar-fill" style={{ width: `${(importance * 100).toFixed(1)}%` }} /></div>
                  <div className="feature-bar-pct">{(importance * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Training with Historical Results</div></div>
        <div className="card-body" style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          <p>Use the admin-only <Link to="/model-training">Model Training</Link> workspace to import authentic college CSV records, inspect data quality and EDA, compare the regression algorithms, and train. No public or unrelated dataset is substituted for college examination data.</p>
          <p>The CSV pipeline derives Combined Class Test = (CT1 + CT2) / 2 and Internal Total = A1 + A2 + Combined + Presentation. It does not accept supplied duplicate derived marks.</p>
          <p>Linear Regression, Decision Tree Regressor and Random Forest Regressor are compared on a fixed 80:20 split. The lowest held-out RMSE is selected. At least 10 valid genuine labeled records are required. Exact duplicate rows are reported and retained for review because different students may have identical marks.</p>
        </div>
      </div>
    </div>
  )
}
