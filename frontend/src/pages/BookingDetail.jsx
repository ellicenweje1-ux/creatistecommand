import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { BOOKING_STATUSES, BOOKING_TONES, fmtDateLong, fmtMoney, invoiceTotal, label, menuPriceTotal, miseReady, relDays, todayISO, uid } from '../format'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, Select, Spinner, Tabs, Textarea, toast, toastErr } from '../ui'
import { BookingForm } from './Bookings'
import { ContactClient } from '../contact'
import { DishRowsEditor, dishFromCourse } from '../dishrows'
import { QuoteEditor } from './Quotes'
import { DesignCard, DesignEditorModal } from './Designs'
import { ExpenseFormModal, InvoiceEditorModal } from './Finance'
import { OrderFormModal, OrderRow } from './Orders'
import { NewRouteModal, RouteEditor } from './RoutesPage'
import { NewPackingModal, PackEditor } from './Packing'
import { ListEditor, NewListModal } from './Shopping'
import { TaskComposer, TaskItem } from './Tasks'

/* ------------------------------- AI result modal ------------------------------- */
function AIModal({ state, onClose, onApply }) {
  const { open, loading, kind, result } = state
  return (
    <Modal open={open} onClose={onClose} title={loading ? 'Asking Mise…' : `Mise suggests — ${kind}`}
      footer={!loading && result && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Discard</Button>
          <Button icon="check" onClick={onApply}>Apply to booking</Button>
        </div>
      )}>
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10 text-fg/50">
          <Icon name="sparkle" size={28} className="animate-pulse text-copper" />
          <p className="text-sm">Mise is thinking through your booking…</p>
        </div>
      ) : result && (
        <div className="space-y-3 text-sm">
          {kind === 'menu' && (
            <>
              <p className="font-display text-lg font-semibold">{result.menu_name}</p>
              <p className="text-fg/60">{result.rationale}</p>
              <ul className="space-y-2">
                {(result.courses || []).map((c, i) => (
                  <li key={i} className="rounded-lg border border-line bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-copper">{c.course}</p>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-fg/55">{c.description}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {kind === 'shopping list' && (
            <>
              <p className="font-medium">{result.title}</p>
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {(result.items || []).map((item, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-1.5">
                    <span>{item.name} <span className="text-fg/45">— {item.qty} {item.unit}</span></span>
                    <span className="text-xs text-fg/50">{item.shop}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-fg/45">{(result.items || []).length} items, grouped by shop.</p>
            </>
          )}
          {kind === 'prep plan' && (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {(result.tasks || []).map((t, i) => (
                <li key={i} className="rounded-lg border border-line bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{t.title}</p>
                    <span className="shrink-0 text-xs text-fg/50">{t.due_date} {t.due_time || ''}</span>
                  </div>
                  {t.description && <p className="mt-0.5 text-xs text-fg/55">{t.description}</p>}
                  <div className="mt-1 flex gap-1.5"><Badge tone="copper">{t.category}</Badge><Badge tone="gray">{t.priority}</Badge></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

/* -------------------------------- menu builder --------------------------------- */
function MenuBuilder({ booking, recipes, currency, canQuote, onSaved }) {
  const [menu, setMenu] = useState(booking.menu || [])
  const [dirty, setDirty] = useState(false)
  const [menus, setMenus] = useState([])
  const [quote, setQuote] = useState(null)  // prefilled draft for the QuoteEditor, or null
  useEffect(() => { setMenu(booking.menu || []); setDirty(false) }, [booking])
  useEffect(() => { api.get('/menus').then(setMenus).catch(() => {}) }, [])

  const change = (rows) => { setMenu(rows); setDirty(true) }
  const importFrom = (menuId) => {
    const m = menus.find((x) => String(x.id) === String(menuId))
    if (!m) return
    const rows = (m.courses || []).map((c) => dishFromCourse(c, m.price_per_head || ''))
    if (!rows.length) { toast(`"${m.title}" has no dishes yet`, 'amber'); return }
    setMenu([...menu, ...rows]); setDirty(true)
    toast(`Added ${rows.length} dish${rows.length === 1 ? '' : 'es'} from "${m.title}"`, 'sage')
  }
  const save = () => api.patch(`/bookings/${booking.id}`, { menu }).then((b) => { onSaved(b); setDirty(false); toast('Menu saved', 'sage') }).catch(toastErr)
  const liveMenus = menus.filter((m) => m.active !== false)
  const total = menuPriceTotal(menu)   // straight sum of the line prices — no calculation
  const priced = menu.some((m) => Number(m.price) > 0)

  // Turn the menu lines into a client quote: each line is one item at its price (qty 1),
  // ready to adjust quantities in the quote editor. No automatic guest/serves maths.
  const buildQuote = () => {
    const items = menu
      .filter((m) => Number(m.price) > 0 || m.name || m.course)
      .map((m) => ({
        id: uid(),
        description: [m.course, m.name].filter(Boolean).join(' — ') + (m.serves ? ` (serves ${m.serves})` : ''),
        qty: 1,
        unit_price: Number(m.price) || 0,
      }))
    setQuote({
      title: `${booking.title || 'Event'} — menu`,
      client_id: booking.client_id || '',
      booking_id: booking.id,
      items,
      tax_rate: 0, discount: 0, valid_until: '', notes: '',
    })
  }

  return (
    <Card title="Menu" action={dirty ? <Button size="sm" icon="check" onClick={save}>Save menu</Button> : null}>
      {liveMenus.length > 0 && (
        <div className="mb-3">
          <Select value="" onChange={(e) => { importFrom(e.target.value); e.target.value = '' }}>
            <option value="">Pull dishes in from a saved menu…</option>
            {liveMenus.map((m) => <option key={m.id} value={m.id}>{m.title}{m.menu_type ? ` · ${m.menu_type}` : ''}</option>)}
          </Select>
          <p className="mt-1 text-xs text-fg/45">Adds that menu’s dishes to this booking — then tweak them here. Build set menus under <span className="font-medium">Menus</span>.</p>
        </div>
      )}
      <DishRowsEditor rows={menu} recipes={recipes} currency={currency} onChange={change} />
      {priced && (
        <div className="mt-3 space-y-2 border-t border-line/60 pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg/60">Menu total <span className="text-xs text-fg/40">· sum of line prices</span></span>
            <span className="font-display text-lg font-semibold">{fmtMoney(total, currency)}</span>
          </div>
          {canQuote && (
            <div className="flex justify-end pt-1">
              <Button size="sm" variant="secondary" icon="doc" onClick={buildQuote} disabled={dirty}>
                {dirty ? 'Save menu first' : 'Build a quote from this menu'}
              </Button>
            </div>
          )}
        </div>
      )}
      {canQuote && (
        <QuoteEditor open={!!quote} initial={quote} currency={currency}
          onClose={() => setQuote(null)}
          onSaved={() => { setQuote(null); toast('Quote drafted — open Finance → Quotes to send it', 'sage') }} />
      )}
    </Card>
  )
}

/* Upload an invoice generated in another app (PDF) and record it against the booking. */
function UploadInvoiceModal({ open, bookingId, clientId, currency, onClose, onSaved }) {
  const [form, setForm] = useState({ number: '', issue_date: todayISO(), amount: '', status: 'sent' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setForm({ number: '', issue_date: todayISO(), amount: '', status: 'sent' }); setFile(null)
    api.get('/finance/next-invoice-number').then(({ number }) => setForm((f) => ({ ...f, number }))).catch(() => {})
  }, [open])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    if (!file) { toast('Choose the invoice PDF to upload', 'amber'); return }
    setBusy(true)
    try {
      const up = await api.upload(file)
      await api.post('/invoices', {
        number: form.number, booking_id: bookingId, client_id: clientId || null,
        issue_date: form.issue_date, status: form.status,
        file_url: up.url, file_name: up.filename || file.name,
        items: [{ id: uid(), description: 'Invoice (uploaded)', qty: 1, unit_price: Number(form.amount) || 0 }],
        notes: 'Uploaded from an external invoice.',
      })
      toast('Invoice uploaded', 'sage'); onSaved()
    } catch (err) { toastErr(err) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload an invoice">
      <div className="space-y-4">
        <p className="text-sm text-fg/60">Generated your invoice elsewhere? Attach the PDF and record it here — it’ll show on this booking and in Finance.</p>
        <Field label="Invoice PDF">
          {file ? (
            <div className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium"><Icon name="doc" size={15} className="shrink-0 text-copper" /><span className="truncate">{file.name}</span></span>
              <IconButton icon="x" label="Remove" onClick={() => setFile(null)} />
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line py-3 text-sm font-medium text-fg/55 hover:border-copper/50 hover:text-copper">
              <Icon name="plus" size={15} /> Choose a PDF
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice number"><Input value={form.number} onChange={set('number')} placeholder="INV-2026-001" /></Field>
          <Field label={`Amount (${currency})`}><Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" /></Field>
          <Field label="Issue date"><Input type="date" value={form.issue_date} onChange={set('issue_date')} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {['draft', 'sent', 'paid', 'overdue', 'void'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="up" disabled={busy} onClick={save}>{busy ? 'Uploading…' : 'Upload invoice'}</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ----------------------------------- page -------------------------------------- */
export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const cur = user?.currency || 'GBP'
  // Quotes are an owner-only, Elite-plan feature — gate the "Build a quote" action to match.
  const canQuote = !user?.is_staff && (user?.role === 'admin' || (user?.plan_level ?? 1) >= 3)
  const [ws, setWs] = useState(null)
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [ai, setAi] = useState({ open: false, loading: false, kind: '', result: null })
  const [aiBrief, setAiBrief] = useState('')
  const [newList, setNewList] = useState(false)
  const [newPack, setNewPack] = useState(false)
  const [newRoute, setNewRoute] = useState(false)
  const [orderModal, setOrderModal] = useState({ open: false, initial: null })
  const [invoiceModal, setInvoiceModal] = useState({ open: false, initial: null })
  const [uploadInvoice, setUploadInvoice] = useState(false)
  const [expenseModal, setExpenseModal] = useState({ open: false, initial: null })
  const [designModal, setDesignModal] = useState({ open: false, design: null })

  const load = () => api.get(`/bookings/${id}/workspace`).then(setWs).catch(toastErr)
  useEffect(() => { load(); api.get('/recipes').then(setRecipes).catch(() => {}) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ws) return <Spinner />
  const b = ws.booking

  const setStatus = (status) => api.patch(`/bookings/${b.id}`, { status }).then(load).catch(toastErr)
  const removeBooking = () => {
    if (!window.confirm('Delete this booking? Linked lists, tasks and routes stay but lose the link.')) return
    api.del(`/bookings/${b.id}`).then(() => navigate('/app/bookings')).catch(toastErr)
  }

  const runAI = async (kind, call) => {
    setAi({ open: true, loading: true, kind, result: null })
    try {
      const result = await call()
      setAi({ open: true, loading: false, kind, result })
    } catch (err) {
      setAi({ open: false, loading: false, kind, result: null })
      toastErr(err)
    }
  }

  const applyAI = async () => {
    const { kind, result } = ai
    try {
      if (kind === 'menu') {
        const menu = (result.courses || []).map((c) => ({ id: uid(), course: c.course, name: c.name, recipe_id: null, notes: c.description || '' }))
        await api.patch(`/bookings/${b.id}`, { menu })
        toast('Menu applied', 'sage')
      } else if (kind === 'shopping list') {
        const items = (result.items || []).map((i) => ({ id: uid(), name: i.name, qty: i.qty, unit: i.unit || '', shop: i.shop || 'Supermarket', category: i.category || '', est_cost: i.est_cost || 0, purchased: false, note: i.note || '' }))
        await api.post('/shopping', { title: result.title || `${b.title} — shopping`, booking_id: b.id, shop_date: b.date, items })
        toast('Shopping list created', 'sage')
        setTab('shopping')
      } else if (kind === 'prep plan') {
        for (const t of result.tasks || []) {
          await api.post('/tasks', { ...t, booking_id: b.id, status: 'todo' })
        }
        toast(`${(result.tasks || []).length} tasks created`, 'sage')
        setTab('tasks')
      }
      setAi({ open: false, loading: false, kind: '', result: null })
      load()
    } catch (err) { toastErr(err) }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'money', label: 'Money' },
    { id: 'shopping', label: 'Shopping', count: ws.shopping_lists.length },
    { id: 'orders', label: 'Orders', count: ws.orders.length },
    { id: 'tasks', label: 'Tasks', count: ws.tasks.filter((t) => t.status !== 'done').length },
    { id: 'route', label: 'Route', count: ws.routes.length },
    { id: 'packing', label: 'Packing', count: (ws.packing_lists || []).length },
    { id: 'designs', label: 'Designs', count: ws.designs.length },
  ]

  return (
    <div>
      <Link to="/app/bookings" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-fg/50 hover:text-copper">
        <Icon name="chevronLeft" size={13} /> All bookings
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">{b.title}</h1>
          <p className="mt-1 text-sm text-fg/55">
            {fmtDateLong(b.date)}{b.start_time ? ` · ${b.start_time}–${b.end_time || '?'}` : ''} · {b.guest_count} guests{b.date ? ` · ${relDays(b.date)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={b.status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
          <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit</Button>
          <IconButton icon="trash" label="Delete booking" onClick={removeBooking} />
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title="Event details">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
                {[['Type', b.event_type || '—'], ['Menu', b.menu_type || '—'], ['Status', label(b.status)], ['Guests', b.guest_count],
                  ['Quoted', b.quoted_price ? fmtMoney(b.quoted_price, cur) : '—'],
                  ['Deposit', b.deposit_paid ? 'Paid ✓' : 'Not paid'],
                  ['Venue', b.venue_name || '—']].map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>
                ))}
              </dl>
              {b.venue_address && <p className="mt-3 rounded-lg bg-parchment/50 px-3 py-2 text-sm text-fg/65"><Icon name="pin" size={13} className="mr-1 inline text-copper" />{b.venue_address}</p>}
              {b.dietary_notes && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"><Icon name="alert" size={13} className="mr-1 inline" />{b.dietary_notes}</p>}
              {b.setup_notes && <p className="mt-2 text-sm text-fg/60"><span className="font-medium">Setup:</span> {b.setup_notes}</p>}
              {b.notes && <p className="mt-2 text-sm text-fg/60"><span className="font-medium">Notes:</span> {b.notes}</p>}
              {(b.equipment || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">{b.equipment.map((e, i) => <Badge key={i} tone="ink">{e}</Badge>)}</div>
              )}
            </Card>
            <MenuBuilder booking={b} recipes={recipes} currency={cur} canQuote={canQuote} onSaved={(nb) => setWs({ ...ws, booking: nb })} />
          </div>

          <div className="space-y-5">
            <Card title="Client">
              {ws.client ? (
                <div className="text-sm">
                  <Link to="/app/clients" className="font-medium text-copper">{ws.client.name}</Link>
                  {ws.client.company && <p className="text-fg/55">{ws.client.company}</p>}
                  <div className="mt-2 space-y-1 text-fg/60">
                    {ws.client.phone && <p><Icon name="phone" size={13} className="mr-1 inline" />{ws.client.phone}</p>}
                    {ws.client.email && <p><Icon name="mail" size={13} className="mr-1 inline" />{ws.client.email}</p>}
                  </div>
                  {(ws.client.dietary || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">{ws.client.dietary.map((d, i) => <Badge key={i} tone="sage">{d}</Badge>)}</div>
                  )}
                  {ws.client.allergies && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">⚠ {ws.client.allergies}</p>}
                  {(ws.client.phone || ws.client.email) && (
                    <div className="mt-3 border-t border-line/60 pt-3">
                      <ContactClient client={ws.client} booking={b} label="Contact client" />
                    </div>
                  )}
                </div>
              ) : <p className="text-sm text-fg/45">No client linked. Edit the booking to attach one.</p>}
            </Card>

            {miseReady(user) && (
            <Card title="Mise — your AI sous-chef">
              <p className="mb-3 text-xs text-fg/50">True to its name — <em>mise en place</em> — Mise preps the boring parts: menus, lists, plans. Review before applying.</p>
              <div className="space-y-2">
                <Input placeholder="Menu brief (e.g. 'summer garden party, 3 courses')" value={aiBrief} onChange={(e) => setAiBrief(e.target.value)} />
                <Button className="w-full" variant="secondary" icon="sparkle"
                  onClick={() => runAI('menu', () => api.post('/ai/menu-suggest', { brief: aiBrief, client_id: b.client_id }))}>
                  Suggest a menu
                </Button>
                <Button className="w-full" variant="secondary" icon="cart"
                  onClick={() => runAI('shopping list', () => api.post('/ai/shopping-list', { booking_id: b.id }))}>
                  Build shopping list from menu
                </Button>
                <Button className="w-full" variant="secondary" icon="checks"
                  onClick={() => runAI('prep plan', () => api.post('/ai/prep-plan', { booking_id: b.id }))}>
                  Draft full prep plan
                </Button>
              </div>
            </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'shopping' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button icon="plus" onClick={() => setNewList(true)}>New list</Button></div>
          {ws.shopping_lists.length === 0 ? (
            <EmptyState icon="cart" title="No shopping lists for this booking"
              hint="Create one by hand, or use the AI sous-chef on the Overview tab to build it from the menu minus your stock." />
          ) : ws.shopping_lists.map((sl) => (
            <ListEditor key={sl.id} list={sl} currency={cur} onChanged={load} onDeleted={load} />
          ))}
          <NewListModal open={newList} bookingId={b.id} defaultDate={b.date} onClose={() => setNewList(false)} onCreated={() => { setNewList(false); load() }} />
        </div>
      )}

      {tab === 'packing' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button icon="plus" onClick={() => setNewPack(true)}>New packing list</Button></div>
          {(ws.packing_lists || []).length === 0 ? (
            <EmptyState icon="clipboard" title="Nothing to pack yet" hint="Build the van-load list: equipment, crockery, signage, safety kit — tick off as it goes in." />
          ) : ws.packing_lists.map((pl) => (
            <PackEditor key={pl.id} list={pl} onChanged={load} onDeleted={load} />
          ))}
          <NewPackingModal open={newPack} bookingId={b.id} onClose={() => setNewPack(false)} onCreated={() => { setNewPack(false); load() }} />
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          <TaskComposer bookingId={b.id} onCreated={load} />
          {ws.tasks.length === 0 ? (
            <EmptyState icon="checks" title="No tasks yet" hint="Add prep, shopping and logistics tasks — or generate a full plan with AI from the Overview tab." />
          ) : (
            <div className="space-y-1.5">{ws.tasks.map((t) => <TaskItem key={t.id} task={t} onChanged={load} />)}</div>
          )}
        </div>
      )}

      {tab === 'route' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button icon="plus" onClick={() => setNewRoute(true)}>New route plan</Button></div>
          {ws.routes.length === 0 ? (
            <EmptyState icon="map" title="No route planned" hint="Plan your prep-day run: market, butcher, wholesaler — in the right order." />
          ) : ws.routes.map((r) => <RouteEditor key={r.id} route={r} onChanged={load} onDeleted={load} />)}
          <NewRouteModal open={newRoute} bookingId={b.id} defaultDate={b.date} onClose={() => setNewRoute(false)} onCreated={() => { setNewRoute(false); load() }} />
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button icon="plus" onClick={() => setOrderModal({ open: true, initial: null })}>Track an order</Button></div>
          {ws.orders.length === 0 ? (
            <EmptyState icon="truck" title="No online orders tracked" hint="Track speciality ingredient and equipment orders so they land before prep day." />
          ) : (
            <div className="space-y-2">{ws.orders.map((o) => (
              <OrderRow key={o.id} order={o} currency={cur} onChanged={load} onEdit={() => setOrderModal({ open: true, initial: o })} />
            ))}</div>
          )}
          <OrderFormModal open={orderModal.open} initial={orderModal.initial} bookingId={b.id}
            onClose={() => setOrderModal({ open: false, initial: null })}
            onSaved={() => { setOrderModal({ open: false, initial: null }); load() }} />
        </div>
      )}

      {tab === 'designs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon="plus" onClick={() => setDesignModal({ open: true, design: { title: `${b.title} — layout`, booking_id: b.id, canvas: { width: 1000, height: 700, items: [] } } })}>
              New design
            </Button>
          </div>
          {ws.designs.length === 0 ? (
            <EmptyState icon="layout" title="No setup designs" hint="Sketch the room: buffet lines, guest tables, bar, stations." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ws.designs.map((d) => (
                <DesignCard key={d.id} design={d} onOpen={() => setDesignModal({ open: true, design: d })} onDeleted={load} />
              ))}
            </div>
          )}
          <DesignEditorModal open={designModal.open} design={designModal.design}
            onClose={() => setDesignModal({ open: false, design: null })}
            onSaved={() => { setDesignModal({ open: false, design: null }); load() }} />
        </div>
      )}

      {tab === 'money' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {(ws.quotes || []).length > 0 && (
            <Card title="Quotes" pad={false} className="lg:col-span-2">
              <ul className="divide-y divide-line/70">
                {ws.quotes.map((qt) => (
                  <li key={qt.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{qt.number || `Quote #${qt.id}`} <span className="text-fg/45">— {qt.title}</span></span>
                    <span className="flex items-center gap-2">
                      <Badge tone={{ draft: 'gray', sent: 'amber', approved: 'sage', declined: 'red', expired: 'ink' }[qt.status]}>{qt.status}</Badge>
                      <Link to="/app/finance" className="text-xs font-medium text-copper">Manage</Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Invoices" action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon="up" onClick={() => setUploadInvoice(true)}>Upload</Button>
              <Button size="sm" icon="plus" onClick={() => setInvoiceModal({ open: true, initial: null })}>New invoice</Button>
            </div>
          } pad={false}>
            {ws.invoices.length === 0 ? <p className="p-5 text-sm text-fg/45">No invoices for this booking yet — create one, or upload a PDF you generated elsewhere.</p> : (
              <ul className="divide-y divide-line/70">
                {ws.invoices.map((inv) => (
                  <li key={inv.id} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-parchment/40"
                    onClick={() => setInvoiceModal({ open: true, initial: inv })}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{inv.number || `Invoice #${inv.id}`}{inv.file_url && <span className="ml-1.5 align-middle text-[10px] font-normal uppercase tracking-wide text-copper">PDF</span>}</p>
                      <p className="text-xs text-fg/45">{inv.issue_date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.file_url && (
                        <a href={inv.file_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          className="text-copper hover:text-copper-dark" title="Open the uploaded PDF"><Icon name="external" size={15} /></a>
                      )}
                      <span className="text-sm font-semibold">{fmtMoney(invoiceTotal(inv), cur)}</span>
                      <Badge tone={{ draft: 'gray', sent: 'amber', paid: 'sage', overdue: 'red', void: 'ink' }[inv.status]}>{inv.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Expenses" action={<Button size="sm" icon="plus" onClick={() => setExpenseModal({ open: true, initial: null })}>Add expense</Button>} pad={false}>
            {ws.expenses.length === 0 ? <p className="p-5 text-sm text-fg/45">No expenses logged against this booking.</p> : (
              <ul className="divide-y divide-line/70">
                {ws.expenses.map((e) => (
                  <li key={e.id} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-parchment/40"
                    onClick={() => setExpenseModal({ open: true, initial: e })}>
                    <div><p className="text-sm font-medium">{e.description}</p><p className="text-xs text-fg/45">{e.category} · {e.date}</p></div>
                    <span className="text-sm font-semibold">{fmtMoney(e.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
            {ws.expenses.length > 0 && (
              <p className="border-t border-line px-4 py-2.5 text-right text-sm">
                Booking costs: <span className="font-semibold">{fmtMoney(ws.expenses.reduce((a, e) => a + (e.amount || 0), 0), cur)}</span>
                {b.quoted_price > 0 && <span className="ml-2 text-fg/45">vs quote {fmtMoney(b.quoted_price, cur)}</span>}
              </p>
            )}
          </Card>
          <InvoiceEditorModal open={invoiceModal.open} initial={invoiceModal.initial} bookingId={b.id} clientId={b.client_id} currency={cur}
            onClose={() => setInvoiceModal({ open: false, initial: null })}
            onSaved={() => { setInvoiceModal({ open: false, initial: null }); load() }} />
          <UploadInvoiceModal open={uploadInvoice} bookingId={b.id} clientId={b.client_id} currency={cur}
            onClose={() => setUploadInvoice(false)}
            onSaved={() => { setUploadInvoice(false); load() }} />
          <ExpenseFormModal open={expenseModal.open} initial={expenseModal.initial} bookingId={b.id}
            onClose={() => setExpenseModal({ open: false, initial: null })}
            onSaved={() => { setExpenseModal({ open: false, initial: null }); load() }} />
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit booking">
        <BookingForm initial={b} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />
      </Modal>
      <AIModal state={ai} onClose={() => setAi({ open: false, loading: false, kind: '', result: null })} onApply={applyAI} />
    </div>
  )
}
