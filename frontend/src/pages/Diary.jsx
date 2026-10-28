import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { addDaysISO, fmtDate, todayISO } from '../format'
import { Badge, Button, Card, Field, Icon, IconButton, Input, Modal, PageHeader, Select, Spinner, Textarea, Toggle, toast, toastErr } from '../ui'
import ExampleCard from '../examples'
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
  const [savingRules, setSavingRules] = useState(false)
  const today = todayISO()

  const load = async () => {
    try {
      const r = await api.get(`/diary/days?from_date=${start}&to_date=${addDaysISO(start, 55)}`)
      setData(r); if (!rules) setRules(r.rules)
    } catch (e) { toastErr(e) }
  }
  useEffect(() => { load() }, [start]) // eslint-disable-line react-hooks/exhaustive-deps

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
        actions={<div className="flex gap-2"><Button variant="ghost" icon="plus" onClick={() => setEditing(blank(today))}>Block time</Button><Button icon="calendar" onClick={() => setBooking({ date: today })}>New booking</Button></div>} />
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
              {d.why?.length ? <p className="mt-1 text-[11px] text-fg/50">{d.why.join(' · ')}</p> : null}
              <ul className="mt-3 flex-1 space-y-1.5">
                {d.bookings.map((b) => (
                  <li key={`b${b.id}`}>
                    <Link to={`/app/bookings/${b.id}`} className="block rounded border border-copper/40 bg-copper/10 px-2 py-1.5 text-xs hover:border-copper" data-booking>
                      <p className="font-medium leading-snug">{b.title}</p>
                      <p className="text-fg/60">{b.kind ? <span className="text-copper">{b.kind} · </span> : null}{b.start_time ? `${hhmm(b.start_time)}${b.end_time ? ` – ${hhmm(b.end_time)}` : ''}` : 'Time not set'}{b.guest_count ? ` · ${b.guest_count} guests` : ''} · {b.status.replace('_', ' ')}</p>
                    </Link>
                  </li>
                ))}
                {d.blocks.map((b) => (
                  <li key={`k${b.id}`}>
                    <button type="button" onClick={() => setEditing({ ...blank(iso), ...b, weekdays: b.weekdays || [] })} className={`block w-full rounded border px-2 py-1.5 text-left text-xs hover:border-fg/40 ${b.kind === 'off' ? 'border-red-400/40 bg-red-400/10' : b.kind === 'prep' ? 'border-amber-400/40 bg-amber-400/10' : 'border-line bg-parchment'}`} data-block>
                      <p className="font-medium leading-snug">{b.title || KIND_LABEL[b.kind]}</p>
                      <p className="text-fg/60">{b.start_time ? `${hhmm(b.start_time)}${b.end_time ? ` – ${hhmm(b.end_time)}` : ''}` : 'All day'}{b.repeat === 'weekly' ? ' · weekly' : ''}</p>
                    </button>
                  </li>
                ))}
                {d.prep_for?.length ? <li className="rounded border border-dashed border-amber-400/40 px-2 py-1.5 text-[11px] text-fg/60">Prep for: {d.prep_for.join(', ')}</li> : null}
              </ul>
              {!past ? (
                <div className="mt-2 flex gap-1">
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

      {/* Rules */}
      <Card className="p-5" data-rules>
        <p className="font-display text-lg">How a day fills up</p>
        <p className="mt-1 text-sm text-fg/70">Bookings that are quoted, confirmed or in prep count towards a day. Enquiries don’t. Days off are always full; a standing service or a prep day makes a day limited (a slot may still be possible, so the site invites people to ask).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Bookings a day can hold, all types together" hint="Once a day has this many, it shows as full."><Input type="number" min={1} max={20} value={rules.max_per_day} onChange={(e) => setRules({ ...rules, max_per_day: e.target.value })} /></Field>
          <Field label="Prep days before a confirmed booking (default)" hint="Kept as limited. A booking type below can set its own."><Input type="number" min={0} max={14} value={rules.prep_days} onChange={(e) => setRules({ ...rules, prep_days: e.target.value })} /></Field>
          <Field label="How far ahead the website shows" hint="Days from today."><Input type="number" min={14} max={365} value={rules.horizon_days} onChange={(e) => setRules({ ...rules, horizon_days: e.target.value })} /></Field>
        </div>
        <div className="mt-6 border-t border-line pt-5" data-kinds>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">Rules by booking type</p>
              <p className="mt-1 text-sm text-fg/70">Each booking is matched to a type by the words in its event type or title (the enquiry form fills these in, so “Personal Chef Services · Batchfully Made” lands under Personal chef). Set how many of each type a day can hold, how many prep days each needs, and whether one booking of that type takes the whole day.</p>
            </div>
            <Button size="sm" variant="ghost" icon="plus" onClick={() => setRules({ ...rules, kinds: [...(rules.kinds || []), { id: `kind${Date.now()}`, label: '', match: [], max_per_day: 1, prep_days: 0, blocks_day: false }] })}>Add a type</Button>
          </div>
          <div className="mt-4 space-y-3">
            {(rules.kinds || []).map((k, i) => {
              const setK = (patch) => setRules({ ...rules, kinds: rules.kinds.map((x, n) => (n === i ? { ...x, ...patch } : x)) })
              return (
                <div key={k.id || i} className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-12 md:items-end" data-kind-row>
                  <Field label="Type" className="md:col-span-3"><Input value={k.label} placeholder="e.g. Private catering" onChange={(e) => setK({ label: e.target.value })} /></Field>
                  <Field label="Matches when the booking mentions" hint="Comma-separated words" className="md:col-span-4"><Input value={Array.isArray(k.match) ? k.match.join(', ') : k.match || ''} placeholder="loaded bar, corporate, wedding" onChange={(e) => setK({ match: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
                  <Field label="Per day" className="md:col-span-1"><Input type="number" min={1} max={50} value={k.max_per_day} onChange={(e) => setK({ max_per_day: e.target.value })} /></Field>
                  <Field label="Prep days" className="md:col-span-1"><Input type="number" min={0} max={14} value={k.prep_days} onChange={(e) => setK({ prep_days: e.target.value })} /></Field>
                  <div className="flex items-center justify-between gap-2 md:col-span-3">
                    <Toggle checked={!!k.blocks_day} onChange={(v) => setK({ blocks_day: v })} label="Takes the whole day" />
                    <IconButton icon="trash" label="Remove this type" onClick={() => setRules({ ...rules, kinds: rules.kinds.filter((_, n) => n !== i) })} />
                  </div>
                </div>
              )
            })}
            {!(rules.kinds || []).length ? <p className="text-sm text-fg/60">No types yet: every booking counts the same. Add one to treat, say, Clean Dream days differently from a catered event.</p> : null}
          </div>
          <p className="mt-3 text-xs text-fg/50">Bookings that match no type use the limits above. The first matching type wins, so put the most specific first.</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Toggle checked={!!rules.public} onChange={(v) => setRules({ ...rules, public: v })} label="Show my availability on my website" />
          <Button onClick={saveRules} disabled={savingRules}>{savingRules ? 'Saving…' : 'Save rules'}</Button>
        </div>
        <p className="mt-3 text-xs text-fg/50">Your website reads availability from your enquiry token (Settings → App & integrations), the same one the enquiry form uses.</p>
      </Card>

      <BlockModal form={editing} onClose={() => setEditing(null)} onSave={saveBlock} onDelete={removeBlock} />
      <Modal open={!!booking} onClose={() => setBooking(null)} title="New booking" wide>
        {booking ? <BookingForm initial={booking} onClose={() => setBooking(null)} onSaved={() => { setBooking(null); toast('Booking added to your diary'); load() }} /> : null}
      </Modal>
    </div>
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
