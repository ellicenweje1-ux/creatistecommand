import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtDate, fmtMoney, relDays, todayISO, uid } from '../format'
import { BookingPicker } from '../prep'
import { PriceBookSearch } from '../pricebook'
import { DragList, GripHandle } from '../sortable'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, ProgressBar, Spinner, toast, toastErr } from '../ui'
import ExampleCard from '../examples'

/* ------------------------------ new list modal ------------------------------ */
// `bookings` (optional) shows a "Link to a booking" dropdown so a list and an event merge
// in one step. When a fixed `bookingId` is passed (from a booking's own page) the picker is
// hidden — the booking is already known.
export function NewListModal({ open, onClose, onCreated, bookingId = null, defaultDate = '', defaultTitle = '', bookings = [] }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate || todayISO())
  const [picked, setPicked] = useState('')        // booking id chosen from the dropdown
  const [titleTouched, setTitleTouched] = useState(false)
  useEffect(() => {
    if (open) { setTitle(defaultTitle || ''); setDate(defaultDate || todayISO()); setPicked(''); setTitleTouched(!!defaultTitle) }
  }, [open, defaultDate, defaultTitle])

  const showPicker = !bookingId && bookings.length > 0
  const choose = (val, bk) => {
    setPicked(val)
    if (bk) {
      if (bk.date) setDate(bk.date)
      if (!titleTouched) setTitle(`${bk.title} — shopping`)  // auto-fill, still editable
    }
  }
  const create = (e) => {
    e.preventDefault()
    api.post('/shopping', { title, shop_date: date, booking_id: bookingId || picked || null, items: [] })
      .then((l) => onCreated(l)).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title="New shopping list">
      <form onSubmit={create} className="space-y-4">
        {showPicker && <BookingPicker bookings={bookings} value={picked} onChange={choose} hint="Pick the event this shop is for — the list attaches to it and fills in the date." />}
        <Field label="List title"><Input value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true) }} placeholder="Saturday market run" required /></Field>
        <Field label="Shop date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Create list</Button></div>
      </form>
    </Modal>
  )
}

// Starter shop suggestions shown only until the chef has added their own suppliers —
// after that the dropdown is steered entirely from the Suppliers page.
const GENERIC_SHOPS = ['Supermarket', 'Butcher', 'Fishmonger', 'Greengrocer', 'Wholesaler', 'Market', 'Online']

