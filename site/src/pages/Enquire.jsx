import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CONTACT, ENQUIRE, HOME_EDIT_PACKAGES, PERSONAL_CHEF, PRIVATE_CATERING, RECOMMENDED_BUDGET, SETTINGS } from '../content/site.js'
import { Arrow, Button, Eyebrow, Heading, Reveal, Section } from '../ui.jsx'

/* ── Questions per lane ─────────────────────────────────────────────────────
   Each field: { k, label, type: text|email|tel|date|time|number|select|radio|textarea|check, options?, req?, half?, hint? } */
const PC_SERVICES = [...PERSONAL_CHEF.services.map((s) => s.name), 'Not sure yet, advise me']
const CAT_SERVICES = [...PRIVATE_CATERING.services.filter((s) => s.slug !== 'the-creatiste-table').map((s) => s.name), 'The Loaded Bar for another occasion', 'Not sure yet, advise me']

const LANE_FIELDS = {
  'personal-chef': [
    { k: 'service', label: 'Which service?', type: 'radio', options: PC_SERVICES, req: true },
    { k: 'package', label: 'Which Home Edit package?', type: 'select', options: [...HOME_EDIT_PACKAGES.items.map((p) => `${p.name} (${p.cover})`), 'Not sure yet, advise me'], showIf: (a) => a.service === 'The Home Edit' },
    { k: 'household', label: 'How many people are we feeding?', type: 'select', options: ['1', '2', '3', '4+'], half: true },
    { k: 'frequency', label: 'How often?', type: 'select', options: ['Weekly', 'Fortnightly', 'One-off', 'Not sure'], half: true },
    { k: 'date', label: 'When would you like to start?', type: 'date', half: true },
    { k: 'area', label: 'Postcode', type: 'text', half: true, placeholder: 'e.g. W5 2AB' },
    { k: 'focus', label: 'Food focuses & dietary needs', type: 'textarea', placeholder: 'High protein, halal, no shellfish, Nigerian & Caribbean favourites…' },
    { k: 'budget_per', label: 'This budget is', type: 'select', options: ['Weekly', 'Monthly', 'Per visit'], half: true },
    { k: 'budget', label: 'Rough budget', type: 'text', half: true, placeholder: 'Your figure', hint: (a) => { const r = RECOMMENDED_BUDGET[a.service]?.[a.budget_per || 'Weekly']; return r ? `We recommend a budget starting at £${r} ${(a.budget_per || 'Weekly').toLowerCase()} for ${a.service}.` : 'Pick a service and a frequency to see our recommended starting budget.' } },
  ],
  'private-catering': [
    { k: 'service', label: 'Which service?', type: 'radio', options: CAT_SERVICES, req: true },
    { k: 'date', label: 'Event date', type: 'date', half: true, req: true },
    { k: 'guests', label: 'Guest capacity', type: 'number', half: true, placeholder: 'Approximate headcount', req: true },
    { k: 'start', label: 'Event start time', type: 'time', half: true },
    { k: 'end', label: 'Event end time', type: 'time', half: true },
    { k: 'event_type', label: 'Type of event', type: 'select', options: ['Corporate / office', 'Product launch', 'Birthday', 'Anniversary', 'Private dinner', 'Baby shower', 'Wedding-adjacent', 'Other'], half: true },
    { k: 'venue', label: 'Venue & postcode', type: 'text', half: true, placeholder: 'Office, home, hired space…' },
    { k: 'dietary', label: 'Any major dietary requirements', type: 'textarea', placeholder: 'Allergies, vegetarian counts, halal / kosher needs…', hint: 'We’ll go in depth during consultation.' },
    { k: 'deck', label: 'Send me The Loaded Bar deck', type: 'check' },
  ],
  'creatiste-table': [
    { k: 'date', label: 'Date', type: 'date', half: true, req: true },
    { k: 'guests', label: 'Number of guests', type: 'number', half: true, req: true },
    { k: 'occasion', label: 'The occasion', type: 'text', placeholder: 'An anniversary dinner for eight, a supper for friends…' },
    { k: 'venue', label: 'Venue & postcode', type: 'text', half: true },
    { k: 'budget', label: 'Budget per head, if you have one', type: 'text', half: true, placeholder: 'Optional' },
    { k: 'dietary', label: 'Dietary requirements & dislikes', type: 'textarea' },
  ],
  'pricing-guide': [
    { k: 'interest', label: 'What are you weighing up?', type: 'radio', options: ['Personal chef services', 'Private catering / The Loaded Bar', 'The Creatiste Table', 'Not sure yet'], req: true },
    { k: 'timing', label: 'When might you need us?', type: 'select', options: ['This month', 'Next 1–3 months', 'Later this year', 'Just exploring'], half: true },
    { k: 'guests', label: 'Roughly how many people?', type: 'text', half: true },
  ],
  events: [
    { k: 'interest', label: 'What would you like?', type: 'radio', options: ['Keep me posted on pop-ups & events', 'Collaborate on a pop-up or activation', 'Something else'], req: true },
    { k: 'note', label: 'Tell us more', type: 'textarea', placeholder: 'A venue, a date, an idea…' },
  ],
}

