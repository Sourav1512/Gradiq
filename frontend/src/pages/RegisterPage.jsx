import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap, ShieldCheck } from 'lucide-react'
import { register } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { user, loginUser } = useAuth()

  const [form, setForm]       = useState({ full_name: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  // If already authenticated, redirect to role-based dashboard
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/student-dashboard', { replace: true })
      }
    }
  }, [user, navigate])

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.full_name || !form.email || !form.password) {
      setError('Please fill in all required fields.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    setLoading(true)
    try {
      // Registration is strictly for student accounts
      const res = await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password
      })

      const userData = res.data.user
      const authToken = res.data.token

      // Persist auth session
      loginUser(userData, authToken)

      // Direct student to their personalized Student Dashboard
      navigate('/student-dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={22} />
          </div>
          <span className="auth-logo-text">Gradiq</span>
        </div>

        <h1 className="auth-title">Create Student Account</h1>
        <p className="auth-subtitle">Join Gradiq to view your academic predictions and progress.</p>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="full_name">Full Name *</label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              className="form-input"
              placeholder="e.g. Sourav Singh"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address *</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-input"
              placeholder="e.g. student@college.edu"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password *</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {/* Account Role Badge (Read-only security badge) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--text-secondary)'
          }}>
            <ShieldCheck size={16} color="var(--primary)" />
            <span>Account Type: <strong>Student Member</strong> (Role assigned automatically)</span>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create Student Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
