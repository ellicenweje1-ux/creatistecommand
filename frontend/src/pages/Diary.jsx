import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { addDaysISO, fmtDate, todayISO } from '../format'
import { Badge, Button, Card, Field, Icon, IconButton, Input, Modal, PageHeader, Select, Spinner, Textarea, Toggle, toast, toastErr } from '../ui'
import ExampleCard from '../examples'
import PencilIn from '../pencil'
import { BookingForm } from './Bookings'

/* Diary — your week, Monday to Sunday: every booking with its time window, plus your own entries
   (a standing lunch service, prep days, days off). The same calculation feeds the public
   "which days are free" calendar on your website, which only ever shows open / limited / full. */
const KINDS = [
  ['busy', 'Time committed', 'A window already taken (another job, a delivery run, a tasting).'],
  ['standing', 'Standing weekly service', 'Repeats every week, e.g. a Monday-to-Friday lunch service.'],
  ['prep', 'Prep day', 'Cooking ahead for an event. Shows as limited on your site.'],
  ['off', 'Day off / holiday', 'Nothing bookable. Shows as full on your site. Add an end date for a run of days.'],
]
const KIND_LABEL = Object.fromEntries(KINDS.map(([k, l]) => [k, l]))
const STATE = { open: ['green', 'Open'], limited: ['amber', 'Limited'], full: ['red', 'Full'] }
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const mondayOf = (iso) => { const d = new Date(`${iso}T00:00:00`); const n = (d.getDay() + 6) % 7; return addDaysISO(iso, -n) }
const blank = (date) => ({ title: '', kind: 'busy', date, end_date: '', start_time: '', end_time: '', repeat: '', weekdays: [0, 1, 2, 3, 4], until: '', notes: '' })
const hhmm = (t) => t ? t.replace(/^(\d{2}):(\d{2}).*/, '$1:$2') : ''

