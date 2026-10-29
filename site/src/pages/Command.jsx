import { COMMAND } from '../content/site.js'
import { Arrow, Button, Eyebrow, Frame, Heading, Reveal, Section } from '../ui.jsx'

/* The Creatiste Command: a landing page for other chefs and caterers. The platform the business runs on,
   with a "Try it now" straight into it. All copy in COMMAND (content/site.js). */
export default function Command() {
  const C = COMMAND
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-20 sm:pb-28" data-command-hero>
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <div className="grid items-end gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <Reveal><Eyebrow>{C.eyebrow}</Eyebrow></Reveal>
              <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5">{C.title}</Heading></Reveal>
              <Reveal delay={1}><p className="mt-4 font-display text-[22px] italic text-gold sm:text-[26px]">{C.strap}</p></Reveal>
              <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{C.intro}</p></Reveal>
              <Reveal delay={3} className="mt-10 flex flex-wrap gap-3">
                <Button href={C.tryUrl} target="_blank" rel="noreferrer" data-try-now>{C.tryLabel} <Arrow /></Button>
                <Button href={C.introUrl} target="_blank" rel="noreferrer" variant="ghost">{C.introLabel}</Button>
              </Reveal>
            </div>
            <Reveal delay={2} className="lg:col-span-5"><Frame src={C.photo} alt="Labelled prep containers in our kitchen" ratio="4/5" className="lg:ml-auto lg:w-[86%]" /></Reveal>
          </div>
        </div>
      </section>

      <Section ground="ivory" id="how-we-use-it">
        <div className="max-w-2xl">
          <Reveal><Eyebrow className="text-gold-deep">We use it to manage our kitchen</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5">{C.useTitle}</Heading></Reveal>
        </div>
        <ol className="mt-12 grid gap-px bg-sand md:grid-cols-2 lg:grid-cols-3" data-command-uses>
          {C.uses.map(([t, d], i) => (
            <Reveal key={t} as="li" delay={i % 3} className="bg-ivory p-7">
              <p className="font-display text-[30px] text-gold-deep">0{i + 1}</p>
              <p className="mt-4 font-display text-[20px]">{t}</p>
              <p className="mt-3 font-body text-[14px] font-light leading-relaxed text-ink/70">{d}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section ground="linen" id="whats-inside">
        <div className="max-w-2xl">
          <Reveal><Eyebrow className="text-gold-deep">The platform</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5">{C.featuresTitle}</Heading></Reveal>
        </div>
        <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4" data-command-features>
          {C.features.map(([t, d], i) => (
            <Reveal key={t} as="li" delay={i % 4} className="border-t border-gold-deep/40 pt-5">
              <p className="font-display text-[19px]">{t}</p>
              <p className="mt-2 font-body text-[13px] font-light leading-relaxed text-ink/70">{d}</p>
            </Reveal>
          ))}
        </ul>
        <Reveal delay={1}><p className="mt-12 font-display text-[22px] italic text-ink/70">{C.tagline}</p></Reveal>
      </Section>

      <Section ground="ink" tight className="border-t border-ink-3" id="try">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Reveal><Eyebrow>Free trial</Eyebrow></Reveal>
            <Reveal delay={1}><Heading className="mt-4">{C.trialTitle}</Heading></Reveal>
            <Reveal delay={2}><p className="lede mt-4 max-w-lg text-ivory/70">{C.trialBody}</p></Reveal>
            <Reveal delay={3}><p className="mt-4 font-body text-[12px] text-smoke">{C.note}</p></Reveal>
          </div>
          <Reveal delay={2} className="flex flex-wrap gap-3">
            <Button href={C.tryUrl} target="_blank" rel="noreferrer">{C.tryLabel} <Arrow /></Button>
            <Button href={C.url} target="_blank" rel="noreferrer" variant="ghost">Visit creatistecommand.onrender.com</Button>
          </Reveal>
        </div>
      </Section>
    </>
  )
}
