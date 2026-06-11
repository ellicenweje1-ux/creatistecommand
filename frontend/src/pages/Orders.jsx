import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtDate, fmtMoney, label, ORDER_STATUSES, ORDER_TONES, relDays, todayISO } from '../format'
import { Badge, Button, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, Select, Spinner, Textarea, toastErr } from '../ui'

/* -------------------------------- form modal -------------------------------- */
export function OrderFormModal({ open, onClose, onSaved, initial = null, bookingId = null }) {
  const blank = {
    supplier: '', website: '', order_ref: '', items_summary: '', order_date: todayISO(),
    expected_date: '', status: 'to_order', tracking_url: '', cost: '', notes: '',
  }
  const [form, setForm] = useState(blank)
  useEffect(() => { if (open) setForm(initial ? { ...blank, ...initial } : blank) }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = (e) => {
    e.preventDefault()
    const payload = { ...form, cost: Number(form.cost) || 0, booking_id: initial?.booking_id ?? bookingId }
    const req = initial?.id ? api.patch(`/orders/${initial.id}`, payload) : api.post('/orders', payload)
    req.then(onSaved).catch(toastErr)
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit order' : 'Track an online order'}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier"><Input value={form.supplier} onChange={set('supplier')} placeholder="Sous Chef" required /></Field>
          <Field label="Order ref"><Input value={form.order_ref} onChange={set('order_ref')} placeholder="SC-118245" /></Field>
        </div>
        <Field label="What's in it"><Textarea rows={2} value={form.items_summary} onChange={set('items_summary')} placeholder="Banana leaves x30, smoked salt…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ordered on"><Input type="date" value={form.order_date} onChange={set('order_date')} /></Field>
          <Field label="Expected by"><Input type="date" value={form.expected_date} onChange={set('expected_date')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </Select>
          </Field>
          <Field label="Cost"><Input type="number" step="0.01" min="0" value={form.cost} onChange={set('cost')} /></Field>
        </div>
        <Field label="Tracking URL"><Input value={form.tracking_url} onChange={set('tracking_url')} placeholder="https://track…" /></Field>
        <Field label="Website"><Input value={form.website} onChange={set('website')} placeholder="https://supplier.com" /></Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>{initial?.id ? 'Save' : 'Track order'}</Button></div>
      </form>
    </Modal>
  )
}

/* --------------------------------- order row -------------------------------- */
export function OrderRow({ order, onChanged, onEdit, currency = 'GBP', bookingLabel }) {
  const setStatus = (status) => {
    const patch = { status }
    if (status === 'delivered' && !order.delivered_date) patch.delivered_date = todayISO()
    api.patch(`/orders/${order.id}`, patch).then(onChanged).catch(toastErr)
  }
  const remove = () => { if (window.confirm('Delete this order?')) api.del(`/orders/${order.id}`).then(onChanged).catch(toastErr) }
  const late = order.expected_date && order.expected_date < todayISO() && !['delivered', 'cancelled'].includes(order.status)

  return (
    <div className="group flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-card">
      <Icon name="truck" size={18} className={cls('shrink-0', late || order.status === 'delayed' ? 'text-red-600' : 'text-fg/35')} />
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
        <p className="truncate text-sm font-medium">{order.supplier}{order.order_ref && <span className="text-fg/40"> · {order.order_ref}</span>}</p>
        <p className="truncate text-xs text-fg/50">{order.items_summary || 'No item summary'}{bookingLabel ? ` · ${bookingLabel}` : ''}</p>
        <p className="text-xs text-fg/45">
          {order.expected_date ? `Expected ${fmtDate(order.expected_date)} (${relDays(order.expected_date)})` : 'No ETA'}
          {late && <span className="font-medium text-red-600"> — late, chase it</span>}
        </p>
      </div>
      {Number(order.cost) > 0 && <span className="text-sm font-medium">{fmtMoney(order.cost, currency)}</span>}
      {order.tracking_url && (
        <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-copper" title="Open tracking">
          <Icon name="external" size={15} />
        </a>
      )}
      <Select value={order.status} onChange={(e) => setStatus(e.target.value)} className="w-32 !py-1.5 text-xs">
        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </Select>
      <Badge tone={ORDER_TONES[order.status]} className="hidden sm:inline-flex">{label(order.status)}</Badge>
      <IconButton icon="trash" label="Delete" className="opacity-0 group-hover:opacity-100" onClick={remove} />
    </div>
  )
}

/* ----------------------------------- page ----------------------------------- */
export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [bookings, setBookings] = useState([])
  const [modal, setModal] = useState({ open: false, initial: null })
  const [filter, setFilter] = useState('active')
  const load = () => api.get('/orders').then(setOrders).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!orders) return <Spinner />

  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title
  const visible = orders.filter((o) =>
    filter === 'active' ? !['delivered', 'cancelled'].includes(o.status) : filter === 'done' ? ['delivered', 'cancelled'].includes(o.status) : true)

  return (
    <div>
      <PageHeader title="Online orders" sub="Speciality ingredients and kit — tracked so they arrive in time."
        actions={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>Track an order</Button>} />
      <div className="mb-4 flex gap-1.5">
        {['active', 'done', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cls('rounded-full px-3.5 py-1.5 text-xs font-medium capitalize', filter === f ? 'bg-ink text-cream' : 'border border-line bg-card text-fg/55')}>{f}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState icon="truck" title="No orders here" hint="Track online purchases per booking so nothing arrives after prep day."
          action={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>Track an order</Button>} />
      ) : (
        <div className="space-y-2">
          {visible.map((o) => (
            <OrderRow key={o.id} order={o} currency={user?.currency} onChanged={load}
              onEdit={() => setModal({ open: true, initial: o })} bookingLabel={bookingTitle(o.booking_id)} />
          ))}
        </div>
      )}
      <OrderFormModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })}
        onSaved={() => { setModal({ open: false, initial: null }); load() }} />
    </div>
  )
}
