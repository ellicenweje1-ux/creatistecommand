import { useEffect } from 'react'
import { CONTACT, GALLERY } from './content/site.js'
import { Arrow, Eyebrow, Heading, Reveal, Section } from './ui.jsx'

/* The social mirror: official Instagram embeds of posts and reels chosen in content/site.js.
   They show pictures and videos and stay in sync with the post. A live, auto-updating feed needs
   Instagram's Graph API with a Business account token; that can be added through The Creatiste
   Command later. Until then this curated wall is the honest, zero-cost version. */
export default function SocialMirror({ ground = 'linen' }) {
  const posts = GALLERY.instagram
  useEffect(() => {
    if (!posts.length) return
    const run = () => window.instgrm?.Embeds?.process?.()
    if (window.instgrm) { run(); return }
    const s = document.createElement('script')
    s.async = true; s.src = 'https://www.instagram.com/embed.js'; s.onload = run
    document.body.appendChild(s)
  }, [posts.length])
  const dark = ground === 'ink'
  return (
    <Section ground={ground} tight>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal><Eyebrow className={dark ? '' : 'text-gold-deep'}>From Instagram</Eyebrow></Reveal>
          <Reveal delay={1}><Heading size="md" className="mt-4">@{CONTACT.instagram}</Heading></Reveal>
        </div>
        <Reveal delay={2}>
          <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-wide ${dark ? 'text-ivory/80 hover:text-gold' : 'text-ink/70 hover:text-gold-deep'}`}>Follow on Instagram <Arrow /></a>
        </Reveal>
      </div>
      {posts.length ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((url) => (
            <Reveal key={url} className="min-w-0 overflow-hidden">
              <blockquote className="instagram-media !m-0 !min-w-0 !max-w-full" data-instgrm-permalink={url} data-instgrm-version="14" style={{ width: '100%' }}>
                <a href={url} target="_blank" rel="noreferrer" className={`block p-6 font-body text-[13px] ${dark ? 'text-ivory/70' : 'text-ink/70'}`}>View this post on Instagram</a>
              </blockquote>
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal delay={2} className="mt-10">
          {/* Instagram's public profile embed: the latest posts, no account connection needed. Shows on the live site (some hosts, like design previews, block third-party frames). */}
          <iframe title={`@${CONTACT.instagram} on Instagram`} src={`https://www.instagram.com/${CONTACT.instagram}/embed/`} loading="lazy" className={`block h-[560px] w-full max-w-[640px] border ${dark ? 'border-ink-3 bg-ink-2' : 'border-sand bg-ivory'} mx-auto`} allowTransparency="true" />
          <p className={`mt-4 text-center font-body text-[12px] ${dark ? 'text-smoke' : 'text-stone'}`}>If the feed doesn’t load here, <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer" className="link-under">open @{CONTACT.instagram} on Instagram</a>.</p>
        </Reveal>
      )}
    </Section>
  )
}
