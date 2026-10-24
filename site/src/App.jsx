import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CONTACT, FOOTER, HOURS } from './content/site.js'
import { ScrollToTop, asset } from './ui.jsx'
import Home from './pages/Home.jsx'
import PersonalChef from './pages/PersonalChef.jsx'
import PrivateCatering from './pages/PrivateCatering.jsx'
import LoadedBar from './pages/LoadedBar.jsx'
import WhatsOn from './pages/WhatsOn.jsx'
import Chef from './pages/Chef.jsx'
import Gallery from './pages/Gallery.jsx'
import Enquire from './pages/Enquire.jsx'
import Portfolio from './pages/Portfolio.jsx'
import CleanDream, { CleanDreamConfirmed } from './pages/CleanDream.jsx'
import TableMenuPrint from './pages/TableMenu.jsx'
import Menus from './pages/Menus.jsx'

const NAV = [
  { to: '/personal-chef', label: 'Personal Chef' },
  { to: '/private-catering', label: 'Private Catering' },
  { to: '/the-loaded-bar', label: 'The Loaded Bar' },
  { to: '/the-menus', label: 'The Menus' },
  { to: '/whats-up', label: 'What’s Up With Us?' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/the-gallery', label: 'The Gallery' },
  { to: '/the-chef', label: 'About the Chef' },
]

function Nav() {
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' ; return () => { document.body.style.overflow = '' } }, [open])

  return (
    <>
    <header className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ease-silk ${solid || open ? 'bg-ink/90 backdrop-blur-md' : 'bg-transparent'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex h-[76px] w-full max-w-page items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center" aria-label="The Creatiste Catering, home">
          <img src={asset('/brand/lockup-dark.png')} alt="The Creatiste Catering" className="h-9 w-auto sm:h-10" />
        </Link>
        <nav className="hidden flex-nowrap items-center gap-4 xl:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `whitespace-nowrap font-body text-[10.5px] uppercase tracking-[0.1em] transition-colors ${isActive ? 'text-gold' : 'text-ivory/80 hover:text-ivory'}`}>
              {n.label}
            </NavLink>
          ))}
          <Link to="/enquire" className="ml-1 whitespace-nowrap border border-gold px-3.5 py-2 font-body text-[10.5px] uppercase tracking-[0.1em] text-gold transition-colors hover:bg-gold hover:text-ink">Enquire Now</Link>
        </nav>
        <button type="button" onClick={() => setOpen((v) => !v)} className="xl:hidden -mr-2 p-2 text-ivory" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
          <span className="relative block h-4 w-6">
            <span className={`absolute left-0 top-0 h-px w-6 bg-current transition-transform duration-300 ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
            <span className={`absolute left-0 top-[7px] h-px w-6 bg-current transition-opacity duration-300 ${open ? 'opacity-0' : ''}`} />
            <span className={`absolute left-0 top-[14px] h-px w-6 bg-current transition-transform duration-300 ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
          </span>
        </button>
      </div>
    </header>
      {/* Mobile sheet — a sibling of the header: backdrop-filter on the header would otherwise become its containing block. */}
      <div className={`xl:hidden fixed inset-x-0 bottom-0 top-[76px] z-30 bg-ink transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <nav className="flex h-full flex-col px-6 pt-4" aria-label="Mobile">
          <p className="eyebrow pb-3">Menu</p>
          {NAV.map((n, i) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `flex items-baseline justify-between border-t border-ink-3 py-3.5 font-display text-[19px] tracking-[0.01em] ${isActive ? 'text-gold' : 'text-ivory/90'}`}>
              <span>{n.label}</span><span className="font-body text-[10px] tracking-eyebrow text-smoke">0{i + 1}</span>
            </NavLink>
          ))}
          <Link to="/enquire" className="mt-6 bg-gold px-6 py-3.5 text-center font-body text-[11px] uppercase tracking-wide text-ink">Enquire Now</Link>
          <Link to="/clean-dream" className="mt-2 border border-ivory/30 px-6 py-3.5 text-center font-body text-[11px] uppercase tracking-wide text-ivory/90">Order Clean Dream</Link>
          <p className="mt-auto font-body text-[12px] text-smoke" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>
            <a href={`mailto:${CONTACT.email}`} className="link-under">{CONTACT.email}</a>
          </p>
        </nav>
      </div>
    </>
  )
}

function Footer() {
  return (
    <footer className="ground-ink border-t border-ink-3">
      <div className="mx-auto w-full max-w-page px-5 py-16 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <img src={asset('/brand/lockup-dark.png')} alt="The Creatiste Catering" className="h-14 w-auto" />
            <p className="mt-6 max-w-sm font-body text-[14px] font-light leading-relaxed text-smoke">{FOOTER.tagline}</p>
            <a href={`mailto:${CONTACT.email}`} className="mt-5 inline-block font-body text-[14px] text-ivory/90 link-under">{CONTACT.email}</a>
          </div>
          <div className="lg:col-span-3">
            <p className="eyebrow">Explore</p>
            <ul className="mt-5 space-y-3 font-body text-[14px] text-ivory/80">
              {NAV.map((n) => <li key={n.to}><Link to={n.to} className="hover:text-gold">{n.label}</Link></li>)}
              <li><Link to="/enquire" className="hover:text-gold">Enquire Now</Link></li>
            </ul>
          </div>
          <div className="lg:col-span-4">
            <p className="eyebrow">Standard operating hours</p>
            <dl className="mt-5 space-y-4">
              {HOURS.map((h) => (
                <div key={h.label}>
                  <dt className="font-body text-[12px] uppercase tracking-wide text-ivory/70">{h.label}</dt>
                  <dd className="mt-1 font-body text-[14px] text-ivory/90">{h.value}</dd>
                </div>
              ))}
            </dl>
            <p className="eyebrow mt-8">Follow</p>
            <ul className="mt-4 flex gap-5 font-body text-[14px] text-ivory/80">
              <li><a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer" className="hover:text-gold">Instagram</a></li>
              <li><a href={`https://tiktok.com/@${CONTACT.tiktok}`} target="_blank" rel="noreferrer" className="hover:text-gold">TikTok</a></li>
              {CONTACT.linktree ? <li><a href={CONTACT.linktree} target="_blank" rel="noreferrer" className="hover:text-gold">Linktree</a></li> : null}
            </ul>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-ink-3 pt-6 font-body text-[12px] text-smoke sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} The Creatiste Catering. All rights reserved.</p>
          <p>{CONTACT.area}</p>
        </div>
      </div>
    </footer>
  )
}

