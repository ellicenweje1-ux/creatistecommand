import { useState } from 'react'
import { LOADED_BAR } from './content/site.js'
import { Reveal } from './ui.jsx'

/* The Loaded Bar bowl menus (corporate / private), as laid out in the brochure.
   `ids` limits which menus show; with more than one, a toggle switches between them. */
export default function BowlMenu({ ids, ground = 'ink', className = '' }) {
  const menus = LOADED_BAR.menu.menus.filter((m) => !ids || ids.includes(m.id))
  const [active, setActive] = useState(menus[0]?.id)
  const dark = ground === 'ink'
  const m = menus.find((x) => x.id === active) || menus[0]
  if (!m) return null
  return (
    <div className={className} data-bowl-menu={m.id}>
      {menus.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose a menu">
          {menus.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === m.id} onClick={() => setActive(x.id)}
              className={`border px-5 py-2.5 font-body text-[11px] uppercase tracking-eyebrow transition-colors ${x.id === m.id ? (dark ? 'border-gold bg-gold text-ink' : 'border-ink bg-ink text-ivory') : (dark ? 'border-ink-3 text-ivory/75 hover:border-gold/60' : 'border-ink/30 text-ink/70 hover:border-gold-deep')}`}>
              {x.name} menu
            </button>
          ))}
        </div>
      ) : (
        <p className={`font-body text-[11px] uppercase tracking-eyebrow ${dark ? 'text-gold' : 'text-gold-deep'}`}>{m.name} menu</p>
      )}
      <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {m.groups.map((g, i) => (
          <Reveal key={`${m.id}-${g.name}`} delay={i % 3} className={`border-t pt-5 ${dark ? 'border-ink-3' : 'border-sand'}`}>
            <p className="font-display text-[22px]">{g.name} <span className={`font-body text-[11px] uppercase tracking-wide ${dark ? 'text-gold' : 'text-gold-deep'}`}>{g.pick}</span></p>
            <ul className="mt-4 space-y-1.5">{g.items.map((it) => <li key={it} className={`font-body text-[14px] font-light ${dark ? 'text-ivory/80' : 'text-ink/80'}`}>{it}</li>)}</ul>
            {g.extra ? <p className={`mt-3 font-body text-[12px] italic ${dark ? 'text-smoke' : 'text-stone'}`}>{g.extra}</p> : null}
          </Reveal>
        ))}
      </div>
    </div>
  )
}
