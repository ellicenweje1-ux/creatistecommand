import { Link } from 'react-router-dom'
import { SETTINGS } from '../content/site.js'
import { Arrow, Button, Eyebrow, Frame, Heading, Reveal, Section } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

/* Shared layout for the two umbrella pages: a dark hero, then each service as a
   full-width editorial block alternating ivory / linen, with an in-page index. */
export default function ServiceUmbrella({ u, lane, hero, photos = {} }) {
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-20 sm:pb-28">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{u.name}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{u.strap}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{u.intro}</p></Reveal>
          <Reveal delay={3} className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink-3 pt-6">
            {u.services.map((s) => (
              <a key={s.slug} href={`#${s.slug}`} className="font-body text-[12px] uppercase tracking-wide text-ivory/70 hover:text-gold">{s.name}</a>
            ))}
          </Reveal>
        </div>
      </section>

      {u.services.map((s, i) => {
        const ground = i % 2 === 0 ? 'ivory' : 'linen'
        const flip = i % 2 === 1
        return (
          <Section key={s.slug} ground={ground} id={s.slug}>
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
              <div className={`lg:col-span-6 ${flip ? 'lg:order-2' : ''}`}>
                <Reveal><p className="font-body text-[12px] uppercase tracking-eyebrow text-gold-deep">0{i + 1}{s.special ? ' · By special request' : ''}</p></Reveal>
                <Reveal delay={1}><Heading className="mt-4">{s.name}</Heading></Reveal>
                <Reveal delay={1}><p className="mt-3 font-display text-[20px] italic text-stone">{s.strap}</p></Reveal>
                <Reveal delay={2}><p className="lede mt-7 max-w-lg text-ink/80">{s.body}</p></Reveal>
                {s.includes?.length ? (
                  <Reveal delay={2} as="ul" className="mt-8 space-y-3 border-t border-sand pt-6">
                    {s.includes.map((line) => (
                      <li key={line} className="flex gap-4 font-body text-[14px] font-light leading-relaxed text-ink/75"><span className="mt-[9px] h-px w-5 shrink-0 bg-gold-deep" />{line}</li>
                    ))}
                  </Reveal>
                ) : null}
                {s.note ? <Reveal delay={3}><p className="mt-6 font-body text-[13px] italic text-stone">{s.note}</p></Reveal> : null}
                {SETTINGS.showFromPrices && s.from ? <Reveal delay={3}><p className="mt-6 font-body text-[12px] uppercase tracking-wide text-gold-deep">From {s.from} · subject to consultation</p></Reveal> : null}
                <Reveal delay={3} className="mt-8 flex flex-wrap gap-3">
                  {s.link ? <Button to={s.link} variant="ink">Explore {s.name}</Button> : null}
                  <Button to={`/enquire?lane=${lane}&service=${s.slug}`} variant={s.link ? 'ghost-ink' : 'ink'}>Enquire about {s.name}</Button>
                </Reveal>
              </div>
              <Reveal delay={1} className={`lg:col-span-6 ${flip ? 'lg:order-1' : ''}`}>
                <Frame src={photos[s.slug]} alt={s.name} ratio="4/5" className="lg:w-[86%]" caption={photos[s.slug] ? undefined : 'Photography to follow'} />
              </Reveal>
            </div>
          </Section>
        )
      })}

      {hero?.after}
      <EnquireBand />
    </>
  )
}
