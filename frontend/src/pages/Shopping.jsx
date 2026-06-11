import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtDate, fmtMoney, todayISO, uid } from '../format'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, ProgressBar, Spinner, toast, toastErr } from '../ui'

/* ------------------------------ new list modal ------------------------------ */
export function NewListModal({ open, onClose, onCreated, bookingId = null, defaultDate = '' }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate || todayISO())
  useEffect(() => { if (open) { setTitle(''); setDate(defaultDate || todayISO()) } }, [open, defaultDate])
  const create = (e) => {
    e.preventDefault()
    api.post('/shopping', { title, shop_date: date, booking_id: bookingId, items: [] })
      .then((l) => onCreated(l)).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title="New shopping list">
      <form onSubmit={create} className="space-y-4">
        <Field label="List title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday market run" required /></Field>
        <Field label="Shop date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Create list</Button></div>
      </form>
    </Modal>
  )
}

/* ------------------------------- list editor -------------------------------- */
export function ListEditor({ list, onChanged, onDeleted, currency = 'GBP', startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState({ name: '', qty: '', unit: '', shop: '', est_cost: '' })
  const [shopOptions, setShopOptions] = useState([])
  useEffect(() => {
    if (!open) return
    api.get('/suppliers').then((s) => setShopOptions(s.map((x) => x.name))).catch(() => {})
  }, [open])

  const items = list.items || []
  const done = items.filter((i) => i.purchased).length
  const total = items.reduce((a, i) => a + (Number(i.est_cost) || 0), 0)
  const groups = useMemo(() => {
    const map = {}
    items.forEach((i) => { const key = i.shop || 'Anywhere'; (map[key] = map[key] || []).push(i) })
    return Object.entries(map)
  }, [list])

  const saveItems = (next) => api.patch(`/shopping/${list.id}`, { items: next }).then(onChanged).catch(toastErr)
  const toggle = (itemId) => api.post(`/shopping/${list.id}/toggle`, { item_id: itemId }).then(onChanged).catch(toastErr)
  const removeItem = (itemId) => saveItems(items.filter((i) => i.id !== itemId))
  const addItem = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    saveItems([...items, { id: uid(), name: draft.name.trim(), qty: draft.qty ? Number(draft.qty) : '', unit: draft.unit, shop: draft.shop.trim() || 'Anywhere', category: '', est_cost: draft.est_cost ? Number(draft.est_cost) : 0, purchased: false, note: '' }])
    setDraft({ name: '', qty: '', unit: '', shop: draft.shop, est_cost: '' })
  }
  const markDone = () => api.patch(`/shopping/${list.id}`, { status: list.status === 'done' ? 'open' : 'done' }).then(onChanged).catch(toastErr)
  const removeList = () => {
    if (!window.confirm('Delete this shopping list?')) return
    api.del(`/shopping/${list.id}`).then(onDeleted).catch(toastErr)
  }

  return (
    <Card pad={false} className={list.status === 'done' ? 'opacity-70' : ''}>
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(!open)}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} className="shrink-0 text-fg/40" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{list.title}</p>
            {list.status === 'done' && <Badge tone="sage">done</Badge>}
          </div>
          <p className="text-xs text-fg/45">{list.shop_date ? fmtDate(list.shop_date) : 'No date'} · {done}/{items.length} items · est {fmtMoney(total, currency)}</p>
        </div>
        <div className="w-28 shrink-0"><ProgressBar value={done} max={items.length || 1} /></div>
      </button>

      {open && (
        <div className="border-t border-line/70 px-4 py-3">
          {groups.length === 0 && <p className="pb-2 text-sm text-fg/45">Empty list — add the first item below.</p>}
          {groups.map(([shop, shopItems]) => (
            <div key={shop} className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-copper">
                <Icon name="pin" size={12} />{shop}
                <span className="text-fg/35">({shopItems.filter((i) => i.purchased).length}/{shopItems.length})</span>
              </p>
              <ul className="space-y-1">
                {shopItems.map((i) => (
                  <li key={i.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-parchment/50">
                    <button onClick={() => toggle(i.id)}
                      className={cls('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        i.purchased ? 'border-sage bg-sage text-white' : 'border-fg/25 bg-card')}>
                      {i.purchased && <Icon name="check" size={12} />}
                    </button>
                    <span className={cls('min-w-0 flex-1 truncate text-sm', i.purchased && 'text-fg/35 line-through')}>
                      {i.name}{(i.qty || i.unit) ? <span className="text-fg/45"> — {i.qty} {i.unit}</span> : null}
                      {i.note ? <span className="text-fg/35"> · {i.note}</span> : null}
                    </span>
                    {Number(i.est_cost) > 0 && <span className="shrink-0 text-xs text-fg/45">{fmtMoney(i.est_cost, currency)}</span>}
                    <IconButton icon="trash" label="Remove" className="opacity-0 group-hover:opacity-100" onClick={() => removeItem(i.id)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <form onSubmit={addItem} className="mt-2 grid grid-cols-12 gap-1.5">
            <Input className="col-span-12 sm:col-span-4" placeholder="Add item…" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input className="col-span-3 sm:col-span-1" placeholder="Qty" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
            <Input className="col-span-3 sm:col-span-1" placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            <Input className="col-span-4 sm:col-span-3" placeholder="Shop (e.g. Butcher)" list={`shops-${list.id}`} value={draft.shop} onChange={(e) => setDraft({ ...draft, shop: e.target.value })} />
            <Input className="col-span-2 sm:col-span-1" placeholder="£" value={draft.est_cost} onChange={(e) => setDraft({ ...draft, est_cost: e.target.value })} />
            <Button className="col-span-12 sm:col-span-2" size="sm" icon="plus">Add</Button>
            <datalist id={`shops-${list.id}`}>
              {[...new Set([...shopOptions, 'Supermarket', 'Butcher', 'Fishmonger', 'Greengrocer', 'Wholesaler', 'Market', 'Online'])].map((s) => <option key={s} value={s} />)}
            </datalist>
          </form>

          <div className="mt-3 flex justify-between border-t border-line/70 pt-3">
            <Button size="sm" variant="danger" icon="trash" onClick={removeList}>Delete list</Button>
            <Button size="sm" variant={list.status === 'done' ? 'secondary' : 'dark'} icon="check" onClick={markDone}>
              {list.status === 'done' ? 'Reopen' : 'Mark all done'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ----------------------------------- page ----------------------------------- */
export default function Shopping() {
  const { user } = useAuth()
  const [lists, setLists] = useState(null)
  const [bookings, setBookings] = useState([])
  const [creating, setCreating] = useState(false)
  const load = () => api.get('/shopping').then(setLists).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!lists) return <Spinner />

  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title
  const open = lists.filter((l) => l.status === 'open')
  const closed = lists.filter((l) => l.status === 'done')

  return (
    <div>
      <PageHeader title="Shopping" sub="Lists per booking, grouped by shop — check off as you go."
        actions={<Button icon="plus" onClick={() => setCreating(true)}>New list</Button>} />
      {lists.length === 0 ? (
        <EmptyState icon="cart" title="No shopping lists yet" hint="Create one here, or generate one from a booking's menu with the AI sous-chef."
          action={<Button icon="plus" onClick={() => setCreating(true)}>New list</Button>} />
      ) : (
        <div className="space-y-3">
          {open.map((l) => (
            <div key={l.id}>
              {l.booking_id && bookingTitle(l.booking_id) && (
                <Link to={`/app/bookings/${l.booking_id}`} className="mb-1 inline-block text-[11px] font-medium text-copper">↳ {bookingTitle(l.booking_id)}</Link>
              )}
              <ListEditor list={l} currency={user?.currency} onChanged={load} onDeleted={load} />
            </div>
          ))}
          {closed.length > 0 && <p className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-fg/40">Completed</p>}
          {closed.map((l) => <ListEditor key={l.id} list={l} currency={user?.currency} onChanged={load} onDeleted={load} />)}
        </div>
      )}
      <NewListModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); toast('List created', 'sage') }} />
    </div>
  )
}
