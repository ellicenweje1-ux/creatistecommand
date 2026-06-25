import { useEffect, useState } from 'react'
import { cls } from './format'

/* ---------------------------------- icons ---------------------------------- */
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  calendar: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13h14M9 8h6',
  box: 'M21 8 12 3 3 8m18 0v8l-9 5-9-5V8m18 0-9 5M3 8l9 5m0 0v8',
  cart: 'M3 4h2l2.6 12.4a1 1 0 0 0 1 .6h8.8a1 1 0 0 0 1-.7L21 8H6m2 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  truck: 'M3 7h11v8H3V7Zm11 3h4l3 3v2h-7v-5ZM7 18a2 2 0 1 0 0-2m11 2a2 2 0 1 0 0-2',
  check: 'm5 13 4 4L19 7',
  checks: 'M4 12h16M4 6h16M4 18h10',
  map: 'M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Zm0 0v14m6-12v14',
  layout: 'M4 4h16v16H4V4Zm0 6h16M10 10v10',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z',
  coins: 'M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8Zm8-2.5v13C20 19.9 16.4 21 12 21s-8-1.1-8-2.5v-13M20 12c0 1.4-3.6 2.5-8 2.5S4 13.4 4 12',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.5c-.8.3-1.5.7-2.2 1.3l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1c.7.6 1.4 1 2.2 1.3l.4 2.5h4l.4-2.5c.8-.3 1.5-.7 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z',
  shield: 'M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14 6l3 3',
  trash: 'M5 7h14m-9-3h4M7 7l1 13h8l1-13M10 11v5m4-5v5',
  search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 6-6 6 6 6',
  star: 'm12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z',
  pin: 'M12 21s-6.5-5.4-6.5-10A6.5 6.5 0 0 1 12 4.5 6.5 6.5 0 0 1 18.5 11c0 4.6-6.5 10-6.5 10Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z',
  clock: 'M12 7v5l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  alert: 'M12 9v4m0 4h.01M10.3 4.6 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  dots: 'M12 6h.01M12 12h.01M12 18h.01',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5m5 5H3',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  external: 'M14 4h6v6m0-6L10 14M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3',
  users: 'M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.8-1.2-3.4-2.9-3.9M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4.3.8a3 3 0 0 1-1.6 3.6',
  phone: 'M5 4h4l1.5 4.5L8 10a12 12 0 0 0 6 6l1.5-2.5L20 15v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z',
  mail: 'M4 6h16v12H4V6Zm0 1 8 6 8-6',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  copy: 'M8 8h12v12H8V8Zm-4 8V4h12',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m11.4 0 1.4 1.4M4.9 4.9l1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  lock: 'M7 10V8a5 5 0 0 1 10 0v2m-12 0h14v11H5V10Zm7 4v3',
  pen: 'M12 19l7.5-7.5a2.5 2.5 0 0 0-3.5-3.5L8.5 15.5 7 19l5-1.5Zm3-9 2 2M4 21h16',
  lineTool: 'M5 19 19 5m-2-1a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM3 20a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  circleShape: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  squareShape: 'M5 5h14v14H5V5Z',
  clipboard: 'M9 4h6v3H9V4ZM8 5H6v16h12V5h-2m-7 7h6m-6 4h4',
  grid2: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  tag: 'M3 12V4h8l9 9-8 8-9-9Zm5.5-4.5h.01',
  fork: 'M8 3v5l4 3M12 3v18M16 3v5l-4 3',
  doc: 'M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6m-6 4h6',
  help: 'M12 17h.01M9.3 9.3a2.7 2.7 0 1 1 3.8 2.5c-.8.3-1.6.9-1.6 1.7v.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  flame: 'M12 21c4 0 7-2.6 7-6.5 0-3-2-5-3.5-6.5-.3 1.6-1 2.6-2 3-0.1-2.9-1.5-5.5-4.5-7 .5 3-.6 4.4-2 6-1.3 1.4-2 3-2 4.5C5 18.4 8 21 12 21Z',
  play: 'M8 5.5v13l11-6.5L8 5.5Z',
  pause: 'M7.5 5h3v14h-3V5Zm6 0h3v14h-3V5Z',
  replay: 'M3 3v5h5M3.5 8A9 9 0 1 1 3 12.5',
  sound: 'M4 9v6h4l5 4V5L8 9H4Zm13 .5a3.5 3.5 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10',
  soundOff: 'M4 9v6h4l5 4V5L8 9H4Zm12 2 5 5m0-5-5 5',
  mobile: 'M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Zm2.5 15.5h3',
  circleV: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 9.5l3.5 5 3.5-5',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1L23 23',
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] || PATHS.dots} />
    </svg>
  )
}

