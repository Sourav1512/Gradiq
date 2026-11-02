import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Eye, X } from 'lucide-react'
import { getStudents, createStudent, updateStudent, deleteStudent, getStudent } from '../services/api'

// ── Helper ────────────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3 className="modal-title">Confirm Delete</h3>
          <button className="close-btn" onClick={onCancel}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Student Form Modal ────────────────────────────────────────────────────────
function StudentModal({ student, onClose, onSaved }) {
  const isEdit = !!student?.id
  const empty  = { full_name: '', email: '', course: '', semester: '1', attendance: '', previous_marks: '' }

  const [form, setForm]   = useState(student ? {
    ...student,
    semester: String(student.semester),
    attendance: student.attendance ?? '',
    previous_marks: student.previous_marks ?? '',
  } : empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      full_name: form.full_name,
      email: form.email,
      course: form.course,
      semester:       Number(form.semester),
      attendance: form.attendance === '' ? null : Number(form.attendance),
      previous_marks: form.previous_marks === '' ? null : Number(form.previous_marks),
    }
    setSaving(true)
    try {
      if (isEdit) {
        await updateStudent(student.id, payload)
      } else {
        await createStudent(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Student' : 'Add New Student'}</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <form id="student-form" onSubmit={handleSubmit}>
            {!isEdit && (
              <div className="alert alert-info">
                Student Code is generated automatically after this student is created and cannot be edited.
              </div>
            )}
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Student Code</label>
                <input className="form-input" value={student.student_id} readOnly />
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input name="full_name" className="form-input" value={form.full_name}
                  onChange={handleChange} placeholder="Jane Smith" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input name="email" type="email" className="form-input" value={form.email}
                onChange={handleChange} placeholder="jane@example.com" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Course *</label>
                <input name="course" className="form-input" value={form.course}
                  onChange={handleChange} placeholder="BCA, BSc, MCA…" required />
              </div>
              <div className="form-group">
                <label className="form-label">Semester *</label>
                <select name="semester" className="form-select" value={form.semester} onChange={handleChange}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Attendance (%)</label>
                <input name="attendance" type="number" min="0" max="100" step="0.1"
                  className="form-input" value={form.attendance}
                  onChange={handleChange} placeholder="0–100" />
              </div>
              <div className="form-group">
                <label className="form-label">Previous Semester Marks (optional)</label>
                <input name="previous_marks" type="number" min="0" max="100" step="0.1"
                  className="form-input" value={form.previous_marks}
                  onChange={handleChange} placeholder="0–100" />
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="student-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── View Student Modal ────────────────────────────────────────────────────────
function ViewModal({ studentId, onClose }) {
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudent(studentId)
      .then(res => setStudent(res.data.student))
      .finally(() => setLoading(false))
  }, [studentId])

  const rows = student ? [
    ['Student Code',   student.student_id],
    ['Full Name',      student.full_name],
    ['Email',          student.email],
    ['Course',         student.course],
    ['Semester',       `Semester ${student.semester}`],
    ['Attendance',     student.attendance == null ? 'Not recorded' : `${student.attendance}%`],
    ['Previous Semester Marks', student.previous_marks == null ? 'Not recorded' : `${student.previous_marks}/100`],
    ['Added On',       new Date(student.created_at).toLocaleString()],
  ] : []

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Student Details</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : (
            <table style={{ width: '100%' }}>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: '8px 0', color: 'var(--text-secondary)', width: 160, fontSize: 13 }}>{label}</td>
                    <td style={{ padding: '8px 0', fontWeight: 500, fontSize: 13 }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const [students, setStudents]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [modalType, setModalType]   = useState(null)  // 'add' | 'edit' | 'view' | 'delete'
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [error, setError]           = useState('')

  const fetchStudents = useCallback((q = '') => {
    setLoading(true)
    getStudents(q)
      .then(res => setStudents(res.data.students))
      .catch(err => setError(err.response?.data?.error || 'Failed to load students'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchStudents(search), 350)
    return () => clearTimeout(t)
  }, [search, fetchStudents])

  const handleDelete = async () => {
    try {
      await deleteStudent(selectedStudent.id)
      fetchStudents(search)
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed')
    } finally {
      setModalType(null)
      setSelectedStudent(null)
    }
  }

  return (
    <div>
      {error && (
        <div className="alert alert-error">
          {error}
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div className="search-bar">
          <Search size={15} color="var(--text-muted)" />
          <input
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }} onClick={() => setSearch('')}>
              <X size={14} color="var(--text-muted)" />
            </button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setSelectedStudent(null); setModalType('add') }}>
          <Plus size={15} /> Add Student
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All Students</div>
            <div className="card-subtitle">{students.length} record{students.length !== 1 ? 's' : ''} found</div>
          </div>
        </div>
        {loading ? (
          <div className="loading-state"><div className="spinner" /><span>Loading…</span></div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No students found</h3>
            <p>{search ? 'Try a different search term.' : 'Click Add Student to get started.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Course</th>
                  <th>Semester</th>
                  <th>Attendance</th>
                  <th>Previous /100</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td><code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{s.student_id}</code></td>
                    <td><strong>{s.full_name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.email}</td>
                    <td>{s.course}</td>
                    <td>Sem {s.semester}</td>
                    <td>
                      <span style={{ color: s.attendance == null ? 'var(--text-muted)' : s.attendance < 75 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                        {s.attendance == null ? '—' : `${s.attendance}%`}
                      </span>
                    </td>
                    <td>{s.previous_marks == null ? '—' : `${s.previous_marks}/100`}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-icon"
                          title="View"
                          onClick={() => { setSelectedStudent(s); setModalType('view') }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit"
                          onClick={() => { setSelectedStudent(s); setModalType('edit') }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Delete"
                          onClick={() => { setSelectedStudent(s); setModalType('delete') }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {(modalType === 'add' || modalType === 'edit') && (
        <StudentModal
          student={modalType === 'edit' ? selectedStudent : null}
          onClose={() => setModalType(null)}
          onSaved={() => fetchStudents(search)}
        />
      )}
      {modalType === 'view' && (
        <ViewModal studentId={selectedStudent.id} onClose={() => setModalType(null)} />
      )}
      {modalType === 'delete' && (
        <ConfirmDialog
          message={`Are you sure you want to delete ${selectedStudent?.full_name}? This will also delete all associated predictions.`}
          onConfirm={handleDelete}
          onCancel={() => { setModalType(null); setSelectedStudent(null) }}
        />
      )}
    </div>
  )
}
