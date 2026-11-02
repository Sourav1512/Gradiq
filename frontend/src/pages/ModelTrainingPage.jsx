import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  downloadTrainingTemplate, getModelInfo, getTrainingEda,
  getTrainingRecords, trainModel, uploadTrainingCsv,
} from '../services/api'

const FEATURE_LABELS = {
  attendance_pct: 'Attendance Percentage',
  assignment_1_marks: 'Assignment 1',
  assignment_2_marks: 'Assignment 2',
  class_test_1_marks: 'Class Test 1',
  class_test_2_marks: 'Class Test 2',
  combined_class_test_marks: 'Combined Class Test',
  presentation_marks: 'Presentation',
  internal_total: 'Internal Assessment Total',
  previous_semester_marks: 'Previous Semester Marks',
  actual_semester_marks: 'Actual End-Semester Marks',
}

function Histogram({ title, data, color }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">{title}</div></div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="range" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function ModelTrainingPage() {
  const [info, setInfo] = useState(null)
  const [records, setRecords] = useState(null)
  const [eda, setEda] = useState(null)
  const [file, setFile] = useState(null)
  const [selectedFeature, setSelectedFeature] = useState('attendance_pct')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    const [modelResponse, recordResponse, edaResponse] = await Promise.all([
      getModelInfo(), getTrainingRecords(), getTrainingEda(),
    ])
    setInfo(modelResponse.data)
    setRecords(recordResponse.data)
    setEda(edaResponse.data.eda)
  }

  useEffect(() => {
    refresh()
      .catch(err => setError(err.response?.data?.error || 'Failed to load model training information.'))
      .finally(() => setLoading(false))
  }, [])

  const featureNames = useMemo(
    () => Object.keys(eda?.relationships || {}),
    [eda],
  )

  const downloadTemplate = async () => {
    setError('')
    try {
      const response = await downloadTrainingTemplate()
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'historical_marks_template.csv'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download the CSV template.')
    }
  }

  const upload = async event => {
    event.preventDefault()
    if (!file) {
      setError('Choose a genuine historical CSV file first.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await uploadTrainingCsv(file)
      setMessage(`${response.data.message} ${response.data.status_message}`)
      setFile(null)
      event.target.reset()
      await refresh()
    } catch (err) {
      setError(err.response?.data?.error || 'CSV upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const train = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await trainModel()
      setInfo(response.data.model)
      setMessage(response.data.message)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Model training failed.')
      if (err.response?.data?.model) {
        setInfo(err.response.data.model)
      } else if (err.response?.data?.training_status === 'needs_real_data') {
        setInfo(current => current ? {
          ...current,
          training_status: 'needs_real_data',
          status_message: err.response.data.error,
          metrics: null,
        } : current)
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading training workspace…</span></div>

  const trained = info?.training_status === 'trained'
  const matrix = eda?.correlations || {}
  const matrixKeys = Object.keys(matrix)
  const statusText = trained
    ? `Active model: ${info.model_name} (${info.model_version})`
    : 'Model Not Trained – Genuine Historical Examination Data Required.'

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-info">{message}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Genuine Historical Data and Model Training</div>
            <div className="card-subtitle">Target: actual end-semester examination marks out of 60</div>
          </div>
          <span className={`badge ${trained ? 'badge-good' : 'badge-needs'}`}>
            {trained ? 'Trained' : 'Not Trained'}
          </span>
        </div>
        <div className="card-body">
          <div className={`alert ${trained ? 'alert-info' : 'alert-warning'}`}>{statusText}</div>
          <div className="stats-grid" style={{ margin: '16px 0' }}>
            <div className="stat-card">
              <div className="stat-card-label">Genuine Labeled Records</div>
              <div className="stat-card-value">{records?.record_count ?? 0}</div>
              <div className="stat-card-sub">At least 10 required for an 80:20 split</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Training / Test Rows</div>
              <div className="stat-card-value">{trained ? `${info.train_size} / ${info.test_size}` : '—'}</div>
              <div className="stat-card-sub">Fixed random_state: 42</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Data Quality</div>
              <div className="stat-card-value">{records?.data_quality?.duplicate_rows ?? 0} duplicates</div>
              <div className="stat-card-sub">Exact repeated rows are flagged before training</div>
            </div>
          </div>
          {(records?.data_quality?.duplicate_rows ?? 0) > 0 && (
            <div className="alert alert-warning">
              Exact duplicate component/target rows were detected. They are retained because identical results may belong to different students; review source records before training.
            </div>
          )}
          <p className="card-subtitle">
            Upload only authentic college records. Required columns include attendance, each raw internal component,
            and the actual exam result. Combined Class Test and Internal Total are calculated from components;
            they must not be entered as separate CSV values.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Import Genuine Historical CSV</div></div>
          <div className="card-body">
            <p className="card-subtitle" style={{ marginBottom: 14 }}>
              The template contains only headers, no example students or target marks.
            </p>
            <button type="button" className="btn btn-secondary" onClick={downloadTemplate} style={{ marginBottom: 16 }}>
              Download CSV Template
            </button>
            <form onSubmit={upload}>
              <div className="form-group">
                <label className="form-label">Historical college marks CSV</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="form-input"
                  onChange={event => setFile(event.target.files?.[0] || null)}
                />
                <span className="form-hint">Maximum 10 MB and 20,000 rows. Re-importing the same file is blocked.</span>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy || !file}>
                {busy ? 'Importing…' : 'Validate and Import'}
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Compare and Train Models</div></div>
          <div className="card-body">
            <p className="card-subtitle" style={{ marginBottom: 12 }}>
              Trains Linear Regression, Decision Tree Regressor, and Random Forest Regressor using only genuine
              labels. Selects the lowest held-out RMSE. The saved pipeline is fitted on all validated records.
            </p>
            <button type="button" className="btn btn-primary" onClick={train} disabled={busy || (records?.record_count ?? 0) < 10}>
              {busy ? 'Training…' : 'Train and Evaluate Models'}
            </button>
            {(records?.record_count ?? 0) < 10 && (
              <div className="alert alert-warning" style={{ marginTop: 16 }}>
                {info?.status_message || 'Model Not Trained – Genuine Historical Examination Data Required.'}
              </div>
            )}
            {trained && info.algorithm_comparison && (
              <div className="table-wrapper" style={{ marginTop: 16 }}>
                <table>
                  <thead><tr><th>Algorithm</th><th>MAE</th><th>MSE</th><th>RMSE</th><th>R²</th></tr></thead>
                  <tbody>{Object.entries(info.algorithm_comparison).map(([name, metrics]) => (
                    <tr key={name}>
                      <td><strong>{name}{name === info.model_name ? ' (selected)' : ''}</strong></td>
                      <td>{metrics.mae}</td><td>{metrics.mse}</td><td>{metrics.rmse}</td><td>{metrics.r2}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Exploratory Data Analysis</div>
            <div className="card-subtitle">Charts use genuine uploaded or recorded actual examination data only</div>
          </div>
          <span className="badge badge-student">{eda?.record_count ?? 0} records</span>
        </div>
        {!eda ? (
          <div className="empty-state"><p>No genuine labeled records are available for EDA.</p></div>
        ) : (
          <div className="card-body">
            <div className="grid-3" style={{ marginBottom: 22 }}>
              <Histogram title="Attendance Distribution (%)" data={eda.distributions.attendance_pct} color="#2563EB" />
              <Histogram title="Internal Total Distribution (/40)" data={eda.distributions.internal_total} color="#7C3AED" />
              <Histogram title="Actual End-Semester Distribution (/60)" data={eda.distributions.actual_semester_marks} color="#16A34A" />
            </div>

            {featureNames.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="form-group" style={{ maxWidth: 360 }}>
                  <label className="form-label">Feature relationship with actual end-semester marks</label>
                  <select className="form-select" value={selectedFeature} onChange={event => setSelectedFeature(event.target.value)}>
                    {featureNames.map(feature => (
                      <option key={feature} value={feature}>{FEATURE_LABELS[feature] || feature}</option>
                    ))}
                  </select>
                </div>
                <div className="card">
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="x" name={FEATURE_LABELS[selectedFeature] || selectedFeature} />
                        <YAxis type="number" dataKey="y" name="Actual End-Semester Marks" domain={[0, 60]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter data={eda.relationships[selectedFeature] || []} fill="#2563EB" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {matrixKeys.length > 0 && (
              <>
                <h3 className="card-title" style={{ marginBottom: 12 }}>Feature Correlation Matrix</h3>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Feature</th>{matrixKeys.map(key => <th key={key}>{FEATURE_LABELS[key] || key}</th>)}</tr></thead>
                    <tbody>{matrixKeys.map(row => (
                      <tr key={row}>
                        <th>{FEATURE_LABELS[row] || row}</th>
                        {matrixKeys.map(column => {
                          const value = Number(matrix[row]?.[column] ?? 0)
                          const intensity = Math.round(Math.abs(value) * 55)
                          const background = value >= 0
                            ? `rgba(37, 99, 235, ${intensity / 100})`
                            : `rgba(220, 38, 38, ${intensity / 100})`
                          return <td key={column} style={{ textAlign: 'center', background }}>{value.toFixed(2)}</td>
                        })}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {trained && (
        <div className="card">
          <div className="card-header"><div className="card-title">Selected Model Feature Importance</div></div>
          <div className="card-body">
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Feature</th><th>Normalized Importance</th></tr></thead>
                <tbody>{Object.entries(info.feature_importance || {}).map(([name, value]) => (
                  <tr key={name}><td>{FEATURE_LABELS[name] || name}</td><td>{(value * 100).toFixed(2)}%</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
