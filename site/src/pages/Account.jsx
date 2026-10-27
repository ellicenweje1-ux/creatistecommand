import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CONTACT } from '../content/site.js'
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
