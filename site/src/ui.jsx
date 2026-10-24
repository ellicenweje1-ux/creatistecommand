import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

const base = import.meta.env.BASE_URL || '/'
/* Public asset path that survives the relative-base preview build. */
export const asset = (p) => (p.startsWith('/') ? base.replace(/\/$/, '') + p : p)

export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [pathname, hash])
  return null
}

/* Fade-and-rise once in view. Wrap any block. */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) { el && el.classList.add('is-in'); return }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect() } })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <Tag ref={ref} data-delay={delay || undefined} className={`reveal ${className}`} {...rest}>{children}</Tag>
}

export function Section({ ground = 'ink', id, className = '', children, tight = false }) {
  const g = { ink: 'ground-ink', ivory: 'ground-ivory', linen: 'ground-linen' }[ground]
  return (
    <section id={id} className={`${g} ${tight ? 'py-16 sm:py-20' : 'py-20 sm:py-28 lg:py-32'} ${className}`}>
      <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">{children}</div>
    </section>
  )
}

export function Eyebrow({ children, className = '' }) {
  return <p className={`eyebrow ${className}`}>{children}</p>
}

export function Heading({ as: Tag = 'h2', size = 'lg', className = '', children }) {
  const s = {
    xl: 'text-[40px] sm:text-[56px] lg:text-[72px]',
    lg: 'text-[32px] sm:text-[42px] lg:text-[52px]',
    md: 'text-[26px] sm:text-[32px] lg:text-[36px]',
    sm: 'text-[22px] sm:text-[26px]',
  }[size]
  return <Tag className={`display ${s} ${className}`}>{children}</Tag>
}

/* Buttons: gold (solid), ghost-ivory (for ink grounds), ghost-ink (for ivory grounds). */
export function Button({ to, href, variant = 'gold', className = '', children, ...rest }) {
  const v = {
    gold: 'bg-gold text-ink hover:bg-gold-light',
    ghost: 'border border-ivory/40 text-ivory hover:border-gold hover:text-gold',
    'ghost-ink': 'border border-ink/40 text-ink hover:border-gold-deep hover:text-gold-deep',
    'ink': 'bg-ink text-ivory hover:bg-ink-2',
  }[variant]
  const cls = `inline-flex items-center justify-center gap-2 px-6 py-3.5 font-body text-[12px] font-medium uppercase tracking-wide transition-all duration-300 ease-silk ${v} ${className}`
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>
  return <button type="button" className={cls} {...rest}>{children}</button>
}

/* A photo slot. With `src` it shows the image; without, an intentional dark frame. */
export function Frame({ src, alt = '', ratio = '4/5', className = '', caption }) {
  return (
    <figure className={`frame ${src ? '' : 'frame-empty'} ${className}`} style={{ aspectRatio: ratio }}>
      {src ? <img src={asset(src)} alt={alt} loading="lazy" /> : null}
      {caption ? <figcaption className="absolute bottom-3 left-4 font-body text-[11px] uppercase tracking-wide text-smoke">{caption}</figcaption> : null}
    </figure>
  )
}

export function Flame({ className = '' }) {
  return <img src={asset('/brand/flame.png')} alt="" aria-hidden="true" className={className} />
}

export function Arrow({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
