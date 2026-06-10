import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { BOOKING_TONES, cls, fmtDate, label, todayISO } from '../format'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, SearchInput, Spinner, Stars, Textarea, toastErr } from '../ui'

function ClientModal({ open, onClose, onSaved, initial = null }) {
  const blank = { name: '', email: '', phone: '', company: '', address: '', dietary: [], allergies: '', likes: '', dislikes: '', tags: [], notes: '' }
  const [form, setForm] = useState(blank)
  const [dietaryText, setDietaryText] = useState('')
  const [tagText, setTagText] = useState('')
  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...blank, ...initial } : blank)
    setDietaryText(initial?.dietary?.join(', ') || '')
    setTagText(initial?.tags?.join(', ') || '')
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      dietary: dietaryText.split(',').map((t) => t.trim()).filter(Boolean),
      tags: tagText.split(',').map((t) => t.trim()).filter(Boolean),
    }
    const req = initial?.id ? api.patch(`/clients/${initial.id}`, payload) : api.post('/clients', payload)
    req.then(onSaved).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit client' : 'New client'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Name"><Input value={form.name} onChange={set('name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company"><Input value={form.company} onChange={set('company')} /></Field>
          <Field label="Tags (comma-separated)"><Input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="repeat, VIP" /></Field>
        </div>
        <Field label="Address"><Input value={form.address} onChange={set('address')} /></Field>
        <Field label="Dietary (comma-separated)"><Input value={dietaryText} onChange={(e) => setDietaryText(e.target.value)} placeholder="vegetarian, halal" /></Field>
        <Field label="Allergies"><Input value={form.allergies} onChange={set('allergies')} placeholder="Shellfish (strict)" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Likes"><Textarea rows={2} value={form.likes} onChange={set('likes')} /></Field>
          <Field label="Dislikes"><Textarea rows={2} value={form.dislikes} onChange={set('dislikes')} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>{initial?.id ? 'Save' : 'Add client'}</Button></div>
      </form>
    </Modal>
  )
}

function ClientDetail({ client, onEdit, onChanged }) {
  const [reviews, setReviews] = useState([])
  const [bookings, setBookings] = useState([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', date: todayISO() })

  const loadExtras = () => {
    api.get(`/clients/${client.id}/reviews`).then(setReviews).catch(() => {})
    api.get(`/bookings?client_id=${client.id}`).then(setBookings).catch(() => {})
  }
  useEffect(loadExtras, [client.id])

  const addReview = (e) => {
    e.preventDefault()
    api.post(`/clients/${client.id}/reviews`, reviewForm)
      .then(() => { setReviewForm({ rating: 5, comment: '', date: todayISO() }); loadExtras() }).catch(toastErr)
  }
  const removeClient = () => {
    if (window.confirm(`Delete ${client.name}? Their bookings stay but lose the link.`))
      api.del(`/clients/${client.id}`).then(onChanged).catch(toastErr)
  }
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : null

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{client.name}</h2>
            {client.company && <p className="text-sm text-ink/55">{client.company}</p>}
            <div className="mt-2 space-y-1 text-sm text-ink/65">
              {client.phone && <p><Icon name="phone" size={13} className="mr-1.5 inline text-ink/35" />{client.phone}</p>}
              {client.email && <p><Icon name="mail" size={13} className="mr-1.5 inline text-ink/35" />{client.email}</p>}
              {client.address && <p><Icon name="pin" size={13} className="mr-1.5 inline text-ink/35" />{client.address}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1">
              <IconButton icon="edit" label="Edit" onClick={onEdit} />
              <IconButton icon="trash" label="Delete" onClick={removeClient} />
            </div>
            {avg && <div className="flex items-center gap-1.5 text-sm"><Stars value={Math.round(avg)} /><span className="font-medium">{avg}</span></div>}
            {bookings.length > 1 && <Badge tone="copper">repeat ×{bookings.length}</Badge>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(client.tags || []).map((t) => <Badge key={t} tone="ink">{t}</Badge>)}
          {(client.dietary || []).map((d) => <Badge key={d} tone="sage">{d}</Badge>)}
        </div>
        {client.allergies && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">⚠ Allergies: {client.allergies}</p>}
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {client.likes && <div><p className="label">Loves</p><p className="text-ink/70">{client.likes}</p></div>}
          {client.dislikes && <div><p className="label">Avoid</p><p className="text-ink/70">{client.dislikes}</p></div>}
        </div>
        {client.notes && <p className="mt-3 border-t border-line/60 pt-3 text-sm text-ink/60">{client.notes}</p>}
      </Card>

      <Card title={`Bookings (${bookings.length})`} pad={false}>
        {bookings.length === 0 ? <p className="p-4 text-sm text-ink/45">No bookings yet for this client.</p> : (
          <ul className="divide-y divide-line/70">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link to={`/app/bookings/${b.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-parchment/40">
                  <div><p className="text-sm font-medium">{b.title}</p><p className="text-xs text-ink/45">{fmtDate(b.date)} · {b.guest_count} guests</p></div>
                  <Badge tone={BOOKING_TONES[b.status]}>{label(b.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Reviews (${reviews.length})`}>
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-parchment/30 p-3">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                <div className="flex items-center gap-2 text-xs text-ink/45">
                  {r.date && fmtDate(r.date)}
                  <IconButton icon="trash" label="Delete review" onClick={() => api.del(`/clients/${client.id}/reviews/${r.id}`).then(loadExtras).catch(toastErr)} />
                </div>
              </div>
              {r.comment && <p className="mt-1.5 text-sm text-ink/70">"{r.comment}"</p>}
            </div>
          ))}
          <form onSubmit={addReview} className="rounded-lg border border-dashed border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <Stars value={reviewForm.rating} onChange={(rating) => setReviewForm({ ...reviewForm, rating })} />
              <Input type="date" className="!w-40" value={reviewForm.date} onChange={(e) => setReviewForm({ ...reviewForm, date: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Input placeholder="What did they say?" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} />
              <Button size="sm">Add</Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}

export default function Clients() {
  const [clients, setClients] = useState(null)
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState({ open: false, initial: null })

  const load = () => api.get('/clients').then(setClients).catch(toastErr)
  useEffect(load, [])
  if (!clients) return <Spinner />

  const visible = q ? clients.filter((c) => `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(q.toLowerCase())) : clients
  const selected = clients.find((c) => c.id === selectedId) || visible[0]

  return (
    <div>
      <PageHeader title="Clients" sub="Preferences, allergies, reviews and repeat history."
        actions={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New client</Button>} />
      {clients.length === 0 ? (
        <EmptyState icon="users" title="No clients yet" hint="Add clients to track their tastes, allergies and reviews across bookings."
          action={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New client</Button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <SearchInput value={q} onChange={setQ} className="mb-3" />
            <div className="space-y-1.5">
              {visible.map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={cls('flex w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left shadow-card transition-all',
                    selected?.id === c.id ? 'border-copper ring-1 ring-copper/30' : 'border-line hover:border-copper/40')}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-cream">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-ink/45">{c.company || c.email || c.phone || '—'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            {selected ? (
              <ClientDetail client={selected} onEdit={() => setModal({ open: true, initial: selected })}
                onChanged={() => { setSelectedId(null); load() }} />
            ) : <EmptyState icon="users" title="Select a client" />}
          </div>
        </div>
      )}
      <ClientModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })}
        onSaved={(c) => { setModal({ open: false, initial: null }); setSelectedId(c?.id || selectedId); load() }} />
    </div>
  )
}
