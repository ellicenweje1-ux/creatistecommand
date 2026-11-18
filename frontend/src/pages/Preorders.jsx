import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { fmtDate, fmtMoney, todayISO } from '../format'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Textarea, toast, toastErr } from '../ui'
import { DocPreview, PreviewModal } from '../receiptpreview'

/* Pre-orders — customer orders placed on the chef's own website (a lunch service, a pop-up),
   paid by card before they're confirmed. Paid orders also roll into one confirmed Booking per
   day, so this page is the box-by-box view: who, which slot, what's in each named box. */
const TONES = { paid: 'green', collected: 'gray', cancelled: 'red', refunded: 'amber', pending_payment: 'amber' }
const LABELS = { paid: 'Paid', collected: 'Collected', cancelled: 'Cancelled', refunded: 'Refunded', pending_payment: 'Awaiting payment' }
/* The WhatsApp receipt Ellice sends by hand once a transfer lands: boxes, total, where and when, with a
   blank for the delivery fee. Copied to the clipboard, pasted into WhatsApp, figures tweaked as needed. */
function receiptText(o, template = '', business = 'The Creatiste Catering') {
  const lines = (o.boxes || []).map((b) => `• ${b.for}: ${b.item}${b.summary ? ` (${b.summary})` : ''}${b.note ? ` [${b.note}]` : ''} £${Number(b.price || 0).toFixed(2)}`)
  const when = o.date ? new Date(o.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const where = o.delivery_address ? `Delivery to: ${o.delivery_address}\nDelivery window: ____\nDelivery fee: £____ (£0.65 per mile)` : `Collection: ${o.slot || ''}`
  const total = `£${Number(o.total || 0).toFixed(2)}`
  if (template && template.trim()) {
    // The chef's own wording (Settings → Invoices → Receipts), placeholders filled in.
    const fill = {
      '{first_name}': (o.name || '').split(' ')[0], '{name}': o.name || '', '{date}': when, '{boxes}': lines.join('\n'),
      '{total}': total, '{ref}': o.public_id || '', '{where}': where, '{allergies}': o.allergies ? `Allergies noted: ${o.allergies}` : '',
      '{business}': business, '{title}': o.title || 'Clean Dream',
    }
    return Object.entries(fill).reduce((s, [k, v]) => s.split(k).join(v), template).replace(/\n{3,}/g, '\n\n').trim()
  }
  return [
    `Hi ${(o.name || '').split(' ')[0]}, thank you for your ${o.title || 'Clean Dream'} order.`,
    '',
    'RECEIPT OF PAYMENT',
    `Payment received: £${Number(o.total || 0).toFixed(2)}${o.pay_method === 'bank' ? ' by bank transfer' : ''}`,
    `Order ref: ${o.public_id || ''}`,
    `For: ${when}`,
    '',
    ...lines,
    `Total: £${Number(o.total || 0).toFixed(2)}`,
    o.delivery_address ? 'Total incl. delivery: £____' : '',
    '',
    where,
    o.allergies ? `Allergies noted: ${o.allergies}` : '',
    '',
    'Your order is confirmed. See you then!',
    business,
  ].filter((l) => l !== '').join('\n')
}
const label = (o) => (o.status === 'pending_payment' && o.pay_method === 'bank' ? 'Awaiting bank transfer' : LABELS[o.status] || o.status)
const STATE = { open: ['Taking orders', 'green'], closed: ['Pre-orders closed', 'gray'], paused: ['Paused', 'amber'], sold_out: ['Sold out', 'red'], finished: ['Finished', 'gray'] }
const siteUrl = (user) => {
  const w = (user?.socials?.website || '').trim()
  return w ? w.replace(/\/$/, '').replace(/^(?!https?:\/\/)/, 'https://') : ''
}

/* The kitchen list for one day of one order page: how many of each box and every portion inside them, across the
   paid orders (bank transfers still waiting are counted separately), so the shop and the cook are a read-off. */
function KitchenList({ rows }) {
  const live = rows.filter((o) => o.status === 'paid' || o.status === 'collected')
  const waiting = rows.filter((o) => o.status === 'pending_payment' && o.pay_method === 'bank')
  const tally = (list) => {
    const items = {}, portions = {}
    list.forEach((o) => (o.boxes || []).forEach((b) => {
      items[b.item] = (items[b.item] || 0) + 1
      Object.values(b.choices || {}).forEach((names) => (names || []).forEach((n) => { portions[n] = (portions[n] || 0) + 1 }))
    }))
    return { items: Object.entries(items).sort((a, b) => b[1] - a[1]), portions: Object.entries(portions).sort((a, b) => b[1] - a[1]) }
  }
  const t = tally(live)
  const w = tally(waiting)
  if (!t.items.length && !w.items.length) return null
  return (
    <div className="border-b border-line bg-parchment/60 px-5 py-4" data-kitchen-list>
      <p className="label">Kitchen list{waiting.length ? ' · paid orders' : ''}</p>
      {t.items.length ? (
        <>
          <p className="mt-1 text-sm"><span className="font-medium">Boxes:</span> {t.items.map(([n, c]) => `${c} × ${n}`).join(' · ')}</p>
          <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2 lg:grid-cols-3">{t.portions.map(([n, c]) => <li key={n} className="flex justify-between gap-3"><span className="text-fg/75">{n}</span><span className="font-medium tabular-nums">{c}</span></li>)}</ul>
        </>
      ) : <p className="mt-1 text-sm text-fg/60">Nothing paid yet.</p>}
      {waiting.length ? <p className="mt-2 text-xs text-fg/55">Plus {waiting.length} order{waiting.length === 1 ? '' : 's'} awaiting bank transfer: {w.items.map(([n, c]) => `${c} × ${n}`).join(' · ')}.</p> : null}
    </div>
  )
}

/* Each order page on the chef's website: its link, whether it is taking orders, card or bank transfer, and for a one-off
   event the everyday settings (where and when you collect, when pre-orders close, a box limit, pause). */
function OrderPage({ page, user, cardReady, stripeKey, stripeAccount, onSaved }) {
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [menuJson, setMenuJson] = useState('')
  const [editingMenu, setEditingMenu] = useState(false)
  useEffect(() => { setF({ date: page.date, closes: page.closes, place: page.slot?.place || '', time: page.slot?.time || '', capacity: page.capacity || '', collect_note: page.collect_note || '' }) }, [page])
  const save = async (patch, msg = 'Saved') => {
    setBusy(true)
    try { await api.put(`/preorders/offers/${page.slug}`, patch); toast(msg); onSaved() } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const saveMenu = async () => {
    let parsed
    try { parsed = JSON.parse(menuJson) } catch { toastErr(new Error('That isn’t valid JSON yet')); return }
    await save({ offer: parsed }, 'Menu saved'); setEditingMenu(false)
  }
  const base = siteUrl(user)
  const link = page.path ? `${base}/${page.path}` : ''
  const [stateLabel, tone] = STATE[page.state] || [page.state, 'gray']
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied') } catch { window.prompt('Copy the link:', link) } }
  const privateLink = page.private_key && page.path ? `${base || ''}/${page.path}?invite=${page.private_key}` : ''
  const copyPrivate = async () => { try { await navigator.clipboard.writeText(privateLink); toast('Private link copied') } catch { window.prompt('Copy the private link:', privateLink) } }
  if (!f) return null
  const event = !!page.date
  return (
    <Card className="p-5" data-order-page={page.slug}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg">{page.title} <span className="ml-1 text-sm font-normal text-fg/55">{event ? `Pop-up · ${fmtDate(page.date)}` : 'Your main order page'}</span></p>
          {link ? <p className="mt-1 text-sm"><a href={link} target="_blank" rel="noreferrer" className="text-copper hover:underline" data-page-link>{link.replace(/^https?:\/\//, '')}</a> <button type="button" onClick={copy} className="ml-2 text-xs text-fg/55 hover:text-fg">Copy</button></p>
            : page.path ? <p className="mt-1 text-sm text-fg/60">/{page.path} on your website (add your website under Settings → Business to see the full link)</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{stateLabel}</Badge>
          {page.boxes_left != null ? <Badge tone="gray">{page.boxes_left} boxes left</Badge> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm" data-pay-setting>
        <span className="text-fg/70">Customers pay by</span>
        {['card', 'bank'].map((v) => (
          <button key={v} type="button" disabled={busy || (v === 'card' && !cardReady)} onClick={() => save({ pay: v }, v === 'card' ? 'Card payments on' : 'Bank transfer on')}
            className={`rounded-full border px-3 py-1 ${page.pay === v ? 'border-copper bg-copper/15 text-fg' : 'border-line text-fg/60'} disabled:opacity-40`} aria-pressed={page.pay === v} data-pay={v}>
            {v === 'card' ? 'Card (Stripe)' : 'Bank transfer'}
          </button>
        ))}
        <span className="text-xs text-fg/55">
          {page.payments === 'stripe' ? `Card payments are live on this page${stripeAccount === 'command' ? ', paid into your Creatiste Command Stripe account' : ''}.`
            : !stripeKey ? 'Card payments switch on once Stripe is connected on the server. Until then customers pay by bank transfer.'
            : !cardReady ? 'The Stripe key on the server belongs to a different account, so card payments are not offered here.'
            : 'Bank transfer: mark each order paid when the money lands.'}
        </span>
      </div>

      {event ? (
        <div className="mt-4 border-t border-line pt-4" data-private-link>
          <p className="text-sm font-medium">Private link</p>
          <p className="mt-0.5 text-xs text-fg/55">For people you choose. It keeps this page open for them after it closes to everyone else (the public page stays closed), and they pay by bank transfer. Their orders land here with the rest, marked “Private link”.</p>
          {privateLink ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full break-all rounded-md bg-fg/5 px-2 py-1 text-xs" data-private-url>{privateLink.replace(/^https?:\/\//, '')}</code>
              <Button size="sm" onClick={copyPrivate} data-private-copy>Copy</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm('Make a new private link? The old one stops working.') && save({ private_link: 'new' }, 'New private link made. The old one no longer works.')} data-private-new>New link</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm('Turn the private link off? Anyone with it will see the page closed.') && save({ private_link: 'off' }, 'Private link turned off')} data-private-off>Turn off</Button>
              <span className="text-xs text-fg/55">{page.private_state === 'open' ? 'Taking orders.' : page.private_state === 'paused' ? 'Paused, like the page.' : 'The event has passed.'}</span>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="mt-2" disabled={busy || !page.path} onClick={() => save({ private_link: 'new' }, 'Private link ready: copy it and send it to who you choose')} data-private-make>Make a private link</Button>
          )}
          {privateLink && !base ? <p className="mt-1 text-xs text-fg/55">Add your website under Settings → Business and the full address shows here.</p> : null}
        </div>
      ) : null}

      {event ? (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Collection place"><Input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} placeholder="e.g. The Yard, 12 Example Street, E1" data-f-place /></Field>
          <Field label="Collection time"><Input value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} placeholder="e.g. 5pm to 9pm" data-f-time /></Field>
          <Field label="Date of the event"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Pre-orders close"><Input type="datetime-local" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} data-f-closes /></Field>
          <Field label="Most boxes to take" hint="Blank for no limit"><Input type="number" min="0" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} data-f-capacity /></Field>
          <Field label="How to collect (shown to customers)" className="sm:col-span-2 lg:col-span-3"><Textarea rows={2} value={f.collect_note} onChange={(e) => setF({ ...f, collect_note: e.target.value })} /></Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Button size="sm" disabled={busy} onClick={() => save({ place: f.place, time: f.time, date: f.date, closes: f.closes, capacity: Number(f.capacity) || 0, collect_note: f.collect_note })} data-save-page>Save</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ paused: !page.paused }, page.paused ? 'Taking orders again' : 'Orders paused')} data-pause>{page.paused ? 'Start taking orders again' : 'Pause orders'}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setMenuJson(JSON.stringify(page.offer, null, 2)); setEditingMenu(!editingMenu) }}>{editingMenu ? 'Close menu editor' : 'Edit the menu (advanced)'}</Button>
            <span className="text-xs text-fg/55">{page.closes_text ? `Closes ${page.closes_text}.` : ''} {page.items.map((i) => `${i.name} ${fmtMoney(i.price)}`).join(' · ')}</span>
          </div>
          {editingMenu ? <div className="sm:col-span-2 lg:col-span-3"><Textarea rows={18} className="font-mono text-xs" value={menuJson} onChange={(e) => setMenuJson(e.target.value)} /><div className="mt-2"><Button size="sm" onClick={saveMenu} disabled={busy}>Save menu</Button></div></div> : null}
        </div>
      ) : null}
    </Card>
  )
}

