import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { cls, fmtDate, todayISO, uid } from '../format'
import { BookingPicker, listShops, stopsFromLists } from '../prep'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, Select, Spinner, toast, toastErr } from '../ui'

export function gmapsUrl(route) {
  const points = [route.start_location, ...(route.stops || []).map((s) => s.address || s.name)].filter(Boolean)
  if (points.length < 2) return null
  return `https://www.google.com/maps/dir/${points.map((p) => encodeURIComponent(p)).join('/')}`
}

export function NewRouteModal({ open, onClose, onCreated, bookingId = null, defaultDate = '', bookings = [] }) {
  const [form, setForm] = useState({ title: '', date: '', start_location: '' })
  const [picked, setPicked] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  useEffect(() => { if (open) { setForm({ title: '', date: defaultDate || todayISO(), start_location: '' }); setPicked(''); setTitleTouched(false) } }, [open, defaultDate])
  const showPicker = !bookingId && bookings.length > 0
  const choose = (val, bk) => {
    setPicked(val)
    if (bk) setForm((f) => ({ ...f, date: bk.date || f.date, title: titleTouched ? f.title : `${bk.title} — prep run` }))
  }
  const create = (e) => {
    e.preventDefault()
    api.post('/routes', { ...form, booking_id: bookingId || picked || null, stops: [] }).then(onCreated).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title="New route plan">
      <form onSubmit={create} className="space-y-4">
        {showPicker && <BookingPicker bookings={bookings} value={picked} onChange={choose} hint="Pick the event this run is for — fills in the date." />}
        <Field label="Title"><Input value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setTitleTouched(true) }} placeholder="Saturday prep-day run" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Start from"><Input value={form.start_location} onChange={(e) => setForm({ ...form, start_location: e.target.value })} placeholder="Home kitchen, SE15" /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Create route</Button></div>
      </form>
    </Modal>
  )
}

