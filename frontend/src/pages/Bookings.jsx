import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { BOOKING_STATUSES, BOOKING_TONES, cls, fmtDate, fmtMoney, label, relDays, todayISO } from '../format'
import { Badge, Button, EmptyState, Field, Icon, Input, Modal, PageHeader, Select, Spinner, Textarea, toast, toastErr } from '../ui'
import ExampleCard from '../examples'
import PencilIn from '../pencil'
import { EmailPreview, PreviewModal } from '../receiptpreview'

export function BookingForm({ initial = {}, onSaved, onClose }) {
  const [form, setForm] = useState({
    title: '', event_type: '', status: 'enquiry', date: todayISO(), start_time: '', end_time: '',
    venue_name: '', venue_address: '', guest_count: 0, quoted_price: 0, client_id: '', menu_type: '', day_load: 0,
    dietary_notes: '', setup_notes: '', notes: '', ...initial,
  })
  const [clients, setClients] = useState([])
  const [menus, setMenus] = useState([])
  const [busy, setBusy] = useState(false)
  const { user } = useAuth()
  const services = user?.services || []  // set up in Settings → Business; powers the dropdown below
  useEffect(() => {
    api.get('/clients').then(setClients).catch(() => {})
    api.get('/menus').then(setMenus).catch(() => {})
  }, [])
  const set = (k, cast = (v) => v) => (e) => setForm({ ...form, [k]: cast(e.target.value) })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...form, day_load: Number(form.day_load) || 0, client_id: form.client_id ? Number(form.client_id) : null, guest_count: Number(form.guest_count) || 0, quoted_price: Number(form.quoted_price) || 0 }
      const saved = initial.id ? await api.patch(`/bookings/${initial.id}`, payload) : await api.post('/bookings', payload)
      onSaved(saved)
    } catch (err) { toastErr(err) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Event title"><Input value={form.title} onChange={set('title')} placeholder="Okafor 40th — Garden Party" required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Event type">
          <Input list="cc-service-types" value={form.event_type} onChange={set('event_type')} placeholder={services[0] || 'Private dinner'} />
          {services.length > 0 && <datalist id="cc-service-types">{services.map((s) => <option key={s} value={s} />)}</datalist>}
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date"><Input type="date" value={form.date} onChange={set('date')} /></Field>
        <Field label="Start"><Input type="time" value={form.start_time} onChange={set('start_time')} /></Field>
        <Field label="End"><Input type="time" value={form.end_time} onChange={set('end_time')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Guests"><Input type="number" min="0" value={form.guest_count} onChange={set('guest_count')} /></Field>
        <Field label="Quoted price"><Input type="number" min="0" step="0.01" value={form.quoted_price} onChange={set('quoted_price')} /></Field>
      </div>
      <Field label="How much of the day this takes" hint="Leave as usual unless this one is different, e.g. a half-day house-share cook.">
        <Select value={String(form.day_load || 0)} onChange={(e) => setForm({ ...form, day_load: Number(e.target.value) })} data-day-load>
          <option value="0">As usual for this service</option><option value="0.25">A light slice</option><option value="0.5">Half a day</option><option value="1">The whole day, my only booking</option>
        </Select>
      </Field>
      <Field label="Menu">
        <Input list="cc-booking-menus" value={form.menu_type} onChange={set('menu_type')} placeholder="Link one of your set menus" />
        {menus.length > 0 && <datalist id="cc-booking-menus">{menus.map((m) => <option key={m.id} value={m.title} />)}</datalist>}
      </Field>
      <Field label="Client">
        <Select value={form.client_id || ''} onChange={set('client_id')}>
          <option value="">— No client linked —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Venue name"><Input value={form.venue_name} onChange={set('venue_name')} /></Field>
      <Field label="Venue address"><Input value={form.venue_address} onChange={set('venue_address')} /></Field>
      <Field label="Dietary notes"><Textarea rows={2} value={form.dietary_notes} onChange={set('dietary_notes')} placeholder="Allergies, dietary requirements…" /></Field>
      <Field label="Setup notes"><Textarea rows={2} value={form.setup_notes} onChange={set('setup_notes')} /></Field>
      <Field label="General notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={busy}>{initial.id ? 'Save changes' : 'Create booking'}</Button>
      </div>
    </form>
  )
}