function WhatsApp() {
  if (!CONTACT.whatsapp) return null
  return (
    <a href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-ink shadow-lg transition-transform hover:scale-105"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M20 3.9A11.3 11.3 0 0 0 2.2 17.6L1 23l5.6-1.5A11.3 11.3 0 0 0 20 3.9Zm-8 17.3c-1.7 0-3.3-.5-4.7-1.3l-.3-.2-3.3.9.9-3.2-.2-.3a9.4 9.4 0 1 1 7.6 4.1Zm5.2-7c-.3-.1-1.7-.8-1.9-.9-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1a7.7 7.7 0 0 1-3.8-3.3c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5l-.9-2c-.2-.5-.5-.5-.6-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.5.7.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3Z"/></svg>
    </a>
  )
}

function NotFound() {
  return (
    <section className="ground-ink flex min-h-[70vh] items-center">
      <div className="mx-auto max-w-page px-5 text-center">
        <p className="eyebrow">Nothing at this table</p>
        <h1 className="display mt-4 text-[40px]">We can’t find that page.</h1>
        <Link to="/" className="mt-8 inline-block font-body text-[13px] uppercase tracking-wide text-gold link-under">Back to the start</Link>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">Skip to content</a>
      <Nav />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/personal-chef" element={<PersonalChef />} />
          <Route path="/private-catering" element={<PrivateCatering />} />
          <Route path="/the-loaded-bar" element={<LoadedBar />} />
          <Route path="/whats-up" element={<WhatsOn />} />
          <Route path="/whats-on" element={<WhatsOn />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/the-chef" element={<Chef />} />
          <Route path="/the-gallery" element={<Gallery />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/clean-dream" element={<CleanDream />} />
          <Route path="/clean-dream/confirmed" element={<CleanDreamConfirmed />} />
          <Route path="/the-creatiste-table-menu" element={<TableMenuPrint />} />
          <Route path="/the-menus" element={<Menus />} />
          <Route path="/enquire" element={<Enquire />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <WhatsApp />
    </>
  )
}