export function RouteEditor({ route, onChanged, onDeleted }) {
  const [draft, setDraft] = useState({ name: '', address: '', purpose: '', eta: '' })
  const [suppliers, setSuppliers] = useState([])
  const [lists, setLists] = useState([])
  useEffect(() => {
    api.get('/suppliers').then(setSuppliers).catch(() => {})
    api.get('/shopping').then(setLists).catch(() => {})
  }, [])
  const stops = [...(route.stops || [])].sort((a, b) => (a.order || 0) - (b.order || 0))

  const saveStops = (next) =>
    api.patch(`/routes/${route.id}`, { stops: next.map((s, i) => ({ ...s, order: i + 1 })) }).then(onChanged).catch(toastErr)

  // Turn a saved shopping list into stops: one per shop, address pulled from the
  // matching supplier, skipping shops already on the route.
  const listsWithShops = lists.filter((l) => listShops(l).length)
  const addFromList = (listId) => {
    const list = lists.find((l) => String(l.id) === String(listId))
    if (!list) return
    const toAdd = stopsFromLists(list, suppliers, stops)
    if (!toAdd.length) { toast('Those shops are already stops (or the list has no shops set).', 'amber'); return }
    saveStops([...stops, ...toAdd])
    toast(`Added ${toAdd.length} stop${toAdd.length > 1 ? 's' : ''} from “${list.title}”`, 'sage')
  }

  const addStop = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    saveStops([...stops, { id: uid(), ...draft, duration_min: 0, note: '', done: false }])
    setDraft({ name: '', address: '', purpose: '', eta: '' })
  }
  const move = (i, dir) => {
    const next = [...stops]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    saveStops(next)
  }
  const toggleDone = (id) => saveStops(stops.map((s) => (s.id === id ? { ...s, done: !s.done } : s)))
  const removeStop = (id) => saveStops(stops.filter((s) => s.id !== id))
  const removeRoute = () => { if (window.confirm('Delete this route plan?')) api.del(`/routes/${route.id}`).then(onDeleted).catch(toastErr) }
  const maps = gmapsUrl(route)

  return (
    <Card pad={false}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
        <div>
          <h3 className="font-display font-semibold">{route.title}</h3>
          <p className="text-xs text-fg/50">{route.date ? fmtDate(route.date) : 'No date'}{route.start_location ? ` · from ${route.start_location}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {maps && (
            <a href={maps} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" icon="map">Open in Google Maps</Button>
            </a>
          )}
          <IconButton icon="trash" label="Delete route" onClick={removeRoute} />
        </div>
      </header>
      <div className="px-4 py-3">
        {listsWithShops.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <Icon name="cart" size={14} className="shrink-0 text-copper" />
            <Select value="" onChange={(e) => e.target.value && addFromList(e.target.value)} className="max-w-xs text-sm">
              <option value="">Add stops from a shopping list…</option>
              {listsWithShops.map((l) => (
                <option key={l.id} value={l.id}>{l.title} · {listShops(l).length} shop{listShops(l).length > 1 ? 's' : ''}</option>
              ))}
            </Select>
          </div>
        )}
        {stops.length === 0 && <p className="pb-2 text-sm text-fg/45">No stops yet — add your first stop below, or pull them from a shopping list above.</p>}
        <ol className="space-y-1.5">
          {stops.map((s, i) => (
            <li key={s.id} className={cls('group flex items-center gap-3 rounded-lg border border-line/70 bg-parchment/30 px-3 py-2', s.done && 'opacity-55')}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xs font-semibold text-cream">{i + 1}</span>
              <button onClick={() => toggleDone(s.id)}
                className={cls('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', s.done ? 'border-sage bg-sage text-white' : 'border-fg/25 bg-card')}>
                {s.done && <Icon name="check" size={12} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cls('truncate text-sm font-medium', s.done && 'line-through')}>{s.name}</p>
                <p className="truncate text-xs text-fg/50">{[s.purpose, s.address].filter(Boolean).join(' · ')}</p>
              </div>
              {s.eta && <Badge tone="copper">{s.eta}</Badge>}
              <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                <IconButton icon="up" label="Move up" onClick={() => move(i, -1)} />
                <IconButton icon="down" label="Move down" onClick={() => move(i, 1)} />
                <IconButton icon="trash" label="Remove stop" onClick={() => removeStop(s.id)} />
              </div>
            </li>
          ))}
        </ol>
        <form onSubmit={addStop} className="mt-3 grid grid-cols-12 gap-1.5">
          <Input className="col-span-6 sm:col-span-3" placeholder="Stop name" list={`stops-${route.id}`} value={draft.name}
            onChange={(e) => {
              const v = e.target.value
              const match = suppliers.find((s) => s.name === v)
              setDraft({ ...draft, name: v, address: !draft.address && match?.address ? match.address : draft.address })
            }} />
          <Input className="col-span-6 sm:col-span-4" placeholder="Address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          <Input className="col-span-6 sm:col-span-2" placeholder="Purpose" value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
          <Input type="time" className="col-span-3 sm:col-span-1" value={draft.eta} onChange={(e) => setDraft({ ...draft, eta: e.target.value })} />
          <Button className="col-span-3 sm:col-span-2" size="sm" icon="plus">Add stop</Button>
          <datalist id={`stops-${route.id}`}>{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        </form>
        {route.notes && <p className="mt-3 text-xs text-fg/50">📝 {route.notes}</p>}
      </div>
    </Card>
  )
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState(null)
  const [bookings, setBookings] = useState([])
  const [creating, setCreating] = useState(false)
  const load = () => api.get('/routes').then(setRoutes).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!routes) return <Spinner />
  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title

  return (
    <div>
      <PageHeader title="Route planner" sub="Which stops, in which order — market runs without the zigzag."
        actions={<Button icon="plus" onClick={() => setCreating(true)}>New route</Button>} />
      {routes.length === 0 ? (
        <EmptyState icon="map" title="No routes planned" hint="Plan prep-day and service-day runs: every stop ordered, timed, and openable in Google Maps."
          action={<Button icon="plus" onClick={() => setCreating(true)}>New route</Button>} />
      ) : (
        <div className="space-y-4">
          {routes.map((r) => (
            <div key={r.id}>
              {r.booking_id && bookingTitle(r.booking_id) && (
                <Link to={`/app/bookings/${r.booking_id}`} className="mb-1 inline-block text-[11px] font-medium text-copper">↳ {bookingTitle(r.booking_id)}</Link>
              )}
              <RouteEditor route={r} onChanged={load} onDeleted={load} />
            </div>
          ))}
        </div>
      )}
      <NewRouteModal open={creating} bookings={bookings} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />
    </div>
  )
}
