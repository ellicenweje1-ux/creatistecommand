import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { BOOKING_STATUSES, BOOKING_TONES, cls, fmtDate, fmtMoney, label, relDays, todayISO } from '../format'
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, toastErr } from '../ui'

export function BookingForm({ initial = {}, onSaved, onClose }) {
  const [form, setForm] = useState({
    title: '', event_type: '', status: 'enquiry', date: todayISO(), start_time: '', end_time: '',
    venue_name: '', venue_address: '', guest_count: 0, quoted_price: 0, client_id: '',
    dietary_notes: '', setup_notes: '', notes: '', ...initial,
  })
  const [clients, setClients] = useState([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/clients').then(setClients).catch(() => {}) }, [])
  const set = (k, cast = (v) => v) => (e) => setForm({ ...form, [k]: cast(e.target.value) })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...form, client_id: form.client_id ? Number(form.client_id) : null, guest_count: Number(form.guest_count) || 0, quoted_price: Number(form.quoted_price) || 0 }
      const saved = initial.id ? await api.patch(`/bookings/${initial.id}`, payload) : await api.post('/bookings', payload)
      onSaved(saved)
    } catch (err) { toastErr(err) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Event title"><Input value={form.title} onChange={set('title')} placeholder="Okafor 40th — Garden Party" required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Event type"><Input value={form.event_type} onChange={set('event_type')} placeholder="Private dinner" /></Field>
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
    <div className="rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => shift(-1)} />
        <h3 className="font-display font-semibold">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <Button variant="ghost" size="sm" icon="chevronRight" onClick={() => shift(1)} />
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] font-semibold uppercase tracking-wider text-ink/40">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-line">
        {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} className="min-h-[72px] bg-parchment/40" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dateStr = `${anchor}-${String(i + 1).padStart(2, '0')}`
          const todays = byDate[dateStr] || []
          const isToday = dateStr === todayISO()
          return (
            <div key={dateStr} className={cls('min-h-[72px] bg-white p-1', isToday && 'bg-copper/5')}>
              <p className={cls('mb-0.5 text-right text-[11px]', isToday ? 'font-bold text-copper' : 'text-ink/40')}>{i + 1}</p>
              {todays.slice(0, 2).map((b) => (
                <Link key={b.id} to={`/app/bookings/${b.id}`}
                  className={cls('mb-0.5 block truncate rounded px-1 py-0.5 text-[10px] font-medium',
                    b.status === 'cancelled' ? 'bg-ink/5 text-ink/40 line-through' : 'bg-copper/10 text-copper-dark hover:bg-copper/20')}>
                  {b.title}
                </Link>
              ))}
              {todays.length > 2 && <p className="px-1 text-[9px] text-ink/40">+{todays.length - 2} more</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Bookings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState(null)
  const [view, setView] = useState('list')
  const [filter, setFilter] = useState('upcoming')
  const [creating, setCreating] = useState(false)

  const load = () => api.get('/bookings').then(setBookings).catch(toastErr)
  useEffect(() => { load() }, [])
  if (!bookings) return <Spinner />

  const today = todayISO()
  const filtered = bookings.filter((b) => {
    if (filter === 'upcoming') return (!b.date || b.date >= today) && !['completed', 'cancelled'].includes(b.status)
    if (filter === 'past') return (b.date && b.date < today) || ['completed', 'cancelled'].includes(b.status)
    return true
  })
  const sorted = [...filtered].sort((a, b) => (filter === 'past' ? (b.date || '').localeCompare(a.date || '') : (a.date || '').localeCompare(b.date || '')))

  return (
    <div>
      <PageHeader title="Bookings" sub="Every event from enquiry to applause."
        actions={
          <>
            <div className="flex rounded-lg border border-line bg-white p-0.5">
              {['list', 'calendar'].map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cls('rounded-md px-3 py-1.5 text-xs font-medium capitalize', view === v ? 'bg-ink text-cream' : 'text-ink/50')}>{v}</button>
              ))}
            </div>
            <Button icon="plus" onClick={() => setCreating(true)}>New booking</Button>
          </>
        }
      />

      {view === 'calendar' ? <CalendarView bookings={bookings} /> : (
        <>
          <div className="mb-4 flex gap-1.5">
            {['upcoming', 'past', 'all'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cls('rounded-full px-3.5 py-1.5 text-xs font-medium capitalize', filter === f ? 'bg-ink text-cream' : 'bg-white border border-line text-ink/55')}>{f}</button>
            ))}
          </div>
          {sorted.length === 0 ? (
            <EmptyState icon="calendar" title="No bookings here yet" hint="Create your first booking and the whole workspace — shopping, tasks, routes, designs — hangs off it."
              action={<Button icon="plus" onClick={() => setCreating(true)}>New booking</Button>} />
          ) : (
            <div className="space-y-2.5">
              {sorted.map((b) => (
                <Link key={b.id} to={`/app/bookings/${b.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-white px-4 py-3.5 shadow-card transition-all hover:border-copper/40">
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-display text-2xl font-semibold leading-none text-copper">{b.date ? b.date.slice(8, 10) : '—'}</p>
                    <p className="text-[10px] uppercase tracking-wider text-ink/45">{b.date ? fmtDate(b.date).replace(/^\w+ /, '') : 'no date'}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.title}</p>
                    <p className="truncate text-xs text-ink/50">
                      {b.event_type || 'Event'} · {b.guest_count} guests · {b.venue_name || 'venue TBC'}{b.date ? ` · ${relDays(b.date)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.quoted_price > 0 && <span className="text-sm font-medium">{fmtMoney(b.quoted_price, user?.currency)}</span>}
                    <Badge tone={BOOKING_TONES[b.status]}>{label(b.status)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New booking">
        <BookingForm onClose={() => setCreating(false)} onSaved={(b) => { setCreating(false); navigate(`/app/bookings/${b.id}`) }} />
      </Modal>
    </div>
  )
}