/* ----------------------------- edit-item modal ------------------------------ */
// Amend an item already on the list (owner ask): name, qty, unit, shop, cost, note.
function EditItemModal({ open, item, shopOptions, listId, onClose, onSave }) {
  const [form, setForm] = useState(item || {})
  useEffect(() => { if (open && item) setForm(item) }, [open, item])
  if (!item) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    onSave({
      ...item,
      name: (form.name || '').trim() || item.name,
      qty: form.qty === '' || form.qty == null ? '' : Number(form.qty),
      unit: form.unit || '',
      shop: (form.shop || '').trim() || 'Anywhere',
      est_cost: form.est_cost === '' || form.est_cost == null ? 0 : Number(form.est_cost),
      note: form.note || '',
    })
  }
  return (
    <Modal open={open} onClose={onClose} title="Edit item">
      <form onSubmit={save} className="space-y-4">
        <Field label="Item"><Input value={form.name || ''} onChange={set('name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input value={form.qty ?? ''} onChange={set('qty')} placeholder="e.g. 2" /></Field>
          <Field label="Unit"><Input value={form.unit || ''} onChange={set('unit')} placeholder="kg / box / each" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shop">
            <Input value={form.shop || ''} onChange={set('shop')} list={`edit-shops-${listId}`} placeholder="Anywhere" />
            <datalist id={`edit-shops-${listId}`}>{shopOptions.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Est. cost"><Input value={form.est_cost ?? ''} onChange={set('est_cost')} placeholder="£" /></Field>
        </div>
        <Field label="Note"><Input value={form.note || ''} onChange={set('note')} placeholder="brand, size, ripeness…" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Save changes</Button></div>
      </form>
    </Modal>
  )
}

/* ------------------------------- list editor -------------------------------- */
export function ListEditor({ list, onChanged, onDeleted, currency = 'GBP', startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState({ name: '', qty: '', unit: '', shop: '', est_cost: '' })
  const [shopOptions, setShopOptions] = useState([])
  const [editing, setEditing] = useState(null) // item being amended
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
  const updateItem = (next) => { saveItems(items.map((i) => (i.id === next.id ? next : i))); setEditing(null) }
  // Reorder within a shop group: refill the positions this shop occupies in the master
  // array with the new order, leaving every other group exactly where it was.
  const reorderGroup = (shop, nextGroup) => {
    let gi = 0
    const next = items.map((it) => ((it.shop || 'Anywhere') === shop ? nextGroup[gi++] : it))
    saveItems(next)
  }
  const addItem = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    saveItems([...items, { id: uid(), name: draft.name.trim(), qty: draft.qty ? Number(draft.qty) : '', unit: draft.unit, shop: draft.shop.trim() || 'Anywhere', category: '', est_cost: draft.est_cost ? Number(draft.est_cost) : 0, purchased: false, note: '' }])
    setDraft({ name: '', qty: '', unit: '', shop: draft.shop, est_cost: '' })
  }
  const addFromPrice = (p) =>
    saveItems([...items, { id: uid(), name: p.item_name, qty: Number(p.quantity) || '', unit: p.unit || '', shop: p.supplier_name || draft.shop.trim() || 'Anywhere', category: '', est_cost: Number(p.price) || 0, purchased: false, note: '' }])
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
              <DragList items={shopItems} onReorder={(next) => reorderGroup(shop, next)} className="space-y-1">
                {(i, handle) => (
                  <li key={i.id} {...handle.row} className="group flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-parchment/50">
                    {shopItems.length > 1 && <GripHandle handle={handle.grip} />}
                    <button onClick={() => toggle(i.id)} aria-label={i.purchased ? 'Mark not bought' : 'Mark bought'}
                      className={cls('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors sm:h-5 sm:w-5',
                        i.purchased ? 'border-sage bg-sage text-white' : 'border-fg/25 bg-card')}>
                      {i.purchased && <Icon name="check" size={15} className="sm:hidden" />}
                      {i.purchased && <Icon name="check" size={12} className="hidden sm:block" />}
                    </button>
                    <span className={cls('min-w-0 flex-1 truncate text-sm', i.purchased && 'text-fg/35 line-through')}>
                      {i.name}{(i.qty || i.unit) ? <span className="text-fg/45"> — {i.qty} {i.unit}</span> : null}
                      {i.note ? <span className="text-fg/35"> · {i.note}</span> : null}
                    </span>
                    {Number(i.est_cost) > 0 && <span className="shrink-0 text-xs text-fg/45">{fmtMoney(i.est_cost, currency)}</span>}
                    <IconButton icon="edit" label="Edit item" className="opacity-0 group-hover:opacity-100" onClick={() => setEditing(i)} />
                    <IconButton icon="trash" label="Remove" className="opacity-0 group-hover:opacity-100" onClick={() => removeItem(i.id)} />
                  </li>
                )}
              </DragList>
            </div>
          ))}

          <div className="mt-3">
            <PriceBookSearch onPick={addFromPrice} currency={currency}
              placeholder="Add from your price book — search (e.g. cream), press Enter" />
          </div>
          <form onSubmit={addItem} className="mt-2 grid grid-cols-12 gap-1.5">
            <Input className="col-span-12 sm:col-span-4" placeholder="Add item…" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input className="col-span-3 sm:col-span-1" placeholder="Qty" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
            <Input className="col-span-3 sm:col-span-1" placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            <Input className="col-span-4 sm:col-span-3" placeholder="Shop" list={`shops-${list.id}`} value={draft.shop} onChange={(e) => setDraft({ ...draft, shop: e.target.value })} />
            <Input className="col-span-2 sm:col-span-1" placeholder="£" value={draft.est_cost} onChange={(e) => setDraft({ ...draft, est_cost: e.target.value })} />
            <Button className="col-span-12 sm:col-span-2" size="sm" icon="plus">Add</Button>
            <datalist id={`shops-${list.id}`}>
              {(shopOptions.length ? shopOptions : GENERIC_SHOPS).map((s) => <option key={s} value={s} />)}
            </datalist>
          </form>
          <p className="mt-1.5 text-[11px] text-fg/40">
            {shopOptions.length
              ? <>The Shop list is steered from your <Link to="/app/suppliers" className="text-copper hover:underline">Suppliers</Link> — and feeds your route stops. Drag <Icon name="grip" size={11} className="inline" /> to reorder.</>
              : <>Tip: add your <Link to="/app/suppliers" className="text-copper hover:underline">Suppliers</Link> and they’ll fill this Shop dropdown.</>}
          </p>

          <div className="mt-3 flex justify-between border-t border-line/70 pt-3">
            <Button size="sm" variant="danger" icon="trash" onClick={removeList}>Delete list</Button>
            <Button size="sm" variant={list.status === 'done' ? 'secondary' : 'dark'} icon="check" onClick={markDone}>
              {list.status === 'done' ? 'Reopen' : 'Mark all done'}
            </Button>
          </div>
        </div>
      )}
      <EditItemModal open={!!editing} item={editing} listId={list.id}
        shopOptions={shopOptions.length ? shopOptions : GENERIC_SHOPS}
        onClose={() => setEditing(null)} onSave={updateItem} />
    </Card>
  )
}

