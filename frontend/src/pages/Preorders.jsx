import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { fmtDate, fmtMoney, todayISO } from '../format'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Textarea, toast, toastErr } from '../ui'

/* Pre-orders — customer orders placed on the chef's own website (a lunch service, a pop-up),
   paid by card before they're confirmed. Paid orders also roll into one confirmed Booking per
   day, so this page is the box-by-box view: who, which slot, what's in each named box. */
const TONES = { paid: 'green', collected: 'gray', cancelled: 'red', refunded: 'amber', pending_payment: 'amber' }
const LABELS = { paid: 'Paid', collected: 'Collected', cancelled: 'Cancelled', refunded: 'Refunded', pending_payment: 'Awaiting payment' }
const label = (o) => (o.status === 'pending_payment' && o.pay_method === 'bank' ? 'Awaiting bank transfer' : LABELS[o.status] || o.status)

export default function Preorders() {
  const [orders, setOrders] = useState(null)
  const [offer, setOffer] = useState(null)
  const [json, setJson] = useState('')
  const [from, setFrom] = useState(todayISO())
  const [showPending, setShowPending] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = async () => {
    try {
      const [o, f] = await Promise.all([api.get(`/preorders?from_date=${from}`), api.get('/preorders/offer')])
      setOrders(o); setOffer(f); setJson(JSON.stringify(f.offer, null, 2))
    } catch (e) { toastErr(e) }
  }
  useEffect(() => { load() }, [from]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    // Bank-transfer orders are real orders waiting for the money to land, so they always show; card attempts that never paid are hidden unless asked for.
    const vis = (orders || []).filter((o) => showPending || o.status !== 'pending_payment' || o.pay_method === 'bank')
    const by = {}
    vis.forEach((o) => { (by[o.date] ||= []).push(o) })
    return Object.entries(by).sort(([a], [b]) => a.localeCompare(b))
  }, [orders, showPending])

  const setStatus = async (o, status) => {
    try { await api.patch(`/preorders/${o.id}`, { status }); toast(`Marked ${LABELS[status].toLowerCase()}`); load() } catch (e) { toastErr(e) }
  }
  const saveOffer = async () => {
    let parsed
    try { parsed = JSON.parse(json) } catch { toastErr(new Error('That isn’t valid JSON yet')); return }
    try { const r = await api.put('/preorders/offer', { offer: parsed }); setOffer((f) => ({ ...f, offer: r.offer, dates: r.dates, is_default: false })); setEditing(false); toast('Offer saved') } catch (e) { toastErr(e) }
  }
  const useTemplate = () => { if (offer?.template) setJson(JSON.stringify(offer.template, null, 2)) }

  if (!orders || !offer) return <div className="py-20 text-center"><Spinner /></div>
  const paidCount = orders.filter((o) => o.status === 'paid').length
  const boxCount = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + (o.boxes?.length || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Pre-orders" sub="Orders placed on your own site, box by box, ready for labelling. Bank-transfer orders wait here until you mark them paid." />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <label className="flex items-center gap-2 pb-2 text-sm text-fg/80"><input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} /> Show unpaid attempts</label>
          <div className="ml-auto flex gap-6 pb-2 text-sm text-fg/70">
            <span><strong className="text-fg">{paidCount}</strong> paid orders</span>
            <span><strong className="text-fg">{boxCount}</strong> boxes</span>
            <span>Payments: <Badge tone={offer.payments === 'stripe' ? 'green' : 'amber'}>{offer.payments === 'stripe' ? 'card, live' : 'not configured'}</Badge></span>
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <EmptyState icon="cart" title="No orders yet" hint={offer.payments === 'stripe' ? 'Orders from your site will appear here, grouped by day.' : 'Orders from your site appear here grouped by day. Bank-transfer orders arrive as “awaiting bank transfer”: mark each paid once the money lands and it becomes a confirmed booking. Set PREORDER_STRIPE_SECRET_KEY (your business Stripe account) to take card payments as well.'} />
      ) : groups.map(([date, rows]) => (
        <Card key={date} className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <p className="font-display text-lg">{fmtDate(date)}</p>
            <p className="text-sm text-fg/60">{rows.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.boxes?.length || 0), 0)} boxes · {fmtMoney(rows.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0))}</p>
          </div>
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
                    <Badge tone={TONES[o.status] || 'gray'}>{label(o)}</Badge>
                    {o.status === 'pending_payment' && o.pay_method === 'bank' ? <Button size="sm" onClick={() => setStatus(o, 'paid')} data-mark-paid>Mark paid</Button> : null}
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