/* --------------------------------- buttons --------------------------------- */
const BTN_VARIANTS = {
  primary: 'bg-copper text-ink hover:bg-copper-dark shadow-sm',
  dark: 'bg-ink text-cream hover:bg-ink-soft',
  secondary: 'bg-card border border-line text-fg hover:border-copper/50 hover:text-copper',
  ghost: 'text-fg/60 hover:text-fg hover:bg-fg/5',
  danger: 'bg-card border border-red-400/40 text-red-600 hover:bg-red-500/10 dark:text-red-400',
}

export function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...props }) {
  const sizes = { sm: 'px-2.5 py-1.5 text-xs gap-1.5', md: 'px-4 py-2 text-sm gap-2', lg: 'px-6 py-3 text-base gap-2' }
  return (
    <button
      className={cls('inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        BTN_VARIANTS[variant], sizes[size], className)}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className = '', size = 16, ...props }) {
  return (
    <button title={label} aria-label={label}
      className={cls('rounded-lg p-1.5 text-fg/45 transition-colors hover:bg-fg/5 hover:text-fg', className)} {...props}>
      <Icon name={icon} size={size} />
    </button>
  )
}

/* ---------------------------------- layout --------------------------------- */
export function Card({ title, action, children, className = '', pad = true }) {
  return (
    <section className={cls('rounded-xl border border-line bg-card shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
          <h3 className="font-display text-[15px] font-semibold">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, sub, actions, backTo }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {backTo}
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-fg/55">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label: statLabel, value, hint, tone = 'ink', icon }) {
  const tones = { ink: 'text-fg', copper: 'text-copper', sage: 'text-sage', red: 'text-red-700' }
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/45">{statLabel}</p>
        {icon && <Icon name={icon} size={16} className="text-fg/30" />}
      </div>
      <p className={cls('mt-1.5 font-display text-2xl font-semibold', tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-fg/45">{hint}</p>}
    </div>
  )
}

const BADGE_TONES = {
  copper: 'bg-copper/10 text-copper-dark border-copper/25',
  sage: 'bg-sage/10 text-sage border-sage/25',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  ink: 'bg-fg/5 text-fg/70 border-fg/15',
  gray: 'bg-fg/[0.03] text-fg/50 border-line',
}

export function Badge({ tone = 'gray', children, className = '' }) {
  return (
    <span className={cls('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', BADGE_TONES[tone], className)}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, max = 100, className = '' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cls('h-1.5 w-full overflow-hidden rounded-full bg-fg/10', className)}>
      <div className="h-full rounded-full bg-copper transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ---------------------------------- forms ---------------------------------- */
export function Field({ label: fieldLabel, children, hint, className = '' }) {
  return (
    <label className={cls('block', className)}>
      {fieldLabel && <span className="label">{fieldLabel}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-fg/40">{hint}</span>}
    </label>
  )
}

export const Input = (props) => <input {...props} className={cls('input', props.className)} />
// Password field with a show/hide eye toggle. Drop-in replacement for <Input type="password" />.
export function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={cls('input pr-10', className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-fg/40 transition-colors hover:text-fg/70"
      >
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  )
}
export const Textarea = (props) => <textarea rows={3} {...props} className={cls('input', props.className)} />
export const Select = ({ children, ...props }) => (
  <select {...props} className={cls('input appearance-none', props.className)}>{children}</select>
)

export function Toggle({ checked, onChange, label: toggleLabel }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm">
      <span className={cls('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-copper' : 'bg-fg/20')}>
        <span className={cls('absolute top-0.5 h-4 w-4 rounded-full bg-cream shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {toggleLabel && <span className="text-fg/70">{toggleLabel}</span>}
    </button>
  )
}

/* ---------------------------------- modal ---------------------------------- */
export function Modal({ open, onClose, title, children, wide = false, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  // Deliberately NOT closing on backdrop click: an accidental click-off used to
  // discard whatever was being typed in a form. Close only via the X or Escape.
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      {/* Bottom sheet on mobile: 92vh leaves the top clear of the Dynamic Island, and the body
          + footer are padded for the home indicator (safe-area insets) so nothing — dropdowns
          included — sits off-screen on notched iPhones. */}
      <div className={cls('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-base shadow-pop sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-base/95 px-5 py-3.5 backdrop-blur">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
        {footer && <footer className="sticky bottom-0 border-t border-line bg-base/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">{footer}</footer>}
      </div>
    </div>
  )
}

/* ---------------------------------- misc ----------------------------------- */
export function EmptyState({ icon = 'box', title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-card/50 px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-parchment p-3 text-copper"><Icon name={icon} size={22} /></div>
      <p className="font-display font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-fg/50">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return (
    <div className={cls('flex items-center justify-center py-16', className)}>
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-copper" />
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="scrollbar-thin -mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cls('whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors',
            value === t.id ? 'border-b-2 border-copper text-copper' : 'text-fg/50 hover:text-fg')}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-fg/8 px-1.5 text-[11px]">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={cls('relative', className)}>
      <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg/35" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

/* ---------------------------------- toasts --------------------------------- */
let pushToast = () => {}
export function toast(message, tone = 'ink') { pushToast({ message, tone, id: Date.now() + Math.random() }) }
export const toastErr = (e) => toast(e?.message || 'Something went wrong', 'red')

export function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    pushToast = (t) => {
      setItems((prev) => [...prev, t])
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3800)
    }
    return () => { pushToast = () => {} }
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-6">
      {items.map((t) => (
        <div key={t.id} className={cls('pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-pop',
          t.tone === 'red' ? 'bg-red-700 text-white' : t.tone === 'sage' ? 'bg-sage text-white' : 'bg-ink text-cream')}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

export function Stars({ value = 0, onChange, size = 16 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)}
          className={n <= value ? 'text-copper' : 'text-fg/20'}>
          <Icon name="star" size={size} className={n <= value ? 'fill-copper' : ''} />
        </button>
      ))}
    </div>
  )
}


/* ---------------------------------- brand ---------------------------------- */
export function Flame({ size = 22, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" aria-hidden>
      <path d="M11.2 21.6c-3.7-1.2-5.5-4.4-4.4-7.8.7-2.1 2.5-3.5 3.1-5.7.4-1.4.3-2.8-.2-4.3 2.9 1.4 4.6 3.7 4.7 6.3.1 2-1 3.5-1.1 5.2-.1 1.6.7 3 2.2 4.3-1.4.4-2.9.4-4.3 0Z" fill="rgb(var(--c-gold))" />
      <path d="M16.8 20.9c2-1 3-3 2.3-5-.4-1.3-1.4-2.2-1.7-3.7-1.3 1.1-1.9 2.4-1.7 3.8.2 1 .9 1.8.8 2.8-.1.8-.7 1.5-1.6 2 .7.2 1.3.2 1.9.1Z" fill="#FFFBF5" />
    </svg>
  )
}

export function Brand({ on = 'auto', small = false, className = '' }) {
  const second = on === 'dark' ? 'text-cream' : 'text-fg'
  return (
    <span className={cls('inline-flex items-center gap-2.5', className)}>
      <Flame size={small ? 22 : 26} />
      <span className="font-display leading-none">
        <span className={cls('block font-semibold uppercase text-copper', small ? 'text-[12px] tracking-[0.18em]' : 'text-[14px] tracking-[0.2em]')}>The Creatiste</span>
        <span className={cls('mt-0.5 flex justify-between lowercase italic font-medium', small ? 'text-[15px]' : 'text-[17px]', second)}>
          {'command'.split('').map((ch, i) => <span key={i}>{ch}</span>)}
        </span>
      </span>
    </span>
  )
}
