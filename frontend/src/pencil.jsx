import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { Button, ComboInput, Field, Input, Modal, Select, toast, toastErr } from './ui'
import { fmtDate } from './format'

/* "Pencil in": the notepad line. Who, which day, what for. It counts on your calendar the moment you save, and tells you
   straight away whether the day can take it. Replaces writing a promise down: an invoice for the same client and day
   later adopts it instead of doubling up. */
const SERVICES = ['Batchfully Made', 'The Home Edit', 'Sorted & Served', 'Clean Dream', 'Private catering', 'The Loaded Bar', 'Corporate Curations', 'Private & Personal', 'The Creatiste Table']
const LOADS = [['', 'As usual for this service'], ['0.25', 'A light slice'], ['0.5', 'Half a day'], ['1', 'The whole day, my only booking']]

export default function PencilIn({ open, date, onClose, onSaved }) {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [f, setF] = useState({ name: '', date: '', service: 'Batchfully Made', load: '', note: '' })
  const [chk, setChk] = useState(null)
  const [busy, setBusy] = useState(false)
  const services = useMemo(() => [...new Set([...(user?.services || []), ...SERVICES])], [user])
  useEffect(() => {
    if (!open) return
    setF({ name: '', date: date || '', service: 'Batchfully Made', load: '', note: '' }); setChk(null)
    api.get('/clients').then(setClients).catch(() => {})
  }, [open, date])
  useEffect(() => {
    if (!open || !f.date) { setChk(null); return undefined }
    const t = setTimeout(() => api.get(`/diary/check?date=${f.date}&service=${encodeURIComponent(f.service)}&load=${f.load || 0}`).then(setChk).catch(() => setChk(null)), 250)
    return () => clearTimeout(t)
  }, [open, f.date, f.service, f.load])
  const client = clients.find((c) => c.name.toLowerCase() === f.name.trim().toLowerCase())
  const save = async (e) => {
    e.preventDefault()
    if (chk && !chk.fits && !window.confirm(`${chk.message}\n\nPencil it in anyway?`)) return
    setBusy(true)
    try {
      const b = await api.post('/bookings', {
        title: `${f.name.trim()} · ${f.service}`, event_type: f.service, date: f.date, status: 'quoted', client_id: client ? client.id : null,
        day_load: Number(f.load) || 0, notes: `Pencilled in.${f.note.trim() ? ` ${f.note.trim()}` : ''}`,
      })
      toast(`Pencilled in for ${fmtDate(f.date)}. It's on your calendar now.`)
      onSaved?.(b)
    } catch (err) { toastErr(err) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Pencil in a booking">
      <form className="space-y-4" onSubmit={save} data-pencil-form>
        <p className="text-sm text-fg/70">The quick version of writing it on your notepad. It holds the day straight away; invoice them later and it joins up on its own.</p>
        <Field label="Who is it for?">
          <ComboInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} options={clients.map((c) => c.name)} placeholder="Client name" required data-pencil-name />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Which day?"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required data-pencil-date /></Field>
          <Field label="What for?">
            <ComboInput value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} options={services} data-pencil-service />
          </Field>
        </div>
        <Field label="How much of the day?"><Select value={f.load} onChange={(e) => setF({ ...f, load: e.target.value })} data-pencil-load>{LOADS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        {chk ? (
          <div className={`rounded-lg border px-3 py-2 text-sm ${chk.fits ? 'border-green-500/40 bg-green-500/10' : 'border-red-400/50 bg-red-400/10'}`} data-pencil-check data-fits={chk.fits ? 'yes' : 'no'}>
            <strong>{chk.fits ? '✓ ' : '✗ '}</strong>{chk.message}
          </div>
        ) : null}
        <Field label="Note (optional)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. weekly, collects at 1pm" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Not yet</Button><Button type="submit" disabled={busy || !f.name.trim() || !f.date}>{busy ? 'Saving…' : 'Pencil it in'}</Button></div>
      </form>
    </Modal>
  )
}
