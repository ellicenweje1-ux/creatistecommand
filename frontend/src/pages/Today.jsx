import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { AssistantBox, useAssistantChanged } from '../assistant'
import { useAuth } from '../auth'
import { cls, fmtMoney } from '../format'
import { showTime, timeRange } from '../timeinput'
import { Button, Icon, Spinner, toast, toastErr } from '../ui'

/* Today: the one screen to open in the morning. The assistant at the top (say or type what you need), then what is
   waiting for you, what does not match between money and dates, today and the next few days, and your to-dos.
   Everything here is read from GET /api/today, the same picture the assistant and the morning summary use. */

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const at = (iso) => new Date(`${iso}T00:00:00`)
const longDay = (iso) => { const d = at(iso); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` }
const shortDay = (iso) => { const d = at(iso); return `${WD[d.getDay()].slice(0, 3)} ${d.getDate()} ${MON[d.getMonth()].slice(0, 3)}` }

const NEED_ICON = { request: 'calendar', deposit: 'coins', lapsed: 'alert', order: 'cart', review: 'star', enquiry: 'mail', overdue: 'clock' }
const DOT = {
  day: 'bg-copper', shop: 'border-[1.5px] border-copper', prep: 'border border-fg/40 bg-parchment', custom: 'border border-fg/40 bg-parchment',
  held: 'border-[1.5px] border-dashed border-copper', calendar: 'border-[1.5px] border-dashed border-fg/40', block: 'border-[1.5px] border-dashed border-fg/40',
}

function Tick({ done, onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={done} data-tick
      className={cls('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors sm:h-6 sm:w-6',
        done ? 'border-copper bg-copper text-ink' : 'border-fg/30 hover:border-copper')}>
      {done ? <Icon name="check" size={14} /> : null}
    </button>
  )
}

function EntryRow({ e, onTick, onOpen }) {
  if (e.kind === 'todo') {
    return (
      <li className="flex items-center gap-3 py-2" data-entry="todo">
        <Tick done={e.done} onClick={() => onTick(e.task_id, !e.done)} label={e.done ? 'Not done after all' : 'Tick off'} />
        <span className={cls('min-w-0 flex-1 text-sm', e.done && 'text-fg/40 line-through')}>
          {e.who}
          <span className="ml-2 text-xs text-fg/45">{[e.time ? showTime(e.time) : '', e.overdue ? 'overdue' : '', e.sub].filter(Boolean).join(' · ')}</span>
        </span>
      </li>
    )
  }
  const allDay = ['held', 'calendar', 'block'].includes(e.kind)
  const t = e.time ? timeRange(e.time, e.end) : allDay ? 'All day' : 'Any time'
  const head = e.kind === 'held' ? 'Held' : e.kind === 'calendar' ? 'Busy' : e.kind === 'block' ? e.sub : e.label
  return (
    <li>
      <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 py-2 text-left hover:opacity-80" data-entry={e.kind}>
        <span className={cls('inline-block h-3 w-3 shrink-0 rounded-[3px]', DOT[e.kind] || DOT.prep)} aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{head}</span>{e.kind !== 'block' ? <span> · {e.who}</span> : null}
          <span className="ml-2 text-xs text-fg/45">{[t, e.auto ? 'suggested day' : '', e.kind === 'day' ? e.sub : ''].filter(Boolean).join(' · ')}</span>
        </span>
        <Icon name="chevronRight" size={14} className="shrink-0 text-fg/30" />
      </button>
    </li>
  )
}

export default function Today() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const load = () => api.get('/today').then(setData).catch(toastErr)
  useEffect(() => { load() }, [])
  useAssistantChanged(load)
  if (!data) return <Spinner />

  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const cur = user?.currency || 'GBP'
  const [first, ...rest] = data.days || []
  const coming = rest.filter((d) => d.entries.length)
  const sort = data.sort
  const money = data.money || {}
  const canMoney = sort !== null && sort !== undefined

  const tick = async (id, done) => {
    try { await api.patch(`/tasks/${id}`, { status: done ? 'done' : 'todo' }); if (done) toast('Ticked off', 'sage'); load() } catch (e) { toastErr(e) }
  }
  const open = (e) => {
    if (e.job_id) navigate(`/app/calendar?job=${e.job_id}`)
    else if (e.kind === 'held') navigate(canMoney ? '/app/standing' : '/app/calendar')
    else navigate('/app/calendar')
  }

  return (
    <div className="space-y-6" data-today>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{hello}{data.first_name ? `, ${data.first_name}` : ''}</h1>
        <p className="mt-0.5 text-sm text-fg/55">{longDay(data.today)}</p>
      </header>

      <AssistantBox status={data.assistant} />

      {data.needs.length ? (
        <section data-needs>
          <h2 className="mb-2 font-display text-lg font-semibold">Waiting for you</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {data.needs.map((n, i) => (
              <li key={i}>
                <Link to={n.url} className="flex items-center gap-3 px-4 py-3 hover:bg-fg/[0.03]" data-need={n.kind}>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-copper/15 text-copper"><Icon name={NEED_ICON[n.kind] || 'alert'} size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.text}</span><span className="block text-xs text-fg/55">{n.sub}</span></span>
                  <Icon name="chevronRight" size={16} className="shrink-0 text-fg/30" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canMoney ? (
        <section data-sort>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Paid &amp; booked</h2>
            <Link to="/app/standing" className="text-sm text-copper hover:underline">See every client</Link>
          </div>
          {sort.fix ? (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/[0.06] p-4">
              <p className="text-sm font-semibold">{sort.fix} thing{sort.fix === 1 ? '' : 's'} {sort.fix === 1 ? 'doesn’t' : 'don’t'} match yet</p>
              <ul className="mt-2 space-y-1.5">
                {sort.top.map((t, i) => <li key={i} className="text-sm text-fg/75" data-sort-line><span className="font-medium text-fg">{t.client}:</span> {t.text}</li>)}
              </ul>
              {sort.fix > sort.top.length ? <p className="mt-1.5 text-xs text-fg/50">And {sort.fix - sort.top.length} more.</p> : null}
              <Button size="sm" className="mt-3" onClick={() => navigate('/app/standing')} data-sort-open>Sort them out</Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm text-fg/70" data-sort-clear>
              <Icon name="check" size={16} className="text-sage" />Everything matches: everyone who has paid has a date, and every date has its invoice.
            </p>
          )}
        </section>
      ) : null}

      <section data-days>
        <h2 className="mb-2 font-display text-lg font-semibold">Today</h2>
        <div className="rounded-xl border border-copper/60 bg-card px-4 py-1">
          {first?.entries.length ? (
            <ul className="divide-y divide-line">{first.entries.map((e, i) => <EntryRow key={i} e={e} onTick={tick} onOpen={open} />)}</ul>
          ) : <p className="py-3 text-sm text-fg/55">{first?.workday === false ? 'A day off. Nothing in the diary.' : 'Nothing in the diary today.'}</p>}
        </div>
        {coming.length ? (
          <>
            <h2 className="mb-2 mt-5 font-display text-lg font-semibold">Coming up</h2>
            <div className="space-y-2">
              {coming.map((d) => (
                <div key={d.date} className="rounded-xl border border-line bg-card px-4 py-1" data-day={d.date}>
                  <p className="border-b border-line/70 py-2 text-xs font-semibold uppercase tracking-wider text-fg/50">{shortDay(d.date)}</p>
                  <ul className="divide-y divide-line">{d.entries.map((e, i) => <EntryRow key={i} e={e} onTick={tick} onOpen={open} />)}</ul>
                </div>
              ))}
            </div>
          </>
        ) : null}
        <Link to="/app/calendar" className="mt-3 inline-flex items-center gap-1 text-sm text-copper hover:underline">Open the calendar <Icon name="arrowRight" size={14} /></Link>
      </section>

      {data.undated.length ? (
        <section data-undated>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">To-dos with no date</h2>
            <Link to="/app/tasks" className="text-sm text-copper hover:underline">All to-dos</Link>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card px-4">
            {data.undated.slice(0, 12).map((t) => (
              <li key={t.task_id} className="flex items-center gap-3 py-2">
                <Tick done={false} onClick={() => tick(t.task_id, true)} label="Tick off" />
                <span className="min-w-0 flex-1 text-sm">{t.title}{t.personal ? <span className="ml-2 text-xs text-fg/45">Personal</span> : null}</span>
              </li>
            ))}
          </ul>
          {data.undated.length > 12 ? <p className="mt-1.5 text-xs text-fg/50">And {data.undated.length - 12} more in To-dos.</p> : null}
        </section>
      ) : null}

      {canMoney && (money.unpaid || money.drafts) ? (
        <Link to="/app/finance?tab=invoices" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-card px-4 py-3 text-sm hover:border-copper/50" data-money>
          <Icon name="coins" size={16} className="text-copper" />
          {money.unpaid ? <span><span className="font-semibold">{fmtMoney(money.unpaid_total, cur)}</span> to come in from {money.unpaid} invoice{money.unpaid === 1 ? '' : 's'}</span> : null}
          {money.overdue ? <span className="text-red-600 dark:text-red-400">{money.overdue} overdue</span> : null}
          {money.drafts ? <span className="text-fg/60">{money.drafts} draft{money.drafts === 1 ? '' : 's'} not sent</span> : null}
          <Icon name="chevronRight" size={14} className="ml-auto text-fg/30" />
        </Link>
      ) : null}
    </div>
  )
}