/* --------------------- active bookings strip (page header) ------------------ */
// "Pull active bookings into the shopping header" (owner ask): the events you're cooking
// for, with a one-tap start-a-list for each — so a shop run starts from what's coming up.
function ActiveBookingsStrip({ bookings, onStartList }) {
  const today = todayISO()
  const active = bookings
    .filter((b) => ['confirmed', 'in_prep'].includes(b.status) && (!b.date || b.date >= today))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    .slice(0, 8)
  if (active.length === 0) return null
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg/40">Shopping for · active bookings</p>
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {active.map((b) => (
          <div key={b.id} className="flex w-56 shrink-0 flex-col rounded-xl border border-line bg-card p-3 shadow-card">
            <Link to={`/app/bookings/${b.id}`} className="truncate text-sm font-medium hover:text-copper">{b.title}</Link>
            <p className="mt-0.5 truncate text-xs text-fg/50">
              {b.date ? `${fmtDate(b.date)} · ${relDays(b.date)}` : 'No date'}{b.guest_count ? ` · ${b.guest_count} guests` : ''}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <Badge tone={b.status === 'in_prep' ? 'copper' : 'sage'}>{b.status === 'in_prep' ? 'in prep' : b.status}</Badge>
              <Button size="sm" variant="secondary" icon="plus" className="ml-auto" onClick={() => onStartList(b)}>List</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------------- page ----------------------------------- */
export default function Shopping() {
  const { user } = useAuth()
  const [lists, setLists] = useState(null)
  const [bookings, setBookings] = useState([])
  const [creating, setCreating] = useState(null) // null=closed, or {bookingId?, defaultDate?, defaultTitle?}
  const load = () => api.get('/shopping').then(setLists).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!lists) return <Spinner />

  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title
  const open = lists.filter((l) => l.status === 'open')
  const closed = lists.filter((l) => l.status === 'done')
  const startListFor = (b) => setCreating({ bookingId: b.id, defaultDate: b.date || '', defaultTitle: `${b.title} — shopping` })

  return (
    <div>
      <PageHeader title="Shopping" sub="Lists per booking, grouped by shop — check off as you go."
        actions={<Button icon="plus" onClick={() => setCreating({})}>New list</Button>} />
      <ExampleCard k="shopping" />

      <ActiveBookingsStrip bookings={bookings} onStartList={startListFor} />

      {lists.length === 0 ? (
        <EmptyState icon="cart" title="No shopping lists yet" hint="Create one here, or generate one from a booking's menu with the AI sous-chef."
          action={<Button icon="plus" onClick={() => setCreating({})}>New list</Button>} />
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
      <NewListModal open={!!creating} bookingId={creating?.bookingId || null} defaultDate={creating?.defaultDate || ''} defaultTitle={creating?.defaultTitle || ''}
        bookings={bookings}
        onClose={() => setCreating(null)} onCreated={() => { setCreating(null); load(); toast('List created', 'sage') }} />
    </div>
  )
}
