import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, daysUntil, fmtDate, fmtMoney, relDays, todayISO } from '../format'
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, PageHeader, SearchInput, Select, Spinner, Textarea, toastErr } from '../ui'

const STORAGE = ['pantry', 'fridge', 'freezer', 'dry', 'other']
const CATEGORIES = ['Produce', 'Protein', 'Fish', 'Dairy', 'Dry goods', 'Spices', 'Condiments', 'Bakery', 'Drinks', 'Equipment consumables', 'Other']

function ItemModal({ open, onClose, onSaved, initial = null }) {
  const blank = {
    name: '', category: 'Produce', quantity: '', unit: '', low_stock_threshold: '',
    storage: 'pantry', purchase_date: todayISO(), expiry_date: '', cost_per_unit: '', supplier: '', notes: '',
  }
  const [form, setForm] = useState(blank)
  useEffect(() => { if (open) setForm(initial ? { ...blank, ...initial } : blank) }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      quantity: Number(form.quantity) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      cost_per_unit: Number(form.cost_per_unit) || 0,
    }
    const req = initial?.id ? api.patch(`/inventory/${initial.id}`, payload) : api.post('/inventory', payload)
    req.then(onSaved).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit stock item' : 'Add stock item'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Item"><Input value={form.name} onChange={set('name')} placeholder="White miso paste" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Storage">
            <Select value={form.storage} onChange={set('storage')}>{STORAGE.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity"><Input type="number" step="any" min="0" value={form.quantity} onChange={set('quantity')} /></Field>
          <Field label="Unit"><Input value={form.unit} onChange={set('unit')} placeholder="kg / L / pcs" /></Field>
          <Field label="Low-stock at"><Input type="number" step="any" min="0" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchased"><Input type="date" value={form.purchase_date} onChange={set('purchase_date')} /></Field>
          <Field label="Use by"><Input type="date" value={form.expiry_date} onChange={set('expiry_date')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost per unit"><Input type="number" step="0.01" min="0" value={form.cost_per_unit} onChange={set('cost_per_unit')} /></Field>
          <Field label="Supplier"><Input value={form.supplier} onChange={set('supplier')} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>{initial?.id ? 'Save' : 'Add item'}</Button></div>
      </form>
    </Modal>
  )
}

function expiryBadge(item) {
  if (!item.expiry_date) return null
  const days = daysUntil(item.expiry_date)
  if (days < 0) return <Badge tone="red">expired</Badge>
  if (days <= 3) return <Badge tone="red">{relDays(item.expiry_date)}</Badge>
  if (days <= 7) return <Badge tone="amber">{relDays(item.expiry_date)}</Badge>
  return null
}

export default function Inventory() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [view, setView] = useState('all') // all | expiring | low
  const [storage, setStorage] = useState('all')
  const [modal, setModal] = useState({ open: false, initial: null })

  const load = () => api.get('/inventory').then(setItems).catch(toastErr)
  useEffect(load, [])
  if (!items) return <Spinner />

  const adjust = (item, delta) =>
    api.patch(`/inventory/${item.id}`, { quantity: Math.max(0, Math.round(((item.quantity || 0) + delta) * 100) / 100) }).then(load).catch(toastErr)
  const remove = (item) => { if (window.confirm(`Remove "${item.name}" from stock?`)) api.del(`/inventory/${item.id}`).then(load).catch(toastErr) }

  const today = todayISO()
  const soon = (d) => { const n = daysUntil(d); return n !== null && n <= 7 }
  let visible = items
  if (q) visible = visible.filter((i) => `${i.name} ${i.category} ${i.supplier}`.toLowerCase().includes(q.toLowerCase()))
  if (storage !== 'all') visible = visible.filter((i) => i.storage === storage)
  if (view === 'expiring') visible = visible.filter((i) => i.expiry_date && (i.expiry_date < today || soon(i.expiry_date)))
  if (view === 'low') visible = visible.filter((i) => i.low_stock_threshold && (i.quantity || 0) <= i.low_stock_threshold)

  const stockValue = items.reduce((a, i) => a + (i.quantity || 0) * (i.cost_per_unit || 0), 0)

  return (
    <div>
      <PageHeader title="Inventory" sub={`${items.length} items · approx ${fmtMoney(stockValue, user?.currency)} on the shelf`}
        actions={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>Add item</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} className="w-full sm:w-64" />
        {[['all', 'All'], ['expiring', 'Expiring'], ['low', 'Low stock']].map(([v, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            className={cls('rounded-full px-3.5 py-1.5 text-xs font-medium', view === v ? 'bg-ink text-cream' : 'border border-line bg-white text-ink/55')}>{lbl}</button>
        ))}
        <Select value={storage} onChange={(e) => setStorage(e.target.value)} className="!w-32 !py-1.5 text-xs">
          <option value="all">All storage</option>
          {STORAGE.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="box" title="Nothing here" hint="Track what's in the pantry, fridge and freezer — with shelf life and low-stock alerts."
          action={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>Add item</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-ink/45">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Stock</th>
                <th className="px-4 py-2.5">Storage</th>
                <th className="px-4 py-2.5">Use by</th>
                <th className="px-4 py-2.5">Supplier</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {visible.map((item) => {
                const low = item.low_stock_threshold && (item.quantity || 0) <= item.low_stock_threshold
                return (
                  <tr key={item.id} className="hover:bg-parchment/30">
                    <td className="cursor-pointer px-4 py-3" onClick={() => setModal({ open: true, initial: item })}>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-ink/45">{item.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => adjust(item, -1)} className="h-6 w-6 rounded border border-line text-ink/50 hover:border-copper hover:text-copper">−</button>
                        <span className={cls('min-w-[64px] text-center font-medium', low && 'text-red-600')}>{item.quantity} {item.unit}</span>
                        <button onClick={() => adjust(item, 1)} className="h-6 w-6 rounded border border-line text-ink/50 hover:border-copper hover:text-copper">+</button>
                        {low ? <Badge tone="red">low</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-ink/60">{item.storage}</td>
                    <td className="px-4 py-3">
                      <span className="text-ink/60">{item.expiry_date ? fmtDate(item.expiry_date) : '—'}</span>
                      <span className="ml-1.5">{expiryBadge(item)}</span>
                    </td>
                    <td className="px-4 py-3 text-ink/60">{item.supplier || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <IconButton icon="edit" label="Edit" onClick={() => setModal({ open: true, initial: item })} />
                      <IconButton icon="trash" label="Delete" onClick={() => remove(item)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ItemModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })}
        onSaved={() => { setModal({ open: false, initial: null }); load() }} />
    </div>
  )
}
