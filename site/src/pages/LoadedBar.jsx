import { LOADED_BAR, SETTINGS } from '../content/site.js'
import { Button, Eyebrow, Frame, Heading, Reveal, Section, asset } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

export default function LoadedBar() {
  const L = LOADED_BAR
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-20 sm:pb-28">
        <div className="mx-auto grid w-full max-w-page items-end gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:px-12">
          <div className="lg:col-span-7">
            <Reveal><Eyebrow>{L.eyebrow}</Eyebrow></Reveal>
            <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5">{L.title}</Heading></Reveal>
            <Reveal delay={2}><p className="mt-6 font-display text-[22px] italic text-gold-light sm:text-[26px]">{L.sub}</p></Reveal>
            <Reveal delay={2}><p className="lede mt-5 max-w-lg text-ivory/75">{L.body}{SETTINGS.showFromPrices ? <> From <strong className="font-medium text-ivory">{L.from}</strong>.</> : null}</p></Reveal>
            <Reveal delay={3} className="mt-10 flex flex-wrap gap-3">
              <Button href="#included">What’s included</Button>
              <Button to="/enquire?lane=private-catering&service=the-loaded-bar" variant="ghost">Book the bar</Button>
              {L.deckUrl ? <Button href={asset(L.deckUrl)} variant="ghost" target="_blank" rel="noreferrer">Grab the brochure</Button> : null}
            </Reveal>
          </div>
          <Reveal delay={2} className="lg:col-span-5"><Frame src={L.photo} alt="The Loaded Bar station" ratio="4/5" fit="contain" /></Reveal>
        </div>
      </section>

      <Section ground="ivory" id="included">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal><Eyebrow className="text-gold-deep">The experience</Eyebrow></Reveal>
            <Reveal delay={1}><Heading className="mt-5">{L.included.title}</Heading></Reveal>
            <Reveal delay={2}><p className="lede mt-7 text-ink/80">{L.included.intro}</p></Reveal>
            <Reveal delay={3}><p className="mt-6 font-body text-[12px] uppercase tracking-eyebrow text-gold-deep">{L.included.line}</p></Reveal>
          </div>
          <Reveal as="ul" delay={1} className="divide-y divide-sand border-y border-sand lg:col-span-7">
            {L.included.items.map(([k, v]) => (
              <li key={k} className="grid gap-1 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                <p className="font-display text-[19px]">{k}</p>
                <p className="font-body text-[15px] font-light leading-relaxed text-ink/75">{v}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </Section>

      <Section ground="ink">
        <div className="max-w-2xl">
          <Reveal><Eyebrow>{L.menu.title}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5">Every guest builds their own.</Heading></Reveal>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {L.menu.groups.map((g, i) => (
            <Reveal key={g.name} delay={i % 3} className="border-t border-ink-3 pt-5">
              <p className="font-display text-[22px]">{g.name} <span className="font-body text-[11px] uppercase tracking-wide text-gold">{g.pick}</span></p>
              <ul className="mt-4 space-y-1.5">{g.items.map((it) => <li key={it} className="font-body text-[14px] font-light text-ivory/80">{it}</li>)}</ul>
              {g.extra ? <p className="mt-3 font-body text-[12px] italic text-smoke">{g.extra}</p> : null}
            </Reveal>
          ))}
        </div>
      </Section>

      <Section ground="linen">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal><Eyebrow className="text-gold-deep">Booking</Eyebrow></Reveal>
            <Reveal delay={1}><Heading className="mt-5">{L.requirements.title}</Heading></Reveal>
            <Reveal delay={2}><p className="mt-7 font-body text-[14px] text-stone">When you’re ready, <a href="#enquire" className="link-under text-ink">jump to the enquiry</a>.</p></Reveal>
          </div>
          <Reveal as="ul" delay={1} className="divide-y divide-sand border-y border-sand lg:col-span-7">
            {L.requirements.items.map(([k, v]) => (
              <li key={k} className="grid gap-1 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                <p className="font-display text-[19px]">{k}</p>
                <p className="font-body text-[15px] font-light leading-relaxed text-ink/75">{v}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </Section>
      <div id="enquire" />
      <EnquireBand />
    </>
  )
}
