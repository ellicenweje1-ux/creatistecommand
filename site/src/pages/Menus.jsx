import { Link } from 'react-router-dom'
import { MENUS_PAGE } from '../content/site.js'
import { Arrow, Button, Eyebrow, Heading, Reveal, Section, asset } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

export default function Menus() {
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-16">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{MENUS_PAGE.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{MENUS_PAGE.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{MENUS_PAGE.intro}</p></Reveal>
        </div>
      </section>
      <Section ground="ivory">
        <div className="grid gap-px bg-sand md:grid-cols-2">
          {MENUS_PAGE.items.map((m, i) => (
            <Reveal key={m.title} delay={i % 2} className="flex flex-col bg-ivory p-7 sm:p-9">
              <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">{m.kind}</p>
              <p className="mt-3 font-display text-[28px]">{m.title}</p>
              <p className="mt-3 flex-1 font-body text-[14px] font-light leading-relaxed text-ink/75">{m.body}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {m.file ? <Button href={asset(m.file)} variant="ink" target="_blank" rel="noreferrer">Download PDF</Button> : <Button to={m.request || '/enquire'} variant="ink">Request the price list</Button>}
                <Link to={m.to} className="inline-flex items-center gap-2 px-2 py-3 font-body text-[12px] uppercase tracking-wide text-ink/70 hover:text-gold-deep">Read more <Arrow /></Link>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
      <EnquireBand />
    </>
  )
}
