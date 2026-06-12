import { cacheGet, cachePut, processOutbox, queueMutation, queueable } from './offline'

const TOKEN_KEY = 'cc_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

async function networkRequest(path, { method = 'GET', body, formData } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !path.startsWith('/auth/')) {
    setToken(null)
    window.location.assign('/login')
    throw new Error('Session expired — please log in again')
  }
  if (res.status === 402) {
    if (!window.location.pathname.startsWith('/onboarding')) window.location.assign('/onboarding')
    throw new Error('Subscription required')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Something went wrong'
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  return data
}

// fetch() throws TypeError when the network is unreachable — anything else
// (4xx/5xx) arrives as a normal response and is thrown above with a status.
const isNetworkError = (e) => e instanceof TypeError

function offlineError(message) {
  const err = new Error(message)
  err.offline = true
  return err
}

/* Reads: network first, fall back to the offline cache.
   Writes: network first; when offline, queue + apply optimistically (see offline.js). */
async function request(path, opts = {}) {
  const method = opts.method || 'GET'

  if (method === 'GET') {
    if (!navigator.onLine) {
      const cached = await cacheGet(path)
      if (cached !== undefined) return cached
      throw offlineError("You're offline and this hasn't been viewed yet — reconnect to load it.")
    }
    try {
      const data = await networkRequest(path, opts)
      cachePut(path, data)
      return data
    } catch (e) {
      if (!isNetworkError(e)) throw e
      const cached = await cacheGet(path)
      if (cached !== undefined) return cached
      throw offlineError("You're offline and this hasn't been viewed yet — reconnect to load it.")
    }
  }

  if (opts.formData) {
    // File uploads need a live connection
    try {
      return await networkRequest(path, opts)
    } catch (e) {
      throw isNetworkError(e) ? offlineError("You're offline — photo uploads need a connection.") : e
    }
  }

  const canQueue = queueable(path)
  if (!navigator.onLine && canQueue) return queueMutation(method, path, opts.body)
  try {
    const data = await networkRequest(path, opts)
    processOutbox() // clearly online — flush anything still waiting
    return data
  } catch (e) {
    if (isNetworkError(e)) {
      if (canQueue) return queueMutation(method, path, opts.body)
      throw offlineError("You're offline — this action needs a connection.")
    }
    throw e
  }
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('/uploads', { method: 'POST', formData: fd })
  },
}
