import { useEffect, useState } from 'react'
import { api } from '../api'
import { fmtMoney, label } from '../format'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, SearchInput, Select, Spinner, StatCard, Tabs, Textarea, toast, toastErr } from '../ui'

const STATUS_TONE = { active: 'sage', trialing: 'copper', pending: 'amber', suspended: 'red', canceled: 'ink' }
const STATUSES = ['pending', 'trialing', 'active', 'suspended', 'canceled']

function ChefModal({ chef, onClose, onSaved, plans }) {
  const [form, setForm] = useState({})
  useEffect(() => { if (chef) setForm({ subscription_status: chef.subscription_status, plan: chef.plan, admin_notes: chef.admin_notes || '' }) }, [chef])
  if (!chef) return null
  const save = () => api.patch(`/admin/chefs/${chef.id}`, form).then(() => { toast('Chef updated', 'sage'); onSaved() }).catch(toastErr)
  const remove = () => {
    if (window.confirm(`Permanently delete ${chef.email} and ALL their data? This cannot be undone.`))
      api.del(`/admin/chefs/${chef.id}`).then(onSaved).catch(toastErr)
  }
  return (
    <Modal open={!!chef} onClose={onClose} title={chef.business_name || chef.name || chef.email}>
      <div className="space-y-4">
        <div className="rounded-lg bg-parchment/50 p-3 text-sm">
          <p><span className="text-ink/50">Email:</span> {chef.email}</p>
          <p><span className="text-ink/50">Joined:</span> {new Date(chef.created_at).toLocaleDateString()}</p>
          <p><span className="text-ink/50">Bookings:</span> {chef.bookings_count} · <span className="text-ink/50">Onboarding paid:</span> {chef.onboarding_paid ? 'yes' : 'no'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subscription status">
            <Select value={form.subscription_status || ''} onChange={(e) => setForm({ ...form, subscription_status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </Select>
          </Field>
          <Field label="Plan">
            <Select value={form.plan || ''} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="">—</option>
              {Object.keys(plans || {}).map((p) => <option key={p} value={p}>{plans[p].name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Admin notes"><Textarea rows={3} value={form.admin_notes} onChange={(e) => setForm({ ...form, admin_notes: e.target.value })} /></Field>
        <div className="flex justify-between">
          <Button variant="danger" icon="trash" onClick={remove}>Delete chef</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PlansEditor({ settings, onSaved }) {
  const [draft, setDraft] = useState(settings)
  useEffect(() => setDraft(settings), [settings])
  if (!draft) return null
  const setPlan = (key, field, value) =>
    setDraft({ ...draft, plans: { ...draft.plans, [key]: { ...draft.plans[key], [field]: value } } })
  const save = () => {
    const plans = Object.fromEntries(Object.entries(draft.plans).map(([k, p]) => [k, {
      ...p, monthly: Number(p.monthly) || 0, onboarding: Number(p.onboarding) || 0,
      features: typeof p.features === 'string' ? p.features.split('\n').map((f) => f.trim()).filter(Boolean) : p.features,
    }]))
    api.put('/admin/settings', { ...draft, plans, trial_days: Number(draft.trial_days) || 0 })
      .then(() => { toast('Pricing saved', 'sage'); onSaved() }).catch(toastErr)
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Field label="Currency">
          <Select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
            {['GBP', 'USD', 'EUR', 'NGN', 'AUD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Free trial days" hint="0 = pay before access">
          <Input type="number" min="0" value={draft.trial_days} onChange={(e) => setDraft({ ...draft, trial_days: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(draft.plans).map(([key, p]) => (
          <Card key={key} title={`${key} plan`}>
            <div className="space-y-3">
              <Field label="Display name"><Input value={p.name} onChange={(e) => setPlan(key, 'name', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Monthly"><Input type="number" step="0.01" value={p.monthly} onChange={(e) => setPlan(key, 'monthly', e.target.value)} /></Field>
                <Field label="Onboarding"><Input type="number" step="0.01" value={p.onboarding} onChange={(e) => setPlan(key, 'onboarding', e.target.value)} /></Field>
              </div>
              <Field label="Tagline"><Input value={p.tagline || ''} onChange={(e) => setPlan(key, 'tagline', e.target.value)} /></Field>
              <Field label="Features (one per line)">
                <Textarea rows={5} value={Array.isArray(p.features) ? p.features.join('\n') : p.features}
                  onChange={(e) => setPlan(key, 'features', e.target.value)} />
              </Field>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex justify-end"><Button onClick={save}>Save pricing</Button></div>
    </div>
  )
}

export default function Admin() {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [chefs, setChefs] = useState([])
  const [payments, setPayments] = useState([])
  const [settings, setSettings] = useState(null)
  const [q, setQ] = useState('')
  const [selectedChef, setSelectedChef] = useState(null)

  const load = () => {
    api.get('/admin/overview').then(setOverview).catch(toastErr)
    api.get('/admin/chefs').then(setChefs).catch(toastErr)
    api.get('/admin/payments').then(setPayments).catch(toastErr)
    api.get('/admin/settings').then(setSettings).catch(toastErr)
  }
  useEffect(load, [])
  if (!overview) return <Spinner />
  const cur = overview.currency

  const visibleChefs = q ? chefs.filter((c) => `${c.email} ${c.name} ${c.business_name}`.toLowerCase().includes(q.toLowerCase())) : chefs

  return (
    <div>
      <PageHeader title="Platform admin" sub="Your chefs, their subscriptions, your revenue." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'chefs', label: 'Chefs', count: chefs.length },
        { id: 'payments', label: 'Payments' },
        { id: 'pricing', label: 'Pricing' },
      ]} />

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Chefs onboard" value={overview.chefs_total} hint={`${overview.new_signups_30d} new in 30 days`} icon="users" />
            <StatCard label="MRR" value={fmtMoney(overview.mrr, cur)} hint="active subscriptions" tone="sage" icon="coins" />
            <StatCard label="Total revenue" value={fmtMoney(overview.total_revenue, cur)} icon="flame" />
            <StatCard label="Onboarding revenue" value={fmtMoney(overview.onboarding_revenue, cur)} tone="copper" icon="sparkle" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Chefs by status" pad={false}>
              <ul className="divide-y divide-line/70">
                {STATUSES.filter((s) => overview.by_status[s]).map((s) => (
                  <li key={s} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <Badge tone={STATUS_TONE[s]}>{label(s)}</Badge>
                    <span className="font-semibold">{overview.by_status[s]}</span>
                  </li>
                ))}
                {Object.keys(overview.by_status).length === 0 && <li className="px-4 py-4 text-sm text-ink/45">No chefs yet — share your landing page!</li>}
              </ul>
            </Card>
            <Card title="Recent payments" pad={false}>
              {overview.recent_payments.length === 0 ? <p className="p-5 text-sm text-ink/45">No payments yet.</p> : (
                <ul className="divide-y divide-line/70">
                  {overview.recent_payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div><p className="font-medium">{p.user_email}</p><p className="text-xs text-ink/45">{p.note || p.kind} · {p.provider}</p></div>
                      <span className="font-semibold">{fmtMoney(p.amount, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'chefs' && (
        <div>
          <SearchInput value={q} onChange={setQ} className="mb-3 w-full sm:w-72" placeholder="Search chefs…" />
          <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-ink/45">
                <th className="px-4 py-2.5">Chef</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Bookings</th><th className="px-4 py-2.5">Joined</th>
              </tr></thead>
              <tbody className="divide-y divide-line/60">
                {visibleChefs.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-parchment/40" onClick={() => setSelectedChef(c)}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.business_name || c.name || '—'}</p>
                      <p className="text-xs text-ink/45">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{c.plan || '—'}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[c.subscription_status]}>{label(c.subscription_status)}</Badge></td>
                    <td className="px-4 py-3">{c.bookings_count}</td>
                    <td className="px-4 py-3 text-ink/55">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {visibleChefs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/45">No chefs found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-ink/45">
              <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Chef</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Provider</th><th className="px-4 py-2.5 text-right">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-line/60">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-ink/55">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{p.user_email}</td>
                  <td className="px-4 py-3 capitalize">{p.kind}</td>
                  <td className="px-4 py-3 capitalize">{p.provider}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(p.amount, p.currency)}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/45">No payments recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pricing' && <PlansEditor settings={settings} onSaved={load} />}

      <ChefModal chef={selectedChef} plans={settings?.plans} onClose={() => setSelectedChef(null)}
        onSaved={() => { setSelectedChef(null); load() }} />
    </div>
  )
}
