import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtDate, fmtMoney, INVOICE_STATUSES, INVOICE_TONES, invoiceTotal, todayISO, uid } from '../format'
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, Spinner, StatCard, Tabs, Textarea, toastErr } from '../ui'
import { QuotesPanel } from './Quotes'
import { ChargesMenu } from '../charges'

/* ------------------------------ invoice editor ------------------------------ */
export function InvoiceEditorModal({ open, onClose, onSaved, initial = null, bookingId = null, clientId = null, currency = 'GBP' }) {
  const { user } = useAuth()
  const blank = {
    number: '', status: 'draft', issue_date: todayISO(), due_date: '', paid_date: '',
    items: [], tax_rate: 0, discount: 0, notes: '',
  }
  const [form, setForm] = useState(blank)
  const [clients, setClients] = useState([])

  useEffect(() => {
    if (!open) return
    api.get('/clients').then(setClients).catch(() => {})
    if (initial) setForm({ ...blank, ...initial })
    else {
      api.get('/finance/next-invoice-number')
        .then(({ number }) => setForm({ ...blank, number, client_id: clientId }))
        .catch(() => setForm({ ...blank, client_id: clientId }))
    }
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const items = form.items || []
  const setItem = (i, key, value) => setForm({ ...form, items: items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)) })
  const total = invoiceTotal(form)

  const save = (e) => {
    e.preventDefault()
    const payload = {
      ...form, tax_rate: Number(form.tax_rate) || 0, discount: Number(form.discount) || 0,
      client_id: form.client_id ? Number(form.client_id) : null,
      booking_id: initial?.booking_id ?? bookingId,
      items: items.map((it) => ({ ...it, qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0 })),
    }
    const req = initial?.id ? api.patch(`/invoices/${initial.id}`, payload) : api.post('/invoices', payload)
    req.then(onSaved).catch(toastErr)
  }
  const remove = () => {
    if (initial?.id && window.confirm('Delete this invoice?')) api.del(`/invoices/${initial.id}`).then(onSaved).catch(toastErr)
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? `Edit ${initial.number || 'invoice'}` : 'New invoice'} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Number"><Input value={form.number} onChange={set('number')} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Issued"><Input type="date" value={form.issue_date} onChange={set('issue_date')} /></Field>
          <Field label="Due"><Input type="date" value={form.due_date} onChange={set('due_date')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client">
            <Select value={form.client_id || ''} onChange={set('client_id')}>
              <option value="">— None —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {form.status === 'paid' && <Field label="Paid on"><Input type="date" value={form.paid_date || ''} onChange={set('paid_date')} /></Field>}
        </div>

        <div>
          <p className="label">Line items</p>
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={it.id || i} className="grid grid-cols-12 gap-1.5">
                <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                <Input className="col-span-2" type="number" step="any" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                <Input className="col-span-3" type="number" step="0.01" placeholder="Unit price" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                <IconButton icon="trash" label="Remove line" className="col-span-1 justify-self-center self-center"
                  onClick={() => setForm({ ...form, items: items.filter((_, idx) => idx !== i) })} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" icon="plus"
              onClick={() => setForm({ ...form, items: [...items, { id: uid(), description: '', qty: 1, unit_price: 0 }] })}>
              Add line
            </Button>
            <ChargesMenu saved={user?.service_charges || []} className="w-auto"
              onAdd={(line) => setForm({ ...form, items: [...items, line] })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Tax rate %"><Input type="number" step="0.1" value={form.tax_rate} onChange={set('tax_rate')} /></Field>
          <Field label="Discount"><Input type="number" step="0.01" value={form.discount} onChange={set('discount')} /></Field>
          <div className="self-end rounded-lg bg-ink px-4 py-2 text-right text-cream">
            <p className="text-[10px] uppercase tracking-wider text-cream/50">Total</p>
            <p className="font-display text-lg font-semibold">{fmtMoney(total, currency)}</p>
          </div>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Payment terms, bank details…" /></Field>
        <div className="flex justify-between gap-2">
          {initial?.id ? <Button type="button" variant="danger" icon="trash" onClick={remove}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button>{initial?.id ? 'Save invoice' : 'Create invoice'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------ expense modal ------------------------------- */
export function ExpenseFormModal({ open, onClose, onSaved, initial = null, bookingId = null }) {
  const blank = { category: 'Ingredients', description: '', amount: '', date: todayISO(), supplier: '', receipt_url: '' }
  const [form, setForm] = useState(blank)
  useEffect(() => { if (open) setForm(initial ? { ...blank, ...initial } : blank) }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = (e) => {
    e.preventDefault()
    const payload = { ...form, amount: Number(form.amount) || 0, booking_id: initial?.booking_id ?? bookingId }
    const req = initial?.id ? api.patch(`/expenses/${initial.id}`, payload) : api.post('/expenses', payload)
    req.then(onSaved).catch(toastErr)
  }
  const remove = () => {
    if (initial?.id && window.confirm('Delete this expense?')) api.del(`/expenses/${initial.id}`).then(onSaved).catch(toastErr)
  }
  const uploadReceipt = (e) => {
    const file = e.target.files?.[0]
    if (file) api.upload(file).then(({ url }) => setForm((f) => ({ ...f, receipt_url: url }))).catch(toastErr)
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit expense' : 'Log an expense'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Description"><Input value={form.description} onChange={set('description')} placeholder="New Covent Garden produce" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount"><Input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} required /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={set('date')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              {['Ingredients', 'Equipment', 'Travel', 'Staff', 'Kitchen', 'Marketing', 'Insurance', 'Other'].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Supplier"><Input value={form.supplier} onChange={set('supplier')} /></Field>
        </div>
        <Field label="Receipt" hint={form.receipt_url ? 'Receipt attached ✓' : 'Photo or PDF up to 10MB'}>
          <input type="file" accept="image/*,.pdf" onChange={uploadReceipt} className="block w-full text-sm text-fg/60 file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-xs file:font-medium file:text-cream" />
        </Field>
        <div className="flex justify-between gap-2">
          {initial?.id ? <Button type="button" variant="danger" icon="trash" onClick={remove}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button>{initial?.id ? 'Save' : 'Log expense'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* -------------------------------- mini chart -------------------------------- */
function MonthlyChart({ monthly, currency }) {
  const max = Math.max(...monthly.map((m) => Math.max(m.paid, m.expenses, m.invoiced)), 1)
  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5">
        {monthly.map((m, i) => (
          <div key={i} className="group relative flex flex-1 items-end justify-center gap-0.5">
            <div className="w-1/3 rounded-t bg-sage/80" style={{ height: `${(m.paid / max) * 100}%` }} />
            <div className="w-1/3 rounded-t bg-copper/30" style={{ height: `${(m.invoiced / max) * 100}%` }} />
            <div className="w-1/3 rounded-t bg-red-300" style={{ height: `${(m.expenses / max) * 100}%` }} />
            <div className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded bg-ink px-2 py-1 text-[10px] text-cream group-hover:block">
              paid {fmtMoney(m.paid, currency)} · inv {fmtMoney(m.invoiced, currency)} · exp {fmtMoney(m.expenses, currency)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {MONTHS.map((m, i) => <span key={i} className="flex-1 text-center text-[10px] text-fg/40">{m}</span>)}
      </div>
      <div className="mt-2 flex justify-center gap-4 text-[11px] text-fg/55">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sage/80" />Paid</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-copper/30" />Invoiced</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-300" />Expenses</span>
      </div>
    </div>
  )
}

/* ----------------------------------- page ----------------------------------- */
export default function Finance() {
  const { user } = useAuth()
  const cur = user?.currency || 'GBP'
  const [tab, setTab] = useState('overview')
  const [summary, setSummary] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [invoiceModal, setInvoiceModal] = useState({ open: false, initial: null })
  const [expenseModal, setExpenseModal] = useState({ open: false, initial: null })

  const load = () => {
    api.get('/finance/summary').then(setSummary).catch(toastErr)
    api.get('/invoices').then(setInvoices).catch(toastErr)
    api.get('/expenses').then(setExpenses).catch(toastErr)
  }
  useEffect(load, [])
  if (!summary) return <Spinner />

  return (
    <div>
      <PageHeader title="Finance" sub="Quotes approved, invoices out, expenses in — profit visible."
        actions={
          <>
            <Button variant="secondary" icon="plus" onClick={() => setExpenseModal({ open: true, initial: null })}>Expense</Button>
            <Button icon="plus" onClick={() => setInvoiceModal({ open: true, initial: null })}>Invoice</Button>
          </>
        } />

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'quotes', label: 'Quotes' },
        { id: 'invoices', label: 'Invoices', count: invoices.length },
        { id: 'expenses', label: 'Expenses', count: expenses.length },
      ]} />

      {tab === 'quotes' && <QuotesPanel locked={user?.role !== 'admin' && (user?.plan_level ?? 1) < 3} />}

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Paid (all time)" value={fmtMoney(summary.totals.paid, cur)} tone="sage" icon="coins" />
            <StatCard label="Outstanding" value={fmtMoney(summary.totals.outstanding, cur)} tone={summary.totals.outstanding ? 'copper' : 'ink'} icon="clock" />
            <StatCard label="Expenses" value={fmtMoney(summary.totals.expenses, cur)} icon="cart" />
            <StatCard label="Profit" value={fmtMoney(summary.totals.profit, cur)} tone={summary.totals.profit >= 0 ? 'sage' : 'red'} icon="flame" />
          </div>
          <Card title={`Monthly view — ${summary.year}`}>
            <MonthlyChart monthly={summary.monthly} currency={cur} />
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Awaiting payment" pad={false}>
              {summary.open_invoices.length === 0 ? <p className="p-5 text-sm text-fg/45">Nothing outstanding. 🎉</p> : (
                <ul className="divide-y divide-line/70">
                  {summary.open_invoices.map((inv) => (
                    <li key={inv.id} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-parchment/40"
                      onClick={() => setInvoiceModal({ open: true, initial: inv })}>
                      <div><p className="text-sm font-medium">{inv.number}</p><p className="text-xs text-fg/45">due {fmtDate(inv.due_date)}</p></div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{fmtMoney(inv.total, cur)}</span>
                        <Badge tone={INVOICE_TONES[inv.status]}>{inv.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Spend by category" pad={false}>
              {summary.by_category.length === 0 ? <p className="p-5 text-sm text-fg/45">No expenses logged yet.</p> : (
                <ul className="divide-y divide-line/70">
                  {summary.by_category.map((c) => (
                    <li key={c.category} className="px-4 py-2.5">
                      <div className="mb-1 flex justify-between text-sm"><span>{c.category}</span><span className="font-medium">{fmtMoney(c.amount, cur)}</span></div>
                      <div className="h-1.5 rounded-full bg-fg/8">
                        <div className="h-full rounded-full bg-copper/60" style={{ width: `${(c.amount / (summary.by_category[0]?.amount || 1)) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        invoices.length === 0 ? <EmptyState icon="coins" title="No invoices yet" action={<Button icon="plus" onClick={() => setInvoiceModal({ open: true, initial: null })}>New invoice</Button>} /> : (
          <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" icon="down" onClick={() => api.download('/finance/export/invoices.csv', 'creatiste-invoices.csv').catch(toastErr)}>Export CSV</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-fg/45">
                <th className="px-4 py-2.5">Number</th><th className="px-4 py-2.5">Issued</th><th className="hidden px-4 py-2.5 sm:table-cell">Due</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-line/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="cursor-pointer hover:bg-parchment/40" onClick={() => setInvoiceModal({ open: true, initial: inv })}>
                    <td className="px-4 py-3 font-medium">{inv.number || `#${inv.id}`}</td>
                    <td className="px-4 py-3 text-fg/60">{fmtDate(inv.issue_date)}</td>
                    <td className="hidden px-4 py-3 text-fg/60 sm:table-cell">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtMoney(invoiceTotal(inv), cur)}</td>
                    <td className="px-4 py-3"><Badge tone={INVOICE_TONES[inv.status]}>{inv.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )
      )}

      {tab === 'expenses' && (
        expenses.length === 0 ? <EmptyState icon="cart" title="No expenses logged" action={<Button icon="plus" onClick={() => setExpenseModal({ open: true, initial: null })}>Log expense</Button>} /> : (
          <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" icon="down" onClick={() => api.download('/finance/export/expenses.csv', 'creatiste-expenses.csv').catch(toastErr)}>Export CSV</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-fg/45">
                <th className="px-4 py-2.5">Description</th><th className="hidden px-4 py-2.5 sm:table-cell">Category</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5 text-right">Amount</th>
              </tr></thead>
              <tbody className="divide-y divide-line/60">
                {expenses.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-parchment/40" onClick={() => setExpenseModal({ open: true, initial: e })}>
                    <td className="px-4 py-3 font-medium">{e.description}{e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="ml-2 text-copper underline">receipt</a>}</td>
                    <td className="hidden px-4 py-3 text-fg/60 sm:table-cell">{e.category}</td>
                    <td className="px-4 py-3 text-fg/60">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtMoney(e.amount, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )
      )}

      <InvoiceEditorModal open={invoiceModal.open} initial={invoiceModal.initial} currency={cur}
        onClose={() => setInvoiceModal({ open: false, initial: null })}
        onSaved={() => { setInvoiceModal({ open: false, initial: null }); load() }} />
      <ExpenseFormModal open={expenseModal.open} initial={expenseModal.initial}
        onClose={() => setExpenseModal({ open: false, initial: null })}
        onSaved={() => { setExpenseModal({ open: false, initial: null }); load() }} />
    </div>
  )
}
