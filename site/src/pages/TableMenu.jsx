import { TABLE_MENU } from '../content/site.js'
import { asset } from '../ui.jsx'

/* The Creatiste Table set menu as a document: shown in the site and printed to the PDF in /docs.
   Deliberately plain styling, black card with gold rules, matching the printed version. */
export function TableMenuCard({ className = '' }) {
  const M = TABLE_MENU
  return (
    <article className={`mx-auto w-full max-w-[560px] border border-gold/40 bg-ink px-8 py-12 text-ivory sm:px-12 sm:py-16 ${className}`}>
      <div className="border border-gold/30 px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-center font-display text-[30px] tracking-[0.42em] text-ivory">MENU</p>
        <p className="mt-2 text-center font-body text-[10px] uppercase tracking-eyebrow text-gold">{M.title} · {M.season}</p>
        <div className="mx-auto mt-6 flex items-center justify-center gap-3"><span className="h-px w-16 bg-gold/60" /><span className="h-1.5 w-1.5 rotate-45 bg-gold" /><span className="h-px w-16 bg-gold/60" /></div>
        {M.courses.map((c) => (
          <section key={c.name} className="mt-10 text-center">
            <p className="font-body text-[10px] uppercase tracking-eyebrow text-gold">{c.name}</p>
            {c.note ? <p className="mt-2 font-display text-[14px] italic text-ivory/70">{c.note}</p> : null}
            <ul className="mt-4 space-y-4">
              {c.dishes.map((d) => (
                <li key={d.d} className="font-display text-[17px] leading-snug text-ivory/95">{d.d}{d.tag ? <span className="ml-2 font-body text-[10px] uppercase tracking-wide text-gold">{d.tag}</span> : null}</li>
              ))}
            </ul>
          </section>
        ))}
        {M.perHead ? <p className="mt-10 text-center font-body text-[12px] uppercase tracking-wide text-gold">{M.perHead} per head</p> : null}
        {M.perHeadNote ? <p className="mt-2 text-center font-body text-[11px] text-ivory/60">{M.perHeadNote}</p> : null}
        <div className="mx-auto mt-10 flex items-center justify-center gap-3"><span className="h-px w-16 bg-gold/60" /><span className="h-1.5 w-1.5 rotate-45 bg-gold" /><span className="h-px w-16 bg-gold/60" /></div>
        <p className="mt-8 text-center font-body text-[10px] uppercase tracking-eyebrow text-ivory/80">{M.footer}</p>
        <img src={asset('/brand/lockup-dark.png')} alt="The Creatiste Catering" className="mx-auto mt-10 h-10 w-auto" />
      </div>
    </article>
  )
}

/* Print route: /the-creatiste-table-menu renders only the card on black for PDF export. */
export default function TableMenuPrint() {
  return (
    <div className="min-h-screen bg-ink p-6">
      <style>{'@page{size:A4 portrait;margin:0} header,footer{display:none!important} main{padding:0!important}'}</style>
      <TableMenuCard />
    </div>
  )
}
