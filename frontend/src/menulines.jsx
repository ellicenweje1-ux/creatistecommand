import { api } from './api'
import { SYMBOLS, uid } from './format'
import { Select } from './ui'

const itemLabel = (m) => [m.course, m.name].filter(Boolean).join(' | ') || m.name || 'Item'

/* Gather priced dishes the chef can pull straight onto a quote/invoice line: the booking's
   own menu (when there is one) + every saved menu. Returns [{group, label, price}]. */
export async function fetchMenuItems(bookingId) {
  const out = []
  if (bookingId) {
    try {
      const bk = await api.get(`/bookings/${bookingId}`)
      ;(bk.menu || []).forEach((m) => {
        if (Number(m.price) > 0) out.push({ group: 'This booking’s menu', label: itemLabel(m), price: Number(m.price) })
      })
    } catch { /* booking may be gone — ignore */ }
  }
  try {
    const menus = await api.get('/menus')
    ;(menus || []).forEach((menu) => {
      (menu.courses || []).forEach((c) => {
        if (Number(c.price) > 0) out.push({ group: menu.title || 'Saved menu', label: itemLabel(c), price: Number(c.price) })
      })
    })
  } catch { /* no menus — ignore */ }
  return out
}

/* "Add a menu item…" dropdown — one tap auto-fills a line with the dish + its price. */
export function MenuItemsMenu({ items = [], currency = 'GBP', onAdd, className = '' }) {
  if (!items.length) return null
  const sym = SYMBOLS[currency] || '£'
  const groups = [...new Set(items.map((i) => i.group))]
  const pick = (e) => {
    const v = e.target.value
    e.target.value = ''
    if (v === '') return
    const it = items[Number(v)]
    if (it) onAdd({ id: uid(), description: it.label, qty: 1, unit_price: it.price })
  }
  return (
    <Select value="" onChange={pick} className={className} aria-label="Add a menu item">
      <option value="">+ Add a menu item…</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {items.map((it, i) => (it.group === g
            ? <option key={i} value={i}>{it.label} — {sym}{it.price}</option>
            : null))}
        </optgroup>
      ))}
    </Select>
  )
}
