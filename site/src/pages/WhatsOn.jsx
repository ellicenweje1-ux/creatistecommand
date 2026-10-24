import { NOW } from '../content/site.js'
import { Button, Eyebrow, Heading, Reveal, Section } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

function Card({ item, i }) {
  const dim = !item.live
  return (
    <Reveal delay={i} className={`flex flex-col border p-7 sm:p-9 ${dim ? 'border-dashed border-ink-3 text-smoke' : 'border-gold/40 bg-ink-2/70'}`}>
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
      {item.cta ? <div className="mt-7"><Button to={item.cta.to} variant={item.live ? 'gold' : 'ghost'}>{item.cta.label}</Button></div> : null}
    </Reveal>
  )
}

export default function WhatsOn() {
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-16">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{NOW.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{NOW.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">Lunch services, pop-ups and the occasional Creatiste-hosted event. This page changes — check back, or ask to be kept posted.</p></Reveal>
        </div>
      </section>
      <Section ground="ink" tight>
        <div className="grid gap-5 lg:grid-cols-3">
          {NOW.items.map((it, i) => <Card key={it.name} item={it} i={i} />)}
        </div>
      </Section>
      <EnquireBand ground="ivory" />
    </>
  )
}
