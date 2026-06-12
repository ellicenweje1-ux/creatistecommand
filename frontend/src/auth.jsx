import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, getToken, setToken } from './api'
import { cachePut, clearOfflineData, pendingCount } from './offline'
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
      .catch((e) => { if (!e.offline) setToken(null) }) // keep the session through an offline boot
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    setToken(res.token)
    setUser(res.user)
    cachePut('/auth/me', res.user) // so the installed app can boot with no connection
    return res.user
  }

  const register = async (data) => {
    const res = await api.post('/auth/register', data)
    setToken(res.token)
    setUser(res.user)
    cachePut('/auth/me', res.user)
    return res.user
  }

  const logout = async () => {
    const pending = await pendingCount().catch(() => 0)
    if (pending > 0 && !window.confirm(
      `You have ${pending} offline change${pending === 1 ? '' : 's'} that haven't synced yet — logging out discards them. Log out anyway?`,
    )) return
    await clearOfflineData().catch(() => {}) // shared devices: don't leave kitchen data behind
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
