import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CLEAN_DREAM, CONTACT, SETTINGS } from '../content/site.js'
import { Arrow, Button, Eyebrow, Heading, Reveal, Section, asset } from '../ui.jsx'
import { REORDER_KEY, getCustomer, prefill } from '../account.js'

const money = (n) => `£${Number(n || 0).toFixed(2)}`
const API = SETTINGS.apiBase && SETTINGS.enquiryToken ? `${SETTINGS.apiBase}/api/public/preorder` : ''
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* Next open days in London time, honouring the order cut-off. Mirrors the server's rule. */
function openDates(menu) {
  const now = new Date()
  const ldn = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }).replace(/(\d+)\/(\d+)\/(\d+), (.*)/, '$3-$2-$1T$4'))
  const [hh, mm] = (menu.cutoff || '10:00').split(':').map(Number)
  const after = ldn.getHours() > hh || (ldn.getHours() === hh && ldn.getMinutes() >= mm)
  const d = new Date(ldn.getFullYear(), ldn.getMonth(), ldn.getDate() + (after ? 1 : 0))
  const out = []
  for (let i = 0; i < 30 && out.length < (menu.days_ahead || 5); i++) {
    const wd = (d.getDay() + 6) % 7
    if ((menu.days || [0, 1, 2, 3, 4]).includes(wd)) out.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, label: `${DAYS[wd]} ${d.getDate()} ${MONTHS[d.getMonth()]}` })
    d.setDate(d.getDate() + 1)
  }
  return out
}

/* Mirrors the server's pricing so the running total is honest; the server is still the authority. */
function priceBox(item, choices) {
  let price = Number(item.price || 0)
  for (const g of item.groups || []) {
    const picked = choices[g.id] || []
    const opts = Object.fromEntries((g.options || []).map((o) => [o.name, o]))
    picked.forEach((name, n) => {
      const o = opts[name] || {}
      price += Number(o.surcharge || 0)
      if (g.max && n >= g.max) price += Number(o.premium ? g.extra_premium_price : g.extra_price) || 0
    })
  }
  return Math.round(price * 100) / 100
}
const summarise = (item, choices) => (item.groups || []).filter((g) => (choices[g.id] || []).length).map((g) => `${g.label}: ${choices[g.id].join(', ')}`).join('; ')

function Chip({ on, onClick, children }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className={`border px-4 py-2.5 font-body text-[13px] transition-colors ${on ? 'border-gold bg-gold text-ink' : 'border-ink-3 text-ivory/85 hover:border-gold/60'}`}>{children}</button>
}

