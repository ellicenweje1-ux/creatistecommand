import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { addDaysISO, cls, fmtDate, fmtMoney, todayISO } from '../format'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea, Toggle, toast, toastErr } from '../ui'
import ExampleCard from '../examples'
import { parseTime, showTime, timeHint, timeRange } from '../timeinput'
import { HoldsStrip } from './Bookings'
import { InvoiceEditorModal } from './Finance'
import { CalendarFeedCard, NotificationsCard } from './Settings'

/* Calendar — invoice-first. Every job starts as an invoice (or a website order / date request); saving it puts the job on
   its day, and the service's setup adds its shop and prep as steps with a window of days. The chef picks the day and types
   the time for each step (To plan), exactly as they would on a pad. The same calendar goes to their phone (Phone &
   notifications), and how each service runs is theirs to set (Your services). */

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dow = (iso) => new Date(`${iso}T00:00:00`).getDay()
const short = (iso) => `${WD[dow(iso)]} ${Number(iso.slice(8))}`
const mondayOf = (iso) => addDaysISO(iso, -((dow(iso) + 6) % 7))
const windowText = ([a, b]) => (a === b ? `On ${short(a)}` : `Any day ${short(a)} to ${short(b)}`)
const daysBetween = (a, b) => { const out = []; for (let d = a; d <= b && out.length < 40; d = addDaysISO(d, 1)) out.push(d); return out }
const runWord = (st) => (st.kind === 'shop' ? 'shop run' : st.kind === 'prep' ? 'prep session' : st.name.toLowerCase())
const KIND_STYLE = {
  day: 'border-copper bg-copper text-ink',
  shop: 'border-copper text-fg',
  prep: 'border-line bg-parchment text-fg',
  custom: 'border-line bg-parchment text-fg',
  held: 'border-dashed border-copper text-copper',
  calendar: 'border-dashed border-fg/30 text-fg/60',
  block: 'border-dashed border-fg/30 text-fg/60',
}
const DOT = {
  day: 'bg-copper', shop: 'border-[1.5px] border-copper', prep: 'border border-fg/40 bg-parchment', custom: 'border border-fg/40 bg-parchment',
  held: 'border-[1.5px] border-dashed border-copper', calendar: 'border-[1.5px] border-dashed border-fg/40',
}
const Dot = ({ kind }) => <span className={cls('inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]', DOT[kind] || DOT.prep)} aria-hidden="true" />

export default function CalendarPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const owner = !user?.is_staff
  const tab = params.get('tab') || 'calendar'
  const setTab = (t) => { const p = new URLSearchParams(params); if (t === 'calendar') p.delete('tab'); else p.set('tab', t); p.delete('job'); setParams(p, { replace: true }) }
  const tabs = [{ id: 'calendar', label: 'Calendar' }, ...(owner ? [{ id: 'services', label: 'Your services' }] : []), { id: 'phone', label: 'Phone & notifications' }]
  return (
    <div>
      <PageHeader title="Calendar" sub="Every job starts from an invoice. Its shop, prep and the day itself land here and on your phone." />
      <ExampleCard k="diary" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'services' && owner ? <ServicesTab /> : tab === 'phone' ? <PhoneTab /> : <CalendarTab />}
    </div>
  )
}

