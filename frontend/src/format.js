export const SYMBOLS = { GBP: '£', USD: '$', EUR: '€', NGN: '₦', AUD: 'A$', CAD: 'C$' }

export const cls = (...parts) => parts.filter(Boolean).join(' ')

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`)

export const todayISO = () => new Date().toISOString().slice(0, 10)

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

// Menu line maths. Each line "serves N @ £X": with N portions per unit you need
// ceil(guests / N) units (trays/platters) to feed everyone; a blank/0 "serves" means
// the £ is a per-head rate (one unit per guest). Used for the booking menu total and to
// itemise the menu into a client quote.
export const dishUnits = (line, guests) => {
  const serves = Number(line?.serves) || 0
  const g = Number(guests) || 1
  return serves > 0 ? Math.ceil(g / serves) : g
}
export const dishLineTotal = (line, guests) => dishUnits(line, guests) * (Number(line?.price) || 0)
export const menuTotal = (menu, guests) => (menu || []).reduce((sum, l) => sum + dishLineTotal(l, guests), 0)