/* The bowl builder as steps: one choice group per step, then name the box, then add to basket. */
function Builder({ item, onAdd, boxCount }) {
  const groups = item.groups || []
  const steps = [...groups.map((g) => ({ kind: 'group', g })), { kind: 'name' }]
  const [i, setI] = useState(0)
  const [choices, setChoices] = useState({})
  const [forWho, setForWho] = useState('')
  const [note, setNote] = useState('')
  const top = useRef(null)
  const step = steps[i]
  const price = priceBox(item, choices)
  const toggle = (g, name) => setChoices((c) => {
    const cur = c[g.id] || []
    if (cur.includes(name)) return { ...c, [g.id]: cur.filter((x) => x !== name) }
    if (g.max === 1) return { ...c, [g.id]: [name] }
    if (g.max && cur.length >= g.max && !(g.extra_price || g.extra_premium_price)) return c
    return { ...c, [g.id]: [...cur, name] }
  })
  const canNext = step.kind === 'group' ? (choices[step.g.id] || []).length >= (step.g.min || 0) : !!forWho.trim()
  const go = (n) => { setI(n); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const add = () => {
    if (!forWho.trim()) return
    onAdd({ item_id: item.id, item: item.name, for: forWho.trim(), choices, note: note.trim(), price, summary: summarise(item, choices) })
    setChoices({}); setForWho(''); setNote(''); go(0)
  }
  return (
    <div ref={top} className="scroll-mt-28 border border-ink-3 bg-ink-2/50 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-[26px]">{item.name}</p>
        <p className="font-body text-[12px] uppercase tracking-wide text-gold">{money(item.price)} to start</p>
      </div>
      {/* Step rail */}
      <ol className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {steps.map((s, n) => {
          const label = s.kind === 'group' ? s.g.label : 'Name it'
          const done = n < i
          return (
            <li key={label} className="flex items-center gap-2">
              <button type="button" onClick={() => n < i && go(n)} className={`flex items-center gap-2 font-body text-[11px] uppercase tracking-eyebrow ${n === i ? 'text-gold' : done ? 'text-ivory/80' : 'text-smoke'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${n === i ? 'border-gold bg-gold text-ink' : done ? 'border-gold/60 text-gold' : 'border-ink-3'}`}>{done ? '✓' : n + 1}</span>{label}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="mt-8 min-h-[200px]">
        {step.kind === 'group' ? (
          <fieldset>
            <legend className="font-display text-[22px]">Step {i + 1}: {step.g.label === 'Extra protein' ? 'Add extra protein?' : `Choose your ${step.g.label.toLowerCase()}`} <span className="ml-2 font-body text-[12px] normal-case tracking-normal text-smoke">{step.g.pick}{step.g.extra_price ? ` · beyond ${step.g.max}, ${money(step.g.extra_price)} each (premium ${money(step.g.extra_premium_price)})` : ''}</span></legend>
            <div className="mt-5 flex flex-wrap gap-2">
              {(step.g.options || []).map((o) => {
                const on = (choices[step.g.id] || []).includes(o.name)
                return <Chip key={o.name} on={on} onClick={() => toggle(step.g, o.name)}>{o.name}{o.surcharge ? <span className={`ml-1.5 text-[11px] ${on ? 'text-ink/70' : 'text-gold'}`}>+{money(o.surcharge)}</span> : null}{o.premium ? <span className={`ml-1 text-[10px] uppercase ${on ? 'text-ink/60' : 'text-smoke'}`}>p</span> : null}</Chip>
              })}
            </div>
            {(choices[step.g.id] || []).length ? <p className="mt-4 font-body text-[12px] text-ivory/60">{choices[step.g.id].join(', ')}</p> : null}
          </fieldset>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2 border-b border-ink-3 pb-4 font-body text-[13px] font-light text-ivory/70">{summarise(item, choices) || 'Nothing chosen yet.'}</div>
            <div>
              <label htmlFor="box-for" className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">Who is this bowl for? <span className="text-gold">*</span></label>
              <input id="box-for" className="field mt-1" placeholder={boxCount ? `Bowl ${boxCount + 1}` : 'e.g. Priya'} value={forWho} onChange={(e) => setForWho(e.target.value)} />
              <p className="mt-2 font-body text-[11px] text-smoke">So each person’s food is labelled correctly.</p>
            </div>
            <div>
              <label htmlFor="box-note" className="font-body text-[11px] uppercase tracking-eyebrow text-ivory/70">Any notes for the kitchen</label>
              <input id="box-note" className="field mt-1" placeholder="No onions, sauce on the side…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-5">
        <p className="font-display text-[22px]">{money(price)}</p>
        <div className="flex gap-2">
          {i > 0 ? <Button variant="ghost" onClick={() => go(i - 1)}>Back</Button> : null}
          {step.kind === 'group'
            ? <Button onClick={() => go(i + 1)} disabled={!canNext} className="disabled:cursor-not-allowed disabled:opacity-40">{(step.g.min || 0) === 0 && !(choices[step.g.id] || []).length ? 'Skip' : 'Next'} <Arrow /></Button>
            : <Button onClick={add} disabled={!canNext} className="disabled:cursor-not-allowed disabled:opacity-40">Add to basket <Arrow /></Button>}
        </div>
      </div>
    </div>
  )
}

export default function CleanDream() {
  const [params] = useSearchParams()
  const [menu, setMenu] = useState(CLEAN_DREAM.menu)
  const [payments, setPayments] = useState(false)
  const [dates, setDates] = useState(() => openDates(CLEAN_DREAM.menu))
  const [boxes, setBoxes] = useState([])
  const [stage, setStage] = useState('build') // build | checkout
  const [f, setF] = useState({ name: '', email: '', phone: '', allergies: '', date: '', fulfilment: 'collection', slot_id: '', delivery_address: '', note: '', company: '' })
  const [state, setState] = useState({ status: 'idle', error: '' })
  const [showBank, setShowBank] = useState(false)
  const [copied, setCopied] = useState(false)
  const bank = CLEAN_DREAM.bank
  const bankText = () => `${bank.name}\n${bank.bank}\nAccount number ${bank.account}\nSort code ${bank.sort}\nReference ${f.name || 'your name'}\nAmount ${money(total)}`
  const copyBank = async () => { try { await navigator.clipboard.writeText(bankText()); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }
  const setK = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const checkoutRef = useRef(null)

  useEffect(() => {
    setF((p) => ({ ...p, date: dates[0]?.date || '', slot_id: menu.slots?.[0]?.id || '' }))
  }, [menu, dates])
  useEffect(() => { prefill(setF) }, []) // a signed-in visitor's name, email and phone
  // "Order this again" from the account page: rebuild the previous boxes against the current menu (re-priced).
  useEffect(() => {
    if (!params.get('reorder')) return
    let saved = null
    try { saved = JSON.parse(sessionStorage.getItem(REORDER_KEY) || 'null'); sessionStorage.removeItem(REORDER_KEY) } catch {}
    if (!saved?.boxes?.length) return
    const rebuilt = saved.boxes.map((b) => {
      const item = menu.items.find((i) => i.id === b.item_id) || menu.items.find((i) => i.name === b.item)
      if (!item) return null
      const choices = {}
      for (const g of item.groups || []) {
        const names = new Set((g.options || []).map((o) => o.name))
        const picked = (b.choices?.[g.id] || []).filter((n) => names.has(n))
        if (picked.length) choices[g.id] = picked
      }
      return { id: Math.random().toString(36).slice(2), item_id: item.id, item: item.name, for: b.for || '', choices, note: b.note || '', price: priceBox(item, choices), summary: summarise(item, choices) }
    }).filter(Boolean)
    if (!rebuilt.length) return
    setBoxes(rebuilt)
    setF((p) => ({ ...p, fulfilment: saved.fulfilment === 'delivery' ? 'delivery' : 'collection', delivery_address: saved.delivery_address || p.delivery_address, allergies: saved.allergies || p.allergies }))
    setStage('checkout')
    setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [menu]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!API) return
    fetch(`${API}/${SETTINGS.enquiryToken}`).then((r) => (r.ok ? r.json() : Promise.reject(r))).then((d) => {
      if (d.offer?.items?.length) { setMenu(d.offer); setDates(d.dates || openDates(d.offer)) }
      setPayments(d.payments === 'stripe')
    }).catch(() => {})
  }, [])

  const total = useMemo(() => boxes.reduce((s, b) => s + b.price, 0), [boxes])
  const slot = menu.slots?.find((s) => s.id === f.slot_id)
  const ready = boxes.length && f.name.trim() && f.email.trim() && f.phone.trim() && f.date && (f.fulfilment === 'delivery' ? f.delivery_address.trim() : f.slot_id)

  const waText = () => {
    const where = f.fulfilment === 'delivery' ? `Delivery to ${f.delivery_address}` : slot ? `${slot.label}, ${slot.place} @ ${slot.time}` : ''
    const lines = boxes.map((b) => `• ${b.for}: ${b.item} (${b.summary})${b.note ? ` [${b.note}]` : ''} ${money(b.price)}`)
    return [`${menu.title || 'Clean Dream'} order for ${f.date}`, `Name: ${f.name} · ${f.phone} · ${f.email}`, where, ...lines, `Total ${money(total)}`, !(API && payments) ? `Payment: bank transfer${showBank ? ' sent' : ''}, reference ${f.name}` : '', f.allergies ? `Allergies: ${f.allergies}` : '', f.note ? `Note: ${f.note}` : ''].filter(Boolean).join('\n')
  }

  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    if (!API || !payments) {
      // Bank transfer (or no payment set up): log the order with us first so it is on our list and in your
      // account, then hand the same order to WhatsApp (or email) for you to send.
      setState({ status: 'sending', error: '' })
      let logged = false
      if (API && showBank) {
        try {
          const r = await fetch(`${API}/${SETTINGS.enquiryToken}/bank`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, boxes: boxes.map((b) => ({ item_id: b.item_id, for: b.for, choices: b.choices, note: b.note })) }) })
          logged = r.ok
        } catch { logged = false }
      }
      const text = encodeURIComponent(waText())
      const href = CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}?text=${text}` : `mailto:${CONTACT.email}?subject=${encodeURIComponent('Clean Dream order')}&body=${text}`
      setState({ status: 'handoff', error: '', logged, href })
      window.location.href = href
      return
    }
    setState({ status: 'sending', error: '' })
    try {
      const r = await fetch(`${API}/${SETTINGS.enquiryToken}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, boxes: boxes.map((b) => ({ item_id: b.item_id, for: b.for, choices: b.choices, note: b.note })), return_url: window.location.origin }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.detail || 'Something went wrong placing that order.')
      if (j.url) { window.location.href = j.url; return }
      setState({ status: 'error', error: 'No payment link came back. Please try again.' })
    } catch (ex) {
      setState({ status: 'error', error: ex.message })
    }
  }
  const toCheckout = () => { setStage('checkout'); setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }

  return (
    <>
      <section className="relative overflow-hidden pt-40 pb-20">
        <div className="absolute inset-0"><img src={asset(CLEAN_DREAM.photo)} alt="" className="h-full w-full object-cover object-center opacity-30" /><div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/80 to-ink" /></div>
        <div className="relative mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
          <Reveal><Eyebrow>{CLEAN_DREAM.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5">{CLEAN_DREAM.title}</Heading></Reveal>
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/80">{CLEAN_DREAM.sub}</p></Reveal>
          <Reveal delay={3} className="mt-8"><Button href="#order">Start your order <Arrow /></Button></Reveal>
          {params.get('cancelled') ? <Reveal delay={3}><p className="mt-6 inline-block border border-gold/40 px-4 py-2 font-body text-[13px] text-gold-light">Payment was cancelled, so nothing was ordered. Build your bowls again below whenever you’re ready.</p></Reveal> : null}
        </div>
      </section>

      <Section ground="linen" tight>
        <ol className="grid gap-px bg-sand sm:grid-cols-2 lg:grid-cols-4">
          {CLEAN_DREAM.how.map(([t, d], i) => (
            <Reveal key={t} as="li" delay={i} className="bg-linen p-6">
              <p className="font-display text-[28px] text-gold-deep">0{i + 1}</p>
              <p className="mt-3 font-display text-[19px]">{t}</p>
              <p className="mt-2 font-body text-[14px] font-light leading-relaxed text-ink/70">{d}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section ground="ink" id="order">
        <Reveal><Eyebrow>Order</Eyebrow></Reveal>
        <Reveal delay={1}><Heading className="mt-5">Build your bowls</Heading></Reveal>
        <Reveal delay={2}><p className="lede mt-4 max-w-xl text-ivory/70">Pick a base, a protein and your toppings, name who it’s for, and add it to your basket. Add as many bowls as you need, then check out.</p></Reveal>
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            {menu.items.map((it) => <Reveal key={it.id} delay={1}><Builder item={it} boxCount={boxes.length} onAdd={(b) => setBoxes((p) => [...p, { ...b, id: Math.random().toString(36).slice(2) }])} /></Reveal>)}
          </div>
          <aside className="lg:col-span-5">
            <div className="sticky top-24 border border-gold/40 bg-ink-2/70 p-6 sm:p-8">
              <div className="flex items-baseline justify-between"><p className="eyebrow">Your basket</p><p className="font-body text-[12px] text-smoke">{boxes.length} {boxes.length === 1 ? 'bowl' : 'bowls'}</p></div>
              {boxes.length ? (
                <ul className="mt-4 divide-y divide-ink-3 border-y border-ink-3">
                  {boxes.map((b) => (
                    <li key={b.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="font-display text-[17px]">{b.for} <span className="font-body text-[12px] text-smoke">· {b.item}</span></p>
                        <p className="mt-1 font-body text-[12px] font-light leading-relaxed text-ivory/65">{b.summary}{b.note ? ` · ${b.note}` : ''}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-body text-[14px]">{money(b.price)}</p>
                        <button type="button" onClick={() => setBoxes((p) => p.filter((x) => x.id !== b.id))} className="mt-1 font-body text-[11px] uppercase tracking-wide text-smoke hover:text-gold">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-4 font-body text-[14px] font-light text-smoke">Your basket is empty. Build a bowl to begin.</p>}
              <div className="mt-4 flex items-baseline justify-between"><p className="font-body text-[12px] uppercase tracking-wide text-ivory/70">Total</p><p className="font-display text-[26px]">{money(total)}</p></div>
              <Button onClick={toCheckout} disabled={!boxes.length} className="mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40">Checkout <Arrow /></Button>
              <p className="mt-3 font-body text-[12px] text-smoke">Orders in by {menu.cutoff} are made the same day, Monday to Friday.</p>
            </div>
          </aside>
        </div>
      </Section>

      {stage === 'checkout' && boxes.length ? (
        <Section ground="linen" id="checkout">
          <div ref={checkoutRef} className="scroll-mt-24" />
          <Reveal><Eyebrow className="text-gold-deep">Checkout</Eyebrow></Reveal>
          <Reveal delay={1}><Heading className="mt-5">Nearly there.</Heading></Reveal>
          <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-12">
            <div className="space-y-12 lg:col-span-7">
              <div>
                <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Step 1 · When & where</p>
                <div className="mt-4 grid gap-5">
                  <div>
                    <label htmlFor="o-date" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Day <span className="text-gold-deep">*</span></label>
                    <select id="o-date" className="field-ivory mt-1" value={f.date} onChange={(e) => setK('date', e.target.value)}>
                      {dates.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[['collection', 'Collection'], ...(menu.delivery?.enabled ? [['delivery', 'Delivery']] : [])].map(([v, l]) => (
                      <button type="button" key={v} onClick={() => setK('fulfilment', v)} aria-pressed={f.fulfilment === v} className={`border px-4 py-2 font-body text-[13px] ${f.fulfilment === v ? 'border-ink bg-ink text-ivory' : 'border-sand text-ink/80'}`}>{l}</button>
                    ))}
                  </div>
                  {f.fulfilment === 'collection' ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(menu.slots || []).map((s) => (
                        <label key={s.id} className={`flex cursor-pointer items-start gap-3 border bg-ivory p-3 ${f.slot_id === s.id ? 'border-gold-deep' : 'border-sand'}`}>
                          <input type="radio" name="slot" className="mt-1 accent-gold-deep" checked={f.slot_id === s.id} onChange={() => setK('slot_id', s.id)} />
                          <span><span className="block font-body text-[11px] uppercase tracking-wide text-gold-deep">{s.label} · {s.time}</span><span className="block font-body text-[14px] text-ink/85">{s.place}</span></span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="o-addr" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Delivery address & postcode <span className="text-gold-deep">*</span></label>
                      <input id="o-addr" className="field-ivory mt-1" value={f.delivery_address} onChange={(e) => setK('delivery_address', e.target.value)} />
                      <p className="mt-2 font-body text-[12px] font-light leading-relaxed text-stone">{menu.delivery?.note}</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Step 2 · Your details</p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label htmlFor="o-name" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Full name <span className="text-gold-deep">*</span></label><input id="o-name" className="field-ivory mt-1" autoComplete="name" value={f.name} onChange={(e) => setK('name', e.target.value)} /></div>
                  <div><label htmlFor="o-phone" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Phone <span className="text-gold-deep">*</span></label><input id="o-phone" type="tel" className="field-ivory mt-1" autoComplete="tel" value={f.phone} onChange={(e) => setK('phone', e.target.value)} /></div>
                  <div><label htmlFor="o-email" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Email <span className="text-gold-deep">*</span></label><input id="o-email" type="email" className="field-ivory mt-1" autoComplete="email" value={f.email} onChange={(e) => setK('email', e.target.value)} /></div>
                  <div className="sm:col-span-2"><label htmlFor="o-all" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Allergies & dietary needs</label><input id="o-all" className="field-ivory mt-1" placeholder="Nut allergy for Priya, no dairy for Sam…" value={f.allergies} onChange={(e) => setK('allergies', e.target.value)} /></div>
                  <div className="sm:col-span-2"><label htmlFor="o-note" className="font-body text-[11px] uppercase tracking-eyebrow text-ink/70">Anything else</label><input id="o-note" className="field-ivory mt-1" value={f.note} onChange={(e) => setK('note', e.target.value)} /></div>
                  <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="o-company">Company</label><input id="o-company" tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => setK('company', e.target.value)} /></div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="sticky top-24 border border-sand bg-ivory p-6 sm:p-8">
                <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Step 3 · Pay</p>
                <ul className="mt-4 divide-y divide-sand border-y border-sand">
                  {boxes.map((b) => <li key={b.id} className="flex justify-between gap-4 py-2.5 font-body text-[14px]"><span className="min-w-0"><span className="font-display text-[16px]">{b.for}</span> <span className="text-stone">· {b.summary}</span></span><span className="shrink-0">{money(b.price)}</span></li>)}
                </ul>
                <div className="mt-3 flex items-baseline justify-between"><p className="font-body text-[12px] uppercase tracking-wide text-ink/70">Total</p><p className="font-display text-[28px]">{money(total)}</p></div>
                <p className="mt-2 font-body text-[13px] text-stone">{f.date ? dates.find((d) => d.date === f.date)?.label : ''}{f.fulfilment === 'delivery' ? ' · Delivery' : slot ? ` · ${slot.place} @ ${slot.time}` : ''}</p>
                {state.error ? <p className="mt-4 font-body text-[13px] text-red-600">{state.error}</p> : null}
                {API && payments ? (
                  <>
                    <Button type="submit" variant="ink" disabled={!ready || state.status === 'sending'} className="mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40">
                      {state.status === 'sending' ? 'Taking you to payment…' : `Pay ${money(total)} & place order`} <Arrow />
                    </Button>
                    <p className="mt-3 font-body text-[12px] text-stone">Card payment by Stripe. Your order is confirmed once payment goes through.</p>
                  </>
                ) : (
                  <>
                    {/* Paying by bank transfer: the details sit behind a button, then the order goes to us on WhatsApp. */}
                    {!showBank ? (
                      <Button type="button" variant="ink" onClick={() => setShowBank(true)} className="mt-6 w-full" data-pay-bank>Pay {money(total)} by bank transfer <Arrow /></Button>
                    ) : (
                      <div className="mt-6 border border-gold bg-linen p-5" data-bank-details>
                        <p className="font-body text-[11px] uppercase tracking-eyebrow text-gold-deep">Pay by bank transfer</p>
                        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-body text-[14px]">
                          <dt className="text-stone">Name</dt><dd className="font-medium">{bank.name}</dd>
                          <dt className="text-stone">Bank</dt><dd>{bank.bank}</dd>
                          <dt className="text-stone">Account number</dt><dd className="tabular-nums">{bank.account}</dd>
                          <dt className="text-stone">Sort code</dt><dd className="tabular-nums">{bank.sort}</dd>
                          <dt className="text-stone">Reference</dt><dd>{f.name || 'Your name'}</dd>
                          <dt className="text-stone">Amount</dt><dd className="font-medium">{money(total)}</dd>
                        </dl>
                        <button type="button" onClick={copyBank} className="mt-4 font-body text-[11px] uppercase tracking-wide text-gold-deep link-under">{copied ? 'Copied' : 'Copy the details'}</button>
                        <p className="mt-4 font-body text-[12px] leading-relaxed text-ink/70">{CLEAN_DREAM.confirm}</p>
                      </div>
                    )}
                    <Button type="submit" variant={showBank ? 'gold' : 'ghost-ink'} disabled={!ready || state.status === 'sending'} className="mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40">
                      {state.status === 'sending' ? 'Logging your order…' : showBank ? 'I’ve paid, send my order' : CONTACT.whatsapp ? 'Send order on WhatsApp' : 'Send order by email'} <Arrow />
                    </Button>
                    <p className="mt-3 font-body text-[12px] text-stone">{CONTACT.whatsapp ? 'Your order opens in WhatsApp for you to send. ' : 'Your order opens in your email app for you to send. '}{CLEAN_DREAM.confirm}</p>
                  </>
                )}
                {state.status === 'handoff' ? (
                  <div className="mt-5 border border-gold bg-linen p-5 font-body text-[13px] leading-relaxed text-ink/80" data-handoff>
                    {state.logged ? <p>Your order is logged with us{getCustomer() ? ' and saved in your account' : ''}. </p> : null}
                    <p>{CONTACT.whatsapp ? 'WhatsApp should have opened with your order ready to send.' : 'Your email app should have opened with your order ready to send.'} If it didn’t, <a href={state.href} className="link-under text-gold-deep">open it here</a>.</p>
                  </div>
                ) : null}
                <button type="button" onClick={() => setStage('build')} className="mt-4 font-body text-[11px] uppercase tracking-wide text-stone hover:text-ink">Back to the basket</button>
              </div>
            </div>
          </form>
        </Section>
      ) : null}
    </>
  )
}

export function CleanDreamConfirmed() {
  const [params] = useSearchParams()
  const [order, setOrder] = useState(null)
  const [tries, setTries] = useState(0)
  const id = params.get('order') || ''
  useEffect(() => {
    if (!API || !id) return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch(`${API}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_id: id, session_id: params.get('session_id') || '' }) })
        const j = await r.json()
        if (!alive) return
        setOrder(j)
        if (j.status === 'pending_payment' && tries < 6) setTimeout(() => setTries((t) => t + 1), 2000)
      } catch { if (alive) setOrder({ status: 'unknown' }) }
    }
    check()
    return () => { alive = false }
  }, [id, tries]) // eslint-disable-line react-hooks/exhaustive-deps
  const paid = order?.status && order.status !== 'pending_payment' && order.status !== 'unknown'
  return (
    <section className="hero-field grain relative flex min-h-[80vh] items-center pt-32">
      <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
        <Reveal><Eyebrow>{paid ? 'Confirmed' : 'One moment'}</Eyebrow></Reveal>
        <Reveal delay={1}><Heading as="h1" size="xl" className="mt-5 max-w-3xl">{paid ? 'Your order is in.' : order?.status === 'unknown' ? 'We couldn’t check that order.' : 'Checking your payment…'}</Heading></Reveal>
        {paid ? (
          <Reveal delay={2} className="mt-8 max-w-xl border border-gold/40 bg-ink-2/60 p-6">
            <p className="font-body text-[14px] text-ivory/80">{order.date} · {order.slot}{order.delivery_address ? ` · ${order.delivery_address}` : ''}</p>
            <ul className="mt-4 space-y-2">{order.boxes.map((b, i) => <li key={i} className="font-body text-[14px] text-ivory/85"><span className="font-display text-[16px]">{b.for}</span> · {b.item} <span className="text-smoke">({b.summary})</span></li>)}</ul>
            <p className="mt-4 font-display text-[22px]">Paid {money(order.total)}</p>
            <p className="mt-3 font-body text-[12px] text-smoke">A confirmation email is on its way. Reference {order.public_id}.</p>
          </Reveal>
        ) : order?.status === 'pending_payment' && tries >= 6 ? (
          <Reveal delay={2}><p className="lede mt-8 max-w-xl text-ivory/75">Payment hasn’t reached us yet. If you completed it, the confirmation will follow by email within a few minutes. Otherwise, <Link to="/cleandream" className="link-under text-ivory">head back and try again</Link>.</p></Reveal>
        ) : null}
        <Reveal delay={3} className="mt-10 flex flex-wrap gap-3"><Button to="/whats-up">What’s up with Us?</Button><Button to="/" variant="ghost">Back to the start</Button></Reveal>
      </div>
    </section>
  )
}