const LANE_LABEL = Object.fromEntries(ENQUIRE.lanes.map((l) => [l.id, l.label]))

function Field({ f, value, onChange, answers }) {
  const id = `f-${f.k}`
  const hint = typeof f.hint === 'function' ? f.hint(answers || {}) : f.hint
  const label = <label htmlFor={id} className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">{f.label}{f.req ? <span className="text-gold"> *</span> : null}</label>
  if (f.type === 'radio') {
    return (
      <fieldset className="sm:col-span-2">
        <legend className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">{f.label}{f.req ? <span className="text-gold"> *</span> : null}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {f.options.map((o) => (
            <label key={o} className={`cursor-pointer border px-4 py-2.5 font-body text-[13px] transition-colors ${value === o ? 'border-gold bg-gold text-ink' : 'border-ink-3 text-ivory/85 hover:border-gold/60'}`}>
              <input type="radio" name={f.k} value={o} checked={value === o} onChange={() => onChange(o)} className="sr-only" />{o}
            </label>
          ))}
        </div>
      </fieldset>
    )
  }
  if (f.type === 'check') {
    return (
      <label className="flex cursor-pointer items-center gap-3 font-body text-[14px] text-ivory/85 sm:col-span-2">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-gold" />{f.label}
      </label>
    )
  }
  const wrap = f.half ? '' : 'sm:col-span-2'
  if (f.type === 'select') {
    return (
      <div className={wrap}>{label}
        <select id={id} className="field mt-1" value={value || ''} onChange={(e) => onChange(e.target.value)} required={f.req}>
          <option value="">Select…</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }
  if (f.type === 'textarea') {
    return (
      <div className={wrap}>{label}
        <textarea id={id} rows={3} className="field mt-1 resize-y" placeholder={f.placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} required={f.req} />
        {hint ? <p className="mt-2 font-body text-[11px] uppercase tracking-wide text-smoke">{hint}</p> : null}
      </div>
    )
  }
  return (
    <div className={wrap}>{label}
      <input id={id} type={f.type} className="field mt-1" placeholder={f.placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} required={f.req} min={f.type === 'number' ? 1 : undefined} />
      {hint ? <p className="mt-2 font-body text-[12px] text-gold-light/90">{hint}</p> : null}
    </div>
  )
}

/* Compose the Command payload from the lane answers. Everything the Command
   enquiry endpoint doesn't have a column for goes into `message`. */
function buildPayload(lane, a, c) {
  const fields = LANE_FIELDS[lane] || []
  const lines = fields.filter((f) => (!f.showIf || f.showIf(a)) && a[f.k] !== undefined && a[f.k] !== '' && a[f.k] !== false).map((f) => `${f.label}: ${a[f.k] === true ? 'Yes' : a[f.k]}`)
  if (c.message) lines.push(`Message: ${c.message}`)
  if (c.contact_pref) lines.push(`Preferred contact: ${c.contact_pref}`)
  const service = a.service || a.interest || ''
  return {
    name: c.name, email: c.email, phone: c.phone,
    event_type: [LANE_LABEL[lane], service].filter(Boolean).join(' · '),
    date: a.date || '',
    guest_count: a.guests || a.household || a.lunches || 0,
    location: a.venue || a.area || '',
    budget: [a.budget, a.budget_per].filter(Boolean).join(' '),
    message: `[${LANE_LABEL[lane]}] via thecreatistecatering.com\n` + lines.join('\n'),
    company: c.company || '',
  }
}

