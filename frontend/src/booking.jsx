import { useEffect, useState } from 'react'
import { api } from './api'
import { cls, fmtDate } from './format'
import { Button, Icon, Spinner, toastErr } from './ui'

/* Shared slot picker for video sessions with Ellice: the onboarding/verification
   call every new client books, and founders' day-5 check-in calls. */
export function SlotPicker({ kind = 'onboarding', onBooked, confirmLabel = 'Book my session', compact = false }) {
  const [days, setDays] = useState(null)
  const [duration, setDuration] = useState(45)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/onboarding/slots').then((r) => {
      setDays(r.days)
      setDuration(r.duration_min)
      if (r.days.length) setDate(r.days[0].date)
    }).catch(toastErr)
  }, [])

  if (!days) return <Spinner className={compact ? 'py-6' : ''} />
  if (days.length === 0) return <p className="text-sm text-fg/50">No open slots right now — check back shortly.</p>

  const day = days.find((d) => d.date === date) || days[0]
  const book = () => {
    setBusy(true)
    api.post('/onboarding/book', { kind, date: day.date, start_time: time })
      .then((s) => onBooked?.(s))
      .catch(toastErr)
      .finally(() => setBusy(false))
  }

  return (
    <div className="space-y-3">
      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button key={d.date} type="button" onClick={() => { setDate(d.date); setTime('') }}
            className={cls('shrink-0 rounded-xl border px-3 py-2 text-center transition-all',
              d.date === day.date ? 'border-copper ring-2 ring-copper/30 text-copper' : 'border-line text-fg/60 hover:border-copper/40')}>
            <span className="block text-xs font-semibold">{fmtDate(d.date)}</span>
            <span className="block text-[10px] text-fg/40">{d.times.length} slots</span>
          </button>
        ))}
      </div>
      <div className={cls('grid gap-1.5', compact ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-6')}>
        {day.times.map((t) => (
          <button key={t} type="button" onClick={() => setTime(t)}
            className={cls('rounded-lg border px-2 py-1.5 text-sm font-medium transition-all',
              t === time ? 'border-copper bg-copper/10 text-copper' : 'border-line text-fg/60 hover:border-copper/40')}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-fg/45">{duration}-minute video call{time ? ` · ${fmtDate(day.date)} at ${time}` : ''}</p>
        <Button size={compact ? 'sm' : 'md'} icon="calendar" disabled={!time || busy} onClick={book}>
          {busy ? 'Booking…' : confirmLabel}
        </Button>
      </div>
    </div>
  )
}

/* Confirmation card for a booked session. */
export function SessionCard({ session, title, onRebook, onCancelled, note }) {
  const cancel = () => {
    if (!window.confirm('Cancel this session? You can book a new time afterwards.')) return
    api.post(`/onboarding/cancel/${session.id}`).then(onCancelled).catch(toastErr)
  }
  return (
    <div className="rounded-2xl border border-copper/40 bg-copper/[0.06] p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-copper/15 p-2.5 text-copper"><Icon name="calendar" size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-fg/65">{fmtDate(session.date)} at {session.start_time} · {session.duration_min} min video call</p>
          {note && <p className="mt-2 text-sm leading-relaxed text-fg/55">{note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={session.meeting_url} target="_blank" rel="noreferrer">
              <Button size="sm" icon="external">Join the video call</Button>
            </a>
            {onRebook && <Button size="sm" variant="secondary" onClick={onRebook}>Pick another time</Button>}
            {onCancelled && <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Perks arrive either as plain strings (legacy) or {icon,title,text} badge objects. */
export const perkTitle = (p) => (typeof p === 'string' ? p : p.title)
export const perkText = (p) => (typeof p === 'string' ? '' : p.text)
export const perkIcon = (p) => (typeof p === 'string' ? 'check' : p.icon || 'check')
