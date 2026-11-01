/* A visitor's account on this site, backed by The Creatiste Command (sign in by emailed code).
   The token and the profile live in localStorage so forms can be pre-filled and orders re-ordered. */
import { useEffect, useState } from 'react'
import { SETTINGS } from './content/site.js'

const KEY = 'tcc_customer'
const EVENT = 'tcc-customer'
export const ACCOUNT_API = SETTINGS.apiBase && SETTINGS.enquiryToken ? `${SETTINGS.apiBase}/api/public/customer/${SETTINGS.enquiryToken}` : ''

/* Design preview only: VITE_MOCK_ACCOUNT=1 swaps the booking system for canned data so the account can be shown with no backend.
   When the variable is unset (the live build) this whole branch, and the mock file, are removed from the bundle. */
const MOCK = import.meta.env.VITE_MOCK_ACCOUNT === '1'
if (MOCK) { try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify({ token: 'mock', name: 'Rita Regular', email: 'rita@example.com', phone: '' })) } catch {} }

export function getCustomer() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}
export function setCustomer(c) {
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY) } catch {}
  window.dispatchEvent(new Event(EVENT))
}
export function clearCustomer() { setCustomer(null) }

/* React to sign-in / sign-out anywhere on the page. */
export function useCustomer() {
  const [c, setC] = useState(getCustomer)
  useEffect(() => {
    const on = () => setC(getCustomer())
    window.addEventListener(EVENT, on); window.addEventListener('storage', on)
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on) }
  }, [])
  return c
}

export async function accountFetch(path, opts = {}) {
  if (MOCK) { const m = await import('./accountMock.js'); return m.mockFetch(path, opts) }
  const c = getCustomer()
  const r = await fetch(`${ACCOUNT_API}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(c?.token ? { Authorization: `Bearer ${c.token}` } : {}), ...(opts.headers || {}) } })
  if (r.status === 401 && c?.token) clearCustomer()
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.detail || 'Something went wrong.')
  return j
}

/* Prefill a form's contact fields from the signed-in visitor (only the blanks). */
export function prefill(setter, map = { name: 'name', email: 'email', phone: 'phone' }) {
  const c = getCustomer()
  if (!c) return
  setter((p) => { const n = { ...p }; for (const [k, v] of Object.entries(map)) if (!n[k] && c[v]) n[k] = c[v]; return n })
}

/* Re-order: the account page parks a previous order's boxes here; the Clean Dream page picks them up. */
export const REORDER_KEY = 'tcc_reorder'
