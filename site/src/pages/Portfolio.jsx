import { KIND_WORDS, PORTFOLIO } from '../content/site.js'
import { Eyebrow, Frame, Heading, Reveal, Section } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

export default function Portfolio() {
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-16">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{PORTFOLIO.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{PORTFOLIO.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{PORTFOLIO.intro}</p></Reveal>
          {PORTFOLIO.clients.length ? (
            <Reveal delay={3} as="ul" className="mt-10 flex flex-wrap gap-3 border-t border-ink-3 pt-8">
              {PORTFOLIO.clients.map((c) => (
                <li key={c.name} className="flex items-center gap-3 border border-ink-3 px-4 py-3">
                  {c.logo ? <img src={c.logo} alt="" className="h-6 w-auto" /> : null}
                  <span className="font-display text-[17px]">{c.name}</span>
                  {c.kind ? <span className="font-body text-[11px] uppercase tracking-wide text-smoke">{c.kind}</span> : null}
                </li>
              ))}
            </Reveal>
          ) : null}
        </div>
      </section>

      <Section ground="ivory">
        <Reveal><Eyebrow className="text-gold-deep">Selected work</Eyebrow></Reveal>
        <div className="mt-8 space-y-16">
          {PORTFOLIO.features.map((f, i) => (
            <div key={f.title} className="grid items-center gap-10 lg:grid-cols-12">
              <Reveal className={`lg:col-span-5 ${i % 2 ? 'lg:order-2' : ''}`}><Frame src={f.photo} alt={f.title} ratio="4/5" /></Reveal>
              <div className={`lg:col-span-6 ${i % 2 ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-7'}`}>
                <Reveal><p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">{f.kind}</p></Reveal>
                <Reveal delay={1}><Heading size="md" className="mt-4">{f.title}</Heading></Reveal>
                <Reveal delay={2}><p className="lede mt-5 max-w-lg text-ink/75">{f.body}</p></Reveal>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section ground="linen" tight>
        <Reveal className="text-center"><Eyebrow className="text-gold-deep">{KIND_WORDS.eyebrow}</Eyebrow><Heading size="md" className="mt-4">{KIND_WORDS.title}</Heading></Reveal>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
          {KIND_WORDS.quotes.map((q, i) => (
            <Reveal key={q.text} delay={i % 2} className={`border border-sand bg-ivory p-8 ${KIND_WORDS.quotes.length === 1 ? 'md:col-span-2 md:mx-auto md:max-w-2xl' : ''}`}>
              <p className="font-display text-[20px] leading-snug text-ink/90 sm:text-[24px]">“{q.text}”</p>
              <p className="mt-5 font-body text-[11px] uppercase tracking-eyebrow text-stone">{q.who}</p>
            </Reveal>
          ))}
        </div>
      </Section>
      <EnquireBand />
    </>
  )
}
