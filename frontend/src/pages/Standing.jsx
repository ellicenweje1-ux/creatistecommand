import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAssistantChanged } from '../assistant'
import { useAuth } from '../auth'
import { cls, fmtMoney, todayISO } from '../format'
import { Badge, Button, ComboInput, Icon, Input, Modal, PageHeader, SearchInput, Spinner, Textarea, toast, toastErr } from '../ui'
import { HoldsStrip } from './Bookings'
import { InvoiceEditorModal } from './Finance'

/* Paid & booked: where every client stands. For each client: the dates they have, what they have paid and still owe,
   and (in amber) anything that does not match yet, each with a one-tap fix:
     paid, but no date        -> add the date (or dates) / no date needed
     a date, but no invoice   -> make the invoice / no invoice needed
     sent, not paid           -> mark paid (with or without a receipt)
     a request / a deposit    -> answered in the strip at the top
   "Send update" writes the client a plain summary to send by WhatsApp or email.
   The findings come from GET /api/standing, the same ones Today and the assistant use. */

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (iso) => { const d = new Date(`${iso}T00:00:00`); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` }
const days = (list) => list.map(day).join(', ')
const STATE = {
  requested: ['amber', 'asked for'], deposit_owed: ['amber', 'deposit owed'], pencilled: ['gray', 'pencilled in'],
  booked: ['sage', 'booked'], done: ['gray', 'done'], lapsed: ['red', 'lapsed'],
}
const INV_TONE = { draft: 'gray', sent: 'amber', overdue: 'red', paid: 'sage' }
const waNumber = (phone) => { const n = (phone || '').replace(/\D/g, ''); return n.startsWith('0') ? `44${n.slice(1)}` : n }

/* Give an invoice its day (or days): the job lands in the diary and the mismatch is gone. */
function DateFix({ f, services, onDone, onOpen }) {
  const [list, setList] = useState([''])
  const [svc, setSvc] = useState(f.service || '')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const picked = [...new Set(list.filter(Boolean))].sort()
    if (!picked.length) return toast('Pick the day first')
    setBusy(true)
    try {
      await api.patch(`/invoices/${f.invoice_id}`, { service_date: picked[0], service_days: picked.length > 1 ? picked : [], service_type: svc.trim() })
      const r = await api.post(`/invoices/${f.invoice_id}/sync-booking`)
      if (r.ok) toast(picked.length > 1 ? `${picked.length} dates are in your diary now` : 'In your diary now', 'sage')
      else toast(r.reason || 'That could not go in the diary', 'red')
      onDone()
    } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const settle = async () => {
    try { await api.post('/standing/settle', { invoice_ids: [f.invoice_id] }); toast('Taken off the list'); onDone() } catch (e) { toastErr(e) }
  }
  return (
    <div className="mt-2 space-y-2" data-date-fix>
      <div className="flex flex-wrap items-end gap-2">
        {list.map((d, i) => (
          <label key={i} className="block">
            <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wider text-fg/45">{i === 0 ? 'Which day?' : `Day ${i + 1}`}</span>
            <Input type="date" className="!w-[10.5rem]" value={d} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} data-fix-date />
          </label>
        ))}
        {list.length < 7 ? <Button size="sm" variant="ghost" icon="plus" onClick={() => setList([...list, ''])} data-fix-another>Another day</Button> : null}
        <label className="block min-w-[11rem] flex-1">
          <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wider text-fg/45">What for?</span>
          <ComboInput value={svc} onChange={(e) => setSvc(e.target.value)} options={services} placeholder="Service" data-fix-service />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={busy} data-fix-save>Add to my diary</Button>
        <Button size="sm" variant="secondary" onClick={settle} data-fix-nodate>Already done / no date needed</Button>
        <Button size="sm" variant="ghost" onClick={() => onOpen(f.invoice_id)}>Open invoice</Button>
      </div>
    </div>
  )
}

function Flag({ f, services, actions }) {
  const fix = f.level === 'fix'
  const toStrip = () => document.querySelector('[data-holds-strip]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className={cls('rounded-lg border px-3 py-2.5', fix ? 'border-amber-500/50 bg-amber-500/[0.06]' : 'border-line bg-parchment/50')} data-flag={f.kind} data-level={f.level}>
      <p className="flex items-start gap-2 text-sm"><Icon name={fix ? 'alert' : 'clock'} size={15} className={cls('mt-0.5 shrink-0', fix ? 'text-amber-600 dark:text-amber-400' : 'text-fg/40')} /><span>{f.text}</span></p>
      {f.kind === 'paid_no_date' || f.kind === 'unpaid_no_date' ? <DateFix f={f} services={services} onDone={actions.reload} onOpen={actions.openInvoice} /> : (
        <div className="mt-2 flex flex-wrap gap-2 pl-[23px]">
          {f.kind === 'no_invoice' ? (
            <>
              <Button size="sm" onClick={() => actions.makeInvoice(f.booking_id)} data-fix-invoice>Make the invoice</Button>
              <Button size="sm" variant="secondary" onClick={() => actions.settleBooking(f.booking_id)} data-fix-noinvoice>No invoice needed</Button>
            </>
          ) : null}
          {f.kind === 'unpaid' ? (
            <>
              <Button size="sm" onClick={() => actions.markPaid(f.invoice_id)} data-fix-paid>Mark paid</Button>
              <Button size="sm" variant="secondary" onClick={() => actions.receipt(f.invoice_id)}>Paid, and send a receipt</Button>
              <Button size="sm" variant="ghost" onClick={() => actions.openInvoice(f.invoice_id)}>Open invoice</Button>
            </>
          ) : null}
          {f.kind === 'double_invoice' ? (
            <>
              <Button size="sm" onClick={() => actions.openInvoice(f.invoice_id)} data-fix-open>Open this one</Button>
              <Button size="sm" variant="secondary" onClick={() => actions.openInvoice(f.other_invoice_id)}>Open the other</Button>
            </>
          ) : null}
          {f.kind === 'double' ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => actions.openJob(f.booking_id)} data-fix-open>Open it</Button>
              {!f.invoiced ? <Button size="sm" onClick={() => actions.removeEntry(f.booking_id)} data-fix-remove>Remove the extra entry</Button> : null}
            </>
          ) : null}
          {['draft', 'deposit_unused', 'no_client'].includes(f.kind) ? <Button size="sm" variant={fix ? 'primary' : 'secondary'} onClick={() => actions.openInvoice(f.invoice_id)} data-fix-open>Open the invoice</Button> : null}
          {['request', 'deposit_owed', 'lapsed'].includes(f.kind) ? <Button size="sm" variant={fix ? 'primary' : 'secondary'} onClick={toStrip} data-fix-answer>{f.kind === 'request' ? 'Answer it' : f.kind === 'lapsed' ? 'Decide' : 'Deposit received?'}</Button> : null}
        </div>
      )}
    </div>
  )
}

function ClientCard({ r, cur, services, actions, onUpdate }) {
  const navigate = useNavigate()
  return (
    <article className={cls('rounded-xl border bg-card', r.fix ? 'border-amber-500/40' : 'border-line')} data-client={r.name}>
      <header className="flex flex-wrap items-center gap-2 px-4 pt-3.5">
        <h3 className="font-display text-[17px] font-semibold">{r.name}</h3>
        {r.fix ? <Badge tone="amber">{r.fix} to sort out</Badge> : r.watch ? <Badge tone="gray">nothing urgent</Badge> : <Badge tone="sage">all matched</Badge>}
        {r.client_id ? <Button size="sm" variant="secondary" icon="mail" className="ml-auto" onClick={() => onUpdate(r)} data-send-update>Send update</Button> : null}
      </header>
      {r.flags.length ? <div className="space-y-2 px-4 pt-3">{r.flags.map((f, i) => <Flag key={i} f={f} services={services} actions={actions} />)}</div> : null}
      <div className="grid gap-4 px-4 pb-4 pt-3.5 sm:grid-cols-2">
        <div data-dates>
          <p className="label">Dates</p>
          {r.dates.length ? (
            <ul className="space-y-1.5">
              {r.dates.map((d) => (
                <li key={d.booking_id} className={cls('text-sm', d.past && 'text-fg/55')}>
                  <button type="button" className="text-left font-medium hover:text-copper" onClick={() => navigate(`/app/calendar?job=${d.booking_id}`)}>{days(d.days)}</button>
                  <span className="text-fg/60"> · {d.service}</span>{' '}
                  <Badge tone={STATE[d.state]?.[0] || 'gray'}>{STATE[d.state]?.[1] || d.state}</Badge>{' '}
                  {d.invoices.length ? d.invoices.map((i) => <Badge key={i.id} tone={INV_TONE[i.status] || 'gray'} className="!normal-case">{i.number || 'invoice'} {i.status}</Badge>)
                    : d.no_invoice ? <button type="button" className="text-xs text-fg/45 underline" onClick={() => actions.settleBooking(d.booking_id, true)}>no invoice needed · undo</button>
                      : ['requested', 'lapsed'].includes(d.state) ? null : <span className="text-xs text-fg/45">no invoice</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-fg/50">No dates in the diary.</p>}
        </div>
        <div data-money>
          <p className="label">Money</p>
          <p className="text-sm"><span className="font-medium">{fmtMoney(r.paid_total, cur)}</span> <span className="text-fg/60">paid</span>
            {r.owed_total ? <> · <span className="font-medium">{fmtMoney(r.owed_total, cur)}</span> <span className="text-fg/60">to pay</span></> : null}</p>
          {r.invoices.length ? (
            <ul className="mt-1.5 space-y-1">
              {r.invoices.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <button type="button" className="font-medium hover:text-copper" onClick={() => actions.openInvoice(i.id)}>{i.number || 'Invoice'}</button>
                  <Badge tone={INV_TONE[i.status] || 'gray'}>{i.status}</Badge>
                  <span>{fmtMoney(i.total, cur)}</span>
                  <span className="text-xs text-fg/50">{i.service_days.length ? `for ${days(i.service_days)}` : i.no_date ? 'no date needed' : 'no date'}</span>
                  {i.no_date && !i.has_date ? <button type="button" className="text-xs text-fg/45 underline" onClick={() => actions.settleInvoice(i.id, true)}>undo</button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-fg/50">No invoices lately.</p>}
        </div>
      </div>
    </article>
  )
}

function UpdateBody({ row }) {
  const [text, setText] = useState(row.message || '')
  const first = row.name?.split(' ')[0] || 'them'
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into WhatsApp or a text.', 'sage') } catch { toast('Press and hold the message to copy it') }
  }
  return (
    <>
      <p className="text-sm text-fg/60">Where {first} stands, in plain words. Change anything you like. Nothing is sent until you send it.</p>
      <Textarea rows={13} className="mt-3 text-[15px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} data-update-text />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button icon="copy" onClick={copy} data-update-copy>Copy</Button>
        {row.phone ? <Button variant="secondary" icon="phone" onClick={() => window.open(`https://wa.me/${waNumber(row.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')} data-update-whatsapp>Open in WhatsApp</Button> : null}
        {row.email ? <Button variant="secondary" icon="mail" onClick={() => { window.location.href = `mailto:${row.email}?subject=${encodeURIComponent('Your dates and payments')}&body=${encodeURIComponent(text)}` }}>Open in email</Button> : null}
      </div>
    </>
  )
}