function CalendarView({ bookings }) {
  const [anchor, setAnchor] = useState(() => todayISO().slice(0, 7))
  const [y, m] = anchor.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startPad = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(y, m, 0).getDate()
  const byDate = useMemo(() => {
    const map = {}
    bookings.forEach((b) => { if (b.date) (map[b.date] = map[b.date] || []).push(b) })
    return map
  }, [bookings])
  const shift = (delta) => {
    const d = new Date(y, m - 1 + delta, 1)
    setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => shift(-1)} />
        <h3 className="font-display font-semibold">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <Button variant="ghost" size="sm" icon="chevronRight" onClick={() => shift(1)} />
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] font-semibold uppercase tracking-wider text-fg/40">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-line">
        {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} className="min-h-[72px] bg-parchment/40" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dateStr = `${anchor}-${String(i + 1).padStart(2, '0')}`
          const todays = byDate[dateStr] || []
          const isToday = dateStr === todayISO()
          return (
            <div key={dateStr} className={cls('min-h-[72px] bg-card p-1', isToday && 'bg-copper/5')}>
              <p className={cls('mb-0.5 text-right text-[11px]', isToday ? 'font-bold text-copper' : 'text-fg/40')}>{i + 1}</p>
              {todays.slice(0, 2).map((b) => (
                <Link key={b.id} to={`/app/bookings/${b.id}`}
                  className={cls('mb-0.5 block truncate rounded px-1 py-0.5 text-[10px] font-medium',
                    b.status === 'cancelled' ? 'bg-fg/5 text-fg/40 line-through' : 'bg-copper/10 text-copper-dark hover:bg-copper/20')}>
                  {b.title}
                </Link>
              ))}
              {todays.length > 2 && <p className="px-1 text-[9px] text-fg/40">+{todays.length - 2} more</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------- enquiry / lead pipeline board ------------------------- */
// The active life of a lead, in order. Completed/cancelled graduate off the board.
const PIPELINE_STAGES = ['enquiry', 'quoted', 'confirmed', 'in_prep']
const NEXT_STATUS = { enquiry: 'quoted', quoted: 'confirmed', confirmed: 'in_prep', in_prep: 'completed' }
const STAGE_HINT = {
  enquiry: 'New leads — the rough details the client sent.',
  quoted: 'Price sent — waiting on their yes.',
  confirmed: 'Booked in and locked for the diary.',
  in_prep: 'Prep underway for the event.',
}

function PipelineCard({ booking, currency, onEdit, onAdvance }) {
  const b = booking
  const next = NEXT_STATUS[b.status]
  return (
    <div className="rounded-xl border border-line bg-card p-3 shadow-card transition-all hover:border-copper/40">
      {b.date_hold && <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-copper">{b.deposit_paid ? 'Date held · deposit paid' : b.hold_stage === 'requested' ? 'Date request · waiting for you' : 'Date hold · awaiting deposit'}</p>}
      <div className="flex items-start justify-between gap-2">
        <Link to={`/app/bookings/${b.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-copper">{b.title}</Link>
        {b.quoted_price > 0 && <span className="shrink-0 text-xs font-semibold">{fmtMoney(b.quoted_price, currency)}</span>}
      </div>
      <p className="mt-1 text-xs text-fg/55">
        {b.date ? fmtDate(b.date) : 'date TBC'}{b.date ? ` · ${relDays(b.date)}` : ''}
        {b.guest_count ? ` · ${b.guest_count} guests` : ''}{b.event_type ? ` · ${b.event_type}` : ''}
      </p>
      {b.venue_address && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-fg/45">
          <Icon name="pin" size={11} className="shrink-0" />{b.venue_address}
        </p>
      )}
      {b.notes && (
        <p className="mt-2 line-clamp-4 whitespace-pre-line rounded-lg bg-parchment/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-fg/55">{b.notes}</p>
      )}
      <div className="mt-2.5 space-y-1.5">
        {next && (
          <Button size="sm" icon="arrowRight" className="w-full whitespace-nowrap" onClick={() => onAdvance(b, next)}>
            {next === 'completed' ? 'Mark complete' : `Move to ${label(next)}`}
          </Button>
        )}
        <button onClick={() => onEdit(b)} className="inline-flex w-full items-center justify-center gap-1 py-0.5 text-xs font-medium text-fg/50 hover:text-copper">
          <Icon name="edit" size={13} /> Edit details
        </button>
      </div>
    </div>
  )
}

function PipelineView({ bookings, currency, onEdit, onAdvance, onNew }) {
  const open = bookings.filter((b) => PIPELINE_STAGES.includes(b.status))
  const byStage = (s) => open
    .filter((b) => b.status === s)
    .sort((a, b) => (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99'))

  if (open.length === 0) {
    return (
      <EmptyState icon="pulse" title="No open enquiries or active events"
        hint="When a client sends an enquiry it lands here as a new lead — then move it down the line: quote it, confirm it, prep it. Share your enquiry link from Settings → App & integrations."
        action={<Button icon="plus" onClick={onNew}>New booking</Button>} />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PIPELINE_STAGES.map((stage) => {
        const cards = byStage(stage)
        return (
          <div key={stage} className="rounded-2xl border border-line bg-base/40 p-2.5">
            <div className="mb-1 flex items-center justify-between px-1">
              <Badge tone={BOOKING_TONES[stage]}>{label(stage)}</Badge>
              <span className="text-xs font-medium text-fg/40">{cards.length}</span>
            </div>
            <p className="mb-2 px-1 text-[11px] leading-snug text-fg/40">{STAGE_HINT[stage]}</p>
            <div className="space-y-2">
              {cards.length === 0
                ? <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-fg/35">Nothing here yet</p>
                : cards.map((b) => <PipelineCard key={b.id} booking={b} currency={currency} onEdit={onEdit} onAdvance={onAdvance} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* Date requests. Clients hold the dates they need on your website; the day is held for them straight away.
   Step 1 (waiting for you): confirm you are free, which asks them for the deposit, or say you can't.
   Step 2 (waiting for the deposit): when the money lands, mark it received and the date is locked in. */
export function HoldsStrip({ holds, currency, onChanged, onPaid }) {
  const [now, setNow] = useState(Date.now())
  const [preview, setPreview] = useState(null) // { kind: 'confirm' | 'paid', hold, customer }
  const [decline, setDecline] = useState(null) // { hold, reason }
  const [busy, setBusy] = useState(false)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  if (!holds.length) return null
  const left = (h) => {
    const ms = new Date(h.expires_at).getTime() - now
    if (ms <= 0) return 'time is up'
    const m = Math.floor(ms / 60000)
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`
  }
  const wanting = holds.filter((h) => h.stage === 'requested')
  const deposits = holds.filter((h) => h.stage !== 'requested')
  const open = async (kind, h) => {
    try { const p = await api.get(`/holds/${h.id}/${kind === 'confirm' ? 'confirm-preview' : 'paid-preview'}`); setPreview({ kind, hold: h, ...p }) } catch (e) { toastErr(e) }
  }
  const confirm = async () => {
    setBusy(true)
    try {
      if (preview.kind === 'confirm') { await api.post(`/holds/${preview.hold.id}/confirm`); toast('Confirmed. They have been asked for the deposit.', 'sage') }
      else { await api.post(`/holds/${preview.hold.id}/paid`); toast('Deposit received. The date is locked in and the client has been emailed.', 'sage') }
      const paid = preview.kind === 'paid' ? preview.hold : null
      setPreview(null); onChanged()
      if (paid && onPaid) onPaid(paid)
    } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const sendDecline = async () => {
    setBusy(true)
    try { await api.post(`/holds/${decline.hold.id}/decline`, { reason: decline.reason }); toast('Released. They have been told.'); setDecline(null); onChanged() } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const release = async (h) => {
    if (!window.confirm(`Release ${h.client_name}'s hold on ${fmtDate(h.date)}? The date opens up again.`)) return
    try { await api.post(`/holds/${h.id}/release`); toast('Hold released'); onChanged() } catch (e) { toastErr(e) }
  }
  return (
    <div className="mb-5 space-y-4" data-holds-strip>
      <PreviewModal open={!!preview} onClose={() => setPreview(null)}
        title={preview?.kind === 'confirm' ? 'Confirm you are free, and ask for the deposit' : 'Deposit received? Lock the date in'}
        confirmLabel={preview?.kind === 'confirm' ? 'Confirm & send' : 'Confirm date & send'} onConfirm={confirm} busy={busy}>
        {preview ? <EmailPreview to={preview.customer?.to} subject={preview.customer?.subject} body={preview.customer?.body}
          note={preview.kind === 'confirm'
            ? `You are saying you are free on ${fmtDate(preview.hold.date)}. This email asks ${preview.hold.client_name} for the ${fmtMoney(preview.hold.amount, currency)} deposit, and they then have 12 hours to pay it before the date is released.`
            : `Check the ${fmtMoney(preview.hold.amount, currency)} from ${preview.hold.client_name} (reference ${preview.hold.reference}) has landed. On confirm, ${fmtDate(preview.hold.date)} becomes a confirmed booking and this email goes to them.`} /> : null}
      </PreviewModal>
      <PreviewModal open={!!decline} onClose={() => setDecline(null)} title="Can't do that day" confirmLabel="Release & tell them" onConfirm={sendDecline} busy={busy}>
        {decline ? (
          <div className="space-y-3 text-sm">
            <p>This releases {fmtDate(decline.hold.date)} for {decline.hold.client_name} and emails them that you can't do it. They haven't paid anything.</p>
            <Field label="A line for them (optional)"><Textarea rows={3} value={decline.reason} onChange={(e) => setDecline({ ...decline, reason: e.target.value })} placeholder="e.g. I'm away that day. Could you do the Thursday instead?" data-decline-reason /></Field>
          </div>
        ) : null}
      </PreviewModal>
      {wanting.length ? (
        <div className="rounded-xl border border-copper/60 bg-copper/10 p-4" data-requests>
          <p className="font-display text-lg">Date requests <span className="text-sm text-fg/55">· waiting for you</span></p>
          <p className="mt-0.5 text-xs text-fg/60">Already held on your calendar and website. Confirm if you are free, or release it.</p>
          <ul className="mt-2 divide-y divide-line">
            {wanting.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5" data-hold-row={h.id} data-hold-stage="requested">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{h.client_name} <span className="text-fg/55">· {fmtDate(h.date)} · {h.service}</span></p>
                  <p className="text-xs text-fg/55">{h.phone || h.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => open('confirm', h)} data-hold-confirm>I'm free · Confirm</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDecline({ hold: h, reason: '' })} data-hold-decline>Can't do it</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {deposits.length ? (
        <div className="rounded-xl border border-line bg-card p-4" data-deposits>
          <p className="font-display text-lg">Waiting for the deposit</p>
          <p className="mt-0.5 text-xs text-fg/60">You have confirmed these. When the money lands, press received.</p>
          <ul className="mt-2 divide-y divide-line">
            {deposits.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5" data-hold-row={h.id} data-hold-stage="awaiting_deposit">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{h.client_name} <span className="text-fg/55">· {fmtDate(h.date)} · {h.service}</span></p>
                  <p className="text-xs text-fg/55">Reference <strong>{h.reference}</strong> · {fmtMoney(h.amount, currency)} · <span className="font-medium text-copper" data-hold-left>{left(h)}</span></p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => open('paid', h)} data-hold-received>{fmtMoney(h.amount, currency)} received</Button>
                  <Button size="sm" variant="ghost" onClick={() => release(h)} data-hold-release>Release</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default function Bookings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState(null)
  const [holds, setHolds] = useState([])
  const [view, setView] = useState('list')
  const [filter, setFilter] = useState('upcoming')
  const [creating, setCreating] = useState(false)
  const [pencil, setPencil] = useState(false)
  const [editing, setEditing] = useState(null)

  // Holds first: asking for them also releases any whose time ran out, so the bookings list below is up to date.
  const load = () => api.get('/holds').then(setHolds).catch(() => setHolds([])).finally(() => api.get('/bookings').then(setBookings).catch(toastErr))
  useEffect(() => { load() }, [])
  if (!bookings) return <Spinner />

  const replace = (saved) => setBookings((prev) => prev.map((x) => (x.id === saved.id ? saved : x)))
  const advance = (b, next) => api.patch(`/bookings/${b.id}`, { status: next })
    .then((saved) => { replace(saved); toast(`Moved to ${label(next)}`, 'sage') })
    .catch(toastErr)
  const enquiryCount = bookings.filter((b) => b.status === 'enquiry').length

  const today = todayISO()
  const filtered = bookings.filter((b) => {
    if (filter === 'upcoming') return (!b.date || b.date >= today) && !['completed', 'cancelled'].includes(b.status)
    if (filter === 'past') return (b.date && b.date < today) || ['completed', 'cancelled'].includes(b.status)
    return true
  })
  const sorted = [...filtered].sort((a, b) => (filter === 'past' ? (b.date || '').localeCompare(a.date || '') : (a.date || '').localeCompare(b.date || '')))

  return (
    <div>
      <PageHeader title="Bookings" sub="Every event from enquiry to final presentation."
        actions={
          <>
            <div className="flex rounded-lg border border-line bg-card p-0.5">
              {['list', 'pipeline', 'calendar'].map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cls('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize', view === v ? 'bg-ink text-cream' : 'text-fg/50')}>
                  {v}
                  {v === 'pipeline' && enquiryCount > 0 && (
                    <span className={cls('rounded-full px-1.5 text-[10px] font-semibold leading-tight', view === v ? 'bg-cream/20 text-cream' : 'bg-copper text-ink')}>{enquiryCount}</span>
                  )}
                </button>
              ))}
            </div>
            <Button icon="plus" onClick={() => setPencil(true)} data-pencil-open>Pencil in</Button>
            <Button variant="ghost" icon="plus" onClick={() => setCreating(true)}>New booking</Button>
          </>
        }
      />
      <ExampleCard k="bookings" />
      <HoldsStrip holds={holds} currency={user?.currency} onChanged={load} />

      {view === 'calendar' && <CalendarView bookings={bookings} />}

      {view === 'pipeline' && (
        <PipelineView bookings={bookings} currency={user?.currency}
          onEdit={setEditing} onAdvance={advance} onNew={() => setCreating(true)} />
      )}

      {view === 'list' && (
        <>
          <div className="mb-4 flex gap-1.5">
            {['upcoming', 'past', 'all'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cls('rounded-full px-3.5 py-1.5 text-xs font-medium capitalize', filter === f ? 'bg-ink text-cream' : 'bg-card border border-line text-fg/55')}>{f}</button>
            ))}
          </div>
          {sorted.length === 0 ? (
            <EmptyState icon="calendar" title="No bookings here yet" hint="Create your first booking and the whole workspace — shopping, tasks, routes, designs — hangs off it."
              action={<Button icon="plus" onClick={() => setCreating(true)}>New booking</Button>} />
          ) : (
            <div className="space-y-2.5">
              {sorted.map((b) => (
                <Link key={b.id} to={`/app/bookings/${b.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-card px-4 py-3.5 shadow-card transition-all hover:border-copper/40">
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-display text-2xl font-semibold leading-none text-copper">{b.date ? b.date.slice(8, 10) : '—'}</p>
                    <p className="text-[10px] uppercase tracking-wider text-fg/45">{b.date ? fmtDate(b.date).replace(/^\w+ /, '') : 'no date'}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.title}</p>
                    <p className="truncate text-xs text-fg/50">
                      {b.event_type || 'Event'} · {b.guest_count} guests · {b.venue_name || 'venue TBC'}{b.date ? ` · ${relDays(b.date)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.quoted_price > 0 && <span className="text-sm font-medium">{fmtMoney(b.quoted_price, user?.currency)}</span>}
                    {b.date_hold && !b.deposit_paid && b.status === 'enquiry' && <Badge tone="copper">{b.hold_stage === 'requested' ? 'Date request' : 'Awaiting deposit'}</Badge>}
                    {b.date_hold && b.deposit_paid && <Badge tone="green">Deposit paid</Badge>}
                    <Badge tone={BOOKING_TONES[b.status]}>{label(b.status)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <PencilIn open={pencil} onClose={() => setPencil(false)} onSaved={() => { setPencil(false); load() }} />
      <Modal open={creating} onClose={() => setCreating(false)} title="New booking">
        <BookingForm onClose={() => setCreating(false)} onSaved={(b) => { setCreating(false); navigate(`/app/bookings/${b.id}`) }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit enquiry">
        {editing && <BookingForm initial={editing} onClose={() => setEditing(null)} onSaved={(b) => { setEditing(null); replace(b) }} />}
      </Modal>
    </div>
  )
}
