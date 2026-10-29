import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fmtDate, fmtMoney, invoiceTotal, todayISO } from '../format'

const GOLD = '#BFA987'

async function pub(path) {
  const res = await fetch(`/api/public${path}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong')
  return data
}

/* A clean, white, print-perfect invoice document (portrait) — the client's view and the
   chef's "save as PDF". Self-contained colours so it's identical regardless of app theme. */
export default function PublicInvoice({ receipt = false }) {
  const { token } = useParams()
  const [params] = useSearchParams()
  const preview = receipt && params.get('preview') === '1' // the chef looking before marking paid
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
  const paidOn = invoice.status === 'paid' && invoice.paid_date ? invoice.paid_date : todayISO()
  // Deposit terms (per invoice): show deposit due + balance when set.
  const dep = invoice.deposit_type === 'percent'
    ? Math.max(0, total * (Number(invoice.deposit_value) || 0) / 100)
    : invoice.deposit_type === 'amount' ? Math.min(Number(invoice.deposit_value) || 0, total) : 0
  // Payment bar: the chef's bank presets on one line, plus an optional "pay online" link.
  const bank = business.bank || {}
  const bankParts = [bank.account_name, bank.bank_name,
    bank.sort_code && `Sort code ${bank.sort_code}`,
    bank.account_number && `Acc ${bank.account_number}`].filter(Boolean)
  const payLink = business.payment_link
    ? (/^https?:\/\//i.test(business.payment_link) ? business.payment_link : `https://${business.payment_link}`)
    : ''
  const hasPay = bankParts.length > 0 || payLink || business.payment_details

  return (
    <Wrap>
      <div className="mx-auto mb-4 flex max-w-2xl justify-end print:hidden">
        <button onClick={() => window.print()} style={{ background: accent }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow">Download / Print</button>
      </div>
      <div className="relative mx-auto max-w-2xl bg-white p-8 text-neutral-800 shadow-lg print:max-w-none print:p-0 print:shadow-none" data-doc-kind={receipt ? 'receipt' : 'invoice'}>
        {preview && <p className="absolute right-4 top-4 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 print:hidden" data-preview-ribbon>Preview · not yet paid</p>}
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
            <p className="font-display text-2xl font-bold tracking-wide" style={{ color: accent }}>{receipt ? 'RECEIPT' : 'INVOICE'}</p>
            <p className="text-sm font-medium">{receipt ? `For invoice ${invoice.number}` : invoice.number}</p>
            {receipt
              ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#2e7d32' }}>Paid in full</p>
              : <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: statusColor }}>{invoice.status}</p>}
          </div>
        </div>

        {receipt && (
          <div className="mt-5 grid gap-3 rounded-lg px-5 py-4 sm:grid-cols-3" style={{ background: `${accent}14`, border: `1px solid ${accent}` }} data-receipt-summary>
            <div><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Amount paid</p><p className="font-display text-2xl font-bold" style={{ color: accent }}>{fmtMoney(total, currency)}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Paid on</p><p className="text-sm font-medium">{fmtDate(paidOn)}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Received by</p><p className="text-sm font-medium">{business.name}</p></div>
          </div>
        )}

        <div className="mt-5 flex justify-between gap-4 text-sm">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{receipt ? 'Received from' : 'Bill to'}</p>
            <p className="font-medium">{client.name || '—'}</p>
            {client.company && <p className="text-neutral-500">{client.company}</p>}
            {client.email && <p className="text-neutral-500">{client.email}</p>}
          </div>
          <div className="space-y-0.5 text-right">
            {invoice.issue_date && <p><span className="text-neutral-400">Issued&nbsp;</span>{fmtDate(invoice.issue_date)}</p>}
            {!receipt && invoice.due_date && <p><span className="text-neutral-400">Due&nbsp;</span>{fmtDate(invoice.due_date)}</p>}
            {(receipt || (invoice.status === 'paid' && invoice.paid_date)) && <p><span className="text-neutral-400">Paid&nbsp;</span>{fmtDate(paidOn)}</p>}
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
                <td className="py-2.5 pr-2">{it.description}{it.receipt_url && <a href={it.receipt_url} target="_blank" rel="noreferrer" className="ml-2 whitespace-nowrap text-xs font-semibold underline" style={{ color: accent }} data-view-receipt>View receipt</a>}</td>
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
            {Number(invoice.discount) > 0 && <Row label="Discount" value={`−${fmtMoney(invoice.discount, currency)}`} />}
            {Number(invoice.tax_rate) > 0 && <Row label={`${business.tax_label || 'Tax'} (${invoice.tax_rate}%)`} value={fmtMoney(taxAmt, currency)} />}
            <div className="mt-1 flex justify-between border-t pt-2 font-display text-lg font-bold" style={{ borderColor: accent }}>
              <span>{receipt ? 'Total paid' : 'Total'}</span><span style={{ color: accent }}>{fmtMoney(total, currency)}</span>
            </div>
            {!receipt && dep > 0 && (
              <div className="mt-2 border-t border-neutral-100 pt-2">
                <Row label={`Deposit due${invoice.deposit_type === 'percent' ? ` (${Number(invoice.deposit_value)}%)` : ''}`} value={fmtMoney(dep, currency)} />
                <div className="flex justify-between py-0.5 font-semibold text-neutral-800"><span>Balance due</span><span>{fmtMoney(total - dep, currency)}</span></div>
              </div>
            )}
          </div>
        </div>

        {!receipt && hasPay && (
          <div className="mt-6 rounded-lg border px-4 py-2.5 text-sm" style={{ borderColor: accent, background: `${accent}10` }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Payment</span>
              {bankParts.length > 0 && <span className="text-neutral-700">{bankParts.join('  ·  ')}</span>}
              {payLink && <a href={payLink} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: accent }}>{business.payment_link_label || 'Pay online'}</a>}
            </div>
            {business.payment_details && <p className="mt-1 whitespace-pre-line text-xs text-neutral-500">{business.payment_details}</p>}
          </div>
        )}
        {invoice.notes && (
          <div className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
            <p className="mb-1 font-semibold text-neutral-600">Notes</p>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
        {receipt && <p className="mt-6 text-center text-sm font-medium text-neutral-700">Payment received with thanks. This document is your receipt.</p>}
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
