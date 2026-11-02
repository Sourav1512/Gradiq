import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session from localStorage on application load / refresh
    try {
      const storedToken = localStorage.getItem('gradiq_token')
      const storedUser = localStorage.getItem('gradiq_user') || localStorage.getItem('gradivo_user')

      if (storedToken && storedUser) {
        setUser(JSON.parse(storedUser))
        setToken(storedToken)
      } else if (storedUser) {
        // Clear any half-saved session without a valid token
        localStorage.removeItem('gradiq_token')
        localStorage.removeItem('gradiq_user')
        localStorage.removeItem('gradivo_user')
        setUser(null)
        setToken(null)
      }
    } catch {
      setUser(null)
      setToken(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loginUser = (userData, authToken) => {
    if (authToken) {
      localStorage.setItem('gradiq_token', authToken)
      setToken(authToken)
    }
    if (userData) {
      localStorage.setItem('gradiq_user', JSON.stringify(userData))
      setUser(userData)
    }
    // Clean up any legacy storage key
    localStorage.removeItem('gradivo_user')
  }

  const logoutUser = () => {
    localStorage.removeItem('gradiq_token')
    localStorage.removeItem('gradiq_user')
    localStorage.removeItem('gradivo_user')
    setUser(null)
    setToken(null)
  }

  const isAdmin = user?.role === 'admin'
  const isStudent = user?.role === 'student'

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin,
        isStudent,
        loginUser,
        logoutUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for consuming auth context
export const useAuth = () => useContext(AuthContext)
