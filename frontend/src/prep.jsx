// Shared prep-flow helpers: link a list/route to a booking, and turn shopping lists into
// route stops. Used by the Shopping/Packing/Routes "new" modals and the booking hub.
import { fmtDate, uid } from './format'
import { Field, Select } from './ui'

/* A "Link to a booking" dropdown for the new-list / new-route / new-packing modals, so a
   prep artifact and its event merge in one step. The caller decides what to do on select
   (set booking_id, auto-fill the title/date). */
export function BookingPicker({ bookings = [], value = '', onChange, label = 'Link to a booking', hint }) {
  const opts = [...bookings].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) // upcoming first
  return (
    <Field label={label} hint={hint}>
      <Select value={value} onChange={(e) => onChange(e.target.value, bookings.find((b) => String(b.id) === String(e.target.value)) || null)}>
        <option value="">No booking — standalone</option>
        {opts.map((b) => <option key={b.id} value={b.id}>{b.title}{b.date ? ` · ${fmtDate(b.date)}` : ''}</option>)}
      </Select>
    </Field>
  )
}

// Distinct shops on a shopping list, in order (skips "Anywhere"/blank).
export function listShops(list) {
  const seen = new Set()
  const out = []
  ;(list.items || []).forEach((it) => {
    const shop = (it.shop || '').trim()
    if (!shop || shop.toLowerCase() === 'anywhere') return
    const key = shop.toLowerCase()
    if (!seen.has(key)) { seen.add(key); out.push(shop) }
  })
  return out
}

// Build route stops from one or more shopping lists: one stop per distinct shop, address
// pulled from the matching supplier (by name), skipping shops already present.
export function stopsFromLists(lists, suppliers, existing = []) {
  const have = new Set((existing || []).map((s) => (s.name || '').toLowerCase()))
  const added = []
  ;[].concat(lists).forEach((list) => {
    listShops(list).forEach((shop) => {
      const key = shop.toLowerCase()
      if (have.has(key)) return
      have.add(key)
      const sup = (suppliers || []).find((su) => (su.name || '').toLowerCase() === key)
      added.push({ id: uid(), name: shop, address: sup?.address || '', purpose: `Shop · ${list.title}`, eta: '', duration_min: 0, note: '', done: false })
    })
  })
  return added
}
