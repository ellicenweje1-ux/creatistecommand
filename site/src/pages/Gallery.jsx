import { useEffect, useState } from 'react'
import { CONTACT, GALLERY } from '../content/site.js'
import { Eyebrow, Frame, Heading, Reveal, Section, asset } from '../ui.jsx'
import { EnquireBand } from './Home.jsx'

export default function Gallery() {
  const [open, setOpen] = useState(null)
  useEffect(() => {
    if (open === null) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <section className="hero-field grain relative pt-40 pb-16">
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{GALLERY.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{GALLERY.title}</Heading></Reveal>
          <Reveal delay={2}><p className="mt-8 font-body text-[14px] text-smoke">{GALLERY.follow} — <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer" className="link-under text-ivory/90">@{CONTACT.instagram}</a></p></Reveal>
        </div>
      </section>
      <Section ground="ivory" tight>
        <div className="columns-2 gap-3 sm:gap-4 md:columns-3">
          {GALLERY.photos.map((p, i) => (
            <Reveal key={p.src} delay={i % 3} className="mb-3 break-inside-avoid sm:mb-4">
              <button type="button" onClick={() => setOpen(i)} className="block w-full text-left" aria-label={`Open: ${p.alt}`}>
                <Frame src={p.src} alt={p.alt} ratio={`${p.w}/${p.h}`} />
              </button>
            </Reveal>
          ))}
        </div>
      </Section>
      {open !== null ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-5" onClick={() => setOpen(null)}>
          <img src={asset(GALLERY.photos[open].src)} alt={GALLERY.photos[open].alt} className="max-h-[88vh] max-w-full object-contain" />
          <button type="button" className="absolute right-5 top-5 font-body text-[12px] uppercase tracking-wide text-ivory/80 hover:text-gold" style={{ top: 'calc(1.25rem + env(safe-area-inset-top))' }}>Close</button>
        </div>
      ) : null}
      <EnquireBand />
    </>
  )
}
