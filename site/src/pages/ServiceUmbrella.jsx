import { Link } from 'react-router-dom'
import { HOME_EDIT_PACKAGES, LOADED_BAR, SETTINGS } from '../content/site.js'
import { TableMenuCard } from './TableMenu.jsx'
import { Arrow, Button, Eyebrow, Frame, Heading, Reveal, Section, asset } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'
import BowlMenu from '../menu.jsx'

/* Shared layout for the two umbrella pages: a dark hero, then each service as a
   full-width editorial block alternating ivory / linen, with an in-page index. */
export default function ServiceUmbrella({ u, lane }) {
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-20 sm:pb-28">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>Services</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{u.name}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{u.intro}</p></Reveal>
          <Reveal delay={3} className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink-3 pt-6">
            {u.services.map((s) => (
              <a key={s.slug} href={`#${s.slug}`} className="font-body text-[12px] uppercase tracking-wide text-ivory/70 hover:text-gold">{s.name}</a>
            ))}
          </Reveal>
        </div>
      </section>

      {u.howServed ? (
        <Section ground="ivory" tight id="how-its-served">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <Reveal><Eyebrow className="text-gold-deep">{u.howServed.eyebrow}</Eyebrow></Reveal>
              <Reveal delay={1}><Heading className="mt-5">{u.howServed.title}</Heading></Reveal>
              <Reveal delay={2}><p className="lede mt-6 max-w-xl text-ink/75">{u.howServed.body}</p></Reveal>
              <Reveal delay={3} className="mt-7"><Button to={u.howServed.link} variant="ink">Explore The Loaded Bar</Button></Reveal>
            </div>
            <Reveal delay={2} className="lg:col-span-5"><Frame src={LOADED_BAR.photo} alt="The Loaded Bar station" ratio="4/5" fit="contain" className="lg:ml-auto lg:w-[80%]" /></Reveal>
          </div>
        </Section>
      ) : null}

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
                {s.docUrl ? <Reveal delay={3} className="mt-6"><Button href={asset(s.docUrl)} variant="ghost-ink" target="_blank" rel="noreferrer">{s.docLabel || 'Download the PDF'}</Button></Reveal> : null}
                {s.menuNote ? <Reveal delay={3}><p className="mt-6 font-body text-[13px] italic text-stone">{s.menuNote}</p></Reveal> : null}
                {SETTINGS.showFromPrices && s.from ? <Reveal delay={3}><p className="mt-6 font-body text-[12px] uppercase tracking-wide text-gold-deep">From {s.from} · subject to consultation</p></Reveal> : null}
                <Reveal delay={3} className="mt-8 flex flex-wrap gap-3">
                  {s.link ? <Button to={s.link} variant="ink">Explore {s.name}</Button> : null}
                  <Button to={`/enquire?lane=${lane}&service=${s.slug}`} variant={s.link ? 'ghost-ink' : 'ink'}>Enquire about {s.name}</Button>
                </Reveal>
              </div>
              <Reveal delay={1} className={`lg:col-span-6 ${flip ? 'lg:order-1' : ''}`}>
                <Frame src={s.photo} alt={s.name} ratio="4/5" className="lg:w-[86%]" caption={s.photo ? undefined : 'Photography to follow'} />
              </Reveal>
            </div>
            {s.menuId ? (
              <div className="mt-14 border-t border-sand pt-10">
                <Reveal><p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">The {s.name} menu</p></Reveal>
                <Reveal delay={1}><Heading size="md" className="mt-4">Served from The Loaded Bar.</Heading></Reveal>
                <BowlMenu ids={[s.menuId]} ground={ground} className="mt-8" />
              </div>
            ) : null}
            {s.packages ? <Packages ground={ground} /> : null}
            {s.tableMenu ? (
              <div className="mt-16 grid gap-10 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <Reveal><p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">The set menu</p></Reveal>
                  <Reveal delay={1}><Heading size="md" className="mt-4">Changes with the seasons.</Heading></Reveal>
                  <Reveal delay={2}><p className="lede mt-5 max-w-md text-ink/75">One menu, cooked for the whole table and priced per head. Courses can be tailored to dietary requirements and preferences, and vegan, nut-free and gluten-free plates are available on request.</p></Reveal>
                  <Reveal delay={3} className="mt-6 flex flex-wrap gap-3"><Button href={asset('/docs/the-creatiste-table-menu.pdf')} variant="ghost-ink" target="_blank" rel="noreferrer">Download the menu</Button></Reveal>
                </div>
                <Reveal delay={1} className="lg:col-span-7"><TableMenuCard /></Reveal>
              </div>
            ) : null}
          </Section>
        )
      })}

      <EnquireBand />
    </>
  )
}


function Packages({ ground }) {
  const P = HOME_EDIT_PACKAGES
  const cell = ground === 'ivory' ? 'bg-ivory' : 'bg-linen'
  return (
    <div className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Reveal><p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Package options</p></Reveal>
          <Reveal delay={1}><Heading size="md" className="mt-4">Six ways to hand over the week.</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-4 max-w-xl text-ink/75">Set packages on different pricing bases, so you can choose the schedule and level of cover that works best. Weekly figures are indicative labour costs confirmed at consultation, and groceries are paid at cost by you.</p></Reveal>
        </div>
        <Reveal delay={2}><Button href={asset(P.docUrl)} variant="ghost-ink" target="_blank" rel="noreferrer">Download the package guide</Button></Reveal>
      </div>
      <div className="mt-10 grid gap-px bg-sand sm:grid-cols-2 lg:grid-cols-3">
        {P.items.map((k, i) => (
          <Reveal key={k.n} delay={i % 3} className={`flex flex-col ${cell} p-6`}>
            <p className="font-body text-[10px] uppercase tracking-eyebrow text-gold-deep">Package {k.n}</p>
            <p className="mt-2 font-display text-[22px]">{k.name}</p>
            <p className="mt-1 font-body text-[11px] uppercase tracking-wide text-stone">{k.cover}</p>
            <p className="mt-4 flex-1 font-body text-[14px] font-light leading-relaxed text-ink/75">{k.body}</p>
            {SETTINGS.showFromPrices ? <p className="mt-4 font-display text-[20px] text-gold-deep">£{k.weekly} <span className="font-body text-[11px] uppercase tracking-wide text-stone">/ week, indicative</span></p> : null}
            <p className="mt-3 font-body text-[12px] text-stone">{k.hours}</p>
          </Reveal>
        ))}
      </div>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <Reveal><p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">How each week looks</p></Reveal>
          <Reveal as="ol" delay={1} className="mt-4 divide-y divide-sand border-y border-sand">
            {P.week.map(([t, d], i) => <li key={t} className="grid gap-1 py-3 sm:grid-cols-[32px_160px_1fr]"><span className="font-display text-[16px] text-gold-deep">{i + 1}</span><span className="font-display text-[16px]">{t}</span><span className="font-body text-[14px] font-light text-ink/70">{d}</span></li>)}
          </Reveal>
        </div>
        <div>
          <Reveal><p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Good to know</p></Reveal>
          <Reveal as="ul" delay={1} className="mt-4 space-y-3">
            {P.goodToKnow.map((g) => <li key={g} className="flex gap-4 font-body text-[14px] font-light leading-relaxed text-ink/75"><span className="mt-[9px] h-px w-5 shrink-0 bg-gold-deep" />{g}</li>)}
          </Reveal>
        </div>
      </div>
    </div>
  )
}
