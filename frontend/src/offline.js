/* Offline-first data layer.

   Two IndexedDB stores back the whole thing:
     - 'gets'   — every successful GET response, keyed by API path (incl. query string).
                  Served when the network is unreachable, so the app reads fully offline.
     - 'outbox' — mutations made while offline, replayed in order when the connection
                  returns. Last write wins on the server.

   Offline writes are applied optimistically to the cached GET data (the CRUD routes all
   share the same /resource and /resource/{id} shape), so the UI reflects them
   immediately even though the network round-trip hasn't happened yet. */
import { useEffect, useState } from 'react'
import { toast } from './ui'

const TOKEN_KEY = 'cc_token'

/* ------------------------------- IndexedDB ------------------------------- */
let dbPromise = null
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('cc-offline', 1)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('gets')) d.createObjectStore('gets', { keyPath: 'path' })
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function idb(store, mode, run) {
  return openDb().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(store, mode)
        const req = run(t.objectStore(store))
        t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

const idbGet = (store, key) => idb(store, 'readonly', (s) => s.get(key))
const idbAll = (store) => idb(store, 'readonly', (s) => s.getAll())
const idbPut = (store, value) => idb(store, 'readwrite', (s) => s.put(value))
const idbDel = (store, key) => idb(store, 'readwrite', (s) => s.delete(key))
const idbClear = (store) => idb(store, 'readwrite', (s) => s.clear())

/* ------------------------------ GET cache -------------------------------- */
export const cacheGet = (path) => idbGet('gets', path).then((row) => row?.data).catch(() => undefined)
export const cachePut = (path, data) => idbPut('gets', { path, data, at: Date.now() }).catch(() => {})

export async function clearOfflineData() {
  await Promise.all([idbClear('gets').catch(() => {}), idbClear('outbox').catch(() => {})])
  if ('caches' in window) await caches.delete('cc-runtime-v1').catch(() => {})
  emitState()
}

/* ------------------------------- outbox ---------------------------------- */
// Flows that genuinely need a live connection (payments, login, AI, file uploads,
// bookable call slots) are never queued — they fail fast with a clear message instead.
const NO_QUEUE = ['/auth/', '/billing/', '/ai/', '/admin/', '/onboarding/', '/founders', '/uploads', '/public/', '/exports/', '/calendar/', '/cron/']
export const queueable = (path) => !NO_QUEUE.some((p) => path.startsWith(p))

export const pendingCount = () =>
  idb('outbox', 'readonly', (s) => s.count()).catch(() => 0)

export async function queueMutation(method, path, body) {
  const tempId = method === 'POST' ? `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` : null
  const before = await pendingCount()
  await idbPut('outbox', { method, path, body, tempId, queuedAt: Date.now() })
  if (before === 0) toast("You're offline — changes are saved on this device and will sync when you're back", 'amber')
  const synthetic = await patchCaches(method, path, body, tempId).catch(() => null)
  emitState()
  return synthetic
}

/* --------------------- optimistic patching of cached GETs ---------------------- */
async function patchListsUnder(root, fn) {
  const rows = await idbAll('gets').catch(() => [])
  for (const row of rows) {
    if (row.path.split('?')[0] !== root || !Array.isArray(row.data)) continue
    const next = fn(row.data)
    if (next !== row.data) await idbPut('gets', { ...row, data: next })
  }
}

async function patchSingle(path, fn) {
  const row = await idbGet('gets', path).catch(() => undefined)
  if (!row) return
  const next = fn(row.data)
  if (next !== undefined) await idbPut('gets', { ...row, data: next })
}

async function patchCaches(method, path, body, tempId) {
  // Shopping/packing check-offs: flip the flag on the right item of the right list
  const toggle = path.match(/^\/(shopping|packing)\/(\d+)\/toggle$/)
  if (toggle) {
    const [, kind, listId] = toggle
    const flag = kind === 'shopping' ? 'purchased' : 'packed'
    let updated = null
    const flip = (list) => ({
      ...list,
      items: (list.items || []).map((it) => (it.id === body?.item_id ? { ...it, [flag]: !it[flag] } : it)),
    })
    await patchListsUnder(`/${kind}`, (lists) =>
      lists.map((l) => (String(l.id) === listId ? (updated = flip(l)) : l)),
    )
    await patchSingle(`/${kind}/${listId}`, (l) => (l ? (updated = flip(l)) : l))
    return updated || { ok: true }
  }

  if (method === 'POST') {
    const temp = { id: tempId, _pending: true, ...body }
    // Nested collection (e.g. /clients/3/reviews) cached at exactly this path
    const nested = await idbGet('gets', path).catch(() => undefined)
    if (nested && Array.isArray(nested.data)) {
      await idbPut('gets', { ...nested, data: [...nested.data, temp] })
      return temp
    }
    await patchListsUnder(path.split('?')[0], (list) => [...list, temp])
    // The bare list may not be cached yet — make sure it exists so the page shows the item
    const bare = await idbGet('gets', path.split('?')[0]).catch(() => undefined)
    if (!bare) await cachePut(path.split('?')[0], [temp])
    return temp
  }

  const item = path.match(/^(.*)\/([\w-]+)$/)
  if (!item) return null
  const [, root, id] = item
  const sameId = (v) => String(v) === String(id)

  if (method === 'DELETE') {
    await patchListsUnder(root, (list) => list.filter((it) => !sameId(it.id)))
    await idbDel('gets', path).catch(() => {})
    return null
  }

  // PATCH / PUT — merge into every cached copy of the item
  let merged = { id, ...body }
  await patchListsUnder(root, (list) =>
    list.map((it) => (sameId(it.id) ? (merged = { ...it, ...body }) : it)),
  )
  await patchSingle(path, (it) => (it && sameId(it.id) ? (merged = { ...it, ...body }) : it))
  if (root === '/bookings') {
    await patchSingle(`${path}/workspace`, (ws) =>
      ws?.booking ? { ...ws, booking: { ...ws.booking, ...body } } : ws,
    )
  }
  return merged
}

/* ------------------------------- replay ---------------------------------- */
function rawSend({ method, path, body }) {
  const headers = {}
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }).then(
    async (res) => {
      if (res.status === 204) return null
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(typeof data.detail === 'string' ? data.detail : `sync failed (${res.status})`)
        err.status = res.status
        throw err
      }
      return data
    },
  )
}

