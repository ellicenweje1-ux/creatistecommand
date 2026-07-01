import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fmtDate, fmtMoney, invoiceTotal } from '../format'

const GOLD = '#BFA987'

async function pub(path, opts) {
  const res = await fetch(`/api/public${path}`, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong')
  return data
}

/* The client-facing quote — a clean, white, print-perfect document that mirrors the invoice
   layout (branding, bill-to, line-item table, totals), with the approve/decline step below. */
export default function PublicQuote() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [responding, setResponding] = useState(null) // 'approve' | 'decline'
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    pub(`/quote/${token}`).then(setData).catch((e) => setError(e.message))
  }, [token])

  const respond = (e) => {
    e.preventDefault()
    pub(`/quote/${token}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: responding, name, comment }),
    }).then((r) => setDone(r.status)).catch((er) => setError(er.message))
  }

  if (error) return <Wrap><p className="py-24 text-center text-neutral-500">{error}</p></Wrap>
  if (!data) return <Wrap><p className="py-24 text-center text-neutral-400">Loading…</p></Wrap>
  const { quote, business, currency, client = {} } = data
  const accent = business.accent || GOLD
  const items = quote.items || []
  const subtotal = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  const total = invoiceTotal(quote)
  const taxAmt = total - (subtotal - (Number(quote.discount) || 0))
  const responded = done || (quote.status === 'approved' || quote.status === 'declined' ? quote.status : '')

  return (
    <Wrap>
      <div className="mx-auto mb-4 flex max-w-2xl justify-end print:hidden">
        <button onClick={() => window.print()} style={{ background: accent }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow">Download / Print</button>
      </div>
      <div className="mx-auto max-w-2xl bg-white p-8 text-neutral-800 shadow-lg print:max-w-none print:p-0 print:shadow-none">
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
            <p className="font-display text-2xl font-bold tracking-wide" style={{ color: accent }}>QUOTE</p>
            <p className="text-sm font-medium">{quote.number}</p>
            {responded && <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: responded === 'approved' ? '#2e7d32' : '#c62828' }}>{responded}</p>}
          </div>
        </div>

        <div className="mt-5 flex justify-between gap-4 text-sm">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Prepared for</p>
            <p className="font-medium">{client.name || '—'}</p>
            {client.company && <p className="text-neutral-500">{client.company}</p>}
            {client.email && <p className="text-neutral-500">{client.email}</p>}
          </div>
          <div className="space-y-0.5 text-right">
            {quote.title && <p className="font-medium">{quote.title}</p>}
            {quote.valid_until && <p><span className="text-neutral-400">Valid until&nbsp;</span>{fmtDate(quote.valid_until)}</p>}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-400" style={{ borderBottom: `2px solid ${accent}` }}>
              <th className="pb-2 font-semibold">Description</th>
              <th className="pb-2 text-right font-semibold">Qty</th>
              <th className="pb-2 text-right font-semibold">Unit</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (it.section ? (
              <tr key={i}>
                <td colSpan={4} className="pt-4 pb-1 font-display text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>{it.description}</td>
              </tr>
            ) : (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2.5 pr-2">{it.description}</td>
                <td className="py-2.5 text-right text-neutral-500">{it.qty}</td>
                <td className="py-2.5 text-right text-neutral-500">{fmtMoney(it.unit_price, currency)}</td>
                <td className="py-2.5 text-right font-medium">{fmtMoney((Number(it.qty) || 0) * (Number(it.unit_price) || 0), currency)}</td>
              </tr>
            )))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-56 text-sm">
            <Row label="Subtotal" value={fmtMoney(subtotal, currency)} />
            {Number(quote.discount) > 0 && <Row label="Discount" value={`−${fmtMoney(quote.discount, currency)}`} />}
            {Number(quote.tax_rate) > 0 && <Row label={`Tax (${quote.tax_rate}%)`} value={fmtMoney(taxAmt, currency)} />}
            <div className="mt-1 flex justify-between border-t pt-2 font-display text-lg font-bold" style={{ borderColor: accent }}>
              <span>Total</span><span style={{ color: accent }}>{fmtMoney(total, currency)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
            <p className="mb-1 font-semibold text-neutral-600">Notes</p>
            <p className="whitespace-pre-line">{quote.notes}</p>
          </div>
        )}

        <div className="mt-8 print:hidden">
          {responded ? (
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: accent, background: `${accent}10` }}>
              <p className="font-display text-lg font-semibold text-neutral-800">{responded === 'approved' ? 'Approved — thank you! 🥂' : 'You declined this quote.'}</p>
              <p className="mt-1 text-sm text-neutral-500">{business.name} has been notified{responded === 'approved' ? ' and will be in touch to confirm details.' : '.'}</p>
            </div>
          ) : responding ? (
            <form onSubmit={respond} className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-medium text-neutral-700">{responding === 'approve' ? 'Brilliant — confirm your approval:' : 'Sorry to hear — confirm below:'}</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-neutral-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Comment (optional)</label>
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-neutral-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setResponding(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-800">Back</button>
                <button className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow" style={{ background: responding === 'approve' ? accent : '#c62828' }}>
                  {responding === 'approve' ? 'Approve quote' : 'Decline quote'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setResponding('approve')} className="flex-1 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow" style={{ background: accent }}>Approve</button>
              <button onClick={() => setResponding('decline')} className="flex-1 rounded-lg border px-4 py-3 text-sm font-semibold" style={{ borderColor: accent, color: accent }}>Decline</button>
            </div>
          )}
        </div>
      </div>
    </Wrap>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between py-0.5 text-neutral-600"><span>{label}</span><span>{value}</span></div>
}
function Wrap({ children }) {
  return <div className="min-h-screen bg-neutral-100 px-4 py-8 print:bg-white print:p-0">{children}</div>
}
