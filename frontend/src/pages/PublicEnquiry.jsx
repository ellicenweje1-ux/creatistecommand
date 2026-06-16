import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Brand, Button, Field, Input, Select, Spinner, Textarea } from '../ui'

async function publicFetch(path, opts) {
  const res = await fetch(`/api/public${path}`, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong')
  return data
}

export default function PublicEnquiry() {
  const { token } = useParams()
  const [business, setBusiness] = useState(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', event_type: 'Private dinner', date: '', guest_count: '', location: '', budget: '', message: '',
    company: '', // honeypot — stays empty for real users; bots that fill it are dropped
  })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    document.documentElement.classList.add('dark')
    publicFetch(`/enquiry/${token}`).then((d) => setBusiness(d.business)).catch((e) => setError(e.message))
  }, [token])

  const submit = (e) => {
    e.preventDefault()
    setBusy(true)
    publicFetch(`/enquiry/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, guest_count: Number(form.guest_count) || 0 }),
    }).then(() => setSent(true)).catch((er) => setError(er.message)).finally(() => setBusy(false))
  }

  return (
    <div className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Brand />
          {business && <p className="text-sm text-fg/50">Enquire with <span className="font-medium text-fg/75">{business}</span></p>}
        </div>
        {error && !business ? (
          <p className="text-center text-fg/60">{error}</p>
        ) : !business ? <Spinner /> : sent ? (
          <div className="rounded-2xl border border-copper/40 bg-copper/10 p-8 text-center">
            <p className="font-display text-2xl font-semibold">Thank you! 🥂</p>
            <p className="mt-2 text-sm text-fg/60">Your enquiry is with {business} — they'll be in touch shortly.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-card p-6 shadow-card">
            <h1 className="font-display text-xl font-semibold">Tell us about your event</h1>
            {/* Honeypot: positioned off-screen and hidden from assistive tech + tab order.
                Real people never fill it; bots that auto-complete every field get dropped. */}
            <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
              <label>Company<input type="text" tabIndex={-1} autoComplete="off" value={form.company} onChange={set('company')} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your name"><Input value={form.name} onChange={set('name')} required /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
            </div>
            <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Event type">
                <Select value={form.event_type} onChange={set('event_type')}>
                  {['Private dinner', 'Party / celebration', 'Wedding', 'Corporate', 'Meal prep', 'Other'].map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Date (if known)"><Input type="date" value={form.date} onChange={set('date')} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guests"><Input type="number" min="0" value={form.guest_count} onChange={set('guest_count')} /></Field>
              <Field label="Budget (optional)"><Input value={form.budget} onChange={set('budget')} placeholder="e.g. £1,500" /></Field>
            </div>
            <Field label="Location"><Input value={form.location} onChange={set('location')} placeholder="Venue or area" /></Field>
            <Field label="Tell us more"><Textarea rows={3} value={form.message} onChange={set('message')} placeholder="Occasion, dietary needs, style of food you love…" /></Field>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full" size="lg" disabled={busy}>{busy ? 'Sending…' : 'Send enquiry'}</Button>
          </form>
        )}
      </div>
    </div>
  )
}
