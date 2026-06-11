import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fmtDate, fmtMoney, invoiceTotal } from '../format'
import { Brand, Button, Field, Input, Spinner, Textarea } from '../ui'

async function publicFetch(path, opts) {
  const res = await fetch(`/api/public${path}`, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong')
  return data
}

export default function PublicQuote() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [responding, setResponding] = useState(null) // 'approve' | 'decline'
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    document.documentElement.classList.add('dark')
    publicFetch(`/quote/${token}`).then(setData).catch((e) => setError(e.message))
  }, [token])

  const respond = (e) => {
    e.preventDefault()
    publicFetch(`/quote/${token}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: responding, name, comment }),
    }).then((r) => setDone(r.status)).catch((er) => setError(er.message))
  }

  if (error) return <Shell><p className="text-center text-fg/60">{error}</p></Shell>
  if (!data) return <Shell><Spinner /></Shell>
  const { quote, business, currency, client_name } = data
  const responded = done || (quote.status === 'approved' || quote.status === 'declined' ? quote.status : '')

  return (
    <Shell business={business}>
      <div className="rounded-2xl border border-line bg-card p-6 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-copper">Quote {quote.number}</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">{quote.title || 'Your proposal'}</h1>
            {client_name && <p className="mt-1 text-sm text-fg/55">Prepared for {client_name}</p>}
          </div>
          {quote.valid_until && <p className="shrink-0 text-xs text-fg/45">Valid until<br /><span className="font-medium text-fg/70">{fmtDate(quote.valid_until)}</span></p>}
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line/60">
            {(quote.items || []).map((it, i) => (
              <tr key={i}>
                <td className="py-2.5 pr-2">{it.description}</td>
                <td className="py-2.5 pr-2 text-right text-fg/55">{it.qty} × {fmtMoney(it.unit_price, currency)}</td>
                <td className="py-2.5 text-right font-medium">{fmtMoney((Number(it.qty) || 0) * (Number(it.unit_price) || 0), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex justify-end border-t border-line pt-3">
          <div className="text-right">
            {Number(quote.discount) > 0 && <p className="text-xs text-fg/50">Discount −{fmtMoney(quote.discount, currency)}</p>}
            {Number(quote.tax_rate) > 0 && <p className="text-xs text-fg/50">Incl. tax {quote.tax_rate}%</p>}
            <p className="font-display text-2xl font-semibold text-copper">{fmtMoney(invoiceTotal(quote), currency)}</p>
          </div>
        </div>
        {quote.notes && <p className="mt-4 rounded-lg bg-parchment/60 px-3 py-2 text-sm text-fg/70">{quote.notes}</p>}

        {responded ? (
          <div className="mt-6 rounded-xl border border-copper/40 bg-copper/10 p-4 text-center">
            <p className="font-display text-lg font-semibold">
              {responded === 'approved' ? 'Approved — thank you! 🥂' : 'You declined this quote.'}
            </p>
            <p className="mt-1 text-sm text-fg/60">{business} has been notified{responded === 'approved' ? ' and will be in touch to confirm details.' : '.'}</p>
          </div>
        ) : responding ? (
          <form onSubmit={respond} className="mt-6 space-y-3 rounded-xl border border-line bg-parchment/40 p-4">
            <p className="text-sm font-medium">{responding === 'approve' ? 'Brilliant — confirm your approval:' : 'Sorry to hear — confirm below:'}</p>
            <Field label="Your name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Comment (optional)"><Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setResponding(null)}>Back</Button>
              <Button variant={responding === 'approve' ? 'primary' : 'danger'}>
                {responding === 'approve' ? 'Approve quote' : 'Decline quote'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-6 flex gap-3">
            <Button className="flex-1" size="lg" icon="check" onClick={() => setResponding('approve')}>Approve</Button>
            <Button className="flex-1" size="lg" variant="secondary" onClick={() => setResponding('decline')}>Decline</Button>
          </div>
        )}
      </div>
    </Shell>
  )
}

function Shell({ business, children }) {
  return (
    <div className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Brand />
          {business && <p className="text-sm text-fg/50">on behalf of <span className="font-medium text-fg/75">{business}</span></p>}
        </div>
        {children}
      </div>
    </div>
  )
}
