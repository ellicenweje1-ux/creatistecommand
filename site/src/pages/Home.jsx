import { Link } from 'react-router-dom'
import { ABOUT, CHEF, GALLERY, HERO, KIND_WORDS, MISSION, NOW, PERSONAL_CHEF, PRIVATE_CATERING, PROCESS, LOADED_BAR, SETTINGS } from '../content/site.js'
import SocialMirror from '../social.jsx'
import { Arrow, Button, Eyebrow, Flame, Frame, Heading, Reveal, Section, asset } from '../ui.jsx'

function Hero() {
  return (
    <section className="hero-field grain relative flex min-h-[100svh] items-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={asset(HERO.photo)} alt="" className="h-full w-full object-cover object-[70%_30%] opacity-55" />
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
      </div>
    </section>
  )
}

function NowStrip() {
  const live = NOW.items.filter((i) => i.live)
  if (!live.length) return null
  const words = live.flatMap((i) => [`${i.name} · ${i.kind}`, i.when, ...i.meta])
  return (
    <div className="border-y border-gold/30 bg-ink-2 text-ivory">
      <div className="mx-auto flex w-full max-w-page items-stretch px-5 sm:px-8 lg:px-12">
        <Link to="/whats-up" className="flex shrink-0 items-center gap-3 border-r border-gold/30 pr-4 font-body text-[11px] uppercase tracking-eyebrow text-gold sm:pr-8">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" /></span>
          Live now
        </Link>
        <div className="relative min-w-0 flex-1 overflow-hidden py-4">
          <div className="ticker font-body text-[12px] uppercase tracking-wide text-ivory/85">
            {[...words, ...words].map((w, i) => <span key={i} className="flex items-center gap-12"><span>{w}</span><span className="h-1 w-1 rounded-full bg-gold" /></span>)}
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
        <div className="lg:col-span-6">
          <Reveal><Eyebrow>{ABOUT.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5">{ABOUT.title}</Heading></Reveal>
          <Reveal delay={2}><p className="mt-3 font-display text-[22px] italic text-gold-deep sm:text-[26px]">{ABOUT.tagline}</p></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-lg text-ink/80">{ABOUT.body}</p></Reveal>
          <dl className="mt-10 divide-y divide-sand border-y border-sand">
            {ABOUT.pillars.map((p, i) => (
              <Reveal key={p.k} as="div" delay={i} className="grid gap-2 py-5 sm:grid-cols-[140px_1fr]">
                <dt className="eyebrow text-gold-deep">{p.k}</dt>
                <dd className="font-body text-[15px] font-light leading-relaxed text-ink/75">{p.v}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
        <div className="relative lg:col-span-6">
          <Reveal className="ml-auto w-[82%]"><Frame src={ABOUT.photos[0]} alt="Ellice at a buffet spread" ratio="4/5" /></Reveal>
          <Reveal delay={2} className="absolute -bottom-10 left-0 w-[46%] shadow-2xl"><Frame src={ABOUT.photos[1]} alt="Jollof rice, puff puff and salad" ratio="4/5" /></Reveal>
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
        <Reveal delay={1} className="lg:col-span-6"><Frame src={LOADED_BAR.photo} alt="The Loaded Bar station" ratio="4/5" className="lg:ml-auto lg:w-[86%]" /></Reveal>
      </div>
    </Section>
  )
}

function GalleryTeaser() {
  const p = GALLERY.photos
  return (
    <Section ground="ivory" id="gallery">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal><Eyebrow className="text-gold-deep">{GALLERY.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5 max-w-xl">{GALLERY.title}</Heading></Reveal>
        </div>
        <Reveal delay={2}><Link to="/the-gallery" className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-wide text-ink/70 hover:text-gold-deep">The Gallery <Arrow /></Link></Reveal>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Reveal className="col-span-2 row-span-2"><Frame src={p[0]?.src} alt={p[0]?.alt} ratio="1/1" /></Reveal>
        <Reveal delay={1}><Frame src={p[1]?.src} alt={p[1]?.alt} ratio="1/1" /></Reveal>
        <Reveal delay={2}><Frame src={p[3]?.src} alt={p[3]?.alt} ratio="1/1" /></Reveal>
        <Reveal delay={2}><Frame src={p[2]?.src} alt={p[2]?.alt} ratio="1/1" /></Reveal>
        <Reveal delay={3}><Frame src={p[4]?.src} alt={p[4]?.alt} ratio="1/1" /></Reveal>
      </div>
    </Section>
  )
}

function ChefTeaser() {
  return (
    <Section ground="ink" id="chef">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-5"><Frame src={CHEF.photo} alt={CHEF.name} ratio="4/5" /></Reveal>
        <div className="lg:col-span-6 lg:col-start-7">
          <Reveal><Eyebrow>{CHEF.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><p className="mt-5 font-display text-[26px] italic text-ivory/80">{CHEF.lead}</p></Reveal>
          <Reveal delay={1}><Heading className="mt-2 uppercase tracking-[0.06em]">{CHEF.name}</Heading></Reveal>
          <Reveal delay={2}><p className="mt-3 font-body text-[12px] uppercase tracking-eyebrow text-gold">{CHEF.role}</p></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-lg text-ivory/75">{CHEF.story}</p></Reveal>
          <Reveal delay={3}><Link to="/the-chef" className="mt-8 inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-wide text-gold hover:text-gold-light">Profile & accreditations <Arrow /></Link></Reveal>
        </div>
      </div>
    </Section>
  )
}

function Process() {
  return (
    <Section ground="linen">
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
    <Section ground="ivory" tight>
      <Reveal className="text-center"><Eyebrow className="text-gold-deep">{KIND_WORDS.eyebrow}</Eyebrow><Heading size="md" className="mt-4">{KIND_WORDS.title}</Heading></Reveal>
      <Reveal delay={1} className="mx-auto mt-10 max-w-3xl text-center">
        <p className="font-display text-[24px] leading-snug text-ink/90 sm:text-[30px]">“{q.text}”</p>
        <p className="mt-6 font-body text-[11px] uppercase tracking-eyebrow text-stone">{q.who}</p>
      </Reveal>
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
          <Button to="/clean-dream" variant={dark ? 'ghost' : 'ghost-ink'}>Order Clean Dream</Button>
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
      <GalleryTeaser />
      <SocialMirror ground="linen" />
      <ChefTeaser />
      <Process />
      <KindWords />
      <EnquireBand />
    </>
  )
}
