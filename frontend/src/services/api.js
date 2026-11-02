import axios from 'axios'

// All API calls go through Vite's proxy -> Flask on port 5000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Attach verified JWT Bearer token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gradiq_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Intercept 401 Unauthorized responses to automatically clear stale sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear invalid/expired session
      localStorage.removeItem('gradiq_token')
      localStorage.removeItem('gradiq_user')
      localStorage.removeItem('gradivo_user')
      if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register'
      ) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth Endpoints ────────────────────────────────────────────────────────────
export const register = (data) => api.post('/auth/register', data)
export const login    = (data) => api.post('/auth/login',    data)
export const getMe    = ()     => api.get('/auth/me')

// ── Admin Dashboard & Analytics ──────────────────────────────────────────────
export const getDashboard = () => api.get('/dashboard')
export const getAnalytics = () => api.get('/analytics')
export const getModelInfo = () => api.get('/model-info')
export const getTrainingRecords = () => api.get('/model-training/records')
export const getTrainingEda = () => api.get('/model-training/eda')
export const trainModel = () => api.post('/model-training/train')
export const uploadTrainingCsv = (file) => {
  const data = new FormData()
  data.append('file', file)
  return api.post('/model-training/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const downloadTrainingTemplate = () =>
  api.get('/model-training/template', { responseType: 'blob' })

// ── Admin Student Management ─────────────────────────────────────────────────
export const getStudents   = (search = '') =>
  api.get('/students/', { params: search ? { search } : {} })
export const getStudent    = (id)       => api.get(`/students/${id}`)
export const createStudent = (data)     => api.post('/students/', data)
export const updateStudent = (id, data) => api.put(`/students/${id}`, data)
export const deleteStudent = (id)       => api.delete(`/students/${id}`)

// ── Admin Prediction Endpoints ───────────────────────────────────────────────
export const makePrediction   = (data) => api.post('/predict', data)
export const getPredictions   = ()     => api.get('/predictions')
export const getPrediction    = (id)   => api.get(`/predictions/${id}`)
export const updatePrediction = (id, data) => api.put(`/predictions/${id}`, data)
export const recordActualSemesterResult = (id, actual_semester_marks) =>
  api.put(`/predictions/${id}/actual-result`, { actual_semester_marks })
export const deletePrediction = (id)   => api.delete(`/predictions/${id}`)

// ── Student Portal Endpoints (Student Only) ──────────────────────────────────
export const getStudentDashboard   = ()   => api.get('/student/dashboard')
export const getStudentProfile     = ()   => api.get('/student/profile')
export const getStudentPredictions = ()   => api.get('/student/predictions')
export const getStudentPrediction  = (id) => api.get(`/student/predictions/${id}`)

export default api
