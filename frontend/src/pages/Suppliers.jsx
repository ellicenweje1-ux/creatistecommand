import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtDate, fmtMoney, todayISO } from '../format'
import { Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, SearchInput, Spinner, Textarea, toastErr } from '../ui'

function SupplierModal({ open, onClose, onSaved, initial = null }) {
  const blank = { name: '', category: '', contact_name: '', phone: '', email: '', website: '', address: '', account_ref: '', notes: '' }
  const [form, setForm] = useState(blank)
  useEffect(() => { if (open) setForm(initial ? { ...blank, ...initial } : blank) }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    const req = initial?.id ? api.patch(`/suppliers/${initial.id}`, form) : api.post('/suppliers', form)
    req.then(onSaved).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit supplier' : 'New supplier'}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input value={form.name} onChange={set('name')} required /></Field>
          <Field label="Category"><Input value={form.category} onChange={set('category')} placeholder="Wholesaler / Fish / Produce" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact"><Input value={form.contact_name} onChange={set('contact_name')} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input value={form.email} onChange={set('email')} /></Field>
          <Field label="Account ref"><Input value={form.account_ref} onChange={set('account_ref')} /></Field>
        </div>
        <Field label="Website"><Input value={form.website} onChange={set('website')} /></Field>
        <Field label="Address"><Input value={form.address} onChange={set('address')} /></Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Order cut-offs, delivery days, minimums…" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>{initial?.id ? 'Save' : 'Add supplier'}</Button></div>
      </form>
    </Modal>
  )
}

function PriceBook({ supplier, prices, onChanged, currency }) {
  const [draft, setDraft] = useState({ item_name: '', unit: '', price: '' })
  const [editId, setEditId] = useState(null)         // price row being amended (owner ask)
  const [editForm, setEditForm] = useState({ item_name: '', unit: '', price: '' })
  // Always show the price book A→Z by item name (owner ask) — case-insensitive.
  const mine = prices
    .filter((p) => p.supplier_id === supplier.id)
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', undefined, { sensitivity: 'base' }))
  const add = (e) => {
    e.preventDefault()
    if (!draft.item_name.trim()) return
    api.post('/supplier-prices', { ...draft, price: Number(draft.price) || 0, supplier_id: supplier.id, last_checked: todayISO() })
      .then(() => { setDraft({ item_name: '', unit: '', price: '' }); onChanged() }).catch(toastErr)
  }
  const startEdit = (p) => { setEditId(p.id); setEditForm({ item_name: p.item_name || '', unit: p.unit || '', price: p.price ?? '' }) }
  const saveEdit = (e) => {
    e.preventDefault()
    if (!editForm.item_name.trim()) return
    // Saving counts as re-confirming the price, so stamp "last checked" to today.
    api.patch(`/supplier-prices/${editId}`, { item_name: editForm.item_name.trim(), unit: editForm.unit, price: Number(editForm.price) || 0, last_checked: todayISO() })
      .then(() => { setEditId(null); onChanged() }).catch(toastErr)
  }
  return (
    <div>
      <p className="label">Price book ({mine.length}) · A–Z</p>
      {mine.length > 0 && (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line/60">
            {mine.map((p) => (editId === p.id ? (
              <tr key={p.id}>
                <td colSpan={5} className="py-1.5">
                  <form onSubmit={saveEdit} className="grid grid-cols-12 items-center gap-1.5">
                    <Input className="col-span-5" placeholder="Item" value={editForm.item_name} onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })} autoFocus />
                    <Input className="col-span-2" placeholder="Unit" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} />
                    <Input className="col-span-2" type="number" step="0.01" placeholder="Price" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                    <Button className="col-span-2" size="sm" icon="check">Save</Button>
                    <IconButton icon="x" label="Cancel" className="col-span-1" onClick={() => setEditId(null)} />
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className="group">
                <td className="py-1.5">{p.item_name}</td>
                <td className="py-1.5 text-fg/50">{p.unit}</td>
                <td className="py-1.5 text-right font-medium">{fmtMoney(p.price, currency)}</td>
                <td className="py-1.5 text-right text-xs text-fg/40">{p.last_checked ? fmtDate(p.last_checked) : ''}</td>
                <td className="w-16 py-1.5 text-right">
                  <span className="inline-flex opacity-0 transition-opacity group-hover:opacity-100">
                    <IconButton icon="edit" label="Edit price" onClick={() => startEdit(p)} />
                    <IconButton icon="trash" label="Remove price"
                      onClick={() => api.del(`/supplier-prices/${p.id}`).then(onChanged).catch(toastErr)} />
                  </span>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      )}
      <form onSubmit={add} className="mt-2 grid grid-cols-12 gap-1.5">
        <Input className="col-span-5" placeholder="Item" value={draft.item_name} onChange={(e) => setDraft({ ...draft, item_name: e.target.value })} />
        <Input className="col-span-2" placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        <Input className="col-span-3" type="number" step="0.01" placeholder="Price" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        <Button className="col-span-2" size="sm" icon="plus">Add</Button>
      </form>
    </div>
  )
}