export default function Diary() {
  const [start, setStart] = useState(() => mondayOf(todayISO()))
  const [data, setData] = useState(null)
  const [rules, setRules] = useState(null)
  const [editing, setEditing] = useState(null)   // block form
  const [booking, setBooking] = useState(null)   // {date} → new booking form
  const [pencil, setPencil] = useState(null)     // {date} → quick "pencil in" box
  const [requests, setRequests] = useState([])   // date requests waiting for the chef
  const [savingRules, setSavingRules] = useState(false)
  const today = todayISO()

  const load = async () => {
    try {
      const r = await api.get(`/diary/days?from_date=${start}&to_date=${addDaysISO(start, 55)}`)
      setData(r); if (!rules) setRules(r.rules)
    } catch (e) { toastErr(e) }
  }
  useEffect(() => { load() }, [start]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/holds').then((h) => setRequests(h.filter((x) => x.stage === 'requested'))).catch(() => {}) }, [])

  const byDate = useMemo(() => Object.fromEntries((data?.days || []).map((d) => [d.date, d])), [data])
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(start, i)), [start])
  const ahead = useMemo(() => Array.from({ length: 8 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDaysISO(start, w * 7 + i))), [start])

  const saveRules = async () => {
    setSavingRules(true)
    try { const r = await api.put('/diary/rules', rules); setRules(r); toast('Diary rules saved'); load() } catch (e) { toastErr(e) } finally { setSavingRules(false) }
  }
  const saveBlock = async (form) => {
    const payload = { ...form, weekdays: form.repeat === 'weekly' ? form.weekdays : [], end_date: form.kind === 'off' ? form.end_date : '' }
    try {
      if (form.id) await api.patch(`/diary/blocks/${form.id}`, payload); else await api.post('/diary/blocks', payload)
      toast(form.id ? 'Diary entry updated' : 'Added to your diary'); setEditing(null); load()
    } catch (e) { toastErr(e) }
  }
  const removeBlock = async (b) => {
    if (!window.confirm(`Remove “${b.title || KIND_LABEL[b.kind]}” from your diary?${b.repeat === 'weekly' ? ' This removes every week of it.' : ''}`)) return
    try { await api.del(`/diary/blocks/${b.id}`); toast('Removed (it’s in Recently deleted for 30 days)'); setEditing(null); load() } catch (e) { toastErr(e) }
  }

  if (!data || !rules) return <div className="py-20 text-center"><Spinner /></div>
  const weekLabel = `${fmtDate(start)} – ${fmtDate(addDaysISO(start, 6))}`

  return (
    <div className="space-y-6">
      <PageHeader title="Diary" sub="Your week, Monday to Sunday, with your own time blocked out. The same picture feeds the availability calendar on your website."
        actions={<div className="flex flex-wrap gap-2"><Button icon="plus" onClick={() => setPencil({ date: '' })} data-pencil-open>Pencil in</Button><Button variant="ghost" onClick={() => setEditing(blank(today))}>Block time</Button><Button variant="ghost" icon="calendar" onClick={() => setBooking({ date: today })}>New booking</Button></div>} />
      {requests.length ? (
        <Link to="/app/bookings" className="block rounded-xl border border-copper/50 bg-copper/10 px-4 py-3 text-sm hover:border-copper" data-requests-banner>
          <strong>{requests.length} date {requests.length === 1 ? 'request is' : 'requests are'} waiting for you.</strong> They are already held on your diary. Open Bookings to confirm you are free or say you can’t.
        </Link>
      ) : null}
      <ExampleCard k="diary" />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <IconButton icon="up" label="Previous week" className="-rotate-90" onClick={() => setStart(addDaysISO(start, -7))} />
            <IconButton icon="down" label="Next week" className="-rotate-90" onClick={() => setStart(addDaysISO(start, 7))} />
            <Button size="sm" variant="ghost" onClick={() => setStart(mondayOf(today))}>This week</Button>
            <p className="ml-2 font-display text-lg" data-week-label>{weekLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-fg/70">
            {Object.entries(STATE).map(([k, [tone, label]]) => <span key={k} className="flex items-center gap-1.5"><Badge tone={tone}>{label}</Badge></span>)}
            <span className="text-fg/50">· what your website shows for each day</span>
          </div>
        </div>
      </Card>


      {(() => {
        const used = week.reduce((a, iso) => a + (byDate[iso]?.load || 0), 0)
        const max = rules.week_max || 5
        const pct = Math.min(100, Math.round((used / max) * 100))
        const tone = used >= max ? 'bg-red-400' : used >= max * 0.8 ? 'bg-amber-400' : 'bg-green-500'
        return (
          <Card className="p-4" data-week-meter>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-lg">This week: <span data-week-used>{Number(used.toFixed(2))}</span> of {max} days of work</p>
              <p className="text-xs text-fg/60">{used >= max ? 'You are at your limit. Think twice before promising more.' : `${Number((max - used).toFixed(2))} left before you hit the most you want in a week.`}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-fg/10"><div className={`h-full ${tone}`} style={{ width: `${pct}%` }} /></div>
          </Card>
        )
      })()}

      {/* The week */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7" data-week>
        {week.map((iso, i) => {
          const d = byDate[iso] || { state: 'open', bookings: [], blocks: [], why: [], prep_for: [] }
          const [tone, label] = STATE[d.state] || STATE.open
          const past = iso < today
          return (
            <Card key={iso} pad={false} className={`flex min-h-[220px] flex-col p-3 ${iso === today ? 'ring-1 ring-copper' : ''} ${past ? 'opacity-60' : ''}`} data-day={iso} data-state={d.state}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/50">{DOW[i]}</p>
                  <p className="font-display text-lg leading-tight">{fmtDate(iso).replace(/\s\d{4}$/, '')}</p>
                </div>
                <Badge tone={tone}>{label}</Badge>
              </div>
              {d.workday !== false && d.load > 0 ? <div className="mt-2 h-1.5 overflow-hidden rounded bg-fg/10" title={`${d.load} of a day`}><div className={`h-full ${d.load >= 1 ? 'bg-red-400' : 'bg-copper'}`} style={{ width: `${Math.min(100, d.load * 100)}%` }} /></div> : null}
              {d.why?.length ? <p className="mt-1 text-[11px] text-fg/50">{d.why.join(' · ')}</p> : null}
              <ul className="mt-3 flex-1 space-y-1.5">
                {d.bookings.map((b) => (
                  <li key={`b${b.id}`}>
                    <Link to={`/app/bookings/${b.id}`} className="block rounded border border-copper/40 bg-copper/10 px-2 py-1.5 text-xs hover:border-copper" data-booking>
                      <p className="font-medium leading-snug">{b.title}{b.held ? <span className="ml-1 rounded bg-amber-400/20 px-1 text-[10px] uppercase text-amber-500">held</span> : null}</p>
                      <p className="text-fg/60">{b.kind ? <span className="text-copper">{b.kind} · </span> : null}{b.start_time ? `${hhmm(b.start_time)}${b.end_time ? ` – ${hhmm(b.end_time)}` : ''}` : 'Time not set'}{b.guest_count ? ` · ${b.guest_count} guests` : ''} · {b.status.replace('_', ' ')}</p>
                    </Link>
                  </li>
                ))}
                {d.blocks.map((b) => (
                  <li key={`k${b.id}`}>
                    {b.source === 'calendar' ? (
                      <div className="rounded border border-sky-400/40 bg-sky-400/10 px-2 py-1.5 text-xs" data-calendar-block title="Read from your connected calendar. Change it there.">
                        <p className="font-medium leading-snug">{b.title || 'Busy'}</p>
                        <p className="text-fg/60">{b.start_time ? `${hhmm(b.start_time)}${b.end_time ? ` – ${hhmm(b.end_time)}` : ''}` : 'All day'} · from your calendar</p>
                      </div>
                    ) : (
                    <button type="button" onClick={() => setEditing({ ...blank(iso), ...b, weekdays: b.weekdays || [] })} className={`block w-full rounded border px-2 py-1.5 text-left text-xs hover:border-fg/40 ${b.kind === 'off' ? 'border-red-400/40 bg-red-400/10' : b.kind === 'prep' ? 'border-amber-400/40 bg-amber-400/10' : 'border-line bg-parchment'}`} data-block>
                      <p className="font-medium leading-snug">{b.title || KIND_LABEL[b.kind]}</p>
                      <p className="text-fg/60">{b.start_time ? `${hhmm(b.start_time)}${b.end_time ? ` – ${hhmm(b.end_time)}` : ''}` : 'All day'}{b.repeat === 'weekly' ? ' · weekly' : ''}</p>
                    </button>
                    )}
                  </li>
                ))}
                {d.prep_for?.length ? <li className="rounded border border-dashed border-amber-400/40 px-2 py-1.5 text-[11px] text-fg/60">Prep for: {d.prep_for.join(', ')}</li> : null}
              </ul>
              {!past ? (
                <div className="mt-2 flex flex-col gap-1">
                  <button type="button" onClick={() => setPencil({ date: iso })} className="flex-1 rounded border border-dashed border-copper/50 px-2 py-1 text-[11px] text-copper hover:border-copper" data-add-pencil>+ Pencil in</button>
                  <button type="button" onClick={() => setEditing(blank(iso))} className="flex-1 rounded border border-dashed border-line px-2 py-1 text-[11px] text-fg/60 hover:border-fg/40 hover:text-fg" data-add-block>+ Block time</button>
                  <button type="button" onClick={() => setBooking({ date: iso })} className="flex-1 rounded border border-dashed border-line px-2 py-1 text-[11px] text-fg/60 hover:border-fg/40 hover:text-fg" data-add-booking>+ Booking</button>
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>

      {/* Eight weeks at a glance: exactly what the website shows */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg">The next eight weeks, as your website sees them</p>
            <p className="mt-1 text-sm text-fg/70">Visitors see only open, limited or full for each day. Never a title, a client or a time.</p>
          </div>
          <Badge tone={rules.public ? 'green' : 'gray'}>{rules.public ? 'Showing on your site' : 'Hidden from your site'}</Badge>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead><tr>{DOW.map((d) => <th key={d} className="pb-2 text-left font-semibold text-fg/50">{d}</th>)}</tr></thead>
            <tbody data-ahead>
              {ahead.map((row, w) => (
                <tr key={w}>
                  {row.map((iso) => {
                    const st = byDate[iso]?.state || 'open'
                    const dot = st === 'full' ? 'bg-red-400' : st === 'limited' ? 'bg-amber-400' : 'bg-green-400'
                    return (
                      <td key={iso} className="py-1 pr-3">
                        <button type="button" onClick={() => setStart(mondayOf(iso))} className={`flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-parchment ${iso === today ? 'ring-1 ring-copper' : ''} ${iso < today ? 'opacity-40' : ''}`} data-ahead-day={iso} data-state={st}>
                          <span className={`h-2 w-2 rounded-full ${dot}`} /><span>{fmtDate(iso).replace(/\s\d{4}$/, '')}</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <UndatedInvoices onChanged={load} />

      <RulesCard rules={rules} setRules={setRules} saveRules={saveRules} saving={savingRules} />

      <CalendarCard onChanged={load} />

      <PencilIn open={!!pencil} date={pencil?.date} onClose={() => setPencil(null)} onSaved={() => { setPencil(null); load() }} />
      <BlockModal form={editing} onClose={() => setEditing(null)} onSave={saveBlock} onDelete={removeBlock} />
      <Modal open={!!booking} onClose={() => setBooking(null)} title="New booking" wide>
        {booking ? <BookingForm initial={booking} onClose={() => setBooking(null)} onSaved={() => { setBooking(null); toast('Booking added to your diary'); load() }} /> : null}
      </Modal>
    </div>
  )
}

const SHARES = [[0.25, 'A light slice'], [0.5, 'Half a day'], [0.75, 'Three quarters'], [1, 'A full day, the only booking']]
const BEFORE = [[0, 'Nothing'], [0.25, 'A light slice'], [0.5, 'Half a day'], [0.75, 'Three quarters']]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/* How your days work, in plain words: which days you work, and how much of a day each kind of booking takes. */
function RulesCard({ rules, setRules, saveRules, saving }) {
  const kinds = rules.kinds || []
  const work = rules.work_days || [0, 1, 2, 3, 4, 5]
  const setK = (i, patch) => setRules({ ...rules, kinds: kinds.map((x, n) => (n === i ? { ...x, ...patch } : x)) })
  return (
    <Card className="p-5" data-rules>
      <p className="font-display text-lg">How your days work</p>
      <p className="mt-1 text-sm text-fg/70">Every booking takes a share of a day. A day is full at one whole day. So a morning of batch cooking (half a day) leaves room for a Clean Dream order (half a day), while an in-home day or an event takes the whole day. Held requests and pencilled-in bookings count straight away.</p>
      <div className="mt-5" data-workdays>
        <p className="text-sm font-medium">Days you work</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d, i) => {
            const on = work.includes(i)
            return <button key={d} type="button" onClick={() => setRules({ ...rules, work_days: on ? work.filter((x) => x !== i) : [...work, i].sort() })} aria-pressed={on} data-workday={i}
              className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-copper bg-copper/15 text-copper' : 'border-line text-fg/50'}`}>{d}</button>
          })}
        </div>
        <p className="mt-1 text-xs text-fg/50">Other days show as full, clients can’t request them, and shopping or prep that would land on one moves to the day before.</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="The most days of work you want in a week" hint="The weekly meter turns red here. It warns you; it never blocks."><Input type="number" min={1} max={7} step={0.5} value={rules.week_max} onChange={(e) => setRules({ ...rules, week_max: e.target.value })} data-week-max /></Field>
        <Field label="How far ahead the website shows" hint="Days from today."><Input type="number" min={14} max={365} value={rules.horizon_days} onChange={(e) => setRules({ ...rules, horizon_days: e.target.value })} /></Field>
      </div>
      <div className="mt-6 border-t border-line pt-5" data-kinds>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">How much of a day each kind of booking takes</p>
            <p className="mt-1 text-sm text-fg/70">Bookings are matched by the words in their service or title. You can still change one booking’s share when you pencil it in or edit it (for example a house-share cook that sits alongside a batch drop-off).</p>
          </div>
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setRules({ ...rules, kinds: [...kinds, { id: `kind${Date.now()}`, label: '', match: [], load: 0.5, before1: 0, before2: 0 }] })}>Add a kind</Button>
        </div>
        <div className="mt-4 space-y-3">
          {kinds.map((k, i) => (
            <div key={k.id || i} className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-12 md:items-end" data-kind-row>
              <Field label="Kind" className="md:col-span-3"><Input value={k.label} placeholder="e.g. In-home cooking" onChange={(e) => setK(i, { label: e.target.value })} /></Field>
              <Field label="Matches words" hint="Comma-separated" className="md:col-span-3"><Input value={Array.isArray(k.match) ? k.match.join(', ') : k.match || ''} placeholder="home edit, in-home" onChange={(e) => setK(i, { match: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
              <Field label="On the day" className="md:col-span-2"><Select value={k.load} onChange={(e) => setK(i, { load: Number(e.target.value) })} data-kind-load>{SHARES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Day before (shopping)" className="md:col-span-2"><Select value={k.before1} onChange={(e) => setK(i, { before1: Number(e.target.value) })}>{BEFORE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Two days before (prep)" className="md:col-span-1"><Select value={k.before2} onChange={(e) => setK(i, { before2: Number(e.target.value) })}>{BEFORE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <div className="flex justify-end md:col-span-1"><IconButton icon="trash" label="Remove this kind" onClick={() => setRules({ ...rules, kinds: kinds.filter((_, n) => n !== i) })} /></div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-fg/50">Anything that matches none of these takes half a day. The first match wins, so put the most specific first.</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Toggle checked={!!rules.public} onChange={(v) => setRules({ ...rules, public: v })} label="Show my availability on my website" />
        <Button onClick={saveRules} disabled={saving} data-save-rules>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
      <p className="mt-3 text-xs text-fg/50">Your website reads availability from your enquiry token (Settings → App & integrations), the same one the enquiry form uses.</p>
    </Card>
  )
}

/* Invoice-first, made easy: invoices that were never given a service date don't show in the Diary. One tap each puts them there. */
function UndatedInvoices({ onChanged }) {
  const [rows, setRows] = useState(null)
  const [clients, setClients] = useState([])
  const [draft, setDraft] = useState({})
  const load = () => Promise.all([api.get('/invoices'), api.get('/clients').catch(() => [])]).then(([inv, cl]) => {
    setClients(cl); setRows(inv.filter((i) => !i.service_date && !['void', 'paid'].includes(i.status) && !i.file_url))
  }).catch(() => setRows([]))
  useEffect(() => { load() }, [])
  if (!rows || !rows.length) return null
  const nameOf = (id) => clients.find((c) => c.id === id)?.name || 'No client'
  const save = async (i) => {
    const d = draft[i.id] || {}
    if (!d.date) return toast('Pick the day you are cooking first')
    try {
      await api.patch(`/invoices/${i.id}`, { service_date: d.date, service_type: d.type || i.service_type || '' })
      const r = await api.post(`/invoices/${i.id}/sync-booking`)
      toast(r.ok ? 'In your Diary now' : r.reason); await load(); onChanged()
    } catch (e) { toastErr(e) }
  }
  return (
    <Card className="p-5" data-undated>
      <p className="font-display text-lg">Invoices not in your Diary yet ({rows.length})</p>
      <p className="mt-1 text-sm text-fg/70">These invoices have no service date, so your Diary can’t see the work. Give each the day you are cooking and it counts straight away. New invoices ask for it as you write them.</p>
      <ul className="mt-3 divide-y divide-line">
        {rows.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5" data-undated-row={i.id}>
            <div className="min-w-[10rem] flex-1"><p className="text-sm font-medium">{nameOf(i.client_id)}</p><p className="text-xs text-fg/55">{i.number} · {i.status}</p></div>
            <Input type="date" className="!w-40" value={draft[i.id]?.date || ''} onChange={(e) => setDraft({ ...draft, [i.id]: { ...draft[i.id], date: e.target.value } })} aria-label="Service date" />
            <Input className="!w-44" placeholder="What for? e.g. Batchfully Made" value={draft[i.id]?.type ?? i.service_type ?? ''} onChange={(e) => setDraft({ ...draft, [i.id]: { ...draft[i.id], type: e.target.value } })} aria-label="Service" />
            <Button size="sm" onClick={() => save(i)} data-undated-save>Add to Diary</Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CalendarCard({ onChanged }) {
  const [st, setSt] = useState(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)
  const load = () => api.get('/diary/calendar').then(setSt).catch(toastErr)
  useEffect(() => { load() }, [])
  const act = async (fn, msg) => { setBusy(true); try { const r = await fn(); setSt(r); if (msg) toast(msg); onChanged() } catch (e) { toastErr(e) } finally { setBusy(false) } }
  const ago = (iso) => { if (!iso) return 'not yet'; const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)}h ago` }
  if (!st) return null
  return (
    <Card className="p-5" data-calendar-card>
      <p className="font-display text-lg">Your other calendar</p>
      <p className="mt-1 text-sm text-fg/70">Connect your Google, Apple or Outlook calendar and anything busy in it closes those dates here, and on your website, automatically. A whole-day event closes the day; an event with times makes the day limited. You never have to block the same day twice.</p>
      {st.connected ? (
        <div className="mt-4 space-y-3" data-calendar-connected>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.last_error ? 'amber' : 'green'}>{st.last_error ? 'Needs attention' : 'Connected'}</Badge>
            <span className="text-sm text-fg/70" data-calendar-status>{st.host} · {st.count} {st.count === 1 ? 'busy period' : 'busy periods'} read · updated {ago(st.last_synced)}</span>
          </div>
          {st.last_error ? <p className="text-sm text-amber-500" data-calendar-error>{st.last_error} We keep the dates we last read until it works again.</p> : null}
          <Toggle checked={st.all_day_closes} onChange={(v) => act(() => api.put('/diary/calendar', { all_day_closes: v }), v ? 'All-day events now close the day' : 'All-day events now only make the day limited')} label="An all-day event closes the whole day" />
          <p className="text-xs text-fg/50">Turn this off if your calendar holds things like birthdays or reminders that shouldn’t close a date. Events you’ve marked “free” and cancelled events are always ignored.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => api.post('/diary/calendar/sync'), 'Calendar read')} data-calendar-sync>Read it again now</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm('Disconnect your calendar? The dates it closed will open up again.')) act(() => api.put('/diary/calendar', { url: '' }), 'Calendar disconnected') }} data-calendar-disconnect>Disconnect</Button>
          </div>
        </div>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => api.put('/diary/calendar', { url }), 'Calendar connected').then(() => setUrl('')) }} data-calendar-form>
          <Field label="Your calendar’s private link" hint="Paste the iCal address from your calendar (steps below). Treat it like a password."><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" required /></Field>
          <Button type="submit" disabled={busy || !url.trim()}>{busy ? 'Connecting…' : 'Connect calendar'}</Button>
        </form>
      )}
      <button type="button" onClick={() => setHelp(!help)} className="mt-4 text-xs font-medium text-copper underline-offset-2 hover:underline" data-calendar-help-toggle>{help ? 'Hide the steps' : 'Where do I find this link?'}</button>
      {help ? (
        <div className="mt-3 space-y-3 text-sm text-fg/75" data-calendar-help>
          <div><p className="font-medium">Google Calendar (on a computer)</p><ol className="list-decimal pl-5"><li>Open calendar.google.com, hover your calendar on the left, tap the three dots, then Settings and sharing.</li><li>Scroll to “Integrate calendar” and copy <strong>Secret address in iCal format</strong>.</li><li>Paste it above. (Google can take several hours to show a new event on this link; it is Google’s delay, not ours.)</li></ol></div>
          <div><p className="font-medium">Apple Calendar / iCloud</p><ol className="list-decimal pl-5"><li>In Calendar on a Mac, right-click your calendar and choose Share Calendar, then tick <strong>Public Calendar</strong>.</li><li>Copy the link it shows (it starts with webcal://) and paste it above.</li></ol></div>
          <div><p className="font-medium">Outlook / Microsoft 365</p><ol className="list-decimal pl-5"><li>Outlook on the web: Settings, Calendar, Shared calendars, then Publish a calendar.</li><li>Choose “Can view all details” and copy the <strong>ICS</strong> link.</li></ol></div>
          <p className="text-xs text-fg/50">Tip: if you subscribe to your Command calendar link inside the same calendar, that’s fine. Bookings Command itself exported are ignored here, so nothing is counted twice.</p>
        </div>
      ) : null}
    </Card>
  )
}

function BlockModal({ form, onClose, onSave, onDelete }) {
  const [f, setF] = useState(form)
  useEffect(() => { setF(form) }, [form])
  if (!f) return null
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const toggleDay = (i) => set('weekdays', f.weekdays.includes(i) ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i].sort())
  return (
    <Modal open={!!form} onClose={onClose} title={f.id ? 'Diary entry' : 'Block time in your diary'}
      footer={<div className="flex items-center justify-between gap-2">{f.id ? <Button variant="ghost" icon="trash" onClick={() => onDelete(f)}>Remove</Button> : <span />}<div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(f)} disabled={!f.date}>{f.id ? 'Save' : 'Add to diary'}</Button></div></div>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(f) }} data-block-form>
        <Field label="What is it?">
          <Select value={f.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <p className="mt-1 text-xs text-fg/50">{KINDS.find(([k]) => k === f.kind)?.[2]}</p>
        </Field>
        <Field label="Title (optional)"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={f.kind === 'standing' ? 'e.g. Clean Dream lunch service' : f.kind === 'prep' ? 'e.g. Prep for Sunday drop-offs' : f.kind === 'off' ? 'e.g. Holiday' : 'e.g. Delivery run'} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={f.repeat === 'weekly' ? 'From' : 'Date'}><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} required /></Field>
          {f.kind === 'off' && f.repeat !== 'weekly' ? <Field label="Until (for a run of days)"><Input type="date" value={f.end_date} min={f.date} onChange={(e) => set('end_date', e.target.value)} /></Field> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From (time)" hint="Leave blank for all day"><Input type="time" value={f.start_time} onChange={(e) => set('start_time', e.target.value)} /></Field>
          <Field label="To (time)"><Input type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} /></Field>
        </div>
        <div className="rounded border border-line p-3">
          <Toggle checked={f.repeat === 'weekly'} onChange={(v) => set('repeat', v ? 'weekly' : '')} label="Repeats every week" />
          {f.repeat === 'weekly' ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1.5" data-weekdays>
                {DOW.map((d, i) => <button key={d} type="button" onClick={() => toggleDay(i)} className={`rounded-full border px-3 py-1 text-xs ${f.weekdays.includes(i) ? 'border-copper bg-copper/20 text-fg' : 'border-line text-fg/60'}`} aria-pressed={f.weekdays.includes(i)}>{d}</button>)}
              </div>
              <Field label="Until (optional)"><Input type="date" value={f.until} min={f.date} onChange={(e) => set('until', e.target.value)} /></Field>
            </div>
          ) : null}
        </div>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  )
}