function UpdateModal({ row, onClose }) {
  return (
    <Modal open={!!row} onClose={onClose} title={`Update for ${row?.name?.split(' ')[0] || 'them'}`}>
      {row ? <UpdateBody key={row.client_id} row={row} /> : null}
    </Modal>
  )
}

export default function Standing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const cur = user?.currency || 'GBP'
  const [data, setData] = useState(null)
  const [holds, setHolds] = useState([])
  const [services, setServices] = useState([])
  const [view, setView] = useState('')        // '' = decide from the data, 'sort' | 'all'
  const [q, setQ] = useState('')
  const [invoice, setInvoice] = useState(null)
  const [update, setUpdate] = useState(null)
  const load = () => {
    api.get('/standing').then(setData).catch(toastErr)
    api.get('/holds').then(setHolds).catch(() => setHolds([]))
  }
  useEffect(() => { load(); api.get('/jobs/setup').then((s) => setServices((s.services || []).map((x) => x.name))).catch(() => {}) }, [])
  useAssistantChanged(load)
  if (!data) return <Spinner />

  const jobInvoice = async (bookingId, msg) => {
    try {
      const j = await api.get(`/jobs/${bookingId}`)
      if (msg) toast(msg, 'sage')
      setInvoice({ bookingId: j.id, clientId: j.client?.id || null,
        prefill: { service_date: j.date, service_type: j.service, service_time: j.start_time || '', service_package: j.package || '', service_days: j.days.length > 1 ? j.days : [] } })
    } catch (e) { toastErr(e) }
  }
  const actions = {
    reload: load,
    openInvoice: async (id) => { try { setInvoice({ initial: await api.get(`/invoices/${id}`) }) } catch (e) { toastErr(e) } },
    makeInvoice: (bookingId) => jobInvoice(bookingId),
    markPaid: async (id) => {
      try {
        await api.patch(`/invoices/${id}`, { status: 'paid', paid_date: todayISO() })
        await api.post(`/invoices/${id}/sync-booking`).catch(() => {})
        toast('Marked paid. Nothing was sent to them.', 'sage'); load()
      } catch (e) { toastErr(e) }
    },
    receipt: (id) => navigate(`/app/finance?tab=invoices&receipt=${id}`),
    openJob: (id) => navigate(`/app/calendar?job=${id}`),
    removeEntry: async (id) => {
      if (!window.confirm('Remove this extra entry from your diary? The other one stays.')) return
      try { await api.patch(`/bookings/${id}`, { status: 'cancelled' }); toast('Removed. The other entry stays in your diary.', 'sage'); load() } catch (e) { toastErr(e) }
    },
    settleInvoice: async (id, undo = false) => { try { await api.post('/standing/settle', { invoice_ids: [id], undo }); load() } catch (e) { toastErr(e) } },
    settleBooking: async (id, undo = false) => { try { await api.post('/standing/settle', { booking_ids: [id], undo }); if (!undo) toast('Taken off the list'); load() } catch (e) { toastErr(e) } },
  }

  const c = data.counts
  const mode = view || (c.fix + c.watch ? 'sort' : 'all')
  const needle = q.trim().toLowerCase()
  const rows = data.clients.filter((r) => (mode === 'all' || r.fix || r.watch) && (!needle || r.name.toLowerCase().includes(needle)))
  const tabs = [['sort', `Needs a look (${data.clients.filter((r) => r.fix || r.watch).length})`], ['all', `Everyone (${c.clients})`]]

  return (
    <div data-standing>
      <PageHeader title="Paid & booked" sub="Every client: the dates they have, what they’ve paid, and anything that doesn’t match yet." />

      <HoldsStrip holds={holds} currency={cur} onChanged={load} onPaid={(h) => jobInvoice(h.id, 'Deposit in. Here is their invoice: take the deposit off with one tap.')} />

      {data.tidied?.length ? (
        <div className="mb-4 rounded-xl border border-sage/40 bg-sage/[0.06] px-4 py-3" data-tidied>
          <p className="flex items-center gap-2 text-sm font-semibold"><Icon name="check" size={15} className="text-sage" />Tidied up for you</p>
          <ul className="mt-1.5 space-y-1 pl-[23px] text-sm text-fg/75">
            {data.tidied.slice(0, 6).map((t, i) => <li key={i}>{t.text}</li>)}
          </ul>
          {data.tidied.length > 6 ? <p className="mt-1 pl-[23px] text-xs text-fg/50">And {data.tidied.length - 6} more this week.</p> : null}
          <p className="mt-1.5 pl-[23px] text-xs text-fg/50">Doubles are joined automatically. Nothing was sent to anyone, and no invoice was changed.</p>
        </div>
      ) : null}

      {data.clashes?.length ? (
        <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/[0.06] px-4 py-3" data-clashes>
          <p className="flex items-center gap-2 text-sm font-semibold"><Icon name="alert" size={15} className="text-amber-600 dark:text-amber-400" />{data.clashes.length === 1 ? 'A day' : 'Days'} with more booked than fits</p>
          <ul className="mt-1.5 space-y-1 pl-[23px] text-sm text-fg/75">
            {data.clashes.map((c) => (
              <li key={c.date}><button type="button" className="font-medium text-fg hover:text-copper" onClick={() => navigate('/app/calendar')}>{day(c.date)}:</button> {c.who.join(', ')}</li>
            ))}
          </ul>
          <p className="mt-1.5 pl-[23px] text-xs text-fg/50">These are different clients on the same day, so only you can decide. Move one from the Calendar if it is too much.</p>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-3 gap-2" data-standing-counts>
        <div className={cls('rounded-xl border px-3 py-2.5', c.fix ? 'border-amber-500/50 bg-amber-500/[0.06]' : 'border-line bg-card')}>
          <p className="font-display text-2xl font-semibold" data-count-fix>{c.fix}</p><p className="text-xs text-fg/60">to sort out</p>
        </div>
        <div className="rounded-xl border border-line bg-card px-3 py-2.5">
          <p className="font-display text-2xl font-semibold">{c.watch}</p><p className="text-xs text-fg/60">nothing urgent</p>
        </div>
        <div className="rounded-xl border border-line bg-card px-3 py-2.5">
          <p className="font-display text-2xl font-semibold text-sage">{c.matched}</p><p className="text-xs text-fg/60">clients all matched</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-card p-0.5" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setView(id)} data-standing-tab={id}
              className={cls('rounded-md px-3 py-1.5 text-sm font-medium', mode === id ? 'bg-copper text-ink' : 'text-fg/60 hover:text-fg')}>{label}</button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Find a client…" className="min-w-[12rem] flex-1 sm:max-w-xs" />
      </div>

      {rows.length ? (
        <div className="space-y-3">{rows.map((r) => <ClientCard key={r.client_id} r={r} cur={cur} services={services} actions={actions} onUpdate={setUpdate} />)}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-fg/55" data-standing-empty>
          {needle ? 'No client by that name here.' : mode === 'sort' ? 'Nothing to sort out. Everyone who has paid has a date, and every date has its invoice.'
            : 'Nobody here yet. When you invoice a client or put a date in the diary, they appear here.'}
        </p>
      )}
      <p className="mt-5 text-xs text-fg/45">Amber means something doesn’t match. Fix it with one tap here, or just tell Mise: “Iva’s payment was for the 24th and 26th.”</p>

      <InvoiceEditorModal open={!!invoice} onClose={() => setInvoice(null)} onSaved={() => { setInvoice(null); load() }}
        initial={invoice?.initial || null} bookingId={invoice?.bookingId ?? null} clientId={invoice?.clientId ?? null}
        prefill={invoice?.prefill || null} currency={cur} />
      <UpdateModal row={update} onClose={() => setUpdate(null)} />
    </div>
  )
}
