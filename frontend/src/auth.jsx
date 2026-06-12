import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, getToken, setToken } from './api'
import { Spinner } from './ui'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api.get('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  const register = async (data) => {
    const res = await api.post('/auth/register', data)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    window.location.assign('/')
  }

  const refresh = () => api.get('/auth/me').then((u) => { setUser(u); return u })

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const isActive = (user) =>
  user && (user.role === 'admin' || user.subscription_status === 'active' || user.subscription_status === 'trialing')

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner className="min-h-screen" />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

export function RequireActive({ children }) {
  const { user } = useAuth()
  if (!isActive(user)) return <Navigate to="/onboarding" replace />
  // Verification gate: owners must complete their onboarding call before the
  // workspace opens (staff inherit their owner's state, checked server-side).
  if (user.role !== 'admin' && !user.is_staff && !user.onboarded_at) return <Navigate to="/onboarding" replace />
  return children
}

export function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/app" replace />
  return children
}