// A created-offline record gets a temporary id; once the server assigns the real one,
// rewrite any queued follow-up edits (and the cached copies) to use it.
async function adoptRealId(tempId, real, root) {
  if (!real || real.id === undefined) return
  const remaining = await idbAll('outbox').catch(() => [])
  for (const it of remaining) {
    let changed = false
    let nextPath = it.path
    if (nextPath.includes(tempId)) {
      nextPath = nextPath.replaceAll(tempId, String(real.id))
      changed = true
    }
    let nextBody = it.body
    if (it.body !== undefined && JSON.stringify(it.body).includes(tempId)) {
      nextBody = JSON.parse(JSON.stringify(it.body).replaceAll(`"${tempId}"`, JSON.stringify(real.id)))
      changed = true
    }
    if (changed) await idbPut('outbox', { ...it, path: nextPath, body: nextBody })
  }
  if (root) await patchListsUnder(root, (list) => list.map((it) => (it.id === tempId ? real : it)))
}

let syncing = false
export async function processOutbox() {
  if (syncing || !navigator.onLine) return
  const items = await idbAll('outbox').catch(() => [])
  if (!items.length) return
  syncing = true
  emitState()
  let replayed = 0
  const failures = []
  try {
    for (const item of items.sort((a, b) => a.id - b.id)) {
      // re-read: an earlier create may have rewritten this item's temp ids
      const fresh = (await idbGet('outbox', item.id).catch(() => null)) || item
      try {
        const res = await rawSend(fresh)
        await idbDel('outbox', item.id)
        replayed += 1
        if (fresh.tempId) await adoptRealId(fresh.tempId, res, fresh.path.split('?')[0])
      } catch (e) {
        if (e instanceof TypeError) break // still offline — leave the rest queued
        await idbDel('outbox', item.id) // the server said no — drop it and tell the user
        failures.push(e.message)
        replayed += 1
      }
    }
  } finally {
    syncing = false
    emitState()
  }
  if (replayed > 0) {
    if (failures.length) {
      toast(`Synced with ${failures.length} problem${failures.length === 1 ? '' : 's'}: ${failures[0]}`, 'red')
    } else {
      toast(`Back online — ${replayed} change${replayed === 1 ? '' : 's'} synced to the cloud ✓`, 'sage')
    }
    window.dispatchEvent(new CustomEvent('cc-synced', { detail: { replayed, failures } }))
  }
}

/* ------------------------- status events + hook -------------------------- */
async function emitState() {
  const pending = await pendingCount()
  window.dispatchEvent(
    new CustomEvent('cc-offline', { detail: { online: navigator.onLine, pending, syncing } }),
  )
}

export function useOfflineState() {
  const [state, setState] = useState({ online: navigator.onLine, pending: 0, syncing: false })
  useEffect(() => {
    const onChange = (e) => setState(e.detail)
    window.addEventListener('cc-offline', onChange)
    emitState()
    return () => window.removeEventListener('cc-offline', onChange)
  }, [])
  return state
}

/* -------------------------- install ("add to home") ----------------------- */
let installPrompt = null
export const getInstallPrompt = () => installPrompt
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export function initOffline() {
  window.addEventListener('online', () => {
    emitState()
    processOutbox()
  })
  window.addEventListener('offline', emitState)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt = e
    window.dispatchEvent(new Event('cc-installable'))
  })
  if (navigator.onLine) processOutbox()
  emitState()
}
