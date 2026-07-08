import { api } from './api'
import { SYMBOLS, uid } from './format'
import { Select } from './ui'

const itemLabel = (m) => [m.course, m.name].filter(Boolean).join(' | ') || m.name || 'Item'

/* One dish → one or more picker entries. A dish with serving sizes (e.g. 32oz / 58oz) yields
   one entry per priced size ("Course | Name (32oz)"); otherwise a single entry at its price.
   Each entry carries course/name so a saved invoice can sync back into the booking's menu —
   sized entries carry the BASE dish name (no size suffix) so the sync matches the one menu
   dish they came from instead of adding "(32oz)"/"(58oz)" duplicates to the booking menu. */
function dishEntries(group, m) {
  const base = itemLabel(m)
  if (Array.isArray(m.sizes) && m.sizes.length > 0) {
    return m.sizes
      .filter((s) => Number(s.price) > 0)
      .map((s) => ({
        group, price: Number(s.price),
        label: s.label ? `${base} (${s.label})` : base,
        course: m.course || '', name: m.name || '',
      }))
  }
  if (Number(m.price) > 0) return [{ group, label: base, price: Number(m.price), course: m.course || '', name: m.name || '' }]
  return []
}

/* Gather priced dishes the chef can pull straight onto a quote/invoice line: the booking's
   own menu (when there is one) + every saved menu. Returns [{group, label, price, course, name}]. */
export async function fetchMenuItems(bookingId) {
  const out = []
  if (bookingId) {
    try {
      const bk = await api.get(`/bookings/${bookingId}`)
      ;(bk.menu || []).forEach((m) => out.push(...dishEntries('This booking’s menu', m)))
    } catch { /* booking may be gone — ignore */ }
  }
  try {
    const menus = await api.get('/menus')
    ;(menus || []).forEach((menu) => {
      (menu.courses || []).forEach((c) => out.push(...dishEntries(menu.title || 'Saved menu', c)))
    })
  } catch { /* no menus — ignore */ }
  return out
}

/* Map a whole booking/saved menu into invoice/quote line items: one line per dish (or per
   priced size), qty 1 at its price. Unpriced dishes still list at £0 so they can be priced in
   the editor. Carries course/name so a saved invoice can sync back into the booking's menu. */
export function menuToLines(menu) {
  const out = []
  ;(menu || []).forEach((m) => {
    const entries = dishEntries('', m)
    if (entries.length) {
      entries.forEach((e) => out.push({ id: uid(), description: e.label, qty: 1, unit_price: e.price, course: e.course, name: e.name }))
    } else if ((m.name || '').trim() || (m.course || '').trim()) {
      out.push({ id: uid(), description: itemLabel(m), qty: 1, unit_price: Number(m.price) || 0, course: m.course || '', name: m.name || '' })
    }
  })
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
    if (it) onAdd({ id: uid(), description: it.label, qty: 1, unit_price: it.price, course: it.course || '', name: it.name || '' })
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
