import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getAnalytics } from '../services/api'

const CATEGORY_COLORS = {
  Excellent: '#16A34A',
  Good: '#2563EB',
  Average: '#D97706',
  'Needs Improvement': '#DC2626',
}
const FEATURE_LABELS = {
  attendance_pct: 'Attendance (%)',
  assignment_1_marks: 'Assignment 1',
  assignment_2_marks: 'Assignment 2',
  class_test_1_marks: 'Class Test 1',
  class_test_2_marks: 'Class Test 2',
  combined_class_test_marks: 'Combined Class Tests',
  presentation_marks: 'Presentation',
  internal_total: 'Internal Total',
  previous_semester_marks: 'Previous Semester Marks',
}

function AverageCard({ label, value, maximum }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={{ marginTop: 8 }}>{value == null ? '—' : `${value}/${maximum}`}</div>
      <div className="stat-card-sub">From saved predictions only</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAnalytics()
      .then(response => setData(response.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading analytics…</span></div>
  if (error) return <div className="alert alert-error">{error}</div>

  const featureData = Object.entries(data.feature_importance || {})
    .map(([key, value]) => ({ feature: FEATURE_LABELS[key] || key, importance: +(value * 100).toFixed(1) }))
    .sort((a, b) => b.importance - a.importance)
  const categories = (data.performance_distribution || []).map(item => ({ name: item.category, value: item.count }))
  const scatterData = data.attendance_vs_marks || []
  const courses = data.course_averages || []

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <AverageCard label="Average Internal Marks" value={data.average_internal_marks} maximum={40} />
        <AverageCard label="Average Predicted Semester Marks" value={data.average_predicted_semester_marks} maximum={60} />
        <AverageCard label="Average Estimated Overall Marks" value={data.average_estimated_overall_marks} maximum={100} />
        <div className="stat-card">
          <div className="stat-card-label">Predictions Analysed</div>
          <div className="stat-card-value" style={{ marginTop: 8 }}>{data.prediction_count}</div>
          <div className="stat-card-sub">Saved 40/60 records</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Performance Categories</div><div className="card-subtitle">Saved predictions by estimated overall result</div></div>
          </div>
          <div className="card-body">
            {categories.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {categories.map(item => <Cell key={item.name} fill={CATEGORY_COLORS[item.name] || '#94A3B8'} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No prediction data yet.</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Model Feature Importance</div><div className="card-subtitle">Shown only after training with genuine results</div></div>
          </div>
          <div className="card-body">
            {featureData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={featureData} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={value => [`${value}%`, 'Importance']} />
                  <Bar dataKey="importance" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>Feature importance is unavailable until a model is trained on actual exam results.</p></div>}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Attendance vs Predicted Semester Marks</div><div className="card-subtitle">Each point is a saved prediction</div></div>
          </div>
          <div className="card-body">
            {scatterData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="attendance" name="Attendance" unit="%" type="number" domain={[0, 100]} />
                  <YAxis dataKey="marks" name="Predicted Semester Marks" type="number" domain={[0, 60]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={scatterData} fill="#2563EB" opacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No prediction data yet.</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Course Averages</div><div className="card-subtitle">Actual internal and predicted examination marks</div></div>
          </div>
          <div className="card-body">
            {courses.length ? (
              <div className="table-wrapper"><table>
                <thead><tr><th>Course</th><th>Internal /40</th><th>Predicted /60</th><th>Overall /100</th></tr></thead>
                <tbody>{courses.map(row => (
                  <tr key={row.course}>
                    <td>{row.course}</td>
                    <td>{row.average_internal_marks}</td>
                    <td>{row.average_predicted_semester_marks}</td>
                    <td>{row.average_estimated_overall_marks}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <div className="empty-state"><p>No course prediction data yet.</p></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
