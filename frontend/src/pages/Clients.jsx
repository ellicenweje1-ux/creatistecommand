import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { BOOKING_TONES, cls, fmtDate, label, todayISO } from '../format'
import { ContactClient } from '../contact'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, SearchInput, Spinner, Stars, Textarea, toast, toastErr } from '../ui'
import ExampleCard from '../examples'

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
            {client.company && <p className="text-sm text-fg/55">{client.company}</p>}
            <div className="mt-2 space-y-1 text-sm text-fg/65">
              {client.phone && <p><Icon name="phone" size={13} className="mr-1.5 inline text-fg/35" />{client.phone}</p>}
              {client.email && <p><Icon name="mail" size={13} className="mr-1.5 inline text-fg/35" />{client.email}</p>}
              {client.address && <p><Icon name="pin" size={13} className="mr-1.5 inline text-fg/35" />{client.address}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1">
              <IconButton icon="edit" label="Edit" onClick={onEdit} />
              <IconButton icon="trash" label="Delete" onClick={removeClient} />
            </div>
            <ContactClient client={client} />
            {avg && <div className="flex items-center gap-1.5 text-sm"><Stars value={Math.round(avg)} /><span className="font-medium">{avg}</span></div>}
            {bookings.length > 1 && <Badge tone="copper">repeat ×{bookings.length}</Badge>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(client.tags || []).map((t) => <Badge key={t} tone="ink">{t}</Badge>)}
          {(client.dietary || []).map((d) => <Badge key={d} tone="sage">{d}</Badge>)}
        </div>
        {client.allergies && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">⚠ Allergies: {client.allergies}</p>}
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {client.likes && <div><p className="label">Loves</p><p className="text-fg/70">{client.likes}</p></div>}
          {client.dislikes && <div><p className="label">Avoid</p><p className="text-fg/70">{client.dislikes}</p></div>}
        </div>
        {client.notes && <p className="mt-3 border-t border-line/60 pt-3 text-sm text-fg/60">{client.notes}</p>}
      </Card>

      <Card title={`Bookings (${bookings.length})`} pad={false}>
        {bookings.length === 0 ? <p className="p-4 text-sm text-fg/45">No bookings yet for this client.</p> : (
          <ul className="divide-y divide-line/70">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link to={`/app/bookings/${b.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-parchment/40">
                  <div><p className="text-sm font-medium">{b.title}</p><p className="text-xs text-fg/45">{fmtDate(b.date)} · {b.guest_count} guests</p></div>
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
                <div className="flex items-center gap-2 text-xs text-fg/45">
                  {r.date && fmtDate(r.date)}
                  <IconButton icon="trash" label="Delete review" onClick={() => api.del(`/clients/${client.id}/reviews/${r.id}`).then(loadExtras).catch(toastErr)} />
                </div>
              </div>
              {r.comment && <p className="mt-1.5 text-sm text-fg/70">"{r.comment}"</p>}
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

/* ------------------------------- CSV import -------------------------------- */
/* Tiny CSV parser: quoted fields, "" escapes, CRLF. Auto-detects the delimiter —
   European Excel exports use ; instead of , (e.g. Dutch locales). */
function parseCsv(text) {
  const firstLine = text.slice(0, text.indexOf('\n') + 1 || text.length)
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

// Recognised header names per client field (English + Dutch, case-insensitive).
const IMPORT_FIELDS = [
  ['name', ['name', 'client', 'client name', 'full name', 'contact', 'naam']],
  ['email', ['email', 'e-mail', 'mail', 'email address', 'e-mailadres']],
  ['phone', ['phone', 'mobile', 'tel', 'telephone', 'phone number', 'number', 'telefoon', 'mobiel']],
  ['company', ['company', 'business', 'organisation', 'organization', 'bedrijf']],
  ['address', ['address', 'location', 'adres']],
  ['allergies', ['allergies', 'allergy', 'allergens', 'allergieën', 'allergenen']],
  ['likes', ['likes', 'preferences', 'favourites', 'favorites']],
  ['dislikes', ['dislikes', 'avoid']],
  ['notes', ['notes', 'note', 'comments', 'remarks', 'opmerkingen']],
]

function ImportClientsModal({ open, onClose, existing, onDone }) {
  const [rows, setRows] = useState(null)       // [{name, email, …}] parsed + mapped
  const [mapped, setMapped] = useState([])     // which of our fields were found
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null) // {done, total} while importing
  const reset = () => { setRows(null); setMapped([]); setError(''); setProgress(null) }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result || ''))
      if (parsed.length < 2) { setError('That file looks empty — it needs a header row plus at least one client.'); return }
      const headers = parsed[0].map((h) => h.trim().toLowerCase())
      const colFor = {}
      IMPORT_FIELDS.forEach(([field, names]) => {
        const idx = headers.findIndex((h) => names.includes(h))
        if (idx !== -1) colFor[field] = idx
      })
      if (colFor.name === undefined) {
        setError('Couldn’t find a name column. Make sure the first row is headers and one of them is called “Name” (or “Client”).')
        return
      }
      setError('')
      setMapped(Object.keys(colFor))
      setRows(parsed.slice(1).map((r) => {
        const rec = {}
        Object.entries(colFor).forEach(([field, idx]) => { rec[field] = (r[idx] || '').trim() })
        return rec
      }).filter((r) => r.name))
    }
    reader.readAsText(file)
    e.target.value = '' // same file can be re-picked
  }

  const doImport = async () => {
    const have = new Set(existing.flatMap((c) => [
      c.name.trim().toLowerCase(),
      ...(c.email ? [c.email.trim().toLowerCase()] : []),
    ]))
    let imported = 0, skipped = 0
    setProgress({ done: 0, total: rows.length })
    for (const [i, r] of rows.entries()) {
      const dup = have.has(r.name.toLowerCase()) || (r.email && have.has(r.email.toLowerCase()))
      if (dup) skipped++
      else {
        try {
          await api.post('/clients', r)
          have.add(r.name.toLowerCase()); if (r.email) have.add(r.email.toLowerCase())
          imported++
        } catch { skipped++ }
      }
      setProgress({ done: i + 1, total: rows.length })
    }
    toast(`Imported ${imported} client${imported === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped (already in your list)` : ''}`, 'sage')
    reset(); onDone()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Import clients from a spreadsheet">
      <div className="space-y-4">
        <p className="text-sm text-fg/60">
          Upload a CSV file — from Excel or Google Sheets use <span className="font-medium">File → Download → CSV</span>.
          The first row should be headers; a <span className="font-medium">Name</span> column is required, and
          Email, Phone, Company, Address, Allergies and Notes come along when present. Clients already in your
          list (same name or email) are skipped, never duplicated.
        </p>
        {!rows && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line p-8 text-sm text-fg/55 transition-colors hover:border-copper/50 hover:text-copper">
            <Icon name="up" size={22} />
            Choose a .csv file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
        )}
        {error && <p className="rounded-lg border border-red-300/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
        {rows && (
          <div>
            <p className="text-sm font-medium">{rows.length} client{rows.length === 1 ? '' : 's'} found</p>
            <p className="mt-0.5 text-xs text-fg/50">Columns matched: {mapped.join(' · ')}</p>
            <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-line/60">
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium">{r.name}</td>
                      <td className="px-3 py-1.5 text-fg/55">{r.email || r.phone || '—'}</td>
                      <td className="px-3 py-1.5 text-fg/55">{r.company || r.allergies || ''}</td>
                    </tr>
                  ))}
                  {rows.length > 8 && <tr><td colSpan={3} className="px-3 py-1.5 text-fg/45">…and {rows.length - 8} more</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" className="text-xs text-fg/45 hover:text-fg/70" onClick={reset}>← Pick a different file</button>
              <Button icon="up" disabled={!!progress} onClick={doImport}>
                {progress ? `Importing ${progress.done}/${progress.total}…` : `Import ${rows.length} client${rows.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function Clients() {
  const [clients, setClients] = useState(null)
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState({ open: false, initial: null })
  const [importOpen, setImportOpen] = useState(false)

  const load = () => api.get('/clients').then(setClients).catch(toastErr)
  useEffect(load, [])
  if (!clients) return <Spinner />

  const visible = q ? clients.filter((c) => `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(q.toLowerCase())) : clients
  const selected = clients.find((c) => c.id === selectedId) || visible[0]

  return (
    <div>
      <PageHeader title="Clients" sub="Preferences, allergies, reviews and repeat history."
        actions={
          <>
            {clients.length > 0 && <Button variant="secondary" icon="down" onClick={() => api.download('/exports/clients.csv', 'creatiste-clients.csv').catch(toastErr)}>Export</Button>}
            <Button variant="secondary" icon="up" onClick={() => setImportOpen(true)}>Import</Button>
            <Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New client</Button>
          </>
        } />
      <ExampleCard k="clients" />
      {clients.length === 0 ? (
        <EmptyState icon="users" title="No clients yet" hint="Add clients to track their tastes, allergies and reviews across bookings — or import your existing list from a spreadsheet."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New client</Button>
              <Button variant="secondary" icon="up" onClick={() => setImportOpen(true)}>Import a CSV</Button>
            </div>
          } />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <SearchInput value={q} onChange={setQ} className="mb-3" />
            <div className="space-y-1.5">
              {visible.map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={cls('flex w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-left shadow-card transition-all',
                    selected?.id === c.id ? 'border-copper ring-1 ring-copper/30' : 'border-line hover:border-copper/40')}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-cream">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-fg/45">{c.company || c.email || c.phone || '—'}</span>
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
      <ImportClientsModal open={importOpen} existing={clients} onClose={() => setImportOpen(false)}
        onDone={() => { setImportOpen(false); load() }} />
    </div>
  )
}
