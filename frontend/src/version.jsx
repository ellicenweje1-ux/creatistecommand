import { Link } from 'react-router-dom'
import { cls } from './format'
import { Icon } from './ui'

/* ───────────────────────── The Creatiste Command — versions ─────────────────────────
   Every release pushed live to chefs is dedicated to Ellice's Lord and Saviour,
   Jesus Christ, and carries a line of scripture — a quiet thread of faith through
   the work. The ✝ on the version stamp (at the foot of every page) is that dedication.

   Versions run in order from v1. To ship a NEW version: append the next entry below
   with the next number and a fresh scripture. The app always shows the most recent
   entry as the live version, so this single list drives the whole platform.            */
export const VERSIONS = [
  {
    n: 1,
    ref: 'Matthew 25:23',
    text: '“Well done, good and faithful servant! You have been faithful with a few things; I will put you in charge of many things. Come and share your master’s happiness!”',
    note: 'The first release — The Creatiste Command goes live: one command centre for the whole back-of-house of a chef’s business.',
  },
]

// The live version is always the most recent entry in the list above.
export const CURRENT = VERSIONS[VERSIONS.length - 1]
export const versionLabel = (v = CURRENT) => `v${v.n}`

// Plain text (no typographic quotes) for the native hover tooltip.
const plain = (t) => t.replace(/[“”]/g, '').trim()

/* The cross-marked version stamp shown at the base of the platform and on the public
   pages. Compact: a ✝, the version, and its scripture reference; the full verse is on
   hover (title) and, inside the app, the stamp links through to Settings → Version. */
export function VersionStamp({ to, className = '' }) {
  const v = CURRENT
  const title = `${v.ref} — ${plain(v.text)}`
  const body = (
    <>
      <Icon name="cross" size={12} className="shrink-0 text-copper" />
      <span className="font-semibold tracking-wide">{versionLabel(v)}</span>
      <span aria-hidden className="opacity-40">·</span>
      <span className="italic">{v.ref}</span>
    </>
  )
  const base = 'inline-flex items-center gap-1.5 text-xs text-fg/40'
  return to ? (
    <Link to={to} title={title} className={cls(base, 'transition-colors hover:text-copper', className)}>{body}</Link>
  ) : (
    <span title={title} className={cls(base, className)}>{body}</span>
  )
}

/* The verse on its own, framed — used on the Settings → Version page. */
export function VersionScripture({ version = CURRENT, className = '' }) {
  return (
    <figure className={cls('rounded-xl border border-copper/25 bg-copper/[0.06] p-4', className)}>
      <figcaption className="flex items-center gap-2 text-copper">
        <Icon name="cross" size={15} />
        <span className="font-display text-sm font-semibold">{version.ref}</span>
      </figcaption>
      <blockquote className="mt-2 font-display text-[15px] italic leading-relaxed text-fg/80">{version.text}</blockquote>
    </figure>
  )
}
