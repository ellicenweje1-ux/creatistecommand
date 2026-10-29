import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fmtDate, fmtMoney } from '../format'

const GOLD = '#BFA987'

/* The receipt a pre-order customer receives: the chef's branding, what was paid for, when and where.
   White and print-perfect like the invoice document. ?preview=1 lets the chef see it before marking paid. */
export default function PublicReceipt() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const preview = params.get('preview') === '1'
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    fetch(`/api/public/preorder/receipt/${id}${preview ? '?preview=1' : ''}`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(typeof j.detail === 'string' ? j.detail : 'Something went wrong'); return j })
      .then(setData).catch((e) => setError(e.message))
  }, [id, preview])

  if (error) return <Wrap><p className="py-24 text-center text-neutral-500">{error}</p></Wrap>
  if (!data) return <Wrap><p className="py-24 text-center text-neutral-400">Loading…</p></Wrap>
  const { business, order } = data
  const accent = business.accent || GOLD
  const cur = order.currency || 'GBP'
  const paidOn = order.paid_at ? order.paid_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const where = order.delivery_address ? `Delivery · ${order.delivery_address}` : order.slot

  return (
    <Wrap>
      <div className="mx-auto mb-4 flex max-w-2xl justify-end print:hidden">
        <button onClick={() => window.print()} style={{ background: accent }} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow">Download / Print</button>
      </div>
      <div className="relative mx-auto max-w-2xl bg-white p-8 text-neutral-800 shadow-lg print:max-w-none print:p-0 print:shadow-none" data-doc-kind="preorder-receipt">
        {data.preview && <p className="absolute right-4 top-4 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 print:hidden" data-preview-ribbon>Preview · not yet paid</p>}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <div className="flex items-center gap-3">
            {business.logo && <img src={business.logo} alt="" className="h-14 w-14 rounded object-cover" />}
            <div>
              <p className="font-display text-xl font-bold leading-tight">{business.name}</p>
              {business.email && <p className="text-xs text-neutral-500">{business.email}</p>}
              {business.phone && <p className="text-xs text-neutral-500">{business.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold tracking-wide" style={{ color: accent }}>RECEIPT</p>
            <p className="text-sm font-medium">{order.title} · {order.public_id}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#2e7d32' }}>Paid{order.pay_method === 'bank' ? ' by bank transfer' : ''}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg px-5 py-4 sm:grid-cols-3" style={{ background: `${accent}14`, border: `1px solid ${accent}` }} data-receipt-summary>
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Amount paid</p><p className="font-display text-2xl font-bold" style={{ color: accent }}>{fmtMoney(order.total, cur)}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Paid on</p><p className="text-sm font-medium">{fmtDate(paidOn)}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">For</p><p className="text-sm font-medium">{order.pretty_date || fmtDate(order.date)}</p></div>
        </div>

        <div className="mt-5 flex justify-between gap-4 text-sm">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Received from</p>
            <p className="font-medium">{order.name}</p>
          </div>
          <div className="max-w-[55%] text-right">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{order.delivery_address ? 'Delivery' : 'Collection'}</p>
            <p className="text-neutral-700">{where}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-400" style={{ borderBottom: `2px solid ${accent}` }}>
              <th className="pb-2 font-semibold">For</th>
              <th className="pb-2 font-semibold">Box</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(order.boxes || []).map((b, i) => (
              <tr key={i} className="border-b border-neutral-100 align-top">
                <td className="py-2.5 pr-3 font-medium">{b.for}</td>
                <td className="py-2.5 pr-3"><p>{b.item}</p>{b.summary && <p className="text-xs text-neutral-500">{b.summary}</p>}</td>
                <td className="py-2.5 text-right font-medium">{fmtMoney(b.price, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <div className="w-56 text-sm">
            <div className="mt-1 flex justify-between border-t pt-2 font-display text-lg font-bold" style={{ borderColor: accent }}>
              <span>Total paid</span><span style={{ color: accent }}>{fmtMoney(order.total, cur)}</span>
            </div>
          </div>
        </div>
        {order.allergies && <p className="mt-5 text-xs text-neutral-500"><span className="font-semibold text-neutral-600">Allergies noted:</span> {order.allergies}</p>}
        {order.delivery_address && <p className="mt-2 text-xs text-neutral-500">Delivery window and mileage fee are confirmed by WhatsApp.</p>}
        <p className="mt-6 text-center text-sm font-medium text-neutral-700">Payment received with thanks. This document is your receipt.</p>
        <p className="mt-8 whitespace-pre-line text-center text-[10px] text-neutral-400">{business.footer || 'Thank you for your business.'}</p>
      </div>
    </Wrap>
  )
}

function Wrap({ children }) {
  return <div className="min-h-screen bg-neutral-100 px-4 py-8 print:bg-white print:p-0">{children}</div>
}
