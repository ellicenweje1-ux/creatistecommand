import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fmtDate, fmtMoney, invoiceTotal } from '../format'

const GOLD = '#BFA987'

async function pub(path) {
  const res = await fetch(`/api/public${path}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong')
  return data
}

/* A clean, white, print-perfect invoice document (portrait) — the client's view and the
   chef's "save as PDF". Self-contained colours so it's identical regardless of app theme. */
export default function PublicInvoice() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    pub(`/invoice/${token}`).then(setData).catch((e) => setError(e.message))
  }, [token])

  if (error) return <Wrap><p className="py-24 text-center text-neutral-500">{error}</p></Wrap>
  if (!data) return <Wrap><p className="py-24 text-center text-neutral-400">Loading…</p></Wrap>
  const { invoice, business, currency, client } = data
  const accent = business.accent || GOLD
  const items = invoice.items || []
  const subtotal = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  const total = invoiceTotal(invoice)
  const taxAmt = total - (subtotal - (Number(invoice.discount) || 0))
  const statusColor = { paid: '#2e7d32', overdue: '#c62828', sent: accent, draft: '#888', void: '#999' }[invoice.status] || '#888'

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
            <p className="font-display text-2xl font-bold tracking-wide" style={{ color: accent }}>INVOICE</p>
            <p className="text-sm font-medium">{invoice.number}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: statusColor }}>{invoice.status}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-between gap-4 text-sm">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Bill to</p>
            <p className="font-medium">{client.name || '—'}</p>
            {client.company && <p className="text-neutral-500">{client.company}</p>}
            {client.email && <p className="text-neutral-500">{client.email}</p>}
          </div>
          <div className="space-y-0.5 text-right">
            {invoice.issue_date && <p><span className="text-neutral-400">Issued&nbsp;</span>{fmtDate(invoice.issue_date)}</p>}
            {invoice.due_date && <p><span className="text-neutral-400">Due&nbsp;</span>{fmtDate(invoice.due_date)}</p>}
            {invoice.status === 'paid' && invoice.paid_date && <p><span className="text-neutral-400">Paid&nbsp;</span>{fmtDate(invoice.paid_date)}</p>}
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
            {items.map((it, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2.5 pr-2">{it.description}</td>
                <td className="py-2.5 text-right text-neutral-500">{it.qty}</td>
                <td className="py-2.5 text-right text-neutral-500">{fmtMoney(it.unit_price, currency)}</td>
                <td className="py-2.5 text-right font-medium">{fmtMoney((Number(it.qty) || 0) * (Number(it.unit_price) || 0), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-56 text-sm">
            <Row label="Subtotal" value={fmtMoney(subtotal, currency)} />
            {Number(invoice.discount) > 0 && <Row label="Discount" value={`−${fmtMoney(invoice.discount, currency)}`} />}
            {Number(invoice.tax_rate) > 0 && <Row label={`Tax (${invoice.tax_rate}%)`} value={fmtMoney(taxAmt, currency)} />}
            <div className="mt-1 flex justify-between border-t pt-2 font-display text-lg font-bold" style={{ borderColor: accent }}>
              <span>Total</span><span style={{ color: accent }}>{fmtMoney(total, currency)}</span>
            </div>
          </div>
        </div>

        {business.payment_details && (
          <div className="mt-6 rounded-lg border border-neutral-200 p-4" style={{ borderLeft: `3px solid ${accent}` }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Payment details</p>
            <p className="whitespace-pre-line text-sm text-neutral-700">{business.payment_details}</p>
          </div>
        )}
        {invoice.notes && (
          <div className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
            <p className="mb-1 font-semibold text-neutral-600">Notes</p>{invoice.notes}
          </div>
        )}
        <p className="mt-8 whitespace-pre-line text-center text-[10px] text-neutral-400">{business.footer || 'Thank you for your business.'}</p>
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