export default function Suppliers() {
  const { user } = useAuth()
  const cur = user?.currency || 'GBP'
  const [suppliers, setSuppliers] = useState(null)
  const [prices, setPrices] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState({ open: false, initial: null })
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)

  const load = () => {
    api.get('/suppliers').then(setSuppliers).catch(toastErr)
    api.get('/supplier-prices').then(setPrices).catch(() => {})
  }
  useEffect(load, [])
  useEffect(() => {
    if (!q.trim()) { setResults(null); return }
    const t = setTimeout(() => api.get(`/suppliers/prices/search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [q])
  if (!suppliers) return <Spinner />

  const selected = suppliers.find((s) => s.id === selectedId) || suppliers[0]
  const removeSupplier = (s) => {
    if (window.confirm(`Delete ${s.name} and its price book?`))
      Promise.all(prices.filter((p) => p.supplier_id === s.id).map((p) => api.del(`/supplier-prices/${p.id}`)))
        .then(() => api.del(`/suppliers/${s.id}`)).then(() => { setSelectedId(null); load() }).catch(toastErr)
  }

  return (
    <div>
      <PageHeader title="Supplier price book" sub="Every supplier, every price — and who sells it cheapest."
        actions={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New supplier</Button>} />
      <SearchInput value={q} onChange={setQ} placeholder="Who sells… (e.g. cream, cod loin)" className="mb-4 w-full sm:w-96" />
      {results && (
        <Card title={`Cheapest first — “${q}”`} pad={false} className="mb-5">
          {results.length === 0 ? <p className="p-4 text-sm text-fg/45">No prices found for that item yet.</p> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line/60">
                {results.map((r, i) => (
                  <tr key={r.id} className={i === 0 ? 'bg-sage/10' : ''}>
                    <td className="px-4 py-2">{r.item_name} <span className="text-fg/40">{r.unit}</span></td>
                    <td className="px-4 py-2">{r.supplier_name}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmtMoney(r.price, cur)}{i === 0 && <span className="ml-2 text-xs font-medium text-sage">best</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {suppliers.length === 0 ? (
        <EmptyState icon="tag" title="No suppliers yet" hint="Add your wholesalers, fishmongers and markets — then log prices so quoting gets faster and sharper."
          action={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New supplier</Button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-1.5">
            {suppliers.map((s) => (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className={cls('flex w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-left shadow-card transition-all',
                  selected?.id === s.id ? 'border-copper ring-1 ring-copper/30' : 'border-line hover:border-copper/40')}>
                <Icon name="tag" size={16} className="shrink-0 text-copper" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-fg/45">{s.category || '—'} · {prices.filter((p) => p.supplier_id === s.id).length} prices</span>
                </span>
              </button>
            ))}
          </div>
          <div className="lg:col-span-2">
            {selected && (
              <Card>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h2 className="font-display text-xl font-semibold">{selected.name}</h2>
                    <p className="text-sm text-fg/55">{[selected.category, selected.account_ref && `acct ${selected.account_ref}`].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton icon="edit" label="Edit" onClick={() => setModal({ open: true, initial: selected })} />
                    <IconButton icon="trash" label="Delete" onClick={() => removeSupplier(selected)} />
                  </div>
                </div>
                <div className="mb-4 space-y-1 text-sm text-fg/65">
                  {selected.contact_name && <p><Icon name="users" size={13} className="mr-1.5 inline text-fg/35" />{selected.contact_name}</p>}
                  {selected.phone && <p><Icon name="phone" size={13} className="mr-1.5 inline text-fg/35" />{selected.phone}</p>}
                  {selected.email && <p><Icon name="mail" size={13} className="mr-1.5 inline text-fg/35" />{selected.email}</p>}
                  {selected.website && <p><Icon name="external" size={13} className="mr-1.5 inline text-fg/35" /><a className="text-copper" href={selected.website} target="_blank" rel="noreferrer">{selected.website}</a></p>}
                  {selected.notes && <p className="rounded-lg bg-parchment/50 px-3 py-2">{selected.notes}</p>}
                </div>
                <PriceBook supplier={selected} prices={prices} currency={cur} onChanged={load} />
              </Card>
            )}
          </div>
        </div>
      )}
      <SupplierModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })}
        onSaved={(s) => { setModal({ open: false, initial: null }); setSelectedId(s?.id || selectedId); load() }} />
    </div>
  )
}
