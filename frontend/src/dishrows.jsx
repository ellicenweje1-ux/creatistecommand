import { useRef } from 'react'
import { SYMBOLS, uid } from './format'
import { Button, IconButton, Input, Select } from './ui'

/* One menu line. Stored in the booking `menu` / saved-menu `courses` JSON arrays — so adding
   serves/price needs no backend change. */
export const newDish = () => ({ id: uid(), course: '', name: '', recipe_id: null, serves: '', price: '', notes: '' })

/* Map a saved-menu course into a fresh dish row (new id), carrying serves/price/sizes across and
   falling back to the menu's per-head price when a line has none. */
export const dishFromCourse = (c, fallbackPrice = '') => ({
  id: uid(),
  course: c.course || '',
  name: c.name || '',
  recipe_id: c.recipe_id ?? null,
  serves: c.serves ?? '',
  price: c.price ?? (fallbackPrice || ''),
  sizes: Array.isArray(c.sizes) ? c.sizes.map((s) => ({ id: s.id || uid(), label: s.label || '', price: s.price ?? '' })) : [],
  notes: c.notes || '',
})

/* Shared dish/course editor: course-or-component, dish name, a "serves N @ £X" column, a recipe
   link and notes. Hitting Enter in any field adds the next line (and focuses it). */
export function DishRowsEditor({ rows, recipes = [], currency = 'GBP', onChange }) {
  const ref = useRef(null)
  const sym = SYMBOLS[currency] || '£'
  const update = (i, k, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))
  // Optional per-dish serving sizes (e.g. a meal-prep dish offered at 32oz / 58oz), each with
  // its own price. When a dish has sizes, each one becomes its own line in the invoice picker.
  const addSize = (i) => update(i, 'sizes', [...(rows[i].sizes || []), { id: uid(), label: '', price: '' }])
  const updateSize = (i, si, k, v) => update(i, 'sizes', (rows[i].sizes || []).map((s, idx) => (idx === si ? { ...s, [k]: v } : s)))
  const removeSize = (i, si) => update(i, 'sizes', (rows[i].sizes || []).filter((_, idx) => idx !== si))
  const add = () => {
    onChange([...rows, newDish()])
    // Focus the new line's first field so you can keep typing straight after Enter.
    requestAnimationFrame(() => {
      const inputs = ref.current?.querySelectorAll('input[data-dish-course]')
      inputs?.[inputs.length - 1]?.focus()
    })
  }
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }

  return (
    <div ref={ref} className="space-y-2">
      {rows.length === 0 && (
        <p className="text-sm text-fg/45">No dishes yet — add a line below (or press Enter in a field to add the next).</p>
      )}
      {rows.length > 0 && (
        <div className="hidden gap-2 px-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg/45 sm:grid sm:grid-cols-12">
          <span className="col-span-3">Course/component</span>
          <span className="col-span-4">Dish</span>
          <span className="col-span-2">Serves</span>
          <span className="col-span-3">Price ({sym})</span>
        </div>
      )}
      {rows.map((r, i) => (
        <div key={r.id || i} className="space-y-2 rounded-lg border border-line bg-parchment/30 p-2">
          <div className="grid grid-cols-12 items-center gap-2">
            <Input data-dish-course className="col-span-12 sm:col-span-3" placeholder="Course/component"
              value={r.course || ''} onChange={(e) => update(i, 'course', e.target.value)} onKeyDown={onKey} />
            <Input className="col-span-12 sm:col-span-4" placeholder="Dish name"
              value={r.name || ''} onChange={(e) => update(i, 'name', e.target.value)} onKeyDown={onKey} />
            <Input className="col-span-6 sm:col-span-2" placeholder="e.g. 10-12" aria-label="Serves"
              value={r.serves ?? ''} onChange={(e) => update(i, 'serves', e.target.value)} onKeyDown={onKey} />
            <div className="col-span-4 flex items-center gap-1 sm:col-span-2">
              <span className="shrink-0 text-sm text-fg/50">{sym}</span>
              <Input type="number" min="0" step="0.01" className="min-w-0 flex-1 px-2" placeholder="0" aria-label="Price"
                value={r.price ?? ''} onChange={(e) => update(i, 'price', e.target.value)} onKeyDown={onKey} />
            </div>
            <IconButton icon="trash" label="Remove dish" className="col-span-2 justify-self-end sm:col-span-1" onClick={() => remove(i)} />
          </div>
          <div className="grid grid-cols-12 items-center gap-2">
            <Select className="col-span-12 sm:col-span-6" value={r.recipe_id || ''}
              onChange={(e) => update(i, 'recipe_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Link a recipe sheet…</option>
              {recipes.map((rc) => <option key={rc.id} value={rc.id}>{rc.title}</option>)}
            </Select>
            <Input className="col-span-12 sm:col-span-6" placeholder="Notes (optional)"
              value={r.notes || ''} onChange={(e) => update(i, 'notes', e.target.value)} onKeyDown={onKey} />
          </div>
          {(r.sizes && r.sizes.length > 0) ? (
            <div className="space-y-1.5 rounded-lg border border-line/70 bg-parchment/20 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/45">Serving sizes — each offered at its own price</p>
              {r.sizes.map((s, si) => (
                <div key={s.id || si} className="grid grid-cols-12 items-center gap-2">
                  <Input className="col-span-6 sm:col-span-5" placeholder="e.g. 32oz" value={s.label || ''} onChange={(e) => updateSize(i, si, 'label', e.target.value)} onKeyDown={onKey} />
                  <div className="col-span-4 flex items-center gap-1 sm:col-span-5">
                    <span className="shrink-0 text-sm text-fg/50">{sym}</span>
                    <Input type="number" min="0" step="0.01" className="min-w-0 flex-1 px-2" placeholder="0" aria-label="Size price"
                      value={s.price ?? ''} onChange={(e) => updateSize(i, si, 'price', e.target.value)} />
                  </div>
                  <IconButton icon="trash" label="Remove size" className="col-span-2 justify-self-end" onClick={() => removeSize(i, si)} />
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" icon="plus" onClick={() => addSize(i)}>Add size</Button>
            </div>
          ) : (
            <button type="button" onClick={() => addSize(i)} className="text-xs font-medium text-copper hover:underline">+ Offer multiple sizes (e.g. 32oz / 58oz)</button>
          )}
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" icon="plus" onClick={add}>Add dish</Button>
    </div>
  )
}
