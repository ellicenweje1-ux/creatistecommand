export const SYMBOLS = { GBP: '£', USD: '$', EUR: '€', NGN: '₦', AUD: 'A$', CAD: 'C$' }

export const cls = (...parts) => parts.filter(Boolean).join(' ')

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`)

export const todayISO = () => new Date().toISOString().slice(0, 10)

// ISO date N days from a given ISO date (default today). Used for "Tomorrow" grouping etc.
export function addDaysISO(iso, n) {
  const d = new Date(`${(iso || todayISO())}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function fmtMoney(n, currency = 'GBP') {
  const symbol = SYMBOLS[currency] || `${currency} `
  const val = Number(n || 0)
  return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function fmtDateLong(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function daysUntil(iso) {
  if (!iso) return null
  const today = new Date(todayISO())
  const target = new Date(`${iso}T00:00:00`)
  return Math.round((target - today) / 86400000)
}

export function relDays(iso) {
  const n = daysUntil(iso)
  if (n === null) return ''
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

export const BOOKING_STATUSES = ['enquiry', 'quoted', 'confirmed', 'in_prep', 'completed', 'cancelled']
export const BOOKING_TONES = {
  enquiry: 'gray', quoted: 'amber', confirmed: 'sage', in_prep: 'copper', completed: 'ink', cancelled: 'red',
}
export const TASK_TONES = { todo: 'gray', doing: 'copper', done: 'sage' }
export const PRIORITY_TONES = { low: 'gray', medium: 'amber', high: 'red' }
export const ORDER_STATUSES = ['to_order', 'ordered', 'shipped', 'delivered', 'delayed', 'cancelled']
export const ORDER_TONES = {
  to_order: 'gray', ordered: 'amber', shipped: 'copper', delivered: 'sage', delayed: 'red', cancelled: 'ink',
}
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'void']
export const INVOICE_TONES = { draft: 'gray', sent: 'amber', paid: 'sage', overdue: 'red', void: 'ink' }

export const label = (s) => (s || '').replaceAll('_', ' ')

// Mise (AI sous-chef) tools show only when the chef is Elite AND the platform owner has
// switched the AI key on — otherwise the buttons are hidden (no dead/confusing clicks).
export const miseReady = (user) => !!user?.ai_enabled && (user?.plan_level ?? 1) >= 3

export function invoiceTotal(inv) {
  const sub = (inv.items || []).reduce((acc, i) => acc + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0)
  return Math.max((sub - (Number(inv.discount) || 0)) * (1 + (Number(inv.tax_rate) || 0) / 100), 0)
}

// Simple sum of the per-line prices on a menu (no guest/serves maths — "serves" is just a
// descriptive label like "10-12"). Used for the booking menu total and the quote it builds.
export const menuPriceTotal = (menu) => (menu || []).reduce((sum, l) => sum + (Number(l?.price) || 0), 0)

// Render an invoice/quote number format (mirrors backend utils.render_doc_number) for the
// live preview in Settings. Tokens: {n}/{nn}/{nnn}… = sequence, {DD} {MM} {YY} {YYYY} = date.
export function renderDocNumber(fmt, seq = 1, d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  const out = String(fmt || '').replace(/\{([A-Za-z]+)\}/g, (m, tok) => {
    if (tok === 'DD') return dd
    if (tok === 'MM') return mm
    if (tok === 'YY') return yyyy.slice(-2)
    if (tok === 'YYYY') return yyyy
    if (/^n+$/.test(tok)) return String(seq).padStart(tok.length, '0')
    return m
  }).trim()
  return out || String(seq).padStart(3, '0')
}
