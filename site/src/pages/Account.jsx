import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CLEAN_DREAM, CONTACT, DATE_HOLD } from '../content/site.js'
import { Arrow, Button, Eyebrow, Heading, Reveal, Section } from '../ui.jsx'
import { ACCOUNT_API, REORDER_KEY, accountFetch, clearCustomer, getCustomer, setCustomer, useCustomer } from '../account.js'

const money = (n) => `£${Number(n || 0).toFixed(2)}`
const fmt = (iso) => iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''
const STATUS = { enquiry: 'Enquiry received', quoted: 'Quote sent', confirmed: 'Confirmed', in_prep: 'In preparation', completed: 'Completed', cancelled: 'Cancelled', pending_payment: 'Awaiting payment', paid: 'Paid', collected: 'Collected', refunded: 'Refunded', pending: 'Awaiting approval', approved: 'Showing on the site', hidden: 'Not shown', private: 'Private' }

export default function Account() {
  const customer = useCustomer()
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-16">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>Your account</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{customer ? `Welcome back${customer.name ? `, ${customer.name.split(' ')[0]}` : ''}.` : 'Sign in, no password needed.'}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{customer ? 'Your enquiries, Clean Dream orders and reviews, in one place. Re-order a previous lunch in one tap.' : 'Type your email and we send you a six-digit code. Once you are in, your enquiries and orders are logged, your details are remembered on every form, and a repeat Clean Dream order is one tap.'}</p></Reveal>
        </div>
      </section>
      <Section ground="ivory">
        {!ACCOUNT_API ? (
          <div className="mx-auto max-w-xl border border-sand bg-linen p-8" data-account-offline>
            <p className="font-display text-[22px]">Accounts open with the live site.</p>
            <p className="mt-3 font-body text-[15px] font-light leading-relaxed text-ink/75">Sign-in is switched on once this site is connected to our booking system. In the meantime you can <Link to="/enquire" className="link-under text-gold-deep">enquire</Link> or <Link to="/cleandream" className="link-under text-gold-deep">order Clean Dream</Link> as a guest.</p>
          </div>
        ) : customer ? <Dashboard /> : <SignIn />}
      </Section>
    </>
  )
}

function SignIn() {
  const [step, setStep] = useState('email') // email | code
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [state, setState] = useState({ status: 'idle', error: '' })
  const send = async (e) => {
    e.preventDefault(); setState({ status: 'sending', error: '' })
    try { await accountFetch('/login', { method: 'POST', body: JSON.stringify({ email, name, company: '' }) }); setStep('code'); setState({ status: 'idle', error: '' }) } catch (err) { setState({ status: 'error', error: err.message }) }
  }
  const verify = async (e) => {
    e.preventDefault(); setState({ status: 'sending', error: '' })
    try {
      const j = await accountFetch('/verify', { method: 'POST', body: JSON.stringify({ email, code }) })
      setCustomer({ token: j.token, ...j.customer })
    } catch (err) { setState({ status: 'error', error: err.message }) }
  }
  return (
    <div className="mx-auto max-w-xl border border-sand bg-linen p-7 sm:p-10" data-signin>
      {step === 'email' ? (
        <form onSubmit={send} className="space-y-5">
          <div><label htmlFor="a-email" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Email <span className="text-gold-deep">*</span></label><input id="a-email" type="email" className="field-ivory mt-1" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label htmlFor="a-name" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Your name (first time only)</label><input id="a-name" className="field-ivory mt-1" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          {state.error ? <p className="font-body text-[13px] text-red-700">{state.error}</p> : null}
          <Button type="submit" variant="ink" disabled={state.status === 'sending'} className="w-full">{state.status === 'sending' ? 'Sending your code…' : 'Email me a sign-in code'} <Arrow /></Button>
          <p className="font-body text-[12px] text-stone">We only use your email to sign you in and to reply to you. Nothing is shared.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5" data-code-step>
          <p className="font-body text-[15px] text-ink/80">We’ve emailed a six-digit code to <strong>{email}</strong>. It works for 15 minutes.</p>
          <div><label htmlFor="a-code" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Code</label><input id="a-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" className="field-ivory mt-1 tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value)} required /></div>
          {state.error ? <p className="font-body text-[13px] text-red-700">{state.error}</p> : null}
          <Button type="submit" variant="ink" disabled={state.status === 'sending'} className="w-full">{state.status === 'sending' ? 'Checking…' : 'Sign in'} <Arrow /></Button>
          <button type="button" onClick={() => { setStep('email'); setCode('') }} className="font-body text-[11px] uppercase tracking-wide text-stone hover:text-ink">Use a different email or resend</button>
        </form>
      )}
    </div>
  )
}