/* ------------------------------------------------------------------ calendar */
function CalendarTab() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [start, setStart] = useState(() => mondayOf(todayISO()))
  const [data, setData] = useState(null)
  const [holds, setHolds] = useState([])
  const [job, setJob] = useState(null)          // { id, focus?: {si, ii} }
  const [invoice, setInvoice] = useState(null)  // props for the invoice editor
  const [block, setBlock] = useState(null)
  const canInvoice = !user?.is_staff && ((user?.plan_level ?? 1) >= 2 || user?.role === 'admin')

  const load = () => api.get(`/jobs/calendar?from_date=${start}&to_date=${addDaysISO(start, 6)}`).then(setData).catch(toastErr)
  const loadHolds = () => api.get('/holds').then(setHolds).catch(() => setHolds([]))
  const refresh = () => { load(); loadHolds() }
  useEffect(() => { load() }, [start]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadHolds() }, [])
  // Opened from a notification: /app/calendar?job=12
  useEffect(() => { const j = Number(params.get('job')); if (j) setJob({ id: j }) }, [params])
  const closeJob = () => {
    setJob(null)
    if (params.get('job')) { const p = new URLSearchParams(params); p.delete('job'); setParams(p, { replace: true }) }
  }
  const makeInvoice = (j) => setInvoice({
    bookingId: j.id, clientId: j.client?.id || null,
    prefill: { service_date: j.date, service_type: j.service, service_time: j.start_time || '', service_package: j.package || '', service_days: j.days.length > 1 ? j.days : [] },
  })
  const openInvoice = async (id) => { try { setInvoice({ initial: await api.get(`/invoices/${id}`) }) } catch (e) { toastErr(e) } }
  const afterDeposit = async (hold) => {
    if (!canInvoice) return
    try { const j = await api.get(`/jobs/${hold.id}`); toast('Deposit in. Here is their invoice: take the deposit off with one tap.', 'sage'); makeInvoice(j) } catch (e) { toastErr(e) }
  }
  const openBlock = async (id) => { try { setBlock(await api.get(`/diary/blocks/${id}`)) } catch (e) { toastErr(e) } }
  const saveBlock = async (f) => {
    const payload = { ...f, weekdays: f.repeat === 'weekly' ? f.weekdays : [], end_date: f.kind === 'off' ? f.end_date : '' }
    try {
      if (f.id) await api.patch(`/diary/blocks/${f.id}`, payload); else await api.post('/diary/blocks', payload)
      toast(f.id ? 'Updated' : 'Blocked out on your calendar'); setBlock(null); load()
    } catch (e) { toastErr(e) }
  }
  const deleteBlock = async (f) => {
    if (!window.confirm('Remove this from your calendar?')) return
    try { await api.del(`/diary/blocks/${f.id}`); toast('Removed'); setBlock(null); load() } catch (e) { toastErr(e) }
  }
  const clickEntry = (e) => {
    if (e.job_id) setJob({ id: e.job_id, focus: e.si != null ? { si: e.si, ii: e.ii } : null })
    else if (e.kind === 'held') document.querySelector('[data-holds-strip]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else if (e.kind === 'calendar') toast('This comes from your other calendar. Change it there and Command follows.')
    else if (e.block_id) openBlock(e.block_id)
  }

  const days = data?.days || []
  const title = useMemo(() => {
    if (!days.length) return ''
    const a = days[0].date, b = days[days.length - 1].date
    return a.slice(5, 7) === b.slice(5, 7)
      ? `${Number(a.slice(8))} to ${Number(b.slice(8))} ${MON[Number(a.slice(5, 7)) - 1]}`
      : `${Number(a.slice(8))} ${MON[Number(a.slice(5, 7)) - 1].slice(0, 3)} to ${Number(b.slice(8))} ${MON[Number(b.slice(5, 7)) - 1].slice(0, 3)}`
  }, [days])
  if (!data) return <Spinner />
  const today = data.today

  return (
    <div className="space-y-5">
      <HoldsStrip holds={holds} currency={user?.currency} onChanged={refresh} onPaid={afterDeposit} />

      <section data-to-plan>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-xl font-semibold">To plan</h2>
          <p className="text-sm text-fg/55">{data.to_plan.length ? `${data.to_plan.length} still need a day and time. Write them in like you would on your pad.` : 'Nothing waiting. Every shop and prep has a day.'}</p>
        </div>
        {data.to_plan.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {data.to_plan.slice(0, 12).map((t) => {
              const last = t.window[1]
              const soon = last <= addDaysISO(today, 1)
              return (
                <div key={`${t.job_id}-${t.si}-${t.ii}`} className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-card px-3 py-2.5" data-plan-card>
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium"><Dot kind={t.kind} /><span className="truncate">{t.name} · {t.who}</span></p>
                    <span className={cls('shrink-0 rounded-full border px-2 py-0.5 text-[11px]', soon ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-line text-fg/55')}>
                      {last < today ? 'Window passed' : last === today ? 'By today' : `By ${short(last)}`}
                    </span>
                  </div>
                  <p className="text-xs text-fg/55">{t.service} on {short(t.job_date)}. {t.window[0] === t.window[1] ? (t.window[0] === t.job_date ? 'Same day.' : `On ${short(t.window[0])}.`) : `${windowText(t.window)}.`}</p>
                  <Button size="sm" variant="secondary" className="mt-1 self-start" onClick={() => setJob({ id: t.job_id, focus: { si: t.si, ii: t.ii } })} data-plan-it>Plan it</Button>
                </div>
              )
            })}
          </div>
        ) : <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-fg/55">All planned. New invoices add their shop and prep here.</p>}
        {data.to_plan.length > 12 ? <p className="mt-2 text-xs text-fg/50">And {data.to_plan.length - 12} more further ahead.</p> : null}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold" data-week-title>{title}</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setStart(addDaysISO(start, -7))} aria-label="Previous week">‹ Previous</Button>
            <Button size="sm" variant="secondary" onClick={() => setStart(mondayOf(todayISO()))}>This week</Button>
            <Button size="sm" variant="secondary" onClick={() => setStart(addDaysISO(start, 7))} aria-label="Next week">Next ›</Button>
            <Button size="sm" variant="secondary" icon="clock" onClick={() => setBlock(blankBlock(today))} data-block-time>Block time</Button>
            {canInvoice ? <Button size="sm" icon="plus" onClick={() => setInvoice({})} data-new-invoice>New invoice</Button> : null}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg/55" aria-label="Key">
          <span className="inline-flex items-center gap-1.5"><Dot kind="shop" />Shop</span>
          <span className="inline-flex items-center gap-1.5"><Dot kind="prep" />Prep</span>
          <span className="inline-flex items-center gap-1.5"><Dot kind="day" />On the day</span>
          <span className="inline-flex items-center gap-1.5"><Dot kind="held" />Held for a date request</span>
          <span className="inline-flex items-center gap-1.5"><Dot kind="calendar" />From your other calendar, or blocked out</span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-7" data-week>
          {days.map((d) => (
            <div key={d.date} data-day={d.date}
              className={cls('grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] gap-2 rounded-xl border p-2 lg:flex lg:min-h-[15rem] lg:flex-col',
                d.date === today ? 'border-copper' : 'border-line', d.workday ? 'bg-card' : 'bg-transparent')}>
              <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between lg:px-0.5">
                <span className="font-display text-[15px] font-semibold">{short(d.date)}</span>
                {d.date === today ? <span className="text-[10px] font-semibold uppercase tracking-wider text-copper">Today</span>
                  : !d.workday ? <span className="text-[10px] font-semibold uppercase tracking-wider text-fg/40">Day off</span> : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                {d.entries.length ? d.entries.map((e, i) => <Entry key={i} e={e} onClick={() => clickEntry(e)} />)
                  : <span className="px-0.5 text-xs text-fg/35">{d.workday ? 'Free' : 'Rest'}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {canInvoice ? <UndatedInvoices onChanged={load} /> : null}

      <JobModal job={job} onClose={closeJob} onChanged={load} canInvoice={canInvoice}
        onMakeInvoice={(j) => { closeJob(); makeInvoice(j) }} onOpenInvoice={(id) => { closeJob(); openInvoice(id) }} />
      <InvoiceEditorModal open={!!invoice} onClose={() => setInvoice(null)} onSaved={() => { setInvoice(null); refresh() }}
        initial={invoice?.initial || null} bookingId={invoice?.bookingId ?? null} clientId={invoice?.clientId ?? null}
        prefill={invoice?.prefill || null} currency={user?.currency || 'GBP'} />
      <BlockModal form={block} onClose={() => setBlock(null)} onSave={saveBlock} onDelete={deleteBlock} />
    </div>
  )
}

function Entry({ e, onClick }) {
  const allDay = e.kind === 'held' || e.kind === 'calendar' || e.kind === 'block'
  const t = e.time ? timeRange(e.time, e.end) : allDay ? 'All day' : 'Any time'
  const head = e.kind === 'held' ? 'Held' : e.kind === 'calendar' ? 'Busy' : e.kind === 'block' ? e.sub : e.label
  return (
    <button type="button" onClick={onClick} data-entry={e.kind}
      className={cls('w-full min-w-0 rounded-lg border px-2 py-1.5 text-left transition-opacity hover:opacity-90', KIND_STYLE[e.kind] || KIND_STYLE.prep)}>
      <span className="block text-[10px] font-semibold uppercase tracking-wide">{head} · {t}</span>
      <span className="block break-words text-[13px] font-medium leading-snug">{e.who}</span>
      {e.sub && e.kind !== 'block' ? <span className="block break-words text-[11px] leading-snug opacity-75">{e.sub}</span> : null}
    </button>
  )
}

/* One job: its invoice, its day(s) and time, and the shop / prep steps with the days and times you've planned. */
function JobModal({ job: target, onClose, onChanged, canInvoice, onMakeInvoice, onOpenInvoice }) {
  const [job, setJob] = useState(null)
  const [edit, setEdit] = useState(null)        // { si, ii, day, text }
  const [day, setDay] = useState({ date: '', time: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!target) { setJob(null); setEdit(null); return }
    api.get(`/jobs/${target.id}`).then((j) => {
      setJob(j); setDay({ date: j.date, time: showTime(j.start_time) })
      const f = target.focus
      const s = f ? j.steps[f.si]?.sessions[f.ii] : null
      setEdit(s ? { si: f.si, ii: f.ii, day: s.day, text: showTime(s.time) } : null)
    }).catch((e) => { toastErr(e); onClose() })
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  const done = (j, msg) => { setJob(j); setDay({ date: j.date, time: showTime(j.start_time) }); onChanged(); if (msg) toast(msg, 'sage') }
  const savePlan = async () => {
    const t = parseTime(edit.text)
    if (!edit.day) return toast('Pick a day first')
    if (t === null) return toast('Check the time, for example 9:30 or 2pm')
    setBusy(true)
    try {
      const st = job.steps[edit.si]
      const j = await api.patch(`/jobs/${job.id}/session`, { si: edit.si, ii: edit.ii, day: edit.day, time: t })
      setEdit(null); done(j, `${st.name} for ${job.who}: ${short(edit.day)}${t ? `, ${showTime(t)}` : ', any time'}. On your phone too.`)
    } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const unplan = async () => {
    setBusy(true)
    try { const j = await api.patch(`/jobs/${job.id}/session`, { si: edit.si, ii: edit.ii, day: '', time: '' }); setEdit(null); done(j, 'Back in To plan') } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const removeRun = async () => {
    setBusy(true)
    try { const j = await api.del(`/jobs/${job.id}/session?si=${edit.si}&ii=${edit.ii}`); setEdit(null); done(j, 'Removed') } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const addRun = async (si) => {
    try { const j = await api.post(`/jobs/${job.id}/session`, { si }); done(j); setEdit({ si, ii: j.steps[si].sessions.length - 1, day: '', text: '' }) } catch (e) { toastErr(e) }
  }
  const saveDay = async () => {
    const t = parseTime(day.time)
    if (t === null) return toast('Check the time, for example 12 or 4:30pm')
    const payload = { start: t }
    if (job.days.length === 1 && !job.preorder && day.date && day.date !== job.date) payload.date = day.date
    setBusy(true)
    try {
      const j = await api.patch(`/jobs/${job.id}`, payload)
      done(j, payload.date ? `Moved to ${fmtDate(j.date)}.${j.cleared ? ` ${j.cleared} step${j.cleared > 1 ? 's' : ''} went back to To plan.` : ''}` : 'Saved')
    } catch (e) { toastErr(e) } finally { setBusy(false) }
  }

  const work = job?.work_days || [0, 1, 2, 3, 4, 5]
  const changedDay = job && (day.date !== job.date || (parseTime(day.time) ?? 'x') !== (job.start_time || ''))
  return (
    <Modal open={!!target} onClose={onClose} title={job ? job.who : 'Job'} wide>
      {!job ? <Spinner /> : (
        <div className="space-y-5" data-job={job.id}>
          <div>
            <p className="text-sm text-fg/60">{job.sub}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-parchment px-3 py-2.5 text-sm" data-job-invoice>
              {job.invoice ? (
                <>
                  <span className="font-medium">{job.invoice.number || 'Invoice'}</span>
                  <Badge tone={job.invoice.status === 'paid' ? 'sage' : 'copper'}>{job.invoice.status}</Badge>
                  <span>{fmtMoney(job.invoice.total)}</span>
                  {canInvoice ? <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onOpenInvoice(job.invoice.id)} data-open-invoice>Open invoice</Button> : null}
                </>
              ) : job.preorder ? <span>From your website orders. No invoice needed.</span> : (
                <>
                  <span className="text-fg/70">No invoice yet.{job.deposit_paid && job.deposit_amount ? ` Their ${fmtMoney(job.deposit_amount)} deposit is paid and can come off it.` : ''}</span>
                  {canInvoice ? <Button size="sm" className="ml-auto" onClick={() => onMakeInvoice(job)} data-make-invoice>Make the invoice</Button> : null}
                </>
              )}
            </div>
          </div>

          <div>
            <p className="label">On the day</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {job.days.map((d) => (
                <li key={d} className="flex items-center gap-2 px-3 py-2 text-sm"><Dot kind="day" /><span className="flex-1"><span className="font-medium">{job.day_label}</span> · {fmtDate(d)}</span>
                  <span className="text-fg/60">{job.start_time ? timeRange(job.start_time, job.end_time) : 'Time not set'}</span></li>
              ))}
            </ul>
            {!job.preorder ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-job-day>
                {job.days.length === 1
                  ? <Field label="Move this day"><Input type="date" value={day.date} onChange={(e) => setDay({ ...day, date: e.target.value })} data-job-date /></Field>
                  : <p className="text-xs text-fg/55 sm:pb-2">{job.days.length} days from {job.package || 'the package'}. Change the days on the invoice.</p>}
                <Field label="Time on the day" hint={timeHint(day.time, 'Optional')}><Input value={day.time} onChange={(e) => setDay({ ...day, time: e.target.value })} placeholder="e.g. 12 or 4:30pm" data-job-time /></Field>
                <Button size="sm" variant="secondary" disabled={!changedDay || busy} onClick={saveDay} className="sm:mb-5" data-job-save>Save</Button>
              </div>
            ) : null}
          </div>

          <div>
            <p className="label">Before the day</p>
            {job.steps.length ? job.steps.map((st, si) => (
              <div key={si} className="mb-2 rounded-lg border border-line px-3 py-2.5" data-step={st.kind}>
                <div className="flex flex-wrap items-center gap-2 text-sm"><Dot kind={st.kind} /><span className="font-medium">{st.name}</span><span className="ml-auto text-xs text-fg/55">{windowText(st.window)}</span></div>
                {st.sessions.map((s, ii) => {
                  const editing = edit && edit.si === si && edit.ii === ii
                  return (
                    <div key={ii} className="mt-2 border-t border-line pt-2" data-session={`${si}-${ii}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        {s.day ? <span>{fmtDate(s.day)} · {s.time ? showTime(s.time) : 'any time'}</span> : <span className="text-amber-600 dark:text-amber-400">Not planned yet</span>}
                        {!editing ? <Button size="sm" variant="secondary" onClick={() => setEdit({ si, ii, day: s.day, text: showTime(s.time) })} data-plan-open>{s.day ? 'Change' : 'Plan it'}</Button> : null}
                      </div>
                      {editing ? (
                        <div className="mt-2 rounded-lg border border-copper/50 p-3" data-plan-editor>
                          <p className="label">Day</p>
                          <div className="flex flex-wrap gap-1.5">
                            {daysBetween(st.window[0], st.window[1]).map((d) => {
                              const off = !work.includes((dow(d) + 6) % 7)
                              return (
                                <button key={d} type="button" disabled={off} title={off ? 'Not one of your working days' : undefined} onClick={() => setEdit({ ...edit, day: d })}
                                  aria-pressed={edit.day === d} data-plan-day={d}
                                  className={cls('rounded-full border px-3 py-1 text-xs', edit.day === d ? 'border-copper bg-copper text-ink' : 'border-line hover:border-copper/60', off && 'cursor-not-allowed opacity-40')}>
                                  {short(d)}{off ? ' · off' : ''}
                                </button>
                              )
                            })}
                          </div>
                          <Field label="Time, written however you like" hint={timeHint(edit.text)} className="mt-3">
                            <Input value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="e.g. 8 or 9:30" autoComplete="off"
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); savePlan() } }} data-plan-time />
                          </Field>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" onClick={savePlan} disabled={busy} data-plan-save>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
                            {s.day ? <Button size="sm" variant="ghost" onClick={unplan} disabled={busy}>Unplan</Button> : null}
                            {st.sessions.length > 1 ? <Button size="sm" variant="ghost" icon="trash" onClick={removeRun} disabled={busy}>Remove this one</Button> : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addRun(si)} className="mt-2 text-xs font-medium text-copper hover:underline" data-add-run>+ Add another {runWord(st)}</button>
              </div>
            )) : <p className="text-sm text-fg/55">No shop or prep for this service. Switch them on under Your services.</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ your services */
const BEFORE = [30, 21, 14, 10, 7, 6, 5, 4, 3, 2, 1, 0]
const beforeLabel = (n) => (n === 0 ? 'on the day' : n === 1 ? 'the day before' : `${n} days before`)
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const NOTICE = [0, 1, 2, 3, 5, 7, 10, 14, 21, 28]
const noticeLabel = (n) => (n === 0 ? 'None (same day)' : n === 1 ? '1 day' : n % 7 === 0 ? `${n / 7} week${n > 7 ? 's' : ''}` : `${n} days`)
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ServicesTab() {
  const [setup, setSetup] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState({ name: '', category: 'delivered' })
  useEffect(() => { api.get('/jobs/setup').then(setSetup).catch(toastErr) }, [])
  if (!setup) return <Spinner />
  const services = setup.services
  const put = (next) => { setSetup({ ...setup, services: next }); setDirty(true) }
  const upd = (i, patch) => put(services.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const updStep = (i, k, patch) => upd(i, { steps: services[i].steps.map((st, j) => {
    if (j !== k) return st
    const n = { ...st, ...patch }
    if (n.to > n.from) n.to = n.from
    return n
  }) })
  const updPkg = (i, k, patch) => upd(i, { packages: services[i].packages.map((p, j) => (j === k ? { ...p, ...patch } : p)) })
  const save = async () => {
    setSaving(true)
    try { const r = await api.put('/jobs/setup', { services, remind_unplanned: setup.remind_unplanned }); setSetup(r); setDirty(false); toast('Saved. New invoices use these steps.', 'sage') } catch (e) { toastErr(e) } finally { setSaving(false) }
  }
  const addService = () => {
    const name = adding.name.trim()
    if (!name) return toast('Name the service first')
    if (services.some((s) => s.name.toLowerCase() === name.toLowerCase())) return toast('You already have a service with that name')
    const cat = setup.categories.find((c) => c.id === adding.category) || setup.categories[0]
    put([...services, { id: `new-${Date.now()}`, name, category: cat.id, day_label: cat.day_label, usual_start: '', usual_end: '', requestable: false,
      notice_days: cat.notice_days ?? 7, request_days: [],
      steps: cat.steps.map((s, i) => ({ ...s, id: `${s.kind}-${i}` })), packages: [] }])
    setAdding({ name: '', category: adding.category })
  }
  const options = (cur) => [...new Set([...BEFORE, cur])].sort((a, b) => b - a)

  return (
    <div className="space-y-5 pb-20">
      <p className="max-w-3xl text-sm text-fg/65">How each service usually runs. When you save an invoice, its job gets these steps, each with a window of days; you then pick the day and type the time. Changes here apply to new invoices. Jobs already on your calendar keep their plan.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {services.map((s, i) => (
          <Card key={s.id || i} className="p-4" data-service={s.name}>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={s.name} onChange={(e) => upd(i, { name: e.target.value })} className="!w-auto min-w-0 flex-1 font-display text-lg" aria-label="Service name" />
              <Button size="sm" variant="ghost" icon="trash" onClick={() => { if (window.confirm(`Remove ${s.name} from your services? Jobs already planned keep their steps.`)) put(services.filter((_, j) => j !== i)) }}>Remove</Button>
            </div>
            <p className="label mt-4">Before the day</p>
            <div className="divide-y divide-line">
              {s.steps.map((st, k) => (
                <div key={st.id || k} className={cls('flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5', !st.on && 'opacity-60')} data-step-row={st.kind}>
                  <div className="flex min-w-[8rem] items-center gap-2">
                    <Toggle checked={st.on} onChange={(v) => updStep(i, k, { on: v })} />
                    {st.kind === 'custom'
                      ? <Input value={st.name} onChange={(e) => updStep(i, k, { name: e.target.value })} className="!w-36 !py-1" aria-label="Step name" />
                      : <span className="text-sm font-medium">{st.name}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm text-fg/60">
                    From
                    <Select value={st.from} onChange={(e) => updStep(i, k, { from: Number(e.target.value) })} className="!w-auto !py-1" aria-label={`${st.name} earliest`} data-step-from>
                      {options(st.from).map((n) => <option key={n} value={n}>{beforeLabel(n)}</option>)}
                    </Select>
                    to
                    <Select value={st.to} onChange={(e) => updStep(i, k, { to: Number(e.target.value) })} className="!w-auto !py-1" aria-label={`${st.name} latest`} data-step-to>
                      {options(st.to).filter((n) => n <= st.from).map((n) => <option key={n} value={n}>{beforeLabel(n)}</option>)}
                    </Select>
                  </div>
                  {st.kind === 'custom' ? <Button size="sm" variant="ghost" icon="trash" className="ml-auto" onClick={() => upd(i, { steps: s.steps.filter((_, j) => j !== k) })}>Remove</Button> : null}
                </div>
              ))}
            </div>
            <button type="button" className="mt-1 text-xs font-medium text-copper hover:underline" data-add-step
              onClick={() => upd(i, { steps: [...s.steps, { id: `custom-${Date.now()}`, kind: 'custom', name: 'New step', on: true, from: 1, to: 1 }] })}>+ Add a step, like “Collect hire kit”</button>

            <p className="label mt-4">On the day</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Called"><Input value={s.day_label} onChange={(e) => upd(i, { day_label: e.target.value })} /></Field>
              <Field label="Usual start (optional)"><Input type="time" value={s.usual_start || ''} onChange={(e) => upd(i, { usual_start: e.target.value })} /></Field>
              <Field label="Usual end (optional)"><Input type="time" value={s.usual_end || ''} onChange={(e) => upd(i, { usual_end: e.target.value })} /></Field>
            </div>
            <p className="mt-1 text-xs text-fg/45">Leave the usual times blank if they change job to job. You type the time on each invoice.</p>

            <p className="label mt-4">Packages</p>
            {s.packages.length ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_2rem] gap-1.5 text-[11px] uppercase tracking-wider text-fg/45"><span>Package</span><span>Days a week</span><span>Hours a day</span><span /></div>
                {s.packages.map((p, k) => (
                  <div key={p.id || k} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_2rem] items-center gap-1.5" data-package-row>
                    <Input value={p.name} onChange={(e) => updPkg(i, k, { name: e.target.value })} className="!py-1.5" aria-label="Package name" />
                    <Select value={p.days} onChange={(e) => updPkg(i, k, { days: Number(e.target.value) })} className="!py-1.5" aria-label="Days a week">{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}</Select>
                    <Input type="number" min="0.25" max="16" step="0.25" value={p.hours} onChange={(e) => updPkg(i, k, { hours: e.target.value })} className="!py-1.5" aria-label="Hours a day" />
                    <button type="button" className="text-fg/45 hover:text-red-500" aria-label="Remove package" onClick={() => upd(i, { packages: s.packages.filter((_, j) => j !== k) })}>×</button>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-fg/45">None. Add one if this service is sold as packages (it sets how many days go on the calendar and how long each runs).</p>}
            <button type="button" className="mt-1 text-xs font-medium text-copper hover:underline" onClick={() => upd(i, { packages: [...s.packages, { id: `p-${Date.now()}`, name: 'New package', days: 1, hours: 4 }] })}>+ Add a package</button>

            <div className="mt-4 border-t border-line pt-3" data-request-block>
              <Toggle checked={!!s.requestable} onChange={(v) => upd(i, { requestable: v })} label="Regular clients can request dates for this on my website" />
              {s.requestable ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start">
                  <Field label="Notice they must give">
                    <Select value={s.notice_days ?? 7} onChange={(e) => upd(i, { notice_days: Number(e.target.value) })} data-notice>
                      {[...new Set([...NOTICE, s.notice_days ?? 7])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{noticeLabel(n)}</option>)}
                    </Select>
                  </Field>
                  <div>
                    <p className="label">Days they can ask for</p>
                    <div className="mt-1 flex flex-wrap gap-1" data-request-days>
                      {WEEK.map((d, k) => {
                        const on = !(s.request_days || []).length || s.request_days.includes(k)
                        return (
                          <button key={d} type="button" aria-pressed={on} data-request-day={k}
                            className={cls('h-8 w-10 rounded-md border text-xs font-medium', on ? 'border-copper bg-copper/15 text-fg' : 'border-line text-fg/40')}
                            onClick={() => {
                              const cur = (s.request_days || []).length ? s.request_days : [0, 1, 2, 3, 4, 5, 6]
                              const next = on ? cur.filter((x) => x !== k) : [...cur, k].sort()
                              if (!next.length) return toast('Leave at least one day')
                              upd(i, { request_days: next.length === 7 ? [] : next })
                            }}>{d}</button>
                        )
                      })}
                    </div>
                    <p className="mt-1 text-xs text-fg/45">Days you don’t work (set at the bottom of this page) are never offered.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="font-display text-lg">Add a service</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end">
          <Field label="Name"><Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder="e.g. Weekly meal prep" data-new-service /></Field>
          <Field label="Starts from">
            <Select value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>
              {setup.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Button onClick={addService} className="sm:mb-0.5">Add</Button>
        </div>
      </Card>

      <AvailabilityCard />

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }} data-save-bar>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm text-fg/70">You have changes to your services.</p>
            <Button onClick={save} disabled={saving} data-save-services>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* The days you work and whether your website shows which dates are free. */
function AvailabilityCard() {
  const [rules, setRules] = useState(null)
  useEffect(() => { api.get('/diary/rules').then(setRules).catch(() => {}) }, [])
  if (!rules) return null
  const save = async (patch) => {
    setRules({ ...rules, ...patch })
    try { setRules(await api.put('/diary/rules', patch)); toast('Saved') } catch (e) { toastErr(e); api.get('/diary/rules').then(setRules).catch(() => {}) }
  }
  const work = rules.work_days || []
  return (
    <Card className="p-4" data-availability>
      <p className="font-display text-lg">Your working days</p>
      <p className="mt-1 text-sm text-fg/65">Steps can't be planned on a day off, and clients only see your working days as free.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DAY_NAMES.map((d, i) => {
          const on = work.includes(i)
          return <button key={d} type="button" aria-pressed={on} onClick={() => save({ work_days: on ? work.filter((x) => x !== i) : [...work, i].sort() })}
            className={cls('rounded-full border px-3 py-1 text-xs', on ? 'border-copper bg-copper text-ink' : 'border-line text-fg/60')} data-work-day={i}>{d}</button>
        })}
      </div>
      <div className="mt-4"><Toggle checked={rules.public !== false} onChange={(v) => save({ public: v })} label="Show which dates are free on my website" /></div>
    </Card>
  )
}

/* ------------------------------------------------------------------ phone & notifications */
function PhoneTab() {
  const { user } = useAuth()
  const owner = !user?.is_staff
  const [setup, setSetup] = useState(null)
  useEffect(() => { if (owner) api.get('/jobs/setup').then(setSetup).catch(() => {}) }, [owner])
  const toggleRemind = async (v) => {
    try { setSetup(await api.put('/jobs/setup', { services: setup.services, remind_unplanned: v })); toast(v ? 'Unplanned steps will show on your phone' : 'Only planned steps will show on your phone') } catch (e) { toastErr(e) }
  }
  const [status, setStatus] = useState(null)
  const loadStatus = () => api.get('/jobs/phone-status').then(setStatus).catch(() => {})
  useEffect(() => { if (owner) loadStatus() }, [owner])
  return (
    <div className="space-y-5">
    {owner ? <PhoneStatus status={status} /> : null}
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <NotificationsCard />
        <Card className="p-4">
          <p className="font-display text-lg">On iPhone, first</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-fg/70">
            <li>Open Command in Safari and tap Share, then <strong>Add to Home Screen</strong>.</li>
            <li>Open Command from the new icon on your Home Screen.</li>
            <li>Come back here and switch on <strong>Notify me on this device</strong>, then allow notifications.</li>
          </ol>
          <p className="mt-2 text-xs text-fg/50">Apple only sends pop-up notifications to apps added to the Home Screen. After that they arrive as banners, even when Command is closed.</p>
        </Card>
      </div>
      <div className="space-y-5">
        {owner && user?.calendar_token ? <CalendarFeedCard token={user.calendar_token} /> : null}
        {owner && setup ? (
          <Card className="p-4">
            <Toggle checked={setup.remind_unplanned} onChange={toggleRemind} label="Show unplanned steps on my phone as all-day reminders" />
            <p className="mt-1.5 text-xs text-fg/50">Anything still in To plan appears on its last possible day, so it isn’t forgotten.</p>
          </Card>
        ) : null}
        {owner ? <CalendarCard onChanged={loadStatus} /> : null}
      </div>
    </div>
    </div>
  )
}

const ago = (iso) => {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`
}

/* Both directions of the phone link at a glance, so "is it working?" never needs a guess. */
function PhoneStatus({ status }) {
  if (!status) return null
  const feed = status.feed || {}
  const other = status.other || {}
  const fresh = feed.last && Date.now() - new Date(feed.last).getTime() < 3 * 86400000
  const go = (sel) => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const Row = ({ ok, warn, title, line, action, data }) => (
    <div className="flex flex-wrap items-center gap-3 py-3" data-phone-row={data}>
      <span className={cls('h-2.5 w-2.5 shrink-0 rounded-full', ok ? 'bg-sage' : warn ? 'bg-amber-500' : 'bg-fg/25')} aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="text-xs text-fg/60">{line}</p></div>
      {action}
    </div>
  )
  const errs = (other.links || []).filter((l) => l.last_error)
  return (
    <Card className="p-4" data-phone-status>
      <p className="font-display text-lg">Your two calendars</p>
      <p className="mt-1 text-sm text-fg/65">Command and your phone’s calendar are linked in two separate directions. Each needs setting up once.</p>
      <div className="mt-2 divide-y divide-line">
        <Row data="to-phone" ok={fresh} warn={!!feed.last && !fresh}
          title="Command → your phone"
          line={feed.last ? `${feed.device || 'Your calendar app'} last collected your jobs, shop and prep ${ago(feed.last)}.${fresh ? '' : ' It should check at least every few hours: open the subscription on your phone and check it’s still there.'}`
            : 'Not set up yet. Your phone hasn’t collected your Command calendar. Add the link below once and your jobs, shop and prep appear in your phone’s calendar.'}
          action={!feed.last ? <Button size="sm" variant="secondary" onClick={() => go('[data-feed-card]')}>Show me how</Button> : null} />
        <Row data="from-phone" ok={other.connected && !errs.length} warn={other.connected && errs.length > 0}
          title="Your phone → Command"
          line={other.connected
            ? `${(other.links || []).map((l) => l.name).join(', ')} connected · ${other.count} busy ${other.count === 1 ? 'time' : 'times'} read · updated ${ago(other.last_synced) || 'not yet'}.${errs.length ? ` Needs attention: ${errs.map((l) => l.name).join(', ')}.` : ''}`
            : 'Not connected. Your own phone events (church, appointments, time off) don’t show here yet. Share your phone calendar’s link below once.'}
          action={!other.connected ? <Button size="sm" variant="secondary" onClick={() => go('[data-calendar-card]')}>Show me how</Button> : null} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ shared pieces */
const BLOCK_KINDS = [
  ['busy', 'Time committed', 'A window already taken (another job, a delivery run, a tasting).'],
  ['standing', 'Standing weekly service', 'Repeats every week, e.g. a Monday-to-Friday lunch service.'],
  ['prep', 'Prep day', 'Cooking ahead. Shows as limited on your site.'],
  ['off', 'Day off / holiday', 'Nothing bookable. Shows as full on your site. Add an end date for a run of days.'],
]
const blankBlock = (date) => ({ title: '', kind: 'off', date, end_date: '', start_time: '', end_time: '', repeat: '', weekdays: [0, 1, 2, 3, 4], until: '', notes: '' })

function BlockModal({ form, onClose, onSave, onDelete }) {
  const [f, setF] = useState(form)
  useEffect(() => { setF(form) }, [form])
  if (!f) return null
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const toggleDay = (i) => set('weekdays', f.weekdays.includes(i) ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i].sort())
  return (
    <Modal open={!!form} onClose={onClose} title={f.id ? 'Blocked time' : 'Block time on your calendar'}
      footer={<div className="flex items-center justify-between gap-2">{f.id ? <Button variant="ghost" icon="trash" onClick={() => onDelete(f)}>Remove</Button> : <span />}<div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(f)} disabled={!f.date}>{f.id ? 'Save' : 'Block it out'}</Button></div></div>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(f) }} data-block-form>
        <Field label="What is it?">
          <Select value={f.kind} onChange={(e) => set('kind', e.target.value)}>{BLOCK_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <p className="mt-1 text-xs text-fg/50">{BLOCK_KINDS.find(([k]) => k === f.kind)?.[2]}</p>
        </Field>
        <Field label="Title (optional)"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={f.kind === 'off' ? 'e.g. Holiday' : 'e.g. Delivery run'} /></Field>
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
                {DAY_NAMES.map((d, i) => <button key={d} type="button" onClick={() => toggleDay(i)} className={`rounded-full border px-3 py-1 text-xs ${f.weekdays.includes(i) ? 'border-copper bg-copper/20 text-fg' : 'border-line text-fg/60'}`} aria-pressed={f.weekdays.includes(i)}>{d}</button>)}
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

/* Invoices written before service days existed don't show on the calendar. One tap each puts them there. */
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
      toast(r.ok ? 'On your calendar now' : r.reason); await load(); onChanged()
    } catch (e) { toastErr(e) }
  }
  return (
    <Card className="p-5" data-undated>
      <p className="font-display text-lg">Invoices not on your calendar yet ({rows.length})</p>
      <p className="mt-1 text-sm text-fg/70">These have no service day, so your calendar can’t see the work. Give each its day and it lands there, with its shop and prep.</p>
      <ul className="mt-3 divide-y divide-line">
        {rows.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5" data-undated-row={i.id}>
            <div className="min-w-[10rem] flex-1"><p className="text-sm font-medium">{nameOf(i.client_id)}</p><p className="text-xs text-fg/55">{i.number} · {i.status}</p></div>
            <Input type="date" className="!w-40" value={draft[i.id]?.date || ''} onChange={(e) => setDraft({ ...draft, [i.id]: { ...draft[i.id], date: e.target.value } })} aria-label="Service day" />
            <Input className="!w-44" placeholder="What for?" value={draft[i.id]?.type ?? i.service_type ?? ''} onChange={(e) => setDraft({ ...draft, [i.id]: { ...draft[i.id], type: e.target.value } })} aria-label="Service" />
            <Button size="sm" onClick={() => save(i)} data-undated-save>Add to calendar</Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* Read your own calendars (iPhone / Google / Outlook) back in: busy times there show here and close dates on your website. */
function CalendarCard({ onChanged }) {
  const [st, setSt] = useState(null)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(true)
  const load = () => api.get('/diary/calendar').then((r) => { setSt(r); if (r.connected) setHelp(false) }).catch(() => {})
  useEffect(() => { load() }, [])
  const act = async (fn, msg) => { setBusy(true); try { const r = await fn(); setSt(r); if (msg) toast(msg); onChanged(); return true } catch (e) { toastErr(e); return false } finally { setBusy(false) } }
  const add = async (e) => {
    e.preventDefault()
    if (await act(() => api.put('/diary/calendar', { url, name }), 'Calendar connected. Its busy times now show on your Calendar.')) { setUrl(''); setName('') }
  }
  if (!st) return null
  const links = st.links || []
  return (
    <Card className="p-5" data-calendar-card>
      <p className="font-display text-lg">Your phone’s calendar → Command</p>
      <p className="mt-1 text-sm text-fg/70">Connect the calendars you keep on your phone and anything busy in them shows on your Command calendar and closes those dates on your website. Command reads them every ten minutes.</p>
      {links.length ? (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line" data-calendar-links>
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5" data-calendar-link={l.name}>
              <Badge tone={l.last_error ? 'amber' : 'sage'}>{l.last_error ? 'Needs attention' : 'Connected'}</Badge>
              <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{l.name}</span> <span className="text-fg/55">· {l.count} busy {l.count === 1 ? 'time' : 'times'} · {ago(l.last_synced) || 'not read yet'}</span>
                {l.last_error ? <span className="block text-xs text-amber-600 dark:text-amber-400">{l.last_error} We keep what we last read until it works again.</span> : null}</span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`Disconnect ${l.name}? The dates it closed open up again.`)) act(() => api.put('/diary/calendar', { remove: l.id }), `${l.name} disconnected`) }}>Remove</Button>
            </li>
          ))}
        </ul>
      ) : null}
      {links.length ? (
        <div className="mt-3 space-y-2">
          <Toggle checked={st.all_day_closes} onChange={(v) => act(() => api.put('/diary/calendar', { all_day_closes: v }), v ? 'All-day events now close the day' : 'All-day events now only make the day limited')} label="An all-day event closes the whole day" />
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => api.post('/diary/calendar/sync'), 'Calendars read')} data-calendar-sync>Read them again now</Button>
        </div>
      ) : null}
      {links.length < 5 ? (
        <form className="mt-4 grid gap-3" onSubmit={add} data-calendar-form>
          <Field label="Name it"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={links.length ? 'e.g. Work' : 'e.g. Home'} /></Field>
          <Field label={links.length ? 'Add another calendar’s link' : 'Your calendar’s shared link'}><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="webcal://p01-caldav.icloud.com/published/…" required /></Field>
          <div><Button type="submit" disabled={busy || !url.trim()}>{busy ? 'Connecting…' : 'Connect'}</Button></div>
        </form>
      ) : null}
      <button type="button" onClick={() => setHelp(!help)} className="mt-4 text-xs font-medium text-copper underline-offset-2 hover:underline" data-calendar-help-toggle>{help ? 'Hide the steps' : 'Where do I find this link?'}</button>
      {help ? (
        <div className="mt-3 space-y-3 text-sm text-fg/75" data-calendar-help>
          <div><p className="font-medium">iPhone (iCloud calendars)</p><ol className="list-decimal space-y-0.5 pl-5">
            <li>Open the <strong>Calendar</strong> app and tap <strong>Calendars</strong> at the bottom.</li>
            <li>Tap the <strong>ⓘ</strong> beside the calendar you put your events in (often “Home”).</li>
            <li>Switch on <strong>Public Calendar</strong>, tap <strong>Share Link…</strong>, then <strong>Copy</strong>.</li>
            <li>Paste it above, name it (e.g. Home) and tap Connect. Do the same for each calendar you use, such as Work.</li>
          </ol><p className="mt-1 text-xs text-fg/50">“Public” only means anyone with that exact link can view it. It isn’t listed anywhere, and Command keeps the link private.</p></div>
          <div><p className="font-medium">Calendars from Gmail on your iPhone</p><ol className="list-decimal pl-5"><li>On a computer, open calendar.google.com, hover the calendar on the left, tap the three dots, then Settings and sharing.</li><li>Copy <strong>Secret address in iCal format</strong> and paste it above. Google can take several hours to pass on a new event; that delay is Google’s.</li></ol></div>
          <div><p className="font-medium">Outlook / Microsoft 365</p><ol className="list-decimal pl-5"><li>Outlook on the web: Settings, Calendar, Shared calendars, then Publish a calendar.</li><li>Choose “Can view all details” and copy the <strong>ICS</strong> link.</li></ol></div>
          <p className="text-xs text-fg/50">Not sure which you use? In the iPhone Calendar app tap Calendars: each list has a heading such as ICLOUD, GMAIL or OUTLOOK. Your Command calendar can sit in the same app: anything Command sends to your phone is ignored here, so nothing is counted twice.</p>
        </div>
      ) : null}
    </Card>
  )
}
