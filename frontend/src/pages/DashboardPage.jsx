import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, BarChart3, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import { getDashboard } from '../services/api'

// Category → colour mapping
const CATEGORY_COLORS = {
  Excellent:          '#16A34A',
  Good:               '#2563EB',
  Average:            '#D97706',
  'Needs Improvement':'#DC2626',
}

function CategoryBadge({ category }) {
  const cls = {
    Excellent:          'badge badge-excellent',
    Good:               'badge badge-good',
    Average:            'badge badge-average',
    'Needs Improvement':'badge badge-needs',
  }[category] || 'badge'
  return <span className={cls}>{category}</span>
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getDashboard()
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Loading dashboard…</span>
      </div>
    )
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>
  }

  // Build pie chart data from marks_distribution
  const pieData = data.marks_distribution
    ? Object.entries(data.marks_distribution).map(([name, value]) => ({ name, value }))
    : []

  // Build bar chart data for attendance vs marks (binned into groups)
  const attBins = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 }
  const attMarks = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 }
  const attCounts = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
  (data.attendance_vs_marks || []).forEach(({ attendance, marks }) => {
    let bin
    if (attendance <= 25) bin = '0-25'
    else if (attendance <= 50) bin = '26-50'
    else if (attendance <= 75) bin = '51-75'
    else bin = '76-100'
    attMarks[bin] += marks
    attCounts[bin]++
  })
  const barData = Object.keys(attBins).map(bin => ({
    attendance: bin,
    avg_marks:  attCounts[bin] > 0 ? +(attMarks[bin] / attCounts[bin]).toFixed(1) : 0,
  }))

  const displayAverage = value => value == null ? '—' : value
  const stats = [
    { label: 'Total Students', value: data.total_students, icon: Users, color: 'blue' },
    { label: 'Average Internal Marks', value: `${displayAverage(data.average_internal_marks)}/40`, icon: BarChart3, color: 'teal' },
    { label: 'Average Predicted Semester', value: `${displayAverage(data.average_predicted_semester_marks)}/60`, icon: TrendingUp, color: 'green' },
    { label: 'Average Estimated Overall', value: `${displayAverage(data.average_estimated_overall_marks)}/100`, icon: AlertTriangle, color: 'red' },
  ]

  return (
    <div>
      {/* Stat cards */}
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">{label}</span>
              <div className={`stat-icon ${color}`}>
                <Icon size={18} />
              </div>
            </div>
            <div className="stat-card-value">{value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Performance distribution pie */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Performance Distribution</div>
              <div className="card-subtitle">Breakdown by category</div>
            </div>
          </div>
          <div className="card-body">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>No prediction data yet. Make your first prediction!</p>
              </div>
            )}
          </div>
        </div>

        {/* Attendance vs avg predicted marks */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Attendance vs Predicted Semester Marks</div>
              <div className="card-subtitle">Predicted examination average by attendance range (%)</div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="attendance" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 60]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}/60`, 'Avg Semester Marks']} />
                <Bar dataKey="avg_marks" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent predictions table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Predictions</div>
            <div className="card-subtitle">Last 5 prediction results</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/history')}>
            View All <ChevronRight size={14} />
          </button>
        </div>
        {data.recent_predictions?.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>ID</th>
                  <th>Internal</th>
                  <th>Predicted Semester</th>
                  <th>Estimated Overall</th>
                  <th>Category</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_predictions.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.student_name}</strong></td>
                    <td><span style={{ color: 'var(--text-muted)' }}>{p.student_code}</span></td>
                    <td><strong>{p.internal_total}/40</strong></td>
                    <td><strong>{p.predicted_semester_marks}/60</strong></td>
                    <td><strong>{p.estimated_overall_marks}/100</strong></td>
                    <td><CategoryBadge category={p.performance_category} /></td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <h3>No predictions yet</h3>
            <p>Go to Predict Marks to run your first prediction.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/predict')}>
              Make a Prediction
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
