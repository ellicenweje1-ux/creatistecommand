import { CAREERS, NOW, nowActive } from '../content/site.js'
import { Button, Eyebrow, Heading, Reveal, Section, asset } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'
import { AvailabilityBlock } from '../availability.jsx'

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
function Card({ item, i }) {
  const dim = !item.live
  return (
    <Reveal delay={i} id={slug(item.kind)} className={`flex flex-col border p-7 sm:p-9 ${dim ? 'border-dashed border-ink-3 text-smoke' : 'border-gold/40 bg-ink-2/70'} scroll-mt-24`}>
      <div className="flex items-center justify-between gap-4">
        <p className={`eyebrow ${dim ? 'text-smoke' : ''}`}>{item.kind}</p>
        {item.live ? <span className="flex items-center gap-2 font-body text-[11px] uppercase tracking-wide text-gold"><span className="h-1.5 w-1.5 rounded-full bg-gold" />Live</span> : <span className="font-body text-[11px] uppercase tracking-wide text-smoke">Coming</span>}
      </div>
      <p className={`mt-4 font-display text-[32px] leading-tight ${dim ? 'text-ivory/50' : ''}`}>{item.name}</p>
      <p className={`mt-1 font-display text-[18px] italic ${dim ? 'text-smoke' : 'text-gold-light'}`}>{item.when}</p>
      <p className={`mt-5 flex-1 font-body text-[15px] font-light leading-relaxed ${dim ? 'text-smoke' : 'text-ivory/75'}`}>{item.detail}</p>
      {item.meta?.length ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {item.meta.map((m) => <li key={m} className="border border-gold/40 px-3 py-1.5 font-body text-[11px] uppercase tracking-wide text-gold">{m}</li>)}
        </ul>
      ) : null}
      {item.footnote ? <p className="mt-4 font-body text-[12px] italic text-smoke">{item.footnote}</p> : null}
      {item.cta ? <div className="mt-7">{item.cta.href ? <Button href={item.cta.href} target="_blank" rel="noreferrer" variant={item.live ? 'gold' : 'ghost'}>{item.cta.label}</Button> : <Button to={item.cta.to} variant={item.live ? 'gold' : 'ghost'}>{item.cta.label}</Button>}</div> : null}
    </Reveal>
  )
}

/* A live item that comes with a flyer gets the stage: the flyer beside the details, RSVP as the main button. */
function Featured({ item }) {
  const rsvp = item.cta?.href
  const img = <img src={asset(item.flyer.src)} alt={item.flyer.alt} loading="lazy" className="block h-auto w-full" />
  return (
    <Reveal id={slug(item.kind)} className="scroll-mt-24 border border-gold/40 bg-ink-2/70" data-featured={slug(item.kind)}>
      <div className="grid items-center gap-8 p-5 sm:p-8 lg:grid-cols-12 lg:gap-12 lg:p-10">
        <div className="mx-auto w-full max-w-[440px] lg:col-span-5">
          {rsvp ? <a href={rsvp} target="_blank" rel="noreferrer" aria-label={`${item.cta.label}: ${item.name}`} data-flyer className="block border border-gold/30 transition-colors hover:border-gold">{img}</a> : img}
        </div>
        <div className="lg:col-span-7">
          <div className="flex items-center gap-4">
            <p className="eyebrow">{item.kind}</p>
            <span className="flex items-center gap-2 font-body text-[11px] uppercase tracking-wide text-gold"><span className="h-1.5 w-1.5 rounded-full bg-gold" />Live</span>
          </div>
          <p className="mt-4 font-display text-[40px] leading-tight sm:text-[52px]">{item.name}</p>
          {item.sub ? <p className="mt-1 font-body text-[12px] uppercase tracking-eyebrow text-gold">{item.sub}</p> : null}
          <p className="mt-2 font-display text-[22px] italic text-gold-light">{item.when}</p>
          <p className="mt-6 max-w-xl font-body text-[16px] font-light leading-relaxed text-ivory/80">{item.detail}</p>
          {item.meta?.length ? <ul className="mt-6 flex flex-wrap gap-2">{item.meta.map((m) => <li key={m} className="border border-gold/40 px-3 py-1.5 font-body text-[11px] uppercase tracking-wide text-gold">{m}</li>)}</ul> : null}
          {item.cta ? <div className="mt-8"><Button href={item.cta.href} target="_blank" rel="noreferrer" data-rsvp>{item.cta.label}</Button></div> : null}
          {item.footnote ? <p className="mt-4 font-body text-[12px] italic text-smoke">{item.footnote}</p> : null}
        </div>
      </div>
    </Reveal>
  )
}

export default function WhatsOn() {
  const items = NOW.items.filter(nowActive)
  const featured = items.filter((i) => i.live && i.flyer)
  const rest = items.filter((i) => !(i.live && i.flyer))
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-16">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{NOW.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{NOW.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{NOW.intro}</p></Reveal>
        </div>
      </section>
      <Section ground="ink" tight>
        <div className="space-y-5">
          {featured.map((it) => <Featured key={it.name} item={it} />)}
          <div className="grid gap-5 lg:grid-cols-2" data-now-cards>
            {rest.map((it, i) => <Card key={it.name} item={it} i={i} />)}
          </div>
        </div>
      </Section>
      <Section ground="linen" id="careers" className="scroll-mt-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <Reveal><Eyebrow className="text-gold-deep">{CAREERS.eyebrow}</Eyebrow></Reveal>
            <Reveal delay={1}><Heading className="mt-5">{CAREERS.title}</Heading></Reveal>
            <Reveal delay={2}><p className="lede mt-6 text-ink/75">{CAREERS.intro}</p></Reveal>
          </div>
          <div className="grid gap-5 lg:col-span-8">
            {CAREERS.roles.map((r, i) => (
              <Reveal key={r.title} delay={i} as="article" className="border border-sand bg-ivory p-7 sm:p-9" data-role>
                <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">{r.type}</p>
                <p className="mt-3 font-display text-[28px]">{r.title}</p>
                <p className="mt-1 font-body text-[13px] text-stone">{r.where}</p>
                <p className="mt-4 font-body text-[15px] font-light leading-relaxed text-ink/75">{r.body}</p>
                <ul className="mt-4 list-disc space-y-1 pl-5 font-body text-[14px] font-light leading-relaxed text-ink/75 marker:text-gold-deep">{r.asks.map((a) => <li key={a}>{a}</li>)}</ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button href={`mailto:${CAREERS.email}?subject=${encodeURIComponent(`Application: ${r.title}`)}`} variant="ink">Apply by email</Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>
      <Section ground="ink" id="availability" className="border-t border-ink-3 scroll-mt-20">
        <AvailabilityBlock />
      </Section>
      <EnquireBand ground="ivory" />
    </>
  )
}
