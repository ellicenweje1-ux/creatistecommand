import { useEffect, useState } from 'react'
import { CONTACT, KIND_WORDS, PORTFOLIO, SETTINGS } from '../content/site.js'
import { Arrow, Button, Eyebrow, Frame, Heading, Reveal, Section, asset } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

const slug = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const API = SETTINGS.apiBase && SETTINGS.enquiryToken ? `${SETTINGS.apiBase}/api/public` : ''

function StarRow({ value, onChange, size = 'text-[18px]' }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className={`flex gap-1 ${size}`} role={onChange ? 'radiogroup' : undefined} aria-label={onChange ? 'Your rating' : `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => onChange ? (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          className={`leading-none transition-colors ${n <= shown ? 'text-gold-deep' : 'text-sand'}`}>★</button>
      ) : (
        <span key={n} className={`leading-none ${n <= value ? 'text-gold-deep' : 'text-sand'}`}>★</span>
      ))}
    </div>
  )
}

export default function Portfolio() {
  const [live, setLive] = useState([])
  useEffect(() => {
    if (!API) return
    fetch(`${API}/reviews/${SETTINGS.enquiryToken}`).then((r) => (r.ok ? r.json() : null)).then((j) => j && setLive(j.reviews || [])).catch(() => {})
  }, [])
  const quotes = [
    ...live.map((r) => ({ text: r.comment, who: [r.reviewer_name, r.event_name].filter(Boolean).join(' · '), rating: r.rating, date: r.date })),
    ...KIND_WORDS.quotes,
  ]
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-16">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{PORTFOLIO.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{PORTFOLIO.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{PORTFOLIO.intro}</p></Reveal>
          <Reveal delay={3} as="ul" className="mt-10 flex flex-wrap gap-3 border-t border-ink-3 pt-8" aria-label="Jump to a client">
            {PORTFOLIO.features.map((f) => (
              <li key={f.title}>
                <a href={`#work-${slug(f.title)}`} onClick={(e) => { const el = document.getElementById(`work-${slug(f.title)}`); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', `#work-${slug(f.title)}`) } }} className="flex items-center gap-3 border border-ink-3 px-4 py-3 transition-colors hover:border-gold" data-jump={slug(f.title)}>
                  {f.logo ? <img src={asset(f.logo)} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
                  <span className="font-display text-[17px]">{f.title}</span>
                  <span className="font-body text-[11px] uppercase tracking-wide text-smoke">{f.kind}</span>
                  <Arrow className="h-3 w-3 text-gold" />
                </a>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <Section ground="ivory">
        <Reveal><Eyebrow className="text-gold-deep">Selected work</Eyebrow></Reveal>
        <div className="mt-8 space-y-16">
          {PORTFOLIO.features.map((f, i) => (
            <article key={f.title} id={`work-${slug(f.title)}`} className="scroll-mt-28 grid gap-8 border-t border-sand pt-10 lg:grid-cols-12 lg:gap-12" data-work={f.title}>
              {/* The booking's photo sits beside its highlight header; the name and the event details follow below. */}
              <Reveal className={`lg:col-span-5 ${i % 2 ? 'lg:order-2' : ''}`}><Frame src={f.photo} alt={`${f.title}, ${f.kind}`} ratio="4/5" fit={f.fit || 'cover'} /></Reveal>
              <div className={`flex flex-col lg:col-span-7 ${i % 2 ? 'lg:order-1' : ''}`}>
                <Reveal><p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Selected work · {String(i + 1).padStart(2, '0')}</p></Reveal>
                <Reveal delay={1}><Heading size="lg" className="mt-4 text-gold-deep">{f.kind}</Heading></Reveal>
                <div className="mt-8 border-t border-sand pt-6 lg:mt-auto">
                  <Reveal delay={1} className="flex items-center gap-4">
                    {f.logo ? <img src={asset(f.logo)} alt={f.title} className="h-14 w-14 shrink-0 rounded-full border border-sand object-cover" /> : <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-sand bg-linen font-display text-[20px] text-gold-deep">{f.title.replace(/[^A-Za-z0-9]/g, '').slice(0, 1)}</span>}
                    <p className="font-display text-[26px] leading-tight sm:text-[30px]">{f.title}</p>
                  </Reveal>
                  {f.meta ? <Reveal delay={2}><p className="mt-3 font-body text-[11px] uppercase tracking-eyebrow text-stone">{f.meta}</p></Reveal> : null}
                  <Reveal delay={2}><p className="lede mt-5 max-w-xl text-ink/75">{f.body}</p></Reveal>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section ground="linen" tight id="testimonials">
        <Reveal className="text-center"><Eyebrow className="text-gold-deep">{KIND_WORDS.eyebrow}</Eyebrow><Heading size="md" className="mt-4">{KIND_WORDS.title}</Heading></Reveal>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2" data-testimonials>
          {quotes.map((q, i) => (
            <Reveal key={`${q.who}-${i}`} delay={i % 2} className={`border border-sand bg-ivory p-8 ${quotes.length === 1 ? 'md:col-span-2 md:mx-auto md:max-w-2xl' : ''}`}>
              {q.rating ? <StarRow value={q.rating} /> : null}
              <p className={`font-display text-[20px] leading-snug text-ink/90 sm:text-[24px] ${q.rating ? 'mt-4' : ''}`}>“{q.text}”</p>
              <p className="mt-5 font-body text-[11px] uppercase tracking-eyebrow text-stone">{q.who}{q.date ? ` · ${new Date(q.date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}` : ''}</p>
            </Reveal>
          ))}
        </div>
        <ReviewForm />
      </Section>
      <EnquireBand />
    </>
  )
}

/* Leave us a review: a star rating, name, event and a few words. Goes to The Creatiste Command
   for approval before it appears above; without a token it hands off to email. Google reviews
   can be plugged in beside this later. */
function ReviewForm() {
  const [f, setF] = useState({ rating: 0, name: '', email: '', event: '', date: '', comment: '', company: '' })
  const [state, setState] = useState({ status: 'idle', error: '' })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const ready = f.rating > 0 && f.name.trim() && f.comment.trim()
  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    if (!API) {
      const body = encodeURIComponent(`${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}\n${f.name}${f.event ? ` · ${f.event}` : ''}${f.date ? ` · ${f.date}` : ''}\n\n${f.comment}`)
      window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent('A review for The Creatiste Catering')}&body=${body}`
      setState({ status: 'sent', error: '' }); return
    }
    setState({ status: 'sending', error: '' })
    try {
      const r = await fetch(`${API}/review/${SETTINGS.enquiryToken}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      if (!r.ok) { let m = 'Something went wrong sending that.'; try { m = (await r.json()).detail || m } catch {} throw new Error(m) }
      setState({ status: 'sent', error: '' })
    } catch (err) { setState({ status: 'error', error: err.message }) }
  }
  return (
    <div className="mx-auto mt-16 max-w-3xl border border-sand bg-ivory p-7 sm:p-10" id="leave-a-review">
      <Reveal><Eyebrow className="text-gold-deep">Leave us a review</Eyebrow></Reveal>
      <Reveal delay={1}><Heading size="md" className="mt-4">Cooked for you? Tell the next table.</Heading></Reveal>
      {state.status === 'sent' ? (
        <p className="mt-6 font-body text-[15px] text-ink/80" data-review-sent>Thank you. Your review is with us and will appear here once it has been approved.</p>
      ) : (
        <form onSubmit={submit} className="mt-8 grid gap-6 sm:grid-cols-2" data-review-form>
          <div className="sm:col-span-2">
            <p className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Your rating <span className="text-gold-deep">*</span></p>
            <div className="mt-2"><StarRow value={f.rating} onChange={(n) => set('rating', n)} size="text-[30px]" /></div>
          </div>
          <div><label htmlFor="rv-name" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Your name <span className="text-gold-deep">*</span></label><input id="rv-name" className="field-ivory mt-1" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} required /></div>
          <div><label htmlFor="rv-email" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Email</label><input id="rv-email" type="email" className="field-ivory mt-1" placeholder="Not shown publicly" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div><label htmlFor="rv-event" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">What we cooked for</label><input id="rv-event" className="field-ivory mt-1" placeholder="A birthday dinner, a team lunch, the week’s batch…" value={f.event} onChange={(e) => set('event', e.target.value)} /></div>
          <div><label htmlFor="rv-date" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Date of the event</label><input id="rv-date" type="date" className="field-ivory mt-1" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
          <div className="sm:col-span-2"><label htmlFor="rv-text" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Your review <span className="text-gold-deep">*</span></label><textarea id="rv-text" rows={4} className="field-ivory mt-1 resize-y" value={f.comment} onChange={(e) => set('comment', e.target.value)} required /></div>
          <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="rv-company">Company</label><input id="rv-company" tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => set('company', e.target.value)} /></div>
          {state.error ? <p className="font-body text-[13px] text-red-600 sm:col-span-2">{state.error}</p> : null}
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <Button type="submit" variant="ink" disabled={!ready || state.status === 'sending'} className="disabled:cursor-not-allowed disabled:opacity-40">{state.status === 'sending' ? 'Sending…' : 'Send my review'} <Arrow /></Button>
            <p className="font-body text-[12px] text-stone">Reviews appear once approved. Your email is never shown.</p>
          </div>
        </form>
      )}
    </div>
  )
}
