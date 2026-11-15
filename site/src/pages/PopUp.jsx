import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CLEAN_DREAM, CONTACT, SETTINGS } from '../content/site.js'
import { asset } from '../ui.jsx'
import { getCustomer, prefill } from '../account.js'

/* A pop-up's own pre-order page (thecreatistecatering.com/soulfood): the menu, a box builder, a basket and checkout,
   styled like the pop-up's printed menu. The Creatiste Command holds the menu and prices, takes the payment (card via
   Stripe, or bank transfer until card is switched on) and records every order; `cfg.menu` is only a mirror so the page
   still works if Command can't be reached. */

const API = SETTINGS.apiBase && SETTINGS.enquiryToken ? `${SETTINGS.apiBase}/api/public/preorder` : ''
const MAROON = '#5A1D20'
const CREAM = '#F8ECD7'
const INK = '#18100A'
const AMBER = '#FFA900'
const money = (n) => { const v = Math.round(Number(n || 0) * 100) / 100; return `£${v % 1 ? v.toFixed(2) : v}` }
const count = (list, name) => (list || []).filter((x) => x === name).length

/* "YYYY-MM-DDTHH:MM" in London time, to apply the same closing rule as the server. */
function londonNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
function localState(menu) {
  if (menu.paused) return 'paused'
  const now = londonNow()
  if (menu.date && menu.date < now.slice(0, 10)) return 'finished'
  if (menu.closes && now >= menu.closes) return 'closed'
  return 'open'
}
function closesText(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}:00`)
  const h = d.getHours() % 12 || 12
  return `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${h}${d.getMinutes() ? `:${String(d.getMinutes()).padStart(2, '0')}` : ''}${d.getHours() >= 12 ? 'pm' : 'am'}`
}
const prettyDay = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '')

/* Pricing, mirrored from the server so the running total is honest (the server is still the authority). */
function pickedFor(g, choices) {
  return g.fixed ? (g.options || []).map((o) => o.name) : (choices[g.id] || [])
}
function priceBox(item, choices) {
  let price = Number(item.price || 0)
  for (const g of item.groups || []) {
    const opts = Object.fromEntries((g.options || []).map((o) => [o.name, o]))
    pickedFor(g, choices).forEach((name, n) => {
      const o = opts[name] || {}
      price += Number(o.surcharge || 0)
      if (g.max && n >= g.max) price += Number(o.extra_price ?? (o.premium ? g.extra_premium_price : g.extra_price)) || 0
    })
  }
  return Math.round(price * 100) / 100
}
function summarise(item, choices) {
  return (item.groups || []).map((g) => {
    const picked = pickedFor(g, choices)
    if (!picked.length) return ''
    const named = [...new Set(picked)].map((n) => { const k = count(picked, n); return k > 1 ? `${k}× ${n}` : n })
    return `${g.label}: ${named.join(', ')}`
  }).filter(Boolean).join('; ')
}

function Stepper({ value, onDown, onUp, canUp, label }) {
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
      <button type="button" onClick={onDown} disabled={!value} aria-label={`One less ${label}`} className="flex h-9 w-9 items-center justify-center rounded-full border text-[18px] leading-none disabled:opacity-25" style={{ borderColor: MAROON, color: MAROON }}>−</button>
      <span className="w-7 text-center font-oswald text-[18px] tabular-nums" data-qty>{value}</span>
      <button type="button" onClick={onUp} disabled={!canUp} aria-label={`One more ${label}`} className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] leading-none disabled:opacity-25" style={{ background: MAROON, color: CREAM }}>+</button>
    </div>
  )
}

/* One choice group: steppers when the same thing can be picked more than once, otherwise tap to choose. */
function GroupPicker({ g, choices, setChoices }) {
  const picked = choices[g.id] || []
  const full = g.max && picked.length >= g.max
  const set = (next) => setChoices((c) => ({ ...c, [g.id]: next }))
  const up = (name) => { if (!full) set([...picked, name]) }
  const down = (name) => { const i = picked.lastIndexOf(name); if (i >= 0) set(picked.filter((_, j) => j !== i)) }
  const tap = (name) => {
    if (picked.includes(name)) return set(picked.filter((x) => x !== name))
    if (g.max === 1) return set([name])
    if (!full) set([...picked, name])
  }
  return (
    <fieldset data-group={g.id}>
      <legend className="flex w-full flex-wrap items-baseline justify-between gap-2">
        <span className="font-anton text-[26px] uppercase leading-none sm:text-[30px]" style={{ color: INK }}>{g.label}</span>
        <span className="font-oswald text-[14px] uppercase tracking-wide" style={{ color: MAROON }} data-picked-count>
          {g.min && g.min === g.max ? `${picked.length} of ${g.max} chosen` : picked.length ? `${picked.length} added` : g.pick}
        </span>
      </legend>
      {g.desc ? <p className="mt-1 font-body text-[13px] text-black/60">{g.desc}</p> : null}
      {g.min && g.min === g.max ? <p className="mt-1 font-body text-[13px] text-black/60">{g.pick[0].toUpperCase() + g.pick.slice(1)}. The same one twice is fine.</p> : null}
      {g.repeat ? (
        <ul className="mt-4 divide-y" style={{ borderColor: 'rgba(90,29,32,.15)' }}>
          {(g.options || []).map((o) => (
            <li key={o.name} className="flex items-center justify-between gap-4 py-3" data-option={o.name}>
              <div className="min-w-0">
                <p className="font-body text-[15px] font-medium" style={{ color: INK }}>{o.name}{o.surcharge ? <span className="ml-2 font-oswald text-[13px]" style={{ color: MAROON }}>+{money(o.surcharge)}</span> : null}</p>
                {o.desc ? <p className="mt-0.5 font-body text-[12.5px] leading-snug text-black/55">{o.desc}</p> : null}
              </div>
              <Stepper value={count(picked, o.name)} onDown={() => down(o.name)} onUp={() => up(o.name)} canUp={!full} label={o.name} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {(g.options || []).map((o) => {
            const on = picked.includes(o.name)
            return <button key={o.name} type="button" onClick={() => tap(o.name)} aria-pressed={on} data-option={o.name}
              className="border px-4 py-2.5 font-body text-[14px] transition-colors" style={on ? { background: MAROON, color: CREAM, borderColor: MAROON } : { borderColor: 'rgba(24,16,10,.25)', color: INK }}>{o.name}</button>
          })}
        </div>
      )}
    </fieldset>
  )
}

function Builder({ menu, onAdd, boxCount }) {
  const [item, setItem] = useState(null)
  const [i, setI] = useState(0)
  const [choices, setChoices] = useState({})
  const [forWho, setForWho] = useState('')
  const [note, setNote] = useState('')
  const [added, setAdded] = useState('')
  const top = useRef(null)
  const groups = item ? (item.groups || []).filter((g) => !g.fixed) : []
  const required = groups.filter((g) => (g.min || 0) > 0)
  const optional = groups.filter((g) => !(g.min || 0))
  const fixed = item ? (item.groups || []).filter((g) => g.fixed) : []
  const steps = [{ kind: 'item', label: 'Your box' }, ...required.map((g) => ({ kind: 'group', g, label: g.label })),
    ...(optional.length ? [{ kind: 'extras', label: 'Extras' }] : []), { kind: 'name', label: 'Name it' }]
  const step = steps[Math.min(i, steps.length - 1)]
  const price = item ? priceBox(item, choices) : 0
  const go = (n) => { setI(n); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const choose = (it) => { setItem(it); setChoices({}); setAdded(''); go(1) }
  const groupDone = (g) => (choices[g.id] || []).length >= (g.min || 0)
  const canNext = step.kind === 'group' ? groupDone(step.g) : step.kind === 'name' ? !!forWho.trim() : true
  const add = () => {
    if (!item || !forWho.trim()) return
    const picks = Object.fromEntries(groups.filter((g) => (choices[g.id] || []).length).map((g) => [g.id, choices[g.id]]))
    onAdd({ item_id: item.id, item: item.name, for: forWho.trim(), choices: picks, note: note.trim(), price, summary: summarise(item, choices) })
    setAdded(`${forWho.trim()}’s ${item.name}`)
    setItem(null); setChoices({}); setForWho(''); setNote(''); setI(0)
  }
  return (
    <div ref={top} className="scroll-mt-28 border bg-[#FFF8EC] p-5 sm:p-8" style={{ borderColor: 'rgba(90,29,32,.25)' }} data-builder>
      <ol className="flex flex-wrap gap-x-4 gap-y-2" data-steps>
        {steps.map((s, n) => (
          <li key={s.label}>
            <button type="button" onClick={() => n < i && go(n)} className="flex items-center gap-2 font-oswald text-[13px] uppercase tracking-wide" style={{ color: n === i ? MAROON : n < i ? INK : 'rgba(24,16,10,.4)' }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border text-[12px]" style={n === i ? { background: MAROON, color: CREAM, borderColor: MAROON } : { borderColor: 'rgba(24,16,10,.3)' }}>{n < i ? '✓' : n + 1}</span>{s.label}
            </button>
          </li>
        ))}
      </ol>

      {added && step.kind === 'item' ? (
        <p className="mt-6 border-l-4 py-1 pl-3 font-body text-[14px]" style={{ borderColor: AMBER, color: INK }} data-added>
          Added {added} to your basket. Build another box, or <a href="#basket" className="underline">go to your basket</a>.
        </p>
      ) : null}

      <div className="mt-7 min-h-[220px]">
        {step.kind === 'item' ? (
          <div>
            <p className="font-anton text-[30px] uppercase leading-none" style={{ color: INK }}>Choose your box</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {menu.items.map((it) => (
                <button key={it.id} type="button" onClick={() => choose(it)} data-item={it.id}
                  className="group flex items-center justify-between gap-4 p-4 text-left transition-transform hover:-translate-y-0.5" style={{ background: MAROON, color: CREAM }}>
                  <span className="min-w-0">
                    <span className="block font-anton text-[30px] lowercase leading-none">{it.name}</span>
                    <span className="mt-1 block font-oswald text-[14px] lowercase opacity-90">{it.desc}</span>
                  </span>
                  <span className="font-anton text-[34px] leading-none">{money(it.price)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : step.kind === 'group' ? (
          <GroupPicker g={step.g} choices={choices} setChoices={setChoices} />
        ) : step.kind === 'extras' ? (
          <div className="space-y-8">
            <p className="font-body text-[14px] text-black/60">All optional. Skip straight on if you’re happy.</p>
            {optional.map((g) => <GroupPicker key={g.id} g={g} choices={choices} setChoices={setChoices} />)}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="border-b pb-4 font-body text-[14px] leading-relaxed text-black/70 sm:col-span-2" style={{ borderColor: 'rgba(90,29,32,.15)' }} data-box-summary>
              <span className="font-medium" style={{ color: INK }}>{item.name}.</span> {summarise(item, choices)}
            </div>
            <div>
              <label htmlFor="box-for" className="font-oswald text-[13px] uppercase tracking-wide" style={{ color: MAROON }}>Who is this box for? *</label>
              <input id="box-for" className="field-ivory mt-1" placeholder={boxCount ? `Box ${boxCount + 1}` : 'e.g. Priya'} value={forWho} onChange={(e) => setForWho(e.target.value)} />
              <p className="mt-2 font-body text-[12px] text-black/50">So every box is labelled with the right name.</p>
            </div>
            <div>
              <label htmlFor="box-note" className="font-oswald text-[13px] uppercase tracking-wide" style={{ color: MAROON }}>Notes for the kitchen</label>
              <input id="box-note" className="field-ivory mt-1" placeholder="Sauce on the side…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        )}
        {item && step.kind !== 'item' && fixed.length ? (
          <p className="mt-5 font-body text-[13px] text-black/60">Included in {item.name}: {fixed.map((g) => `${g.pick} ${g.label.toLowerCase()}`).join(' and ')}.</p>
        ) : null}
      </div>

      {item ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-5" style={{ borderColor: 'rgba(90,29,32,.15)' }}>
          <p className="font-anton text-[30px] leading-none" style={{ color: INK }} data-box-price>{money(price)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(i - 1)} className="border px-5 py-3 font-oswald text-[14px] uppercase tracking-wide" style={{ borderColor: 'rgba(24,16,10,.3)', color: INK }}>Back</button>
            {step.kind === 'name'
              ? <button type="button" onClick={add} disabled={!canNext} className="px-6 py-3 font-oswald text-[14px] uppercase tracking-wide disabled:opacity-40" style={{ background: MAROON, color: CREAM }} data-add-to-basket>Add to basket</button>
              : <button type="button" onClick={() => go(i + 1)} disabled={!canNext} className="px-6 py-3 font-oswald text-[14px] uppercase tracking-wide disabled:opacity-40" style={{ background: MAROON, color: CREAM }} data-next>{step.kind === 'extras' && !optional.some((g) => (choices[g.id] || []).length) ? 'Skip' : 'Next'}</button>}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* Lines of big type that each fill the width, the way the menu slides are set, then shrink together if they would
   run taller than the space they have. Re-fitted when the card resizes and once the font has loaded. */
function FitLines({ lines }) {
  const box = useRef(null)
  const inner = useRef(null)
  useLayoutEffect(() => {
    const el = box.current
    const wrap = inner.current
    if (!el || !wrap) return undefined
    const fit = () => {
      const spans = [...wrap.querySelectorAll('[data-fit]')]
      const w = el.clientWidth
      if (!w || !spans.length) return
      spans.forEach((sp) => { sp.style.fontSize = '100px'; sp.style.fontSize = `${Math.min(140, (w / Math.max(1, sp.scrollWidth)) * 100 * 0.985)}px` })
      // Room for the last line's descenders (the p in "pot roast", the g in "sponge"), then shrink everything to fit the height.
      const pad = parseFloat(spans[spans.length - 1].style.fontSize) * 0.22
      const used = spans.reduce((h, sp) => h + sp.offsetHeight, 0) + pad
      const k = el.clientHeight && used > el.clientHeight ? (el.clientHeight - 1) / used : 1
      if (k < 1) spans.forEach((sp) => { sp.style.fontSize = `${parseFloat(sp.style.fontSize) * k}px` })
      wrap.style.paddingBottom = `${pad * k}px`
    }
    fit()
    if (document.fonts?.ready) document.fonts.ready.then(fit)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [lines])
  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
      <div ref={inner}>{lines.map((l, n) => <span key={n} data-fit className="block w-max whitespace-nowrap font-anton lowercase leading-[0.9]">{l}</span>)}</div>
    </div>
  )
}

/* A dish card in the style of the menu slides. The last card (the dessert) runs the full width as a banner. */
function DishTile({ d, tag, wide = false }) {
  return (
    <div className={`relative flex flex-col overflow-hidden p-4 sm:p-5 ${wide ? 'col-span-2 h-[230px] sm:col-span-3 sm:h-[250px]' : 'aspect-[4/5]'}`}
      style={{ background: d.bg, color: d.fg, outline: '1px solid rgba(248,236,215,.14)', outlineOffset: '-1px' }} data-dish>
      <p className="font-oswald text-[11px] lowercase opacity-90">{tag}</p>
      <div className={`mt-2 flex min-h-0 flex-1 flex-col ${wide ? 'sm:max-w-[62%]' : ''}`}><FitLines lines={d.lines} /></div>
      <p className={`mt-2 font-body text-[11px] leading-snug opacity-80 sm:text-[11.5px] ${wide ? 'sm:absolute sm:bottom-5 sm:right-5 sm:mt-0 sm:max-w-[30%]' : ''}`}>{d.desc}</p>
    </div>
  )
}

export default function PopUp({ cfg }) {
  const [params] = useSearchParams()
  const [menu, setMenu] = useState(cfg.menu)
  const [info, setInfo] = useState({ payments: 'off', state: localState(cfg.menu), closes_text: closesText(cfg.menu.closes), boxes_left: null, live: false })
  const [boxes, setBoxes] = useState([])
  const [stage, setStage] = useState('build')
  const [f, setF] = useState({ name: '', email: '', phone: '', allergies: '', note: '', company: '' })
  const [state, setState] = useState({ status: 'idle', error: '' })
  const [showBank, setShowBank] = useState(false)
  const [copied, setCopied] = useState(false)
  const checkoutRef = useRef(null)
  const preview = params.get('preview') === '1'
  const bank = CLEAN_DREAM.bank
  const setK = (k, v) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => { prefill(setF) }, [])
  useEffect(() => {
    document.title = `Pre-order · ${cfg.name} · The Creatiste Catering`
    if (!API) return
    fetch(`${API}/${SETTINGS.enquiryToken}?offer=${encodeURIComponent(cfg.slug)}`).then((r) => (r.ok ? r.json() : Promise.reject(r))).then((d) => {
      if (d.offer?.items?.length) setMenu(d.offer)
      setInfo({ payments: d.payments, state: d.state, closes_text: d.closes_text || closesText(d.offer?.closes), boxes_left: d.boxes_left ?? null, live: true })
    }).catch(() => {})
  }, [cfg.slug, cfg.name])

  const total = useMemo(() => boxes.reduce((s, b) => s + b.price, 0), [boxes])
  const slot = (menu.slots || [])[0]
  const open = info.state === 'open'
  const card = API && info.payments === 'stripe'
  const ready = boxes.length && f.name.trim() && f.email.trim() && f.phone.trim()
  const payload = () => ({ ...f, offer: cfg.slug, date: menu.date, fulfilment: 'collection', slot_id: slot?.id || '', boxes: boxes.map((b) => ({ item_id: b.item_id, for: b.for, choices: b.choices, note: b.note })) })
  const toCheckout = () => { setStage('checkout'); setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }
  const bankText = () => `${bank.name}\n${bank.bank}\nAccount number ${bank.account}\nSort code ${bank.sort}\nReference ${f.name || 'your name'}\nAmount ${money(total)}`
  const copyBank = async () => { try { await navigator.clipboard.writeText(bankText()); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }
  const waText = () => [`${cfg.name} pre-order for ${prettyDay(menu.date)}`, `Name: ${f.name} · ${f.phone} · ${f.email}`,
    ...boxes.map((b) => `• ${b.for}: ${b.item} (${b.summary})${b.note ? ` [${b.note}]` : ''} ${money(b.price)}`), `Total ${money(total)}`,
    `Payment: bank transfer${showBank ? ' sent' : ''}, reference ${f.name}`, f.allergies ? `Allergies: ${f.allergies}` : '', f.note ? `Note: ${f.note}` : ''].filter(Boolean).join('\n')

  async function submit(e) {
    e.preventDefault()
    if (!ready || state.status === 'sending') return
    setState({ status: 'sending', error: '' })
    const post = (path, body) => fetch(`${API}/${SETTINGS.enquiryToken}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (preview) {
      if (API) {
        try {
          const r = await post('/preview', payload()); const j = await r.json().catch(() => ({}))
          if (!r.ok) { setState({ status: 'error', error: j.detail || 'Something in the order needs a second look.' }); return }
        } catch {}
      }
      setState({ status: 'placed', error: '', preview: true }); return
    }
    if (card) {
      try {
        const r = await post('', { ...payload(), return_url: window.location.origin })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.detail || 'Something went wrong placing that order.')
        if (j.url) { window.location.href = j.url; return }
        throw new Error('No payment page came back. Please try again.')
      } catch (ex) { setState({ status: 'error', error: ex.message }); return }
    }
    if (API) {
      try {
        const r = await post('/bank', payload()); const j = await r.json().catch(() => ({}))
        if (r.ok) { setState({ status: 'placed', error: '', public_id: j.public_id }); return }
        if (r.status === 422 || r.status === 429) { setState({ status: 'error', error: j.detail || 'Something in the order needs a second look.' }); return }
      } catch {}
    }
    const text = encodeURIComponent(waText())
    const href = CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}?text=${text}` : `mailto:${CONTACT.email}?subject=${encodeURIComponent(`${cfg.name} pre-order`)}&body=${text}`
    setState({ status: 'handoff', error: '', href })
    window.location.href = href
  }

  const closedCopy = cfg.closed[info.state]
  return (
    <div style={{ background: INK }} data-popup={cfg.slug}>
      {/* Hero, in the colours of the printed menu */}
      <section className="relative overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20" style={{ background: MAROON, color: CREAM }}>
        <div className="mx-auto grid w-full max-w-page items-center gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:px-12">
          <div className="lg:col-span-7">
            <p className="font-oswald text-[18px] font-light lowercase sm:text-[22px]">{cfg.tag}</p>
            <h1 className="mt-3 font-anton text-[86px] lowercase leading-[0.86] sm:text-[140px] lg:text-[164px]" style={{ textShadow: '0 6px 18px rgba(0,0,0,.25)' }}>pre-order</h1>
            <p className="mt-4 font-oswald text-[20px] font-light lowercase sm:text-[24px]">{cfg.when} · {cfg.where}</p>
            <p className="mt-6 max-w-xl font-body text-[16px] font-light leading-relaxed opacity-90">{cfg.sub}</p>
            <p className="mt-6 inline-block border px-4 py-2 font-oswald text-[14px] uppercase tracking-wide" style={{ borderColor: 'rgba(248,236,215,.45)' }} data-popup-state={info.state}>
              {open ? (info.closes_text ? `Pre-orders close ${info.closes_text}` : 'Pre-orders open') + (info.boxes_left != null ? ` · ${info.boxes_left} boxes left` : '') : closedCopy?.[0]}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {open ? <a href="#build" className="px-7 py-4 font-oswald text-[15px] uppercase tracking-wide" style={{ background: CREAM, color: MAROON }}>Build your box</a> : null}
              <a href="#menu" className="border px-7 py-4 font-oswald text-[15px] uppercase tracking-wide" style={{ borderColor: 'rgba(248,236,215,.6)' }}>See the menu</a>
              {cfg.rsvp ? <a href={cfg.rsvp} target="_blank" rel="noreferrer" className="border px-7 py-4 font-oswald text-[15px] uppercase tracking-wide" style={{ borderColor: 'rgba(248,236,215,.6)' }}>RSVP</a> : null}
            </div>
            {preview ? <p className="mt-6 max-w-xl border px-4 py-3 font-body text-[13px]" style={{ borderColor: AMBER, color: AMBER }} data-preview-banner>Preview mode: place a practice order. Nothing is saved, emailed or charged.</p> : null}
            {params.get('cancelled') ? <p className="mt-6 max-w-xl border px-4 py-3 font-body text-[13px]" style={{ borderColor: 'rgba(248,236,215,.5)' }}>Payment was cancelled, so nothing was ordered. Your basket is below whenever you’re ready.</p> : null}
          </div>
          <div className="lg:col-span-5">
            <img src={asset(cfg.cover.src)} alt={cfg.cover.alt} className="mx-auto block w-full max-w-[460px] shadow-2xl" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: CREAM, color: INK }}>
        <ol className="mx-auto grid w-full max-w-page gap-px px-5 py-10 sm:grid-cols-3 sm:px-8 lg:px-12">
          {cfg.how.map(([t, d], n) => (
            <li key={t} className="border-t-2 pt-4 sm:pr-8" style={{ borderColor: MAROON }}>
              <p className="font-anton text-[34px] leading-none" style={{ color: MAROON }}>0{n + 1}</p>
              <p className="mt-2 font-anton text-[24px] lowercase leading-none">{t}</p>
              <p className="mt-2 font-body text-[14px] leading-relaxed text-black/70">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The menu */}
      <section id="menu" className="scroll-mt-20 py-14 sm:py-20" style={{ color: CREAM }}>
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <h2 className="font-anton text-[64px] lowercase leading-none sm:text-[96px]">the menu</h2>
          <div className="mt-8 grid gap-8 lg:grid-cols-12">
            <div className="self-start p-6 sm:p-8 lg:col-span-5" style={{ background: MAROON }} data-price-card>
              <p className="font-oswald text-[13px] lowercase opacity-90">{cfg.tag}</p>
              <ul className="mt-3">
                {cfg.prices.map(([n, d, p]) => (
                  <li key={n} className="flex items-end justify-between gap-4 border-b-2 py-3" style={{ borderColor: CREAM }}>
                    <span><span className="block font-anton text-[40px] lowercase leading-none">{n}</span><span className="mt-1 block font-oswald text-[15px] lowercase">{d}</span></span>
                    <span className="font-anton text-[40px] leading-none">{money(p)}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 grid grid-cols-3 gap-3">
                {cfg.addOns.map(([n, p]) => <li key={n}><span className="block font-anton text-[20px] lowercase leading-none">{n}</span><span className="mt-1 block font-oswald text-[14px]">{money(p)}</span></li>)}
              </ul>
              <ul className="mt-5 space-y-1 font-oswald text-[13px] lowercase opacity-90">{cfg.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7">
              {cfg.dishes.map((d, n) => <DishTile key={d.lines.join(' ')} d={d} tag={cfg.tag} wide={n === cfg.dishes.length - 1 && cfg.dishes.length % 3 === 1} />)}
            </div>
          </div>
        </div>
      </section>

      {/* Build + basket */}
      <section id="build" className="scroll-mt-20 py-14 sm:py-20" style={{ background: CREAM, color: INK }}>
        <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <h2 className="font-anton text-[56px] lowercase leading-none sm:text-[80px]">build your box</h2>
          {open ? (
            <>
              <p className="mt-3 max-w-xl font-body text-[15px] leading-relaxed text-black/70">Choose a combo, pick your proteins and sides, add any extras, and name who it’s for. Add as many boxes as you need, then check out.</p>
              <div className="mt-8 grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-7"><Builder menu={menu} boxCount={boxes.length} onAdd={(b) => setBoxes((p) => [...p, { ...b, id: Math.random().toString(36).slice(2) }])} /></div>
                <aside id="basket" className="scroll-mt-24 lg:col-span-5">
                  <div className="sticky top-24 p-6 sm:p-8" style={{ background: MAROON, color: CREAM }} data-basket>
                    <div className="flex items-baseline justify-between"><p className="font-anton text-[30px] lowercase leading-none">your basket</p><p className="font-oswald text-[14px]">{boxes.length} {boxes.length === 1 ? 'box' : 'boxes'}</p></div>
                    {boxes.length ? (
                      <ul className="mt-4 divide-y border-y" style={{ borderColor: 'rgba(248,236,215,.25)' }}>
                        {boxes.map((b) => (
                          <li key={b.id} className="flex items-start justify-between gap-4 py-3" style={{ borderColor: 'rgba(248,236,215,.25)' }} data-basket-box>
                            <div className="min-w-0">
                              <p className="font-body text-[15px] font-medium">{b.for} <span className="font-oswald text-[13px] opacity-80">· {b.item}</span></p>
                              <p className="mt-1 font-body text-[12px] leading-relaxed opacity-75">{b.summary}{b.note ? ` · ${b.note}` : ''}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-oswald text-[16px]">{money(b.price)}</p>
                              <button type="button" onClick={() => setBoxes((p) => p.filter((x) => x.id !== b.id))} className="mt-1 font-oswald text-[12px] uppercase tracking-wide opacity-70 hover:opacity-100">Remove</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-4 font-body text-[14px] opacity-75">Your basket is empty. Choose a box to begin.</p>}
                    <div className="mt-4 flex items-baseline justify-between"><p className="font-oswald text-[14px] uppercase tracking-wide">Total</p><p className="font-anton text-[36px] leading-none" data-basket-total>{money(total)}</p></div>
                    <button type="button" onClick={toCheckout} disabled={!boxes.length} className="mt-6 w-full py-4 font-oswald text-[15px] uppercase tracking-wide disabled:opacity-40" style={{ background: CREAM, color: MAROON }} data-checkout>Checkout</button>
                    <p className="mt-3 font-body text-[12px] opacity-75">{slot?.label}, {prettyDay(menu.date)}.</p>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <div className="mt-8 max-w-2xl border-l-4 py-2 pl-5" style={{ borderColor: MAROON }} data-closed>
              <p className="font-anton text-[34px] lowercase leading-none" style={{ color: MAROON }}>{closedCopy?.[0]}</p>
              <p className="mt-3 font-body text-[15px] leading-relaxed text-black/75">{closedCopy?.[1]}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer" className="px-6 py-3 font-oswald text-[14px] uppercase tracking-wide" style={{ background: MAROON, color: CREAM }}>Follow on Instagram</a>
                <Link to="/whats-up" className="border px-6 py-3 font-oswald text-[14px] uppercase tracking-wide" style={{ borderColor: MAROON, color: MAROON }}>What’s up with us?</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Checkout */}
      {open && stage === 'checkout' && boxes.length ? (
        <section id="checkout" className="py-14 sm:py-20" style={{ background: '#FFF8EC', color: INK }}>
          <div ref={checkoutRef} className="scroll-mt-24" />
          <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
            <h2 className="font-anton text-[56px] lowercase leading-none sm:text-[72px]">nearly there</h2>
            <form onSubmit={submit} className="mt-8 grid gap-10 lg:grid-cols-12">
              <div className="space-y-10 lg:col-span-7">
                <div>
                  <p className="font-oswald text-[14px] uppercase tracking-wide" style={{ color: MAROON }}>Collection</p>
                  <div className="mt-3 border p-4" style={{ borderColor: 'rgba(90,29,32,.3)' }} data-collect>
                    <p className="font-body text-[15px] font-medium">{slot?.label} · {prettyDay(menu.date)}</p>
                    <p className="mt-1 font-body text-[14px] text-black/70">{slot?.place}{slot?.time ? ` · ${slot.time}` : ''}</p>
                    <p className="mt-2 font-body text-[13px] leading-relaxed text-black/60">{menu.collect_note || cfg.collect}</p>
                  </div>
                </div>
                <div>
                  <p className="font-oswald text-[14px] uppercase tracking-wide" style={{ color: MAROON }}>Your details</p>
                  <div className="mt-3 grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2"><label htmlFor="p-name" className="font-body text-[12px] uppercase tracking-wide text-black/60">Full name *</label><input id="p-name" className="field-ivory mt-1" autoComplete="name" value={f.name} onChange={(e) => setK('name', e.target.value)} /></div>
                    <div><label htmlFor="p-phone" className="font-body text-[12px] uppercase tracking-wide text-black/60">Phone *</label><input id="p-phone" type="tel" className="field-ivory mt-1" autoComplete="tel" value={f.phone} onChange={(e) => setK('phone', e.target.value)} /></div>
                    <div><label htmlFor="p-email" className="font-body text-[12px] uppercase tracking-wide text-black/60">Email *</label><input id="p-email" type="email" className="field-ivory mt-1" autoComplete="email" value={f.email} onChange={(e) => setK('email', e.target.value)} /></div>
                    <div className="sm:col-span-2"><label htmlFor="p-all" className="font-body text-[12px] uppercase tracking-wide text-black/60">Allergies & dietary needs</label><input id="p-all" className="field-ivory mt-1" placeholder="Please tell us before you pay" value={f.allergies} onChange={(e) => setK('allergies', e.target.value)} /></div>
                    <div className="sm:col-span-2"><label htmlFor="p-note" className="font-body text-[12px] uppercase tracking-wide text-black/60">Anything else</label><input id="p-note" className="field-ivory mt-1" value={f.note} onChange={(e) => setK('note', e.target.value)} /></div>
                    <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="p-company">Company</label><input id="p-company" tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => setK('company', e.target.value)} /></div>
                  </div>
                </div>
                <p className="font-body text-[12px] leading-relaxed text-black/55">{cfg.terms} <Link to="/terms" className="underline">Terms</Link>.</p>
              </div>
              <div className="lg:col-span-5">
                <div className="sticky top-24 border p-6 sm:p-8" style={{ borderColor: 'rgba(90,29,32,.3)', background: CREAM }} data-pay>
                  <p className="font-oswald text-[14px] uppercase tracking-wide" style={{ color: MAROON }}>Pay</p>
                  <ul className="mt-3 divide-y border-y" style={{ borderColor: 'rgba(90,29,32,.2)' }}>
                    {boxes.map((b) => <li key={b.id} className="flex justify-between gap-4 py-2.5 font-body text-[14px]" style={{ borderColor: 'rgba(90,29,32,.2)' }}><span className="min-w-0"><span className="font-medium">{b.for}</span> <span className="text-black/55">· {b.item}</span></span><span className="shrink-0">{money(b.price)}</span></li>)}
                  </ul>
                  <div className="mt-3 flex items-baseline justify-between"><p className="font-oswald text-[14px] uppercase tracking-wide">Total</p><p className="font-anton text-[38px] leading-none" data-pay-total>{money(total)}</p></div>
                  {state.error ? <p className="mt-4 font-body text-[13px] text-red-700" data-pay-error>{state.error}</p> : null}
                  {state.status === 'placed' ? (
                    <div className="mt-5 border-l-4 py-1 pl-4" style={{ borderColor: MAROON }} data-placed>
                      <p className="font-anton text-[26px] lowercase leading-none">{state.preview ? 'preview complete' : `thank you${f.name ? `, ${f.name.split(' ')[0].toLowerCase()}` : ''}`}</p>
                      <p className="mt-2 font-body text-[13px] leading-relaxed text-black/75">{state.preview ? 'This is where a real order is placed. Nothing was saved, emailed or charged.' : `Your order is in. It is confirmed once your transfer reaches us, and we send a receipt to ${f.email}.${getCustomer() ? ' It is also saved in your account.' : ''}`}</p>
                    </div>
                  ) : card ? (
                    <>
                      <button type="submit" disabled={!ready || state.status === 'sending'} className="mt-6 w-full py-4 font-oswald text-[16px] uppercase tracking-wide disabled:opacity-40" style={{ background: MAROON, color: CREAM }} data-pay-card>
                        {state.status === 'sending' ? 'Taking you to payment…' : `Pay ${money(total)} by card`}
                      </button>
                      <p className="mt-3 font-body text-[12px] leading-relaxed text-black/60">Secure payment by Stripe. Apple Pay and Google Pay work too. Your order is confirmed the moment payment goes through, and a receipt is emailed to you.</p>
                    </>
                  ) : (
                    <>
                      {!showBank ? (
                        <button type="button" onClick={() => setShowBank(true)} className="mt-6 w-full py-4 font-oswald text-[16px] uppercase tracking-wide" style={{ background: MAROON, color: CREAM }} data-pay-bank>Pay {money(total)} by bank transfer</button>
                      ) : (
                        <div className="mt-6 border p-5" style={{ borderColor: MAROON }} data-bank-details>
                          <p className="font-oswald text-[13px] uppercase tracking-wide" style={{ color: MAROON }}>Bank transfer</p>
                          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-body text-[14px]">
                            <dt className="text-black/55">Name</dt><dd className="font-medium">{bank.name}</dd>
                            <dt className="text-black/55">Bank</dt><dd>{bank.bank}</dd>
                            <dt className="text-black/55">Account number</dt><dd className="tabular-nums">{bank.account}</dd>
                            <dt className="text-black/55">Sort code</dt><dd className="tabular-nums">{bank.sort}</dd>
                            <dt className="text-black/55">Reference</dt><dd>{f.name || 'Your name'}</dd>
                            <dt className="text-black/55">Amount</dt><dd className="font-medium">{money(total)}</dd>
                          </dl>
                          <button type="button" onClick={copyBank} className="mt-4 font-oswald text-[13px] uppercase tracking-wide underline" style={{ color: MAROON }}>{copied ? 'Copied' : 'Copy the details'}</button>
                        </div>
                      )}
                      {showBank ? <button type="submit" disabled={!ready || state.status === 'sending'} className="mt-4 w-full py-4 font-oswald text-[16px] uppercase tracking-wide disabled:opacity-40" style={{ background: AMBER, color: INK }} data-place-bank>{state.status === 'sending' ? 'Placing your order…' : 'I’ve paid, place my order'}</button> : null}
                      <p className="mt-3 font-body text-[12px] leading-relaxed text-black/60">{showBank ? 'Your order is placed with us straight away and a copy is emailed to you. It is confirmed once the transfer reaches us.' : 'Tap to see the bank details, make the transfer, then place your order.'}</p>
                      {state.status === 'handoff' ? <p className="mt-4 font-body text-[13px] text-black/75" data-handoff>{CONTACT.whatsapp ? 'WhatsApp should have opened with your order ready to send.' : 'Your email app should have opened with your order ready to send.'} If not, <a href={state.href} className="underline">open it here</a>.</p> : null}
                    </>
                  )}
                  {!ready && state.status !== 'placed' ? <p className="mt-3 font-body text-[12px] text-black/50">Add your name, phone and email to continue.</p> : null}
                  <button type="button" onClick={() => setStage('build')} className="mt-4 font-oswald text-[12px] uppercase tracking-wide text-black/55 hover:text-black">Back to the basket</button>
                </div>
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export function PopUpConfirmed({ cfg }) {
  const [params] = useSearchParams()
  const [order, setOrder] = useState(null)
  const [tries, setTries] = useState(0)
  const id = params.get('order') || ''
  useEffect(() => {
    document.title = `Order confirmed · ${cfg.name} · The Creatiste Catering`
    if (!API || !id) return
    let alive = true
    fetch(`${API}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_id: id, session_id: params.get('session_id') || '' }) })
      .then((r) => r.json()).then((j) => {
        if (!alive) return
        setOrder(j)
        if (j.status === 'pending_payment' && tries < 6) setTimeout(() => setTries((t) => t + 1), 2000)
      }).catch(() => { if (alive) setOrder({ status: 'unknown' }) })
    return () => { alive = false }
  }, [id, tries]) // eslint-disable-line react-hooks/exhaustive-deps
  const paid = order?.status && !['pending_payment', 'unknown'].includes(order.status) && !order.detail
  return (
    <section className="min-h-[80vh] pt-32 pb-20" style={{ background: MAROON, color: CREAM }} data-popup-confirmed>
      <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
        <p className="font-oswald text-[20px] font-light lowercase">{cfg.tag}</p>
        <h1 className="mt-3 font-anton text-[72px] lowercase leading-[0.9] sm:text-[120px]">{paid ? 'you’re in.' : order?.status === 'unknown' || order?.detail ? 'hmm.' : 'one moment…'}</h1>
        {paid ? (
          <div className="mt-8 max-w-xl p-6" style={{ background: 'rgba(0,0,0,.18)' }}>
            <p className="font-oswald text-[18px] lowercase">{prettyDay(order.date)} · collect under your name</p>
            <ul className="mt-4 space-y-2">{(order.boxes || []).map((b, i) => <li key={i} className="font-body text-[14px] opacity-90"><span className="font-medium">{b.for}</span> · {b.item} <span className="opacity-75">({b.summary})</span></li>)}</ul>
            <p className="mt-4 font-anton text-[34px] leading-none">paid {money(order.total)}</p>
            <p className="mt-4 font-body text-[13px] leading-relaxed opacity-85">{cfg.collect}</p>
            <p className="mt-3 font-body text-[12px] opacity-70">A receipt is on its way to your email. Reference {order.public_id}.</p>
          </div>
        ) : order?.status === 'pending_payment' && tries >= 6 ? (
          <p className="mt-8 max-w-xl font-body text-[16px] leading-relaxed opacity-90">Payment hasn’t reached us yet. If you completed it, your confirmation will follow by email within a few minutes. Otherwise, <Link to={cfg.path} className="underline">head back and try again</Link>.</p>
        ) : order?.status === 'unknown' || order?.detail ? (
          <p className="mt-8 max-w-xl font-body text-[16px] leading-relaxed opacity-90">We couldn’t look up that order. If you paid, your receipt will arrive by email. Any questions, message us on WhatsApp.</p>
        ) : null}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to={cfg.path} className="px-6 py-3 font-oswald text-[14px] uppercase tracking-wide" style={{ background: CREAM, color: MAROON }}>Back to {cfg.name}</Link>
          <Link to="/" className="border px-6 py-3 font-oswald text-[14px] uppercase tracking-wide" style={{ borderColor: 'rgba(248,236,215,.6)' }}>Home</Link>
        </div>
      </div>
    </section>
  )
}
