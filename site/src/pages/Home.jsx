import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ABOUT, COMMAND, CONTACT, GALLERY, HERO, KIND_WORDS, LOADED_BAR, MISSION, NOW, PERSONAL_CHEF, PRIVATE_CATERING, PROCESS, SETTINGS } from '../content/site.js'
import { Arrow, Button, Eyebrow, Flame, Frame, Heading, Reveal, Section, asset } from '../ui.jsx'

function Hero() {
  const slides = HERO.slides?.length ? HERO.slides : [{ src: HERO.photo, pos: '70% 30%' }]
  const [i, setI] = useState(0)
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), HERO.interval || 6000)
    return () => clearInterval(t)
  }, [slides.length])
  return (
    <section className="hero-field grain relative flex min-h-[100svh] items-center overflow-hidden" data-hero-slide={i}>
      <div className="absolute inset-0">
        {slides.map((sl, n) => (
          <img key={sl.src} src={asset(sl.src)} alt="" loading={n ? 'lazy' : 'eager'} style={{ objectPosition: sl.pos || '50% 50%' }}
            className={`hero-slide absolute inset-0 h-full w-full object-cover ${n === i ? 'is-active' : ''}`} data-slide={n} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/25" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>
      <Flame className="hero-glow pointer-events-none absolute -right-10 top-1/2 hidden h-[60vh] w-auto -translate-y-1/2 opacity-[.10] sm:right-[6%] lg:block" />
      <div className="relative mx-auto w-full max-w-page px-5 pb-20 pt-32 sm:px-8 lg:px-12">
        <Reveal><Eyebrow>{HERO.eyebrow}</Eyebrow></Reveal>
        <Reveal delay={1}>
          <h1 className="display mt-6 max-w-4xl text-[44px] leading-[1.02] sm:text-[64px] lg:text-[84px]">
            {HERO.title[0]}<br /><span className="italic text-gold-light">{HERO.title[1]}</span>
          </h1>
        </Reveal>
        <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/80">{HERO.sub}</p></Reveal>
        <Reveal delay={3} className="mt-10 flex flex-wrap gap-3">
          <Button to="/enquire">Tell us about your table</Button>
          <Button to="/personal-chef" variant="ghost">View services</Button>
        </Reveal>
        <Reveal delay={3} className="mt-14 flex items-center gap-4 font-body text-[10px] uppercase tracking-eyebrow text-smoke sm:mt-20 sm:text-[11px]">
          <span className="h-px w-10 bg-gold/60" /> {HERO.strip}
        </Reveal>
        {slides.length > 1 ? (
          <div className="absolute bottom-8 right-5 flex gap-2 sm:right-8 lg:right-12" aria-hidden="true">
            {slides.map((_, n) => <span key={n} className={`h-px transition-all duration-700 ${n === i ? 'w-8 bg-gold' : 'w-4 bg-ivory/30'}`} />)}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function NowStrip() {
  const live = NOW.items.filter((i) => i.live)
  if (!live.length) return null
  // Every phrase in the strip links to its own item (the Clean Dream order page, the pop-up's section on What's Up).
  const words = live.flatMap((i) => [`${i.name} · ${i.kind}`, i.when, ...i.meta].map((w) => ({ w, to: i.link || i.cta?.to || '/whats-up' })))
  return (
    <div className="border-y border-gold/30 bg-ink-2 text-ivory">
      <div className="mx-auto flex w-full max-w-page items-stretch px-5 sm:px-8 lg:px-12">
        <Link to="/whats-up" className="flex shrink-0 items-center gap-3 border-r border-gold/30 pr-4 font-body text-[11px] uppercase tracking-eyebrow text-gold sm:pr-8">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" /></span>
          Live now
        </Link>
        <div className="relative min-w-0 flex-1 overflow-hidden py-4" data-now-strip>
          <div className="ticker font-body text-[12px] uppercase tracking-wide text-ivory/85">
            {[...words, ...words].map((x, i) => <span key={i} className="flex items-center gap-12"><Link to={x.to} className="whitespace-nowrap transition-colors hover:text-gold" tabIndex={i >= words.length ? -1 : undefined} aria-hidden={i >= words.length ? 'true' : undefined}>{x.w}</Link><span className="h-1 w-1 rounded-full bg-gold" /></span>)}
          </div>
        </div>
        <Link to="/whats-up" className="hidden shrink-0 items-center gap-2 border-l border-gold/30 pl-8 font-body text-[11px] uppercase tracking-eyebrow text-ivory/80 hover:text-gold lg:flex">What’s up with Us? <Arrow /></Link>
      </div>
    </div>
  )
}

function About() {
  return (
    <Section ground="ivory" id="about">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-8 lg:col-start-3">
          <Reveal><Eyebrow>{ABOUT.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5">{ABOUT.title}</Heading></Reveal>
          <Reveal delay={2}><p className="mt-3 font-display text-[22px] italic text-gold-deep sm:text-[26px]">{ABOUT.tagline}</p></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-2xl text-ink/80">{ABOUT.body}</p></Reveal>
          <dl className="mt-10 divide-y divide-sand border-y border-sand">
            {ABOUT.pillars.map((p, i) => (
              <Reveal key={p.k} as="div" delay={i} className="grid gap-2 py-5 sm:grid-cols-[140px_1fr]">
                <dt className="eyebrow text-gold-deep">{p.k}</dt>
                <dd className="font-body text-[15px] font-light leading-relaxed text-ink/75">{p.v}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  )
}

function ServiceCard({ s, umbrella, i }) {
  return (
    <Reveal delay={i % 3} className="group flex flex-col border border-ink-3 bg-ink-2/60 p-7 transition-colors duration-500 hover:border-gold/50">
      <p className="font-display text-[24px] leading-tight">{s.name}</p>
      <p className="mt-2 font-body text-[13px] italic text-gold-light/90">{s.strap}</p>
      <p className="mt-4 flex-1 font-body text-[14px] font-light leading-relaxed text-ivory/70">{s.body}</p>
      {SETTINGS.showFromPrices && s.from ? <p className="mt-4 font-body text-[12px] uppercase tracking-wide text-gold">From {s.from}</p> : null}
      <Link to={s.link || `/${umbrella.slug}#${s.slug}`} className="mt-6 inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-wide text-gold transition-colors group-hover:text-gold-light">Explore <Arrow /></Link>
    </Reveal>
  )
}

function Services() {
  return (
    <Section ground="ink" id="services">
      <div className="max-w-2xl">
        <Reveal><Eyebrow>{MISSION.eyebrow}</Eyebrow></Reveal>
        <Reveal delay={1}><Heading className="mt-5">{MISSION.title}</Heading></Reveal>
        <Reveal delay={2}><p className="lede mt-6 text-ivory/75">{MISSION.body}</p></Reveal>
      </div>
      {[PERSONAL_CHEF, PRIVATE_CATERING].map((u) => (
        <div key={u.slug} className="mt-16 first:mt-16">
          <Reveal className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-3 pb-4">
            <div>
              <p className="font-display text-[26px]">{u.name}</p>
            </div>
            <Link to={`/${u.slug}`} className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-wide text-ivory/70 hover:text-gold">All {u.short} services <Arrow /></Link>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {u.services.slice(0, 3).map((s, i) => <ServiceCard key={s.slug} s={s} umbrella={u} i={i} />)}
          </div>
        </div>
      ))}
    </Section>
  )
}

function LoadedBarFeature() {
  return (
    <Section ground="linen" id="loaded-bar">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Reveal><Eyebrow className="text-gold-deep">{LOADED_BAR.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5">{LOADED_BAR.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-6 max-w-md text-ink/80">A live hot food station for your next celebration: customisable loaded bowls, endless combinations, and full service from setup to breakdown.</p></Reveal>
          <Reveal delay={3} className="mt-8 flex flex-wrap gap-3">
            <Button to="/the-loaded-bar" variant="ink">Explore The Loaded Bar</Button>
            <Button to="/enquire?lane=private-catering" variant="ghost-ink">Book the bar</Button>
          </Reveal>
        </div>
        <Reveal delay={1} className="lg:col-span-6"><Frame src={LOADED_BAR.photo} alt="The Loaded Bar station" ratio="4/5" fit="contain" className="lg:ml-auto lg:w-[86%]" /></Reveal>
      </div>
    </Section>
  )
}

/* One highlights feature for the home page: a slow, continuous strip of photographs (the best of the
   gallery and the Instagram feed), linking on to the gallery (now part of Our Portfolio) and Instagram. Replaces the separate gallery
   grid, Instagram mirror and chef teaser that used to sit here. */
function Highlights() {
  const photos = GALLERY.photos.slice(0, 14)
  const row = [...photos, ...photos] // doubled so the loop is seamless
  return (
    <Section ground="ivory" tight id="highlights" className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal><Eyebrow className="text-gold-deep">Highlights</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5 max-w-xl">{GALLERY.title}</Heading></Reveal>
        </div>
        <Reveal delay={2} className="flex flex-wrap gap-6">
          <Link to="/portfolio#gallery" className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-wide text-ink/70 hover:text-gold-deep">The Gallery <Arrow /></Link>
          <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-wide text-ink/70 hover:text-gold-deep">@{CONTACT.instagram} <Arrow /></a>
        </Reveal>
      </div>
      <div className="relative mt-10 -mx-5 sm:-mx-8 lg:-mx-12" data-highlights>
        <div className="ticker ticker-slow items-stretch gap-3 px-3 sm:gap-4">
          {row.map((p, n) => (
            <Link key={`${p.src}-${n}`} to="/portfolio#gallery" className="block w-[220px] shrink-0 sm:w-[280px]" aria-hidden={n >= photos.length ? 'true' : undefined} tabIndex={n >= photos.length ? -1 : undefined}>
              <Frame src={p.src} alt={n >= photos.length ? '' : p.alt} ratio="4/5" />
            </Link>
          ))}
        </div>
      </div>
    </Section>
  )
}

function Process() {
  return (
    <Section ground="linen" id="process">
      <div className="max-w-2xl">
        <Reveal><Eyebrow className="text-gold-deep">{PROCESS.eyebrow}</Eyebrow></Reveal>
        <Reveal delay={1}><Heading className="mt-5">{PROCESS.title}</Heading></Reveal>
      </div>
      <ol className="mt-12 grid gap-px bg-sand sm:grid-cols-2 lg:grid-cols-4">
        {PROCESS.steps.map(([t, d], i) => (
          <Reveal key={t} as="li" delay={i} className="bg-linen p-7">
            <p className="font-display text-[34px] text-gold-deep">0{i + 1}</p>
            <p className="mt-4 font-display text-[20px]">{t}</p>
            <p className="mt-3 font-body text-[14px] font-light leading-relaxed text-ink/70">{d}</p>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}

function KindWords() {
  const q = KIND_WORDS.quotes[0]
  return (
    <Section ground="ivory" tight id="testimonials">
      <Reveal className="text-center"><Eyebrow className="text-gold-deep">{KIND_WORDS.eyebrow}</Eyebrow><Heading size="md" className="mt-4">{KIND_WORDS.title}</Heading></Reveal>
      <Reveal delay={1} className="mx-auto mt-10 max-w-3xl text-center">
        <p className="font-display text-[24px] leading-snug text-ink/90 sm:text-[30px]">“{q.text}”</p>
        <p className="mt-6 font-body text-[11px] uppercase tracking-eyebrow text-stone">{q.who}</p>
      </Reveal>
    </Section>
  )
}

/* Behind the scenes: the business runs on The Creatiste Command. A short band that leads to its page. */
export function CommandBand() {
  return (
    <Section ground="ink" tight className="border-t border-ink-3" id="creatiste-command">
      <div className="grid items-center gap-8 lg:grid-cols-12" data-command-band>
        <div className="lg:col-span-8">
          <Reveal><Eyebrow>Behind the scenes</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-4">Our kitchen runs on The Creatiste Command.</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-4 max-w-xl text-ivory/70">{COMMAND.strap} Built by our chef for chefs and caterers: bookings, menus, quotes, invoices, shopping, prep and the diary, in one place.</p></Reveal>
        </div>
        <Reveal delay={2} className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
          <Button to="/creatiste-command" variant="ghost">Find out more</Button>
          <Button href={COMMAND.tryUrl} target="_blank" rel="noreferrer">{COMMAND.tryLabel}</Button>
        </Reveal>
      </div>
    </Section>
  )
}

export function EnquireBand({ ground = 'ink' }) {
  const dark = ground === 'ink'
  return (
    <Section ground={ground} tight className={dark ? 'border-t border-ink-3' : 'border-t border-sand'}>
      <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div>
          <Reveal><Eyebrow className={dark ? '' : 'text-gold-deep'}>Contact</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-4">Tell us about your table</Heading></Reveal>
          <Reveal delay={2}><p className={`lede mt-4 max-w-md ${dark ? 'text-ivory/70' : 'text-ink/70'}`}>We reply personally, usually within one business day.</p></Reveal>
        </div>
        <Reveal delay={2} className="flex flex-wrap gap-3">
          <Button to="/enquire">Start an enquiry</Button>
          <Button to="/cleandream" variant={dark ? 'ghost' : 'ghost-ink'}>Order Clean Dream</Button>
        </Reveal>
      </div>
    </Section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <NowStrip />
      <About />
      <Services />
      <LoadedBarFeature />
      <Highlights />
      <Process />
      <KindWords />
      <CommandBand />
      <EnquireBand />
    </>
  )
}