/* Regular / already-consulted clients hold a personal chef day with a small bank-transfer deposit. Shown only when Command says they are eligible. */
function useCountdown(iso) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!iso) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [iso])
  if (!iso) return ''
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'expired'
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${String(m).padStart(2, '0')}m left`
}

function HoldRow({ h, bank }) {
  const left = useCountdown(h.stage === 'awaiting_deposit' ? h.expires_at : '')
  const [copied, setCopied] = useState(false)
  const text = `${bank.name}\n${bank.bank}\nAccount number ${bank.account}\nSort code ${bank.sort}\nReference ${h.reference}\nAmount ${money(h.amount)}`
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }
  const label = { requested: 'Held for you, waiting for us to confirm', awaiting_deposit: 'We are free. Send your deposit', confirmed: 'Locked in' }[h.stage] || h.stage
  return (
    <li className="py-5" data-hold data-hold-status={h.stage}>
      <p className="font-display text-[20px]">{fmt(h.date)} <span className="font-body text-[12px] uppercase tracking-wide text-gold-deep">· {label}</span></p>
      <p className="mt-1 font-body text-[13px] text-stone">{h.service}{h.stage === 'confirmed' ? ` · ${money(h.amount)} deposit received` : ''}{h.stage === 'awaiting_deposit' && left && left !== 'expired' ? ` · ${left}` : ''}</p>
      {h.stage === 'requested' ? <p className="mt-2 font-body text-[13px] font-light text-ink/75" data-hold-note>Nothing to pay yet. We will email you the moment we have confirmed this date.</p> : null}
      {h.stage === 'awaiting_deposit' && left !== 'expired' ? (
        <div className="mt-4 border border-sand bg-ivory p-5" data-hold-bank>
          <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Pay {money(h.amount)} by bank transfer to lock this date in</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 font-body text-[14px]">
            <dt className="text-stone">Name</dt><dd>{bank.name}</dd>
            <dt className="text-stone">Bank</dt><dd>{bank.bank}</dd>
            <dt className="text-stone">Account</dt><dd>{bank.account}</dd>
            <dt className="text-stone">Sort code</dt><dd>{bank.sort}</dd>
            <dt className="text-stone">Reference</dt><dd data-hold-ref className="font-medium">{h.reference}</dd>
            <dt className="text-stone">Amount</dt><dd>{money(h.amount)}</dd>
          </dl>
          <button type="button" onClick={copy} className="mt-4 font-body text-[11px] uppercase tracking-wide text-gold-deep link-under">{copied ? 'Copied' : 'Copy the details'}</button>
        </div>
      ) : null}
      {h.stage === 'awaiting_deposit' && left === 'expired' ? <p className="mt-3 font-body text-[13px] text-stone">The deposit time has run out and the date has been released. You are welcome to ask for it again if it is still free.</p> : null}
    </li>
  )
}

/* A real month calendar over the booking window. Free days for the chosen service are gold and tappable (any number, up to the limit).
   Every other day says why when tapped: too soon (the service's notice), a day it doesn't run, or already booked. */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']
const pad2 = (n) => String(n).padStart(2, '0')
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
function whyNot(key, { service, rule, workDays, mine }) {
  if (mine && mine.includes(key)) return { kind: 'mine', text: `You already have ${fmt(key)} held. It is listed under Your dates below.` }
  const wd = (new Date(`${key}T12:00:00`).getDay() + 6) % 7
  if (rule && key < rule.first_date) return { kind: 'soon', text: `${fmt(key)} is too soon. ${service} needs at least ${plural(rule.notice_days, 'day')}’ notice, so the first date you can ask for is ${fmt(rule.first_date)}. For anything sooner, message us on WhatsApp.` }
  if (workDays && !workDays.includes(wd)) return { kind: 'closed', text: `We don’t work on ${DAY_NAMES[wd]}.` }
  if (rule && (rule.days || []).length && !rule.days.includes(wd)) return { kind: 'closed', text: `${service} runs on ${rule.days.map((d) => DAY_NAMES[d]).join(', ').replace(/, ([^,]*)$/, ' and $1')} only.` }
  return { kind: 'taken', text: `${fmt(key)} is already booked up for ${service}. Please pick another date, or message us and we will see what we can do.` }
}
function HoldCalendar({ dates, windowDays, picked, onToggle, max, service, rule, workDays, mine }) {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const last = new Date(today); last.setDate(last.getDate() + windowDays)
  const free = new Set(dates)
  const months = []
  for (let m = new Date(today.getFullYear(), today.getMonth(), 1); m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) months.push(m)
  const [idx, setIdx] = useState(0)
  const [why, setWhy] = useState(null)
  useEffect(() => { setWhy(null) }, [service])
  const m = months[Math.min(idx, months.length - 1)]
  const first = new Date(m.getFullYear(), m.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(new Date(m.getFullYear(), m.getMonth(), d, 12))
  const full = picked.length >= max
  const style = { soon: 'text-ink/30', closed: 'text-ink/25', taken: 'text-ink/30 line-through decoration-ink/20', mine: 'text-gold-deep underline decoration-gold-deep/60 underline-offset-4' }
  return (
    <div className="mt-3 max-w-md border border-sand bg-ivory p-4 sm:p-5" data-hold-calendar>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setIdx(idx - 1)} disabled={idx === 0} aria-label="Previous month" className="px-2 py-1 font-body text-[18px] text-ink disabled:opacity-25">‹</button>
        <p className="font-display text-[20px]" data-cal-month>{m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        <button type="button" onClick={() => setIdx(idx + 1)} disabled={idx >= months.length - 1} aria-label="Next month" className="px-2 py-1 font-body text-[18px] text-ink disabled:opacity-25">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => <span key={d} className="font-body text-[10px] uppercase tracking-eyebrow text-stone">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />
          const key = isoOf(d)
          const inWindow = d >= new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0) && d <= last
          if (!inWindow) return <span key={key} className="py-2 font-body text-[13px] text-ink/10" aria-hidden="true">{d.getDate()}</span>
          const ok = free.has(key), on = picked.includes(key)
          const no = ok ? null : whyNot(key, { service, rule, workDays, mine })
          const tap = () => { if (ok) { setWhy(null); if (on || !full) onToggle(key) } else setWhy({ key, ...no }) }
          return (
            <button key={key} type="button" onClick={tap} data-cal-day={key} data-cal-state={on ? 'selected' : ok ? 'free' : no.kind}
              aria-disabled={ok && !on && full} aria-label={`${fmt(key)}${ok ? ', free' : ', not available'}`} aria-pressed={on}
              className={`py-2 font-body text-[14px] transition-colors ${on ? 'bg-ink text-ivory' : ok ? `border border-gold-deep/70 text-ink hover:bg-gold/20 ${full ? 'opacity-40' : ''}` : style[no.kind]} ${why?.key === key ? 'ring-1 ring-gold-deep' : ''}`}>{d.getDate()}</button>
          )
        })}
      </div>
      {why ? <p className="mt-3 border-l-2 border-gold-deep pl-3 font-body text-[13px] leading-relaxed text-ink/80" data-cal-why={why.kind}>{why.text}</p> : null}
      <p className="mt-3 font-body text-[11px] text-stone">Gold outline: free. Underlined in gold: already yours. Faded: too soon, or a day we don’t do this. Struck through: booked up. Tap any date to see why. Tick as many as you need, up to {max} at a time.</p>
    </div>
  )
}

function ReserveLocked({ amount }) {
  const L = DATE_HOLD.locked
  return (
    <section data-reserve-locked className="border border-sand bg-linen p-7 sm:p-9">
      <Eyebrow className="text-gold-deep">{DATE_HOLD.eyebrow}</Eyebrow>
      <Heading size="md" className="mt-3">{L.title}</Heading>
      <p className="mt-4 max-w-2xl font-body text-[15px] font-light leading-relaxed text-ink/80">{L.body}</p>
      <ul className="mt-5 grid gap-1 font-body text-[13px] font-light leading-relaxed text-ink/75">
        {DATE_HOLD.how.map((r) => <li key={r} className="flex gap-3"><span className="mt-[9px] h-px w-3 shrink-0 bg-gold-deep" aria-hidden="true" />{r}</li>)}
        <li className="flex gap-3"><span className="mt-[9px] h-px w-3 shrink-0 bg-gold-deep" aria-hidden="true" />The deposit is {money(amount)} per date, taken off your final invoice.</li>
      </ul>
      <p className="mt-5 font-body text-[13px] text-stone">{L.hint}</p>
      <div className="mt-6"><Button to="/enquire" variant="ink">{L.cta} <Arrow /></Button></div>
    </section>
  )
}

function ReserveDate() {
  const [info, setInfo] = useState(null)
  const [f, setF] = useState({ service: '', picked: [], note: '' })
  const [state, setState] = useState({ status: 'idle', error: '' })
  const load = () => accountFetch('/holds').then(setInfo).catch(() => setInfo({ eligible: false }))
  useEffect(() => { load() }, [])
  if (!info) return null
  if (!info.eligible) return (info.services || []).length ? <ReserveLocked amount={info.amount} /> : null
  const bank = CLEAN_DREAM.bank
  const dates = (info.dates_by_service || {})[f.service] || []
  const rule = (info.service_rules || {})[f.service]
  const toggle = (d) => setF((p) => ({ ...p, picked: p.picked.includes(d) ? p.picked.filter((x) => x !== d) : [...p.picked, d].sort() }))
  const submit = async (e) => {
    e.preventDefault(); setState({ status: 'sending', error: '' })
    try { await accountFetch('/hold', { method: 'POST', body: JSON.stringify({ dates: f.picked, service: f.service, note: f.note }) }); setF({ service: f.service, picked: [], note: '' }); setState({ status: 'idle', error: '' }); await load() } catch (err) { setState({ status: 'error', error: err.message }); load() }
  }
  const order = { awaiting_deposit: 0, requested: 1, confirmed: 2 }
  const holds = [...(info.holds || [])].sort((a, b) => (order[a.stage] ?? 3) - (order[b.stage] ?? 3) || a.date.localeCompare(b.date))
  const n = f.picked.length
  return (
    <section data-reserve className="border border-gold/60 bg-linen p-7 sm:p-9">
      <Eyebrow className="text-gold-deep">{DATE_HOLD.eyebrow}</Eyebrow>
      <Heading size="md" className="mt-3">{DATE_HOLD.title}</Heading>
      <p className="mt-4 max-w-2xl font-body text-[15px] font-light leading-relaxed text-ink/80">{DATE_HOLD.intro}</p>
      <form onSubmit={submit} className="mt-7 space-y-6" data-reserve-form>
        <div className="max-w-sm">
          <label htmlFor="r-service" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">1. What do you need? <span className="text-gold-deep">*</span></label>
          <select id="r-service" className="field-ivory mt-1" value={f.service} onChange={(e) => setF({ service: e.target.value, picked: [], note: f.note })} required>
            <option value="">Choose a service</option>
            {(info.services || []).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        {f.service ? (
          <div data-date-picker>
            <p className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">2. Tick your dates <span className="text-gold-deep">*</span></p>
            {rule ? <p className="mt-1 font-body text-[13px] text-ink/75" data-notice-line>{rule.notice_days ? <>{f.service} needs at least {plural(rule.notice_days, 'day')}’ notice, so the first date you can ask for is <strong>{fmt(rule.first_date)}</strong>.</> : <>{f.service} can be asked for from today.</>}{(rule.days || []).length ? ` It runs on ${rule.days.map((d) => DAY_NAMES[d]).join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : ''}</p> : null}
            <HoldCalendar dates={dates} windowDays={info.window_days ?? 60} picked={f.picked} onToggle={toggle} max={info.max_dates ?? 6} service={f.service} rule={rule} workDays={info.work_days} mine={(info.holds || []).filter((h) => h.stage !== 'cancelled').map((h) => h.date)} />
            <p className="mt-3 font-body text-[13px] text-ink/80" data-picked>{n ? <>Selected: <strong>{f.picked.map((d) => fmt(d)).join(' · ')}</strong></> : dates.length ? 'Free dates for this service are outlined in gold.' : 'No free dates for this service right now. Message us and we will find one.'}</p>
          </div>
        ) : null}
        {f.service ? (
          <div className="max-w-xl">
            <label htmlFor="r-note" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Anything we should know (optional)</label>
            <input id="r-note" className="field-ivory mt-1" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} />
          </div>
        ) : null}
        {state.error ? <p className="font-body text-[13px] text-red-700" data-reserve-error>{state.error}</p> : null}
        <div>
          <Button type="submit" variant="ink" disabled={state.status === 'sending' || !n}>{state.status === 'sending' ? 'Holding your dates…' : n ? `Hold ${n} ${n === 1 ? 'date' : 'dates'} for me` : 'Choose a date to hold'} <Arrow /></Button>
          <p className="mt-2 font-body text-[12px] text-stone" data-deposit-note>Nothing to pay yet. Once we confirm we are free, the deposit is {money(info.amount)} per date{n > 1 ? ` (${money(info.amount * n)} for these ${n})` : ''}.</p>
        </div>
      </form>
      <ul className="mt-6 grid gap-1 font-body text-[13px] font-light leading-relaxed text-ink/75" data-reserve-rules>
        {DATE_HOLD.rules.map((r) => <li key={r} className="flex gap-3"><span className="mt-[9px] h-px w-3 shrink-0 bg-gold-deep" aria-hidden="true" />{r}</li>)}
      </ul>
      {holds.length ? (
        <div className="mt-8" data-holds>
          <Eyebrow className="text-gold-deep">Your dates</Eyebrow>
          <ul className="mt-2 divide-y divide-sand border-y border-sand">{holds.map((h) => <HoldRow key={h.id} h={h} bank={bank} />)}</ul>
          <p className="mt-4 font-body text-[12px] text-stone">{DATE_HOLD.moveNote}</p>
        </div>
      ) : null}
    </section>
  )
}

