import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, BrainCircuit, History,
  BarChart3, Info, LogOut, X, GraduationCap,
  User
} from 'lucide-react'

const ADMIN_NAV = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/students',   label: 'Students',      icon: Users },
  { to: '/predict',    label: 'Predict Marks', icon: BrainCircuit },
  { to: '/history',    label: 'History',       icon: History },
  { to: '/analytics',  label: 'Analytics',     icon: BarChart3 },
  { to: '/model-info', label: 'ML Model',      icon: Info },
  { to: '/model-training', label: 'Model Training', icon: BrainCircuit },
]

const STUDENT_NAV = [
  { to: '/student-dashboard', label: 'Student Dashboard', icon: LayoutDashboard },
  { to: '/student/profile',   label: 'My Profile',        icon: User },
  { to: '/student/history',   label: 'My Predictions',    icon: History },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logoutUser, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logoutUser()
    navigate('/login', { replace: true })
  }

  const navItems = isAdmin ? ADMIN_NAV : STUDENT_NAV

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <GraduationCap size={20} />
        </div>
        <div>
          <div className="sidebar-logo-text">Gradiq</div>
          <div className="sidebar-logo-sub">
            {isAdmin ? 'Admin Console' : 'Student Portal'}
          </div>
        </div>
        {/* Close button – mobile only */}
        <button
          className="close-btn"
          onClick={onClose}
          style={{ marginLeft: 'auto' }}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">
          {isAdmin ? 'Administration' : 'Student Navigation'}
        </div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div style={{ overflow: 'hidden' }}>
            <div className="sidebar-user-name truncate">{user?.full_name}</div>
            <div className="sidebar-user-role" style={{ textTransform: 'capitalize' }}>
              <span className={isAdmin ? 'badge badge-good' : 'badge badge-student'} style={{ fontSize: 10, padding: '1px 6px' }}>
                {user?.role}
              </span>
            </div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
