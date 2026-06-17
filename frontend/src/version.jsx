import { Link } from 'react-router-dom'
import { cls } from './format'
import { Icon } from './ui'

/* ───────────────────────── The Creatiste Command — versions ─────────────────────────
   Each release pushed live is identified by a version number + a biblical reference
   (e.g. V1. Matthew 25:23) and carries a short list of "what's new" bullets, shown to
   chefs in Settings → Version (iOS-style release notes). The reference is the version's
   name; the meaning behind the scripture is Ellice's own and is deliberately NOT
   explained to users anywhere in the UI. The `text` field below is her private record
   of the verse — it is not rendered.

   Versions run in order from V1. To ship a NEW release: append the next entry with the
   next number, a fresh biblical reference, and its update bullets. The app always shows
   the most recent entry as the live version, so this single list drives the platform. */
export const VERSIONS = [
  {
    n: 1,
    ref: 'Matthew 25:23',
    // Private record of the reference — not shown to users.
    text: 'Well done, good and faithful servant! You have been faithful with a few things; I will put you in charge of many things. Come and share your master’s happiness!',
    updates: [
      'First release of The Creatiste Command — your whole back-of-house in one place.',
      'Bookings with an enquiry pipeline, tastings, recipes & set menus, inventory, shopping and packing lists, tasks and a prep-day route planner.',
      'Clients, quotes & invoices, monthly finances, allergen matrix, design studio, supplier price book and My Brain idea capture.',
      'Install it as an app and keep working offline, subscribe to your diary in any calendar, and export your data to CSV anytime.',
    ],
  },
]

// The live version is always the most recent entry in the list above.
export const CURRENT = VERSIONS[VERSIONS.length - 1]
export const versionLabel = (v = CURRENT) => `v${v.n}`
// The full version reference shown to users, as a lowercase dotted/technical
// string, e.g. "v1.matthew.25:23".
export const versionRef = (v = CURRENT) => `${versionLabel(v)}.${v.ref.toLowerCase().replace(/\s+/g, '.')}`

/* The version stamp shown at the base of the platform and on the public pages:
   a circled "v" mark + the version reference (lowercase, italic). Inside the app it
   links to the Settings → Version release notes; on public pages it's a plain marker. */
export function VersionStamp({ to, className = '' }) {
  const v = CURRENT
  const title = versionRef(v)
  const body = (
    <>
      <Icon name="circleV" size={13} className="shrink-0 text-copper" />
      <span className="italic tracking-wide">{versionRef(v)}</span>
    </>
  )
  const base = 'inline-flex items-center gap-1.5 text-xs text-fg/40'
  return to ? (
    <Link to={to} title={title} className={cls(base, 'transition-colors hover:text-copper', className)}>{body}</Link>
  ) : (
    <span title={title} className={cls(base, className)}>{body}</span>
  )
}

/* One release's "what's new" block — used on the Settings → Version page. */
export function VersionNotes({ version = CURRENT, className = '' }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Icon name="circleV" size={15} className="shrink-0 text-copper" />
        <span className="font-display text-sm font-semibold italic">{versionRef(version)}</span>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {version.updates.map((u, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-fg/70">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-copper/70" />{u}
          </li>
        ))}
      </ul>
    </div>
  )
}
