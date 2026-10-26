import { CHEF } from '../content/site.js'
import { Eyebrow, Frame, Heading, Reveal, Section } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

export default function Chef() {
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-20">
        <div className="mx-auto grid w-full max-w-page gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:px-12">
          <div className="lg:col-span-7">
            <Reveal><Eyebrow>{CHEF.eyebrow}</Eyebrow></Reveal>
            <Reveal delay={1}><p className="mt-5 font-display text-[26px] italic text-ivory/80">{CHEF.lead}</p></Reveal>
            <Reveal delay={1}><Heading as="h1" size="xl" className="mt-2 uppercase tracking-[0.06em]">{CHEF.name}</Heading></Reveal>
            <Reveal delay={2}><p className="mt-4 font-body text-[12px] uppercase tracking-eyebrow text-gold">{CHEF.role}</p></Reveal>
            <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">{CHEF.story}</p></Reveal>
            <Reveal delay={3} as="ul" className="mt-10 grid gap-3 border-t border-ink-3 pt-8 sm:grid-cols-2">
              {CHEF.facts.map((f) => <li key={f} className="flex gap-3 font-body text-[12px] uppercase tracking-wide text-ivory/80"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold" />{f}</li>)}
            </Reveal>
          </div>
          <Reveal delay={2} className="lg:col-span-5"><Frame src={CHEF.photo} alt={CHEF.name} ratio="4/5" /></Reveal>
        </div>
      </section>

      <Section ground="linen" tight>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal><Eyebrow className="text-gold-deep">About me</Eyebrow></Reveal>
            <Reveal delay={1}><Heading className="mt-5">In her words.</Heading></Reveal>
          </div>
          <div className="space-y-5 lg:col-span-8" data-about>
            {CHEF.about.map((para, i) => <Reveal key={i} delay={Math.min(i + 1, 3)}><p className="lede max-w-2xl text-ink/80">{para}</p></Reveal>)}
          </div>
        </div>
      </Section>

      <Section ground="ivory">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal><Eyebrow className="text-gold-deep">Specialisms</Eyebrow></Reveal>
            <Reveal delay={1}><Heading className="mt-5">What we do best.</Heading></Reveal>
            <Reveal as="ul" delay={2} className="mt-8 flex flex-wrap gap-2">
              {CHEF.specialisms.map((s) => <li key={s} className="border border-sand px-4 py-2 font-body text-[12px] uppercase tracking-wide text-ink/80">{s}</li>)}
            </Reveal>
            <Reveal delay={3}><p className="lede mt-6 max-w-md text-ink/75">{CHEF.dietary}</p></Reveal>
            <Reveal delay={3}><p className="mt-8 font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Profile</p></Reveal>
            <Reveal as="dl" delay={3} className="mt-3 divide-y divide-sand border-y border-sand">
              {CHEF.profile.map(([k, v]) => <div key={k} className="grid gap-1 py-3 sm:grid-cols-[120px_1fr]"><dt className="font-body text-[11px] uppercase tracking-wide text-stone">{k}</dt><dd className="font-body text-[14px] text-ink/85">{v}</dd></div>)}
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <Reveal><Eyebrow className="text-gold-deep">Accreditations & certificates</Eyebrow></Reveal>
            <Reveal as="ul" delay={1} className="mt-6 divide-y divide-sand border-y border-sand">
              {CHEF.accreditations.map((a) => (
                <li key={a.name} className="flex items-center justify-between gap-6 py-5">
                  <div>
                    <p className="font-display text-[19px]">{a.name}</p>
                    <p className="mt-1 font-body text-[13px] text-stone">{a.issuer}{a.year ? ` · ${a.year}` : ''}</p>
                  </div>
                  {a.file ? <a href={a.file} target="_blank" rel="noreferrer" className="font-body text-[12px] uppercase tracking-wide text-gold-deep link-under">View</a> : <span className="font-body text-[11px] uppercase tracking-wide text-stone/70">Certificate to follow</span>}
                </li>
              ))}
            </Reveal>
          </div>
        </div>
      </Section>
      <EnquireBand />
    </>
  )
}
