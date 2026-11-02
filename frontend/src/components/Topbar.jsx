import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'

const PAGE_TITLES = {
  // Admin routes
  '/dashboard':          { title: 'Administrator Dashboard', subtitle: 'Institutional performance overview and summaries' },
  '/students':           { title: 'Student Management',      subtitle: 'Manage and view all registered student records' },
  '/predict':            { title: 'Predict Marks',           subtitle: 'Run machine learning model on student academic factors' },
  '/history':            { title: 'Prediction History',      subtitle: 'Comprehensive record of all past institutional evaluations' },
  '/analytics':          { title: 'Analytics & Reports',     subtitle: 'Aggregated statistical distributions and academic trends' },
  '/model-info':         { title: 'ML Model Architecture',   subtitle: 'Regression metrics, comparative benchmarks and feature importance' },
  '/model-training':     { title: 'Model Training',          subtitle: 'Import genuine exam records, review EDA and train admin-controlled models' },

  // Student routes
  '/student-dashboard':  { title: 'Student Academic Dashboard', subtitle: 'Your personal academic performance and forecast overview' },
  '/student/profile':    { title: 'My Academic Profile',        subtitle: 'Verified course, semester, and attendance record' },
  '/student/history':    { title: 'My Prediction History',     subtitle: 'Personal history of your expected academic evaluations' },
}

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const info = PAGE_TITLES[pathname] || { title: 'Gradiq', subtitle: 'Student Performance Prediction System' }

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Hamburger – mobile navigation toggle */}
        <button className="hamburger-btn" onClick={onMenuClick} aria-label="Open sidebar">
          <Menu size={22} />
        </button>
        <div>
          <div className="topbar-title">{info.title}</div>
          {info.subtitle && <div className="topbar-subtitle">{info.subtitle}</div>}
        </div>
      </div>
    </header>
  )
}
