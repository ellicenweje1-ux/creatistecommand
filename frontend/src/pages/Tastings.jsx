import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { cls, fmtDate, label, todayISO } from '../format'
import { Badge, Button, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, Select, Spinner, Textarea, toastErr } from '../ui'
import ExampleCard from '../examples'

const KINDS = ['tasting', 'consultation', 'site_visit', 'call']
const KIND_TONES = { tasting: 'copper', consultation: 'sage', site_visit: 'amber', call: 'ink' }

function ApptModal({ open, onClose, onSaved, initial = null }) {
  const blank = { title: '', kind: 'tasting', date: todayISO(), start_time: '', end_time: '', location: '', client_id: '', booking_id: '', status: 'scheduled', notes: '', outcome: '' }
  const [form, setForm] = useState(blank)
  const [clients, setClients] = useState([])
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...blank, ...initial } : blank)
    api.get('/clients').then(setClients).catch(() => {})
    api.get('/bookings').then(setBookings).catch(() => {})
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    const payload = { ...form, client_id: form.client_id ? Number(form.client_id) : null, booking_id: form.booking_id ? Number(form.booking_id) : null }
    const req = initial?.id ? api.patch(`/appointments/${initial.id}`, payload) : api.post('/appointments', payload)
    req.then(onSaved).catch(toastErr)
  }
  const remove = () => { if (initial?.id && window.confirm('Delete this appointment?')) api.del(`/appointments/${initial.id}`).then(onSaved).catch(toastErr) }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit appointment' : 'New appointment'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Title"><Input value={form.title} onChange={set('title')} placeholder="Tasting — Whitfield anniversary menu" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.kind} onChange={set('kind')}>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {['scheduled', 'completed', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={set('date')} /></Field>
          <Field label="From"><Input type="time" value={form.start_time} onChange={set('start_time')} /></Field>
          <Field label="To"><Input type="time" value={form.end_time} onChange={set('end_time')} /></Field>
        </div>
        <Field label="Location"><Input value={form.location} onChange={set('location')} placeholder="Client home / video call" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client">
            <Select value={form.client_id || ''} onChange={set('client_id')}>
              <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Linked booking">
            <Select value={form.booking_id || ''} onChange={set('booking_id')}>
              <option value="">—</option>{bookings.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Menu routes to taste, dietary reminders…" /></Field>
        {form.status === 'completed' && (
          <Field label="Outcome"><Textarea rows={2} value={form.outcome} onChange={set('outcome')} placeholder="What was decided?" /></Field>
        )}
        <div className="flex justify-between gap-2">
          {initial?.id ? <Button type="button" variant="danger" icon="trash" onClick={remove}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button>{initial?.id ? 'Save' : 'Add to diary'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function Tastings() {
  const [appts, setAppts] = useState(null)
  const [bookings, setBookings] = useState([])
  const [modal, setModal] = useState({ open: false, initial: null })
  const load = () => api.get('/appointments').then(setAppts).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!appts) return <Spinner />

  const today = todayISO()
  const upcoming = appts.filter((a) => a.status === 'scheduled' && (!a.date || a.date >= today))
  const past = appts.filter((a) => !upcoming.includes(a))
  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title

  const Row = ({ a }) => (
    <button onClick={() => setModal({ open: true, initial: a })}
      className={cls('flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left shadow-card transition-all hover:border-copper/40', a.status !== 'scheduled' && 'opacity-60')}>
      <div className="w-14 shrink-0 text-center">
        <p className="font-display text-xl font-semibold leading-none text-copper">{a.date ? a.date.slice(8, 10) : '—'}</p>
        <p className="text-[10px] uppercase tracking-wider text-fg/45">{a.date ? fmtDate(a.date).replace(/^\w+ /, '') : ''}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.title}</p>
        <p className="truncate text-xs text-fg/50">
          {[a.start_time && `${a.start_time}${a.end_time ? `–${a.end_time}` : ''}`, a.location, bookingTitle(a.booking_id)].filter(Boolean).join(' · ') || '—'}
        </p>
        {a.outcome && <p className="mt-0.5 truncate text-xs text-sage">✓ {a.outcome}</p>}
      </div>
      <Badge tone={KIND_TONES[a.kind]}>{label(a.kind)}</Badge>
      {a.status !== 'scheduled' && <Badge tone={a.status === 'completed' ? 'sage' : 'red'}>{a.status}</Badge>}
    </button>
  )

  return (
    <div>
      <PageHeader title="Tastings & consultations" sub="The pre-booking diary: tastings, consultations, site visits and calls."
        actions={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New appointment</Button>} />
      <ExampleCard k="tastings" />
      {appts.length === 0 ? (
        <EmptyState icon="fork" title="No appointments in the diary" hint="Log tastings and consultations here — link them to clients and bookings so nothing slips."
          action={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New appointment</Button>} />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg/40">Upcoming · {upcoming.length}</p>
            <div className="space-y-2">{upcoming.map((a) => <Row key={a.id} a={a} />)}
              {upcoming.length === 0 && <p className="text-sm text-fg/45">Nothing scheduled.</p>}</div>
          </div>
          {past.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg/40">Past & closed · {past.length}</p>
              <div className="space-y-2">{past.map((a) => <Row key={a.id} a={a} />)}</div>
            </div>
          )}
        </div>
      )}
      <ApptModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })}
        onSaved={() => { setModal({ open: false, initial: null }); load() }} />
    </div>
  )
}