export default function Enquire() {
  const [params, setParams] = useSearchParams()
  const lane = params.get('lane') || ''
  const [answers, setAnswers] = useState({})
  const [contact, setContact] = useState({ name: '', email: '', phone: '', contact_pref: '', message: '', company: '' })
  const [state, setState] = useState({ status: 'idle', error: '' })
  const fields = LANE_FIELDS[lane]

  // Deep links can pre-answer the service (e.g. ?service=the-loaded-bar&deck=1).
  useEffect(() => {
    const svc = params.get('service')
    const all = [...PERSONAL_CHEF.services, ...PRIVATE_CATERING.services]
    const found = all.find((s) => s.slug === svc)
    setAnswers((prev) => ({ ...prev, ...(found ? { service: found.name } : {}), ...(params.get('deck') ? { deck: true } : {}) }))
  }, [params])

  const setLane = (id) => { setParams(id ? { lane: id } : {}); setState({ status: 'idle', error: '' }) }
  const setA = (k, v) => setAnswers((p) => ({ ...p, [k]: v }))
  const setC = (k, v) => setContact((p) => ({ ...p, [k]: v }))

  const canSend = useMemo(() => contact.name.trim() && contact.email.trim() && (fields || []).filter((f) => !f.showIf || f.showIf(answers)).every((f) => !f.req || (answers[f.k] && answers[f.k] !== '')), [contact, answers, fields])

  async function submit(e) {
    e.preventDefault()
    if (!canSend) return
    const payload = buildPayload(lane, answers, contact)
    if (!SETTINGS.apiBase || !SETTINGS.enquiryToken) {
      // No Command token configured: hand off to email so no enquiry is ever lost.
      const subject = encodeURIComponent(`Enquiry: ${payload.event_type}`)
      const body = encodeURIComponent(`${payload.message}\n\nName: ${payload.name}\nEmail: ${payload.email}\nPhone: ${payload.phone}`)
      window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`
      setState({ status: 'mailto', error: '' })
      return
    }
    setState({ status: 'sending', error: '' })
    try {
      const r = await fetch(`${SETTINGS.apiBase}/api/public/enquiry/${SETTINGS.enquiryToken}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!r.ok) {
        let msg = 'Something went wrong sending that.'
        try { msg = (await r.json()).detail || msg } catch {}
        throw new Error(msg)
      }
      setState({ status: 'sent', error: '' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setState({ status: 'error', error: err.message || 'Something went wrong.' })
    }
  }

  if (state.status === 'sent' || state.status === 'mailto') {
    return (
      <section className="hero-field grain relative flex min-h-[80vh] items-center pt-32">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{state.status === 'sent' ? 'Received' : 'Almost there'}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{state.status === 'sent' ? 'Thank you, your table is noted.' : 'Your email app should have opened.'}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{state.status === 'sent' ? ENQUIRE.followUp : <>If it didn’t, email us directly at <a className="link-under text-ivory" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> and we’ll pick it up from there.</>}</p></Reveal>
          <Reveal delay={3} className="mt-10 flex flex-wrap gap-3"><Button to="/">Back to the start</Button><Button to="/whats-up" variant="ghost">What’s up with Us?</Button></Reveal>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="hero-field grain relative pt-40 pb-12">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{ENQUIRE.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{ENQUIRE.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{ENQUIRE.sub}</p></Reveal>
        </div>
      </section>

      <Section ground="ink" tight>
        <div className="grid gap-12 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <p className="eyebrow">Start here</p>
            <p className="mt-3 font-body text-[14px] font-light text-ivory/70">Choose how we can help. We’ll show you the right questions next.</p>
            <ul className="mt-6 space-y-2">
              {ENQUIRE.lanes.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setLane(l.id)} className={`w-full border px-5 py-4 text-left transition-colors ${lane === l.id ? 'border-gold bg-ink-2' : 'border-ink-3 hover:border-gold/50'}`} aria-pressed={lane === l.id}>
                    <span className={`block font-display text-[18px] ${lane === l.id ? 'text-gold' : ''}`}>{l.label}</span>
                    <span className="mt-1 block font-body text-[12px] text-smoke">{l.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-10 space-y-2 font-body text-[13px] text-smoke">
              <p><a href={`mailto:${CONTACT.email}`} className="link-under text-ivory/85">{CONTACT.email}</a></p>
              <p>Instagram · <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer" className="link-under text-ivory/85">@{CONTACT.instagram}</a></p>
              <p>TikTok · <a href={`https://tiktok.com/@${CONTACT.tiktok}`} target="_blank" rel="noreferrer" className="link-under text-ivory/85">@{CONTACT.tiktok}</a></p>
            </div>
          </aside>

          <div className="lg:col-span-8">
            {!lane ? (
              <div className="flex h-full min-h-[320px] items-center border border-dashed border-ink-3 p-8">
                <p className="font-display text-[22px] italic text-smoke">Pick an enquiry type to begin.</p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate={false} className="border border-ink-3 bg-ink-2/50 p-6 sm:p-9">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-3 pb-5">
                  <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold">{LANE_LABEL[lane]}</p>
                  <button type="button" onClick={() => setLane('')} className="font-body text-[11px] uppercase tracking-wide text-smoke hover:text-ivory">Change enquiry type</button>
                </div>

                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  {fields.filter((f) => !f.showIf || f.showIf(answers)).map((f) => <Field key={f.k} f={f} value={answers[f.k]} onChange={(v) => setA(f.k, v)} answers={answers} />)}
                </div>

                <p className="mt-12 eyebrow">Your details</p>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <div><label htmlFor="c-name" className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">Full name <span className="text-gold">*</span></label><input id="c-name" className="field mt-1" autoComplete="name" value={contact.name} onChange={(e) => setC('name', e.target.value)} required /></div>
                  <div><label htmlFor="c-phone" className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">Phone</label><input id="c-phone" type="tel" className="field mt-1" placeholder="+44 …" autoComplete="tel" value={contact.phone} onChange={(e) => setC('phone', e.target.value)} /></div>
                  <div><label htmlFor="c-email" className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">Email <span className="text-gold">*</span></label><input id="c-email" type="email" className="field mt-1" placeholder="you@example.com" autoComplete="email" value={contact.email} onChange={(e) => setC('email', e.target.value)} required /></div>
                  <div><label htmlFor="c-pref" className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">Preferred contact</label><select id="c-pref" className="field mt-1" value={contact.contact_pref} onChange={(e) => setC('contact_pref', e.target.value)}><option value="">No preference</option><option>Email</option><option>WhatsApp</option><option>Phone call</option></select></div>
                  <div className="sm:col-span-2"><label htmlFor="c-msg" className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">Anything else</label><textarea id="c-msg" rows={3} className="field mt-1 resize-y" value={contact.message} onChange={(e) => setC('message', e.target.value)} /></div>
                  {/* Honeypot: real people never see this. */}
                  <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="c-company">Company</label><input id="c-company" tabIndex={-1} autoComplete="off" value={contact.company} onChange={(e) => setC('company', e.target.value)} /></div>
                </div>

                <div className="mt-8 border border-gold/30 bg-ink p-5">
                  <p className="eyebrow">Consultation follow-up</p>
                  <p className="mt-2 font-body text-[13px] font-light leading-relaxed text-ivory/70">{ENQUIRE.followUp}</p>
                </div>

                {state.error ? <p className="mt-6 font-body text-[13px] text-red-300">{state.error}. Or email us at <a className="link-under" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.</p> : null}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button type="submit" disabled={!canSend || state.status === 'sending'} className="disabled:cursor-not-allowed disabled:opacity-40">{state.status === 'sending' ? 'Sending…' : 'Send enquiry'} <Arrow /></Button>
                  <p className="font-body text-[12px] text-smoke">We never share your details.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  )
}
