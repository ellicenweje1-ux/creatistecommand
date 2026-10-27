import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SETTINGS } from './content/site.js'
import { Eyebrow, Heading, Reveal } from './ui.jsx'

/* The live availability calendar: reads open / limited / full per day from The Creatiste Command
   (the chef's diary: bookings with their time windows, standing services, prep days, days off).
   Never a title, a client or a time. Open and limited days link to the enquiry form with the date set. */
const API = SETTINGS.apiBase && SETTINGS.enquiryToken ? `${SETTINGS.apiBase}/api/public/availability/${SETTINGS.enquiryToken}` : ''
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const LEGEND = [['open', 'Open', 'Free for a booking'], ['limited', 'Limited', 'Part of the day is committed. A slot may still fit, ask us'], ['full', 'Fully booked', 'Or a day off']]
const CELL = {
  open: 'border-gold/60 text-ivory hover:bg-gold hover:text-ink',
  limited: 'border-gold/30 bg-gold/15 text-ivory/90 hover:bg-gold/40',
  full: 'border-ink-3 bg-ink-2 text-smoke line-through decoration-smoke/60 cursor-not-allowed',
}

export default function AvailabilityCalendar({ months = 3 }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)
  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), [])
  useEffect(() => {
    if (!API) return
    const to = new Date(today); to.setMonth(to.getMonth() + months); to.setDate(0)
    fetch(`${API}?from_date=${iso(today)}&to_date=${iso(to)}`).then((r) => (r.ok ? r.json() : Promise.reject(r))).then(setData).catch(() => setErr(true))
  }, [today, months])
  const states = useMemo(() => Object.fromEntries((data?.days || []).map((d) => [d.date, d.state])), [data])
  const grids = useMemo(() => Array.from({ length: months }, (_, i) => {
    const first = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const lead = (first.getDay() + 6) % 7
    return { label: first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), lead, days: Array.from({ length: n }, (_, k) => new Date(first.getFullYear(), first.getMonth(), k + 1)) }
  }), [today, months])

  if (!API || err || (data && !data.public)) {
    return (
      <div className="border border-dashed border-ink-3 p-7 font-body text-[14px] font-light leading-relaxed text-smoke" data-availability="off">
        {!API ? 'The live availability calendar appears here once this site is connected to our diary.' : 'Our live availability isn’t showing right now. Tell us your date and we will come straight back to you.'} <Link to="/enquire" className="link-under text-ivory/90">Enquire with your date</Link>.
      </div>
    )
  }
  return (
    <div data-availability={data ? 'live' : 'loading'}>
      <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Key">
        {LEGEND.map(([k, l, d]) => <li key={k} className="flex items-center gap-2 font-body text-[12px] text-ivory/80"><span className={`inline-block h-4 w-4 border ${CELL[k].split(' ').slice(0, 2).join(' ')}`} aria-hidden="true" /><span>{l}</span><span className="text-smoke">· {d}</span></li>)}
      </ul>
      <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {grids.map((g) => (
          <Reveal key={g.label} className="min-w-0">
            <p className="font-display text-[20px]">{g.label}</p>
            <div className="mt-3 grid grid-cols-7 gap-1 font-body text-[11px] uppercase tracking-wide text-smoke">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="py-1 text-center">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1" role="grid">
              {Array.from({ length: g.lead }, (_, i) => <span key={`l${i}`} />)}
              {g.days.map((d) => {
                const k = iso(d), st = states[k], past = d < today, beyond = data && data.horizon && k > data.horizon
                if (past || beyond || !st) return <span key={k} className="flex aspect-square items-center justify-center border border-transparent font-body text-[13px] text-ink-3" aria-hidden="true">{d.getDate()}</span>
                const label = `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}: ${LEGEND.find(([x]) => x === st)[1]}`
                return st === 'full'
                  ? <span key={k} className={`flex aspect-square items-center justify-center border font-body text-[13px] ${CELL.full}`} title={label} aria-label={label} data-day={k} data-state={st}>{d.getDate()}</span>
                  : <Link key={k} to={`/enquire?date=${k}`} className={`flex aspect-square items-center justify-center border font-body text-[13px] transition-colors ${CELL[st]}`} title={label} aria-label={`${label}. Enquire for this date`} data-day={k} data-state={st}>{d.getDate()}</Link>
              })}
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 font-body text-[12px] text-smoke">Tap an open or limited day to enquire for it. Availability updates live from our diary; a date is only held once your quotation is accepted.</p>
    </div>
  )
}

export function AvailabilityBlock() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal><Eyebrow>Live availability</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5 max-w-xl">Which days are free.</Heading></Reveal>
        </div>
        <Reveal delay={2}><p className="max-w-md font-body text-[14px] font-light leading-relaxed text-ivory/70">Straight from our diary: the days already blocked off, and the days with room. Pick yours and we take it from there at consultation.</p></Reveal>
      </div>
      <div className="mt-10"><AvailabilityCalendar /></div>
    </>
  )
}