function Dashboard() {
  const nav = useNavigate()
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)
  useEffect(() => { accountFetch('/me').then(setMe).catch((e) => setErr(e.message)) }, [])
  const save = async (e) => {
    e.preventDefault()
    try { const p = await accountFetch('/me', { method: 'PATCH', body: JSON.stringify(edit) }); setCustomer({ ...getCustomer(), ...p }); setMe((m) => ({ ...m, customer: p })); setEdit(null) } catch (ex) { setErr(ex.message) }
  }
  const reorder = (o) => { try { sessionStorage.setItem(REORDER_KEY, JSON.stringify({ boxes: o.boxes, fulfilment: o.fulfilment, delivery_address: o.delivery_address, allergies: o.allergies })) } catch {} nav('/cleandream?reorder=1') }
  if (err) return <p className="font-body text-[15px] text-red-700">{err} <button type="button" onClick={clearCustomer} className="link-under">Sign in again</button>.</p>
  if (!me) return <p className="font-body text-[14px] text-stone">Loading your account…</p>
  const c = me.customer
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14" data-dashboard>
      <aside className="lg:col-span-4">
        <div className="border border-sand bg-linen p-7">
          <Eyebrow className="text-gold-deep">Your details</Eyebrow>
          {edit ? (
            <form onSubmit={save} className="mt-4 space-y-4">
              <div><label htmlFor="e-name" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Name</label><input id="e-name" className="field-ivory mt-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><label htmlFor="e-phone" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Phone</label><input id="e-phone" type="tel" className="field-ivory mt-1" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              <div className="flex gap-3"><Button type="submit" variant="ink">Save</Button><button type="button" onClick={() => setEdit(null)} className="font-body text-[11px] uppercase tracking-wide text-stone">Cancel</button></div>
            </form>
          ) : (
            <dl className="mt-4 space-y-2 font-body text-[14px]">
              <div><dt className="text-[11px] uppercase tracking-eyebrow text-stone">Name</dt><dd data-me-name>{c.name || 'Not set'}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-eyebrow text-stone">Email</dt><dd>{c.email}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-eyebrow text-stone">Phone</dt><dd>{c.phone || 'Not set'}</dd></div>
            </dl>
          )}
          {!edit ? <button type="button" onClick={() => setEdit({ name: c.name || '', phone: c.phone || '' })} className="mt-4 font-body text-[11px] uppercase tracking-wide text-gold-deep link-under">Edit details</button> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to="/cleandream" variant="ink">Order Clean Dream</Button>
            <Button to="/enquire" variant="ghost-ink">Enquire</Button>
          </div>
          <button type="button" onClick={clearCustomer} className="mt-8 font-body text-[11px] uppercase tracking-wide text-stone hover:text-ink" data-signout>Sign out</button>
        </div>
        <p className="mt-5 font-body text-[12px] leading-relaxed text-stone">Quick question? Use the live chat (bottom right) or email <a href={`mailto:${CONTACT.email}`} className="link-under">{CONTACT.email}</a>.</p>
      </aside>
      <div className="space-y-12 lg:col-span-8">
        <ReserveDate />
        <section data-orders>
          <div className="flex items-end justify-between gap-4"><Heading size="md">Clean Dream orders</Heading><span className="font-body text-[12px] text-stone">{me.orders.length} {me.orders.length === 1 ? 'order' : 'orders'}</span></div>
          {me.orders.length ? (
            <ul className="mt-6 divide-y divide-sand border-y border-sand">
              {me.orders.map((o) => (
                <li key={o.public_id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-display text-[20px]">{fmt(o.date)} <span className="font-body text-[12px] uppercase tracking-wide text-gold-deep">· {STATUS[o.status] || o.status}</span></p>
                    <p className="mt-1 font-body text-[13px] text-stone">{o.fulfilment === 'delivery' ? `Delivery to ${o.delivery_address}` : o.slot} · {money(o.total)}</p>
                    <ul className="mt-2 space-y-1">{o.boxes.map((b, i) => <li key={i} className="font-body text-[14px] text-ink/80"><span className="font-display text-[15px]">{b.for}</span> · {b.item} <span className="text-stone">({b.summary})</span></li>)}</ul>
                  </div>
                  <div className="sm:text-right"><Button variant="ink" onClick={() => reorder(o)} data-reorder>Order this again <Arrow /></Button></div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 font-body text-[14px] font-light text-ink/70">No Clean Dream orders yet. <Link to="/cleandream" className="link-under text-gold-deep">Build your first bowl</Link>, and it will be saved here for a one-tap repeat.</p>}
        </section>
        <section data-enquiries>
          <div className="flex items-end justify-between gap-4"><Heading size="md">Enquiries and bookings</Heading><span className="font-body text-[12px] text-stone">{me.enquiries.length}</span></div>
          {me.enquiries.length ? (
            <ul className="mt-6 divide-y divide-sand border-y border-sand">
              {me.enquiries.map((b) => (
                <li key={b.id} className="py-5">
                  <p className="font-display text-[20px]">{b.title} <span className="font-body text-[12px] uppercase tracking-wide text-gold-deep">· {STATUS[b.status] || b.status}</span></p>
                  <p className="mt-1 font-body text-[13px] text-stone">{[b.event_type, b.date ? fmt(b.date) : '', b.guest_count ? `${b.guest_count} guests` : '', b.venue_name].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 font-body text-[14px] font-light text-ink/70">Nothing yet. <Link to="/enquire" className="link-under text-gold-deep">Tell us about your table</Link> and it will be logged here.</p>}
        </section>
        <section data-reviews>
          <Heading size="md">Your reviews</Heading>
          {me.reviews.length ? (
            <ul className="mt-6 space-y-4">{me.reviews.map((r) => <li key={r.id} className="border border-sand bg-linen p-5"><p className="text-gold-deep">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} <span className="ml-2 font-body text-[11px] uppercase tracking-wide text-stone">{STATUS[r.status] || r.status}</span></p><p className="mt-2 font-display text-[18px] text-ink/90">“{r.comment}”</p>{r.event_name ? <p className="mt-1 font-body text-[12px] text-stone">{r.event_name}</p> : null}</li>)}</ul>
          ) : <p className="mt-4 font-body text-[14px] font-light text-ink/70">Cooked for you? <Link to="/portfolio#leave-a-review" className="link-under text-gold-deep">Leave a review</Link>.</p>}
        </section>
      </div>
    </div>
  )
}
