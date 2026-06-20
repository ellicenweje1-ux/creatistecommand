import { uid } from './format'
import { Select } from './ui'

/* Built-in charge presets (added at £0 for the chef to fill). The chef's own saved charges
   (Settings → Business) come with their rate, so they're one tap. */
export const CHARGE_PRESETS = [
  { label: 'Delivery (per mile)', per: 'mile', rate: 0 },
  { label: 'Service charge', per: '', rate: 0 },
  { label: 'Travel', per: '', rate: 0 },
  { label: 'Staffing (per hour)', per: 'hour', rate: 0 },
  { label: 'Deposit', per: '', rate: 0 },
]

/* Turn a charge definition into a quote/invoice line item. Per-unit charges (per mile/hour)
   start at qty 1 — set the miles/hours on the line. */
export const chargeToLine = (c) => ({
  id: uid(),
  description: c.per ? `${c.label}`.replace(/\s*\(per .*\)$/, '') + ` (per ${c.per})` : c.label,
  qty: 1,
  unit_price: Number(c.rate) || 0,
})

/* "Add a charge…" dropdown. Lists the chef's saved charges first (with rates), then the
   presets. Calls onAdd with a ready-made line item. */
export function ChargesMenu({ saved = [], onAdd, className = '' }) {
  const pick = (e) => {
    const v = e.target.value
    e.target.value = ''
    if (!v) return
    const [src, idx] = v.split(':')
    const list = src === 'saved' ? saved : CHARGE_PRESETS
    const c = list[Number(idx)]
    if (c) onAdd(chargeToLine(c))
  }
  return (
    <Select value="" onChange={pick} className={className} aria-label="Add a charge">
      <option value="">+ Add a charge…</option>
      {saved.length > 0 && (
        <optgroup label="Your charges">
          {saved.map((c, i) => (
            <option key={c.id || i} value={`saved:${i}`}>
              {c.label}{c.rate ? ` — £${c.rate}${c.per ? `/${c.per}` : ''}` : ''}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Common charges">
        {CHARGE_PRESETS.map((c, i) => <option key={c.label} value={`preset:${i}`}>{c.label}</option>)}
      </optgroup>
    </Select>
  )
}
