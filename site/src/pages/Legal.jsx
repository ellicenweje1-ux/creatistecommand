import { Link } from 'react-router-dom'
import { CONTACT, LEGAL } from '../content/site.js'
import { Eyebrow, Heading, Reveal, Section } from '../ui.jsx'

/* Privacy notice + terms. Linked from the footer only (not main navigation). */
function LegalPage({ doc, other }) {
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-14">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>Last updated {LEGAL.updated}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{doc.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-2xl text-ivory/75">{doc.intro}</p></Reveal>
        </div>
      </section>
      <Section ground="ivory">
        <div className="mx-auto max-w-3xl divide-y divide-sand">
          {doc.sections.map(([h, body], i) => (
            <Reveal key={h} delay={i % 3} className="py-8">
              <h2 className="font-display text-[24px]">{h}</h2>
              <p className="mt-3 font-body text-[15px] font-light leading-relaxed text-ink/80">{body}</p>
            </Reveal>
          ))}
          <p className="pt-8 font-body text-[13px] text-stone">Questions? Email <a href={`mailto:${CONTACT.email}`} className="link-under text-ink">{CONTACT.email}</a>. See also our <Link to={other.to} className="link-under text-ink">{other.label}</Link>.</p>
        </div>
      </Section>
    </>
  )
}
export function Privacy() { return <LegalPage doc={LEGAL.privacy} other={{ to: '/terms', label: 'terms of service' }} /> }
export function Terms() { return <LegalPage doc={LEGAL.terms} other={{ to: '/privacy', label: 'privacy notice' }} /> }
