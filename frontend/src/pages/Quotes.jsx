import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtDate, fmtMoney, invoiceTotal, todayISO, uid } from '../format'
import { ChargesMenu } from '../charges'
import { MenuItemsMenu, fetchMenuItems } from '../menulines'
import { GripHandle, SortableList } from '../sortable'
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, Spinner, Textarea, toast, toastErr } from '../ui'

const TONES = { draft: 'gray', sent: 'amber', approved: 'sage', declined: 'red', expired: 'ink' }

export function QuoteEditor({ open, onClose, onSaved, initial = null, currency }) {
  const { user } = useAuth()
  const blank = { number: '', title: '', client_id: '', booking_id: '', items: [], tax_rate: 0, discount: 0, valid_until: '', notes: '' }
  const [form, setForm] = useState(blank)
  const [clients, setClients] = useState([])
  const [bookings, setBookings] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const withIds = (arr) => (arr || []).map((it) => ({ ...it, id: it.id || uid() }))
  // Once any save has happened (Save draft included), the quote exists — later saves
  // PATCH it (no accidental duplicates) and closing refreshes the parent list.
  const [savedId, setSavedId] = useState(null)
  const [savedMidEdit, setSavedMidEdit] = useState(false)
  useEffect(() => {
    if (!open) return
    setSavedId(initial?.id || null)
    setSavedMidEdit(false)
    api.get('/clients').then(setClients).catch(() => {})
    api.get('/bookings').then(setBookings).catch(() => {})
    if (initial?.id) setForm({ ...blank, ...initial, items: withIds(initial.items) })
    // New quote (possibly pre-filled from a booking menu): still assign the next number.
    else api.get('/quotes/meta/next-number')
      .then(({ number }) => setForm({ ...blank, number, ...(initial || {}), items: withIds(initial?.items) }))
      .catch(() => setForm({ ...blank, ...(initial || {}), items: withIds(initial?.items) }))
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  // Priced dishes to pull onto a line — refreshed when the linked booking changes.
  useEffect(() => {
    if (!open) return
    fetchMenuItems(form.booking_id || null).then(setMenuItems).catch(() => {})
  }, [open, form.booking_id])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const items = form.items || []
  const setItem = (i, key, value) => setForm({ ...form, items: items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)) })
  const addItem = (line) => setForm({ ...form, items: [...items, line] })
  const dupItem = (i) => setForm({ ...form, items: [...items.slice(0, i + 1), { ...items[i], id: uid() }, ...items.slice(i + 1)] })
  const removeItem = (i) => setForm({ ...form, items: items.filter((_, idx) => idx !== i) })

  const buildPayload = () => ({
    ...form, tax_rate: Number(form.tax_rate) || 0, discount: Number(form.discount) || 0,
    client_id: form.client_id ? Number(form.client_id) : null,
    booking_id: form.booking_id ? Number(form.booking_id) : null,
    items: items.map((it) => (it.section
      ? { id: it.id, description: it.description, section: true }
      : { ...it, qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0 })),
  })
  const persist = () => (savedId ? api.patch(`/quotes/${savedId}`, buildPayload()) : api.post('/quotes', buildPayload()))
    .then((q) => { setSavedId(q.id); setSavedMidEdit(true); return q })
  const save = (e) => { e.preventDefault(); persist().then(onSaved).catch(toastErr) }
  // Save where you are and keep editing — for quotes built up over several sittings.
  const saveDraft = () => persist()
    .then(() => toast('Draft saved — pick it up any time from your quotes list', 'sage'))
    .catch(toastErr)
  const close = () => (savedMidEdit ? onSaved() : onClose())
  // Quote → invoice in one step: save the quote (with its service lines), then create the invoice.
  const saveAndInvoice = () => {
    persist()
      .then((q) => api.post(`/quotes/${q.id}/to-invoice`))
      .then((inv) => { toast(`Invoice ${inv.number} created — see Finance → Invoices`, 'sage'); onSaved() })
      .catch(toastErr)
  }
  const remove = () => { if (savedId && window.confirm('Delete this quote?')) api.del(`/quotes/${savedId}`).then(onSaved).catch(toastErr) }

  return (
    <Modal open={open} onClose={close} title={savedId ? `Edit ${form.number || 'quote'}` : 'New quote'} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number"><Input value={form.number} onChange={set('number')} /></Field>
          <Field label="Title"><Input value={form.title} onChange={set('title')} placeholder="Anniversary dinner — proposal" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Client">
            <Select value={form.client_id || ''} onChange={set('client_id')}>
              <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Booking">
            <Select value={form.booking_id || ''} onChange={set('booking_id')}>
              <option value="">—</option>{bookings.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </Select>
          </Field>
          <Field label="Valid until"><Input type="date" value={form.valid_until} onChange={set('valid_until')} /></Field>
        </div>
        <div>
          <p className="label">Line items</p>
          <p className="mb-1.5 text-xs text-fg/45">Drag the ⠿ handle to reorder lines up or down.</p>
          <SortableList items={items} onReorder={(next) => setForm({ ...form, items: next })} className="space-y-1.5">
            {(it, sort) => {
              const i = items.indexOf(it)
              return (
                <li key={it.id} {...sort.row} className={cls('flex items-center gap-1', sort.active && 'cursor-grabbing')}>
                  <GripHandle handle={sort.grip} />
                  {it.section ? (
                    <div className="grid flex-1 grid-cols-12 items-center gap-1.5 rounded-lg bg-parchment/40 px-1 py-0.5">
                      <Input className="col-span-10 font-display font-semibold" placeholder="Section heading — e.g. DAY 1 (no price)"
                        value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                      <IconButton icon="copy" label="Duplicate line" className="col-span-1 justify-self-center self-center" onClick={() => dupItem(i)} />
                      <IconButton icon="trash" label="Remove line" className="col-span-1 justify-self-center self-center" onClick={() => removeItem(i)} />
                    </div>
                  ) : (
                    <div className="grid flex-1 grid-cols-12 gap-1.5">
                      <Input className="col-span-5" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                      <Input className="col-span-2" type="number" step="any" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                      <Input className="col-span-3" type="number" step="0.01" placeholder="Unit price" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                      <IconButton icon="copy" label="Duplicate line" className="col-span-1 justify-self-center self-center" onClick={() => dupItem(i)} />
                      <IconButton icon="trash" label="Remove line" className="col-span-1 justify-self-center self-center" onClick={() => removeItem(i)} />
                    </div>
                  )}
                </li>
              )
            }}
          </SortableList>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" icon="plus" onClick={() => addItem({ id: uid(), description: '', qty: 1, unit_price: 0 })}>Add line</Button>
            <Button type="button" size="sm" variant="ghost" icon="menu" onClick={() => addItem({ id: uid(), description: '', section: true })}>Add break</Button>
            <MenuItemsMenu items={menuItems} currency={currency} className="w-auto" onAdd={addItem} />
            <ChargesMenu saved={user?.service_charges || []} className="w-auto" onAdd={addItem} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tax rate %"><Input type="number" step="0.1" value={form.tax_rate} onChange={set('tax_rate')} /></Field>
          <Field label="Discount"><Input type="number" step="0.01" value={form.discount} onChange={set('discount')} /></Field>
          <div className="self-end rounded-lg bg-ink px-4 py-2 text-right text-cream">
            <p className="text-[10px] uppercase tracking-wider text-cream/50">Total</p>
            <p className="font-display text-lg font-semibold">{fmtMoney(invoiceTotal(form), currency)}</p>
          </div>
        </div>
        <Field label="Notes for the client" hint="Press Enter for a new line — it shows as a new line on the quote."><Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Deposit terms, what's included…" /></Field>
        <div className="flex flex-wrap justify-between gap-2">
          {savedId ? <Button type="button" variant="danger" icon="trash" onClick={remove}>Delete</Button> : <span />}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="button" variant="secondary" icon="doc" onClick={saveDraft}>Save draft</Button>
            <Button type="button" variant="secondary" icon="coins" onClick={saveAndInvoice}>Save &amp; create invoice</Button>
            <Button>{savedId ? 'Save quote' : 'Create quote'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function QuotesPanel({ locked = false }) {
  const { user } = useAuth()
  const cur = user?.currency || 'GBP'
  const [quotes, setQuotes] = useState(null)
  const [modal, setModal] = useState({ open: false, initial: null })
  const load = () => api.get('/quotes').then(setQuotes).catch(toastErr)
  useEffect(() => { if (!locked) load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (locked) {
    return <EmptyState icon="lock" title="Quotes are part of the Elite Kitchen plan"
      hint="Upgrade in Settings → Membership to send client approval links your clients can accept from their phone." />
  }
  if (!quotes) return <Spinner />

  const send = (q) =>
    api.post(`/quotes/${q.id}/send`).then((res) => {
      navigator.clipboard?.writeText(res.public_url)
      toast('Quote sent — approval link copied to clipboard', 'sage')
      load()
    }).catch(toastErr)
  const copyLink = (q) => {
    navigator.clipboard.writeText(`${window.location.origin}/q/${q.public_token}`)
    toast('Approval link copied', 'sage')
  }
  const toInvoice = (q) =>
    api.post(`/quotes/${q.id}/to-invoice`).then((inv) => toast(`Invoice ${inv.number} created — see Finance`, 'sage')).catch(toastErr)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg/55">Send a link — your client approves from their phone. No logins, no chasing.</p>
        <Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New quote</Button>
      </div>
      {quotes.length === 0 ? (
        <EmptyState icon="doc" title="No quotes yet" hint="Draft a quote, hit send, and share the approval link. You'll see (and get emailed) the moment they respond."
          action={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New quote</Button>} />
      ) : (
        <div className="space-y-2.5">
          {quotes.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-card">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setModal({ open: true, initial: q })}>
                <p className="truncate text-sm font-medium">{q.number} <span className="text-fg/45">— {q.title || 'Untitled quote'}</span></p>
                <p className="truncate text-xs text-fg/50">
                  {[q.valid_until && `valid until ${fmtDate(q.valid_until)}`,
                    q.responder_name && `${q.status} by ${q.responder_name}`,
                    q.client_comment && `“${q.client_comment}”`].filter(Boolean).join(' · ') || 'Draft'}
                </p>
              </div>
              <span className="font-semibold">{fmtMoney(invoiceTotal(q), cur)}</span>
              <Badge tone={TONES[q.status]}>{q.status}</Badge>
              {q.status === 'draft' && <Button size="sm" icon="arrowRight" onClick={() => send(q)}>Send</Button>}
              {q.status === 'sent' && q.public_token && <Button size="sm" variant="secondary" icon="copy" onClick={() => copyLink(q)}>Copy link</Button>}
              {q.status === 'approved' && <Button size="sm" variant="secondary" icon="coins" onClick={() => toInvoice(q)}>To invoice</Button>}
            </div>
          ))}
        </div>
      )}
      <QuoteEditor open={modal.open} initial={modal.initial} currency={cur}
        onClose={() => setModal({ open: false, initial: null })}
        onSaved={() => { setModal({ open: false, initial: null }); load() }} />
    </div>
  )
}
