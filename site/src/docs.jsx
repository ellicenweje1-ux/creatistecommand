import { BATCHFULLY_LIST, HOME_EDIT_PACKAGES, TABLE_MENU } from './content/site.js'
import { asset } from './ui.jsx'

/* The printed documents: one black card, gold rules, a small lockup at the foot. Each fits one A4 page.
   Shown in the site and printed to the PDFs in /docs via the print routes below. */
const money = (n) => (typeof n === 'number' ? (Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`) : n)

export function Rule() {
  return <div className="mx-auto flex items-center justify-center gap-3"><span className="h-px w-14 bg-gold/60" /><span className="h-1.5 w-1.5 rotate-45 bg-gold" /><span className="h-px w-14 bg-gold/60" /></div>
}

export function DocFrame({ heading, eyebrow, intro, children, footer, className = '', wide = false }) {
  return (
    <article className={`mx-auto w-full ${wide ? 'max-w-[720px]' : 'max-w-[560px]'} border border-gold/40 bg-ink px-3 py-6 text-ivory sm:px-10 sm:py-8 ${className}`} data-doc>
      <div className={`border border-gold/30 px-3 sm:px-8 ${wide ? 'py-5 sm:py-6' : 'py-7 sm:py-10'}`}>
        <p className={`whitespace-nowrap text-center font-display text-ivory ${heading.length > 10 ? 'text-[15px] tracking-[0.16em] min-[420px]:text-[18px] min-[420px]:tracking-[0.2em] sm:text-[26px] sm:tracking-[0.28em]' : 'text-[24px] tracking-[0.3em] sm:text-[28px] sm:tracking-[0.4em]'}`}>{heading}</p>
        <p className="mt-2 text-center font-body text-[10px] uppercase tracking-eyebrow text-gold">{eyebrow}</p>
        {intro ? <p className="mx-auto mt-4 text-center font-body text-[11px] font-light leading-relaxed text-ivory/70 sm:whitespace-nowrap">{intro}</p> : null}
        <div className="mt-5"><Rule /></div>
        {children}
        <div className="mt-8"><Rule /></div>
        {footer ? <p className="mt-5 text-center font-body text-[10px] uppercase tracking-eyebrow text-ivory/80">{footer}</p> : null}
        <img src={asset('/brand/lockup-dark.png')} alt="The Creatiste Catering" className="mx-auto mt-6 h-7 w-auto" />
      </div>
    </article>
  )
}

/* Component headers bold, every item in the same body face, prices in two columns. */
export function BatchfullyCard({ className = '' }) {
  const L = BATCHFULLY_LIST
  return (
    <DocFrame heading={L.title.toUpperCase()} eyebrow={L.sub} intro={L.intro} footer={L.footer} className={className} wide>
      <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {L.sections.map((sec) => (
          <section key={sec.name} className="break-inside-avoid" data-doc-section>
            <div className="flex items-baseline justify-between gap-3 border-b border-gold/50 pb-1">
              <h3 className="whitespace-nowrap font-body text-[11.5px] font-bold uppercase tracking-[0.16em] text-gold">{sec.name}</h3>
              {sec.single
                ? (sec.note ? <p className="shrink-0 whitespace-nowrap font-body text-[10px] uppercase tracking-wide text-ivory/70">{sec.note}</p> : null)
                : <p className="flex w-[96px] shrink-0 justify-between font-body text-[10px] uppercase tracking-wide text-ivory/60"><span className="w-11 text-right">{L.columns[0]}</span><span className="w-11 text-right">{L.columns[1]}</span></p>}
            </div>
            <ul className="mt-1.5 space-y-1">
              {sec.items.map(([name, a, b]) => (
                <li key={name} className="flex items-baseline justify-between gap-2 font-body text-[12.5px] text-ivory/95">
                  <span className="min-w-0 flex-1 leading-snug">{name}</span>
                  {sec.single
                    ? <span className="w-[96px] shrink-0 text-right tabular-nums text-ivory/90">{money(a)}</span>
                    : <span className="flex w-[96px] shrink-0 justify-between tabular-nums text-ivory/90"><span className="w-11 text-right">{money(a)}</span><span className="w-11 text-right">{money(b)}</span></span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DocFrame>
  )
}

/* The Home Edit: the four packages, how the week runs, good to know. */
export function HomeEditCard({ className = '' }) {
  const H = HOME_EDIT_PACKAGES
  return (
    <DocFrame heading="THE HOME EDIT" eyebrow="In-home personal chef · Packages" intro="Four ways to have your week cooked for you, each priced per week. Everything in between is shaped at consultation." footer="Every package includes menu design, shopping, cooking on site, storage and clean down." className={className} wide>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {H.items.map((pk) => (
          <section key={pk.name} className="border border-gold/30 p-3" data-doc-package>
            <p className="font-body text-[10px] uppercase tracking-eyebrow text-gold">{pk.n}</p>
            <p className="mt-1 font-display text-[20px] leading-tight">{pk.name}</p>
            <p className="mt-1 font-body text-[12px] text-ivory/70">{pk.cover}</p>
            <p className="mt-2 font-body text-[15px] font-semibold text-ivory">{money(pk.weekly)} <span className="font-normal text-ivory/60">per week</span></p>
            <p className="mt-1 font-body text-[11px] text-ivory/60">{pk.hours}</p>
            <p className="mt-1.5 font-body text-[11px] font-light leading-snug text-ivory/80">{pk.body}</p>
          </section>
        ))}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <section>
          <h3 className="border-b border-gold/50 pb-1.5 font-body text-[12px] font-bold uppercase tracking-[0.18em] text-gold">How the week looks</h3>
          <ol className="mt-2 space-y-1">{H.week.map(([t, d], i) => <li key={t} className="font-body text-[11px] leading-snug text-ivory/90"><span className="text-gold">{String(i + 1).padStart(2, '0')}</span> <span className="font-semibold">{t}.</span> <span className="font-light text-ivory/75">{d}</span></li>)}</ol>
        </section>
        <section>
          <h3 className="border-b border-gold/50 pb-1.5 font-body text-[12px] font-bold uppercase tracking-[0.18em] text-gold">Good to know</h3>
          <ul className="mt-2 space-y-1">{H.goodToKnow.map((g) => <li key={g} className="font-body text-[11px] font-light leading-snug text-ivory/80">{g}</li>)}</ul>
        </section>
      </div>
    </DocFrame>
  )
}

/* The Creatiste Table set menu, fitted to one page. */
export function TableMenuCard({ className = '' }) {
  const M = TABLE_MENU
  return (
    <DocFrame heading={M.title.toUpperCase()} eyebrow={`Seasonal menu · ${M.season}`} footer={M.footer} className={className}>
      {M.courses.map((c) => (
        <section key={c.name} className="mt-6 text-center">
          <p className="font-body text-[10px] uppercase tracking-eyebrow text-gold">{c.name}</p>
          {c.note ? <p className="mt-1.5 font-display text-[13px] italic text-ivory/70">{c.note}</p> : null}
          <ul className="mt-2.5 space-y-2.5">
            {c.dishes.map((d) => (
              <li key={d.d} className="font-display text-[13px] leading-snug text-ivory/95 sm:text-[14px]" data-doc-dish>{d.d}{d.tag ? <span className="ml-2 font-body text-[10px] uppercase tracking-wide text-gold">{d.tag}</span> : null}</li>
            ))}
          </ul>
        </section>
      ))}
      {M.perHead ? <p className="mt-6 text-center font-body text-[12px] uppercase tracking-wide text-gold">{M.perHead} per head</p> : null}
      {M.perHeadNote ? <p className="mt-1.5 text-center font-body text-[11px] text-ivory/60">{M.perHeadNote}</p> : null}
    </DocFrame>
  )
}

const PRINT_CSS = '@page{size:A4 portrait;margin:0} header,footer,[data-live-chat]{display:none!important} main{padding:0!important} html,body{background:#0B0A08}'
function PrintPage({ children }) {
  return <div className="min-h-screen bg-ink p-3"><style>{PRINT_CSS}</style>{children}</div>
}
export function TableMenuPrint() { return <PrintPage><TableMenuCard /></PrintPage> }
export function BatchfullyPrint() { return <PrintPage><BatchfullyCard /></PrintPage> }
export function HomeEditPrint() { return <PrintPage><HomeEditCard /></PrintPage> }
