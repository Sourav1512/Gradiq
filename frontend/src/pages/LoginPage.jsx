import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'
import { login } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loginUser } = useAuth()

  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)

  // If already authenticated, redirect to appropriate role-based dashboard
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
    if (!form.email || !form.password) {
      setError('Please fill in both email and password.')
      return
    }
    setLoading(true)
    try {
      const res = await login(form)
      const userData = res.data.user
      const authToken = res.data.token

      // Persist user profile and JWT token into auth context
      loginUser(userData, authToken)

      // Role-Based Redirection
      if (userData.role === 'admin') {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/student-dashboard', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={22} />
          </div>
          <span className="auth-logo-text">Gradiq</span>
        </div>

        <h1 className="auth-title">Sign in to your account</h1>
        <p className="auth-subtitle">Enter your credentials to access your dashboard.</p>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email" name="email" type="email"
              className="form-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password" name="password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                style={{ paddingRight: 40 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex'
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create student account</Link>
        </div>

        {/* Credentials hint */}
        <div className="alert alert-info" style={{ marginTop: 20, marginBottom: 0 }}>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <div><strong>Administrator:</strong> admin@gradiq.com / Admin@123</div>
            <div style={{ marginTop: 4 }}><strong>Student Account:</strong> Sign up below or use your student email.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
