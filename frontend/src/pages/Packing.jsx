import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { cls, uid } from '../format'
import { Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, ProgressBar, Spinner, toastErr } from '../ui'

const STANDARD_KIT = [
  ['Chef knives roll', 'Equipment'], ['Probe thermometer + wipes', 'Safety'], ['First aid + burns kit', 'Safety'],
  ['Blue roll x2', 'Consumables'], ['Cling film & foil', 'Consumables'], ['Tasting spoons', 'Service'],
  ['Service cloths x10', 'Service'], ['Bin bags', 'Consumables'], ['Allergen signage set', 'Service'],
  ['Phone charger & power bank', 'Misc'],
]

export function NewPackingModal({ open, onClose, onCreated, bookingId = null }) {
  const [title, setTitle] = useState('')
  useEffect(() => { if (open) setTitle('') }, [open])
  const create = (e) => {
    e.preventDefault()
    api.post('/packing', { title, booking_id: bookingId, items: [] }).then(onCreated).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title="New packing list">
      <form onSubmit={create} className="space-y-4">
        <Field label="List title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday — van pack" required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Create</Button></div>
      </form>
    </Modal>
  )
}

export function PackEditor({ list, onChanged, onDeleted, startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState({ name: '', qty: '', category: '' })
  const items = list.items || []
  const packed = items.filter((i) => i.packed).length

  const saveItems = (next) => api.patch(`/packing/${list.id}`, { items: next }).then(onChanged).catch(toastErr)
  const toggle = (id) => api.post(`/packing/${list.id}/toggle`, { item_id: id }).then(onChanged).catch(toastErr)
  const addItem = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    saveItems([...items, { id: uid(), name: draft.name.trim(), qty: draft.qty || 1, category: draft.category.trim() || 'Misc', packed: false }])
    setDraft({ name: '', qty: '', category: draft.category })
  }
  const addStandardKit = () => {
    const have = new Set(items.map((i) => i.name.toLowerCase()))
    const extra = STANDARD_KIT.filter(([n]) => !have.has(n.toLowerCase()))
      .map(([name, category]) => ({ id: uid(), name, qty: 1, category, packed: false }))
    if (extra.length) saveItems([...items, ...extra])
  }
  const removeList = () => { if (window.confirm('Delete this packing list?')) api.del(`/packing/${list.id}`).then(onDeleted).catch(toastErr) }

  const groups = Object.entries(items.reduce((acc, i) => {
    const key = i.category || 'Misc'
    ;(acc[key] = acc[key] || []).push(i)
    return acc
  }, {}))

  return (
    <Card pad={false}>
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(!open)}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} className="shrink-0 text-fg/40" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{list.title}</p>
          <p className="text-xs text-fg/45">{packed}/{items.length} packed</p>
        </div>
        <div className="w-28 shrink-0"><ProgressBar value={packed} max={items.length || 1} /></div>
      </button>
      {open && (
        <div className="border-t border-line/70 px-4 py-3">
          {groups.map(([cat, catItems]) => (
            <div key={cat} className="mb-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-copper">{cat}</p>
              <ul className="space-y-1">
                {catItems.map((i) => (
                  <li key={i.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-parchment/50">
                    <button onClick={() => toggle(i.id)}
                      className={cls('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        i.packed ? 'border-sage bg-sage text-white' : 'border-fg/25 bg-card')}>
                      {i.packed && <Icon name="check" size={12} />}
                    </button>
                    <span className={cls('min-w-0 flex-1 truncate text-sm', i.packed && 'text-fg/35 line-through')}>
                      {i.name}{Number(i.qty) > 1 ? <span className="text-fg/45"> ×{i.qty}</span> : null}
                    </span>
                    <IconButton icon="trash" label="Remove" className="opacity-0 group-hover:opacity-100"
                      onClick={() => saveItems(items.filter((x) => x.id !== i.id))} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <form onSubmit={addItem} className="mt-2 grid grid-cols-12 gap-1.5">
            <Input className="col-span-6 sm:col-span-6" placeholder="Add item…" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input className="col-span-2 sm:col-span-1" placeholder="Qty" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
            <Input className="col-span-4 sm:col-span-3" placeholder="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <Button className="col-span-12 sm:col-span-2" size="sm" icon="plus">Add</Button>
          </form>
          <div className="mt-3 flex justify-between border-t border-line/70 pt-3">
            <Button size="sm" variant="danger" icon="trash" onClick={removeList}>Delete list</Button>
            <Button size="sm" variant="secondary" icon="clipboard" onClick={addStandardKit}>Add standard kit</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function Packing() {
  const [lists, setLists] = useState(null)
  const [bookings, setBookings] = useState([])
  const [creating, setCreating] = useState(false)
  const load = () => api.get('/packing').then(setLists).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!lists) return <Spinner />
  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title

  return (
    <div>
      <PageHeader title="Packing checklists" sub="Everything in the van before it matters — equipment, crockery, signage, safety."
        actions={<Button icon="plus" onClick={() => setCreating(true)}>New list</Button>} />
      {lists.length === 0 ? (
        <EmptyState icon="clipboard" title="No packing lists yet" hint="Create one per booking and tick off as the van fills up. The standard kit button covers the essentials."
          action={<Button icon="plus" onClick={() => setCreating(true)}>New list</Button>} />
      ) : (
        <div className="space-y-3">
          {lists.map((l) => (
            <div key={l.id}>
              {l.booking_id && bookingTitle(l.booking_id) && (
                <Link to={`/app/bookings/${l.booking_id}`} className="mb-1 inline-block text-[11px] font-medium text-copper">↳ {bookingTitle(l.booking_id)}</Link>
              )}
              <PackEditor list={l} onChanged={load} onDeleted={load} />
            </div>
          ))}
        </div>
      )}
      <NewPackingModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />
    </div>
  )
}