export default function Preorders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [offer, setOffer] = useState(null)
  const [json, setJson] = useState('')
  const [tab, setTab] = useState('upcoming') // upcoming | past
  const [showPending, setShowPending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [paidPreview, setPaidPreview] = useState(null) // {o, customer:{to,subject,body}, chef:{…}}
  const [waPreview, setWaPreview] = useState(null)     // {o, text}
  const [busy, setBusy] = useState(false)
  const [pages, setPages] = useState(null)

  const load = async () => {
    try {
      const [o, f, p] = await Promise.all([api.get('/preorders'), api.get('/preorders/offer'), api.get('/preorders/offers')])
      setOrders(o); setOffer(f); setJson(JSON.stringify(f.offer, null, 2)); setPages(p)
    } catch (e) { toastErr(e) }
  }
  const addPopup = async () => { try { await api.post('/preorders/offers', { template: 'soulfood' }); toast('Pop-up added. Set its date, place and closing time below.'); load() } catch (e) { toastErr(e) } }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    // Bank-transfer orders are real orders waiting for the money to land, so they always show; card attempts that never paid are hidden unless asked for.
    const today = todayISO()
    const vis = (orders || []).filter((o) => (showPending || o.status !== 'pending_payment' || o.pay_method === 'bank')
      && (tab === 'past' ? o.date < today : o.date >= today))
    const by = {}
    vis.forEach((o) => { (by[`${o.date}|${o.title || ''}`] ||= []).push(o) })
    // Upcoming: soonest first. Past: most recent first.
    return Object.entries(by).sort(([a], [b]) => (tab === 'past' ? b.localeCompare(a) : a.localeCompare(b))).map(([k, rows]) => [k.split('|')[0], rows, k.split('|')[1]])
  }, [orders, showPending, tab])
  const pastCount = (orders || []).filter((o) => o.date < todayISO() && (o.status === 'paid' || o.status === 'collected')).length

  // The WhatsApp receipt opens as an editable preview first; copy when it reads right.
  const copyReceipt = (o) => setWaPreview({ o, text: receiptText(o, user?.receipt_whatsapp_template || '', user?.business_name || user?.name || 'The Creatiste Catering') })
  const copyWa = async () => {
    const text = waPreview?.text || ''
    try { await navigator.clipboard.writeText(text); toast('Receipt copied. Paste it into WhatsApp.'); setWaPreview(null) } catch { window.prompt('Copy this receipt:', text) }
  }
  const setStatus = async (o, status) => {
    if (status === 'paid') {
      // Marking paid confirms the booking AND emails the customer their receipt: show that email first.
      try { const p = await api.get(`/preorders/${o.id}/receipt-preview`); setPaidPreview({ o, ...p }) } catch (e) { toastErr(e) }
      return
    }
    try { await api.patch(`/preorders/${o.id}`, { status }); toast(`Marked ${LABELS[status].toLowerCase()}`); load() } catch (e) { toastErr(e) }
  }
  const confirmPaid = async () => {
    const o = paidPreview?.o
    if (!o) return
    setBusy(true)
    try { await api.patch(`/preorders/${o.id}`, { status: 'paid' }); toast('Marked paid. Receipt emailed to the customer.'); setPaidPreview(null); load() } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const site = (user?.socials?.website || '').trim()
  const previewUrl = site ? `${site.replace(/\/$/, '').replace(/^(?!https?:\/\/)/, 'https://')}/cleandream?preview=1` : ''
  const saveOffer = async () => {
    let parsed
    try { parsed = JSON.parse(json) } catch { toastErr(new Error('That isn’t valid JSON yet')); return }
    try { const r = await api.put('/preorders/offer', { offer: parsed }); setOffer((f) => ({ ...f, offer: r.offer, dates: r.dates, is_default: false })); setEditing(false); toast('Offer saved') } catch (e) { toastErr(e) }
  }
  const useTemplate = () => { if (offer?.template) setJson(JSON.stringify(offer.template, null, 2)) }

  if (!orders || !offer) return <div className="py-20 text-center"><Spinner /></div>
  const upcomingPaid = orders.filter((o) => o.status === 'paid' && o.date >= todayISO())
  const paidCount = upcomingPaid.length
  const boxCount = upcomingPaid.reduce((s, o) => s + (o.boxes?.length || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Pre-orders" sub="Orders placed on your own site, box by box, ready for labelling. Bank-transfer orders wait here until you mark them paid." />
      <PreviewModal open={!!paidPreview} onClose={() => setPaidPreview(null)} title="Mark paid and send this receipt?" confirmLabel="Mark paid & send receipt" onConfirm={confirmPaid} busy={busy}>
        {paidPreview ? <DocPreview url={paidPreview.receipt_url} to={paidPreview.customer?.to} subject={paidPreview.customer?.subject} body={paidPreview.customer?.body}
          note={`This is the receipt ${paidPreview.o.name} will receive. On confirm the order becomes a confirmed booking for ${fmtDate(paidPreview.o.date)} and the email below (with the receipt link) is sent. You get a copy too.`} /> : null}
      </PreviewModal>
      <PreviewModal open={!!waPreview} onClose={() => setWaPreview(null)} title="WhatsApp receipt" confirmLabel="Copy to clipboard" onConfirm={copyWa}>
        {waPreview ? <div data-wa-preview>
          <p className="mb-2 text-sm text-fg/70">Read it through and tweak anything (the delivery blanks, a line of your own), then copy and paste it into WhatsApp. Change the standing wording under Settings → Invoices → Receipts.</p>
          <Textarea rows={16} className="font-mono text-xs" value={waPreview.text} onChange={(e) => setWaPreview((p) => ({ ...p, text: e.target.value }))} />
        </div> : null}
      </PreviewModal>
      {pages ? (
        <section className="space-y-3" data-order-pages>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-display text-xl">Your order pages</p>
              <p className="text-sm text-fg/60">Each page on your website that takes orders. Orders from all of them land below, day by day.</p>
            </div>
            {pages.templates?.some((t) => !t.added) ? <Button size="sm" variant="ghost" onClick={addPopup} data-add-popup>Add a pop-up page</Button> : null}
          </div>
          {pages.pages.map((pg) => <OrderPage key={pg.slug} page={pg} user={user} cardReady={pages.card_ready} stripeKey={pages.stripe_key} stripeAccount={pages.stripe_account} onSaved={load} />)}
        </section>
      ) : null}

      <Card className="p-4" data-customer-preview>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg">See it as a customer</p>
            <p className="mt-1 text-sm text-fg/70">Open your order page with <code className="rounded bg-fg/5 px-1">?preview=1</code> on the end: the whole journey runs exactly as a customer sees it (bowls, basket, bank transfer, order received) but nothing is saved, emailed or charged, and at the end it shows the emails they would receive. {previewUrl ? '' : 'Set your website under Settings → Business and the button appears here.'}</p>
          </div>
          {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg bg-copper px-4 py-2 text-sm font-medium text-ink hover:opacity-90" data-customer-preview-link>Preview as a customer</a> : null}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex rounded-lg border border-line p-0.5 text-sm" data-order-tabs>
            {[['upcoming', 'Upcoming'], ['past', `Past orders${pastCount ? ` (${pastCount})` : ''}`]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 ${tab === k ? 'bg-copper text-ink' : 'text-fg/70'}`} data-order-tab={k}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-fg/80"><input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} /> Show unpaid attempts</label>
          <div className="ml-auto flex gap-6 pb-2 text-sm text-fg/70">
            <span><strong className="text-fg">{paidCount}</strong> paid orders coming up</span>
            <span><strong className="text-fg">{boxCount}</strong> boxes</span>
            <span>Card payments: <Badge tone={pages?.card_ready ? 'green' : 'amber'}>{pages?.card_ready ? (pages.stripe_account === 'command' ? 'Stripe connected (Command account)' : 'Stripe connected') : 'Stripe not connected'}</Badge></span>
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <EmptyState icon="cart" title={tab === 'past' ? 'No past orders' : 'No upcoming orders'} hint={tab === 'past' ? 'Orders from earlier days appear here, most recent first.' : offer.payments === 'stripe' ? 'Orders from your site will appear here, grouped by day.' : 'Orders from your site appear here grouped by day. Bank-transfer orders arrive as “awaiting bank transfer”: mark each paid once the money lands and it becomes a confirmed booking. Switch a page to Card (Stripe) above to take card payments as well.'} />
      ) : groups.map(([date, rows, title]) => (
        <Card key={`${date}|${title}`} className="p-0" data-order-day={date}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <p className="font-display text-lg">{fmtDate(date)}{title ? <span className="ml-2 text-sm font-normal text-fg/60">{title}</span> : null}</p>
            <p className="text-sm text-fg/60">{rows.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.boxes?.length || 0), 0)} boxes · {fmtMoney(rows.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0))}</p>
          </div>
          <KitchenList rows={rows} />
          <ul className="divide-y divide-line">
            {rows.map((o) => (
              <li key={o.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{o.name} <span className="text-sm text-fg/60">· {o.phone} · {o.email}</span></p>
                    <p className="mt-0.5 text-sm text-fg/70">{o.slot}{o.delivery_address ? ` · ${o.delivery_address}` : ''}</p>
                    {o.allergies ? <p className="mt-1 text-sm text-red-400">Allergies: {o.allergies}</p> : null}
                    {o.note ? <p className="mt-1 text-sm text-fg/60">Note: {o.note}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {o.via === 'private' ? <span data-via-private><Badge tone="copper">Private link</Badge></span> : null}
                    <Badge tone={TONES[o.status] || 'gray'}>{label(o)}</Badge>
                    {o.status === 'pending_payment' && o.pay_method === 'bank' ? <Button size="sm" onClick={() => setStatus(o, 'paid')} data-mark-paid>Mark paid</Button> : null}
                    {o.status === 'paid' || o.status === 'collected' ? <Button size="sm" variant="ghost" onClick={() => copyReceipt(o)} data-copy-receipt>Copy WhatsApp receipt</Button> : null}
                    {o.status === 'paid' ? <Button size="sm" variant="ghost" onClick={() => setStatus(o, 'collected')}>Mark collected</Button> : null}
                    {o.status !== 'cancelled' && o.status !== 'refunded' ? <Button size="sm" variant="ghost" onClick={() => setStatus(o, 'cancelled')}>Cancel</Button> : null}
                  </div>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(o.boxes || []).map((b, i) => (
                    <li key={i} className="rounded border border-line bg-parchment px-3 py-2 text-sm">
                      <p className="font-medium">{b.for} <span className="text-fg/60">· {b.item} · {fmtMoney(b.price)}</span></p>
                      <p className="text-fg/70">{b.summary}{b.note ? ` · ${b.note}` : ''}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg">Your offer</p>
            <p className="mt-1 text-sm text-fg/70">The menu, choice groups and prices, collection slots, delivery policy and order cut-off that your site shows and that every order is priced from. {offer.is_default ? 'You’re on the starter template.' : 'Saved.'} Next open days: {(offer.dates || []).map((d) => d.label).join(', ')}.</p>
            <p className="mt-1 text-xs text-fg/50">Your site needs your enquiry token ({offer.token ? offer.token.slice(0, 6) + '…' : 'none'}) set as VITE_ENQUIRY_TOKEN.</p>
          </div>
          <div className="flex gap-2">
            {editing ? <><Button variant="ghost" onClick={useTemplate}>Load template</Button><Button variant="ghost" onClick={() => { setEditing(false); setJson(JSON.stringify(offer.offer, null, 2)) }}>Cancel</Button><Button onClick={saveOffer}>Save offer</Button></> : <Button variant="ghost" onClick={() => setEditing(true)}>Edit offer</Button>}
          </div>
        </div>
        {editing ? <Textarea className="mt-4 font-mono text-xs" rows={24} value={json} onChange={(e) => setJson(e.target.value)} /> : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {(offer.offer.items || []).map((it) => <li key={it.id} className="rounded border border-line p-3"><p className="font-medium">{it.name} · {fmtMoney(it.price)}</p><p className="text-fg/60">{(it.groups || []).map((g) => `${g.label} (${g.pick})`).join(' · ')}</p></li>)}
            {(offer.offer.slots || []).map((s) => <li key={s.id} className="rounded border border-line p-3"><p className="font-medium">{s.label} · {s.time}</p><p className="text-fg/60">{s.place}</p></li>)}
            <li className="rounded border border-line p-3"><p className="font-medium">Cut-off {offer.offer.cutoff}</p><p className="text-fg/60">Delivery {offer.offer.delivery?.enabled ? `on, £${offer.offer.delivery.per_mile}/mile` : 'off'}</p></li>
          </ul>
        )}
      </Card>
    </div>
  )
}
