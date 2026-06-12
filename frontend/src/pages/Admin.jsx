import { useEffect, useState } from 'react'
import { api } from '../api'
import { fmtMoney, label } from '../format'
import { Badge, Button, Card, Field, Icon, Input, Modal, PageHeader, SearchInput, Select, Spinner, StatCard, Tabs, Textarea, toast, toastErr } from '../ui'

const STATUS_TONE = { active: 'sage', trialing: 'copper', pending: 'amber', suspended: 'red', canceled: 'ink' }
const STATUSES = ['pending', 'trialing', 'active', 'suspended', 'canceled']

function ChefModal({ chef, onClose, onSaved, plans }) {
  const [form, setForm] = useState({})
  useEffect(() => { if (chef) setForm({ subscription_status: chef.subscription_status, plan: chef.plan, admin_notes: chef.admin_notes || '', is_founder: !!chef.is_founder }) }, [chef])
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
          <p><span className="text-fg/50">Email:</span> {chef.email}</p>
          <p><span className="text-fg/50">Joined:</span> {new Date(chef.created_at).toLocaleDateString()}</p>
          <p><span className="text-fg/50">Bookings:</span> {chef.bookings_count} · <span className="text-fg/50">Onboarding paid:</span> {chef.onboarding_paid ? 'yes' : 'no'}</p>
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
              {(form.is_founder || chef.plan === 'founders') && <option value="founders">Founders Membership</option>}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.is_founder} onChange={(e) => setForm({ ...form, is_founder: e.target.checked })} />
          <span>
            Founding member{chef.founder_number ? ` #${chef.founder_number}` : ''} — lifetime founders rate
            {!chef.is_founder && <span className="text-fg/45"> (tick to grandfather this chef into the programme)</span>}
          </span>
        </label>
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

const SESSION_TONE = { booked: 'copper', completed: 'sage', cancelled: 'ink', no_show: 'red' }
const KIND_LABEL = { onboarding: 'Onboarding', checkin: 'Founders check-in' }

function SessionModal({ session, onClose, onSaved }) {
  const [form, setForm] = useState({ notes: '', transcript: '' })
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (session) { setForm({ notes: session.notes || '', transcript: session.transcript || '' }); setSummary(session.ai_summary || '') }
  }, [session])
  if (!session) return null

  const patch = (extra = {}, msg = 'Session saved') =>
    api.patch(`/admin/onboarding/${session.id}`, { ...form, ...extra })
      .then(() => { toast(msg, 'sage'); onSaved() }).catch(toastErr)
  const complete = () => {
    const unlocks = session.kind === 'onboarding' && !session.user_onboarded
    if (unlocks && !window.confirm(`Mark this call complete? ${session.user_name || session.user_email} will be verified — their kitchen unlocks and the free trial starts now.`)) return
    patch({ status: 'completed' }, unlocks ? 'Completed — their trial has started' : 'Marked complete')
  }
  const summarize = () => {
    setBusy(true)
    api.patch(`/admin/onboarding/${session.id}`, form)
      .then(() => api.post(`/admin/onboarding/${session.id}/summarize`))
      .then((r) => { setSummary(r.ai_summary); toast('Key points extracted', 'sage') })
      .catch(toastErr)
      .finally(() => setBusy(false))
  }

  return (
    <Modal open onClose={onClose} wide title={`${KIND_LABEL[session.kind] || session.kind} — ${session.user_name || session.user_email}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-parchment/50 p-3 text-sm">
          <div>
            <p><span className="text-fg/50">When:</span> {session.date} at {session.start_time} ({session.duration_min} min)</p>
            <p><span className="text-fg/50">Client:</span> {session.user_email}{session.is_founder ? ` · Founding member #${session.founder_number}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={SESSION_TONE[session.status]}>{label(session.status)}</Badge>
            <a href={session.meeting_url} target="_blank" rel="noreferrer"><Button size="sm" icon="external">Join call</Button></a>
          </div>
        </div>
        {session.status === 'booked' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={complete} icon="check">
              {session.kind === 'onboarding' && !session.user_onboarded ? 'Complete — verify & start trial' : 'Mark complete'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => patch({ status: 'no_show' }, 'Marked as no-show')}>No-show</Button>
            <Button size="sm" variant="danger" onClick={() => patch({ status: 'cancelled' }, 'Session cancelled')}>Cancel session</Button>
          </div>
        )}
        <Field label="Call notes">
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything worth remembering from the call…" />
        </Field>
        <Field label="Transcript" hint="Paste the transcript (Zoom emails you one after cloud-recorded calls) or rough notes, then let AI pull out the key points.">
          <Textarea rows={5} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} placeholder="Paste the call transcript here…" />
        </Field>
        {summary && (
          <div>
            <p className="label">AI key points</p>
            <p className="whitespace-pre-wrap rounded-lg border border-copper/25 bg-copper/[0.06] px-3 py-2 text-sm text-fg/80">{summary}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Button variant="secondary" icon="sparkle" disabled={busy || !(form.transcript || form.notes)} onClick={summarize}>
            {busy ? 'Summarising…' : 'Summarise with AI'}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button onClick={() => patch()}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function OnboardingPanel({ data, onSaved }) {
  const [selected, setSelected] = useState(null)
  if (!data) return <Spinner />
  const { upcoming, past } = data
  const byDate = upcoming.reduce((acc, s) => { (acc[s.date] = acc[s.date] || []).push(s); return acc }, {})

  const Row = ({ s }) => (
    <button onClick={() => setSelected(s)}
      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm hover:bg-parchment/40">
      <span className="font-display font-semibold">{s.start_time}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{s.user_name || s.user_email}</span>
        <span className="block truncate text-xs text-fg/45">{s.user_email}</span>
      </span>
      {s.is_founder && <Badge tone="copper">founder #{s.founder_number}</Badge>}
      <Badge tone={s.kind === 'checkin' ? 'amber' : 'gray'}>{KIND_LABEL[s.kind]}</Badge>
      <Badge tone={SESSION_TONE[s.status]}>{label(s.status)}</Badge>
      {s.ai_summary && <Icon name="sparkle" size={14} className="text-copper" />}
    </button>
  )

  return (
    <div className="space-y-5">
      <Card title={`Upcoming calls (${upcoming.length})`} pad={false}>
        {upcoming.length === 0 ? (
          <p className="p-5 text-sm text-fg/45">Nothing booked — new sign-ups book their onboarding call themselves, and it lands here.</p>
        ) : Object.entries(byDate).map(([date, list]) => (
          <div key={date}>
            <p className="border-b border-line/60 bg-parchment/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg/45">
              {date === data.today ? `Today — ${date}` : date}
            </p>
            <div className="divide-y divide-line/60">{list.map((s) => <Row key={s.id} s={s} />)}</div>
          </div>
        ))}
      </Card>
      <Card title={`Past & resolved (${past.length})`} pad={false}>
        {past.length === 0 ? <p className="p-5 text-sm text-fg/45">No past sessions yet.</p> : (
          <div className="divide-y divide-line/60">{past.slice(0, 30).map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="pl-4 text-xs text-fg/40">{s.date}</span>
              <div className="flex-1"><Row s={s} /></div>
            </div>
          ))}</div>
        )}
      </Card>
      <SessionModal session={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onSaved() }} />
    </div>
  )
}

function FoundersPanel({ data, onSaved }) {
  const [cfg, setCfg] = useState(null)
  const [viewing, setViewing] = useState(null) // member whose check-in is open
  useEffect(() => {
    if (data) setCfg({ monthly: data.config.monthly, onboarding: data.config.onboarding, spots: data.config.spots })
  }, [data])
  if (!data || !cfg) return <Spinner />

  const link = `${window.location.origin}${data.invite_path}`
  const open = data.config.enabled && data.spots_taken < data.config.spots
  const save = (extra = {}) =>
    api.put('/admin/founders', {
      monthly: Number(cfg.monthly) || 0, onboarding: Number(cfg.onboarding) || 0,
      spots: Number(cfg.spots) || 0, ...extra,
    }).then(() => { toast('Founders programme saved', 'sage'); onSaved() }).catch(toastErr)
  const toggleProgramme = () => {
    if (data.config.enabled && !window.confirm(
      'Close the founders programme? The invite link dies immediately and the offer never returns to the public. Existing founders keep their lifetime rate.'
    )) return
    save({ enabled: !data.config.enabled })
  }

  return (
    <div className="space-y-5">
      <Card title="Founders programme" action={<Badge tone={open ? 'sage' : 'red'}>{open ? 'open' : 'closed'}</Badge>}>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-fg/60">
            The private launch membership for your first chefs: full Elite access at a lifetime rate, joined only
            through the secret link below — it never appears on the public site.{' '}
            <span className="font-medium text-fg/80">{data.spots_taken} of {data.config.spots} founding seats claimed.</span>{' '}
            Closing the programme (or filling every seat) kills the link for good; existing founders keep their rate.
          </p>
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            <Field label="Founding seats"><Input type="number" min="0" value={cfg.spots} onChange={(e) => setCfg({ ...cfg, spots: e.target.value })} /></Field>
            <Field label="Monthly (for life)"><Input type="number" step="0.01" value={cfg.monthly} onChange={(e) => setCfg({ ...cfg, monthly: e.target.value })} /></Field>
            <Field label="Onboarding fee" hint="0 = waived"><Input type="number" step="0.01" value={cfg.onboarding} onChange={(e) => setCfg({ ...cfg, onboarding: e.target.value })} /></Field>
          </div>
          <Field label="Private invite link" hint="Share by hand with invited chefs only.">
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.target.select()} />
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(link); toast('Invite link copied', 'sage') }}>Copy</Button>
            </div>
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm"
                onClick={() => window.confirm('Generate a new invite link? The current link stops working immediately.') && save({ new_code: true })}>
                New link
              </Button>
              <Button variant={data.config.enabled ? 'danger' : 'secondary'} size="sm" onClick={toggleProgramme}>
                {data.config.enabled ? 'Close the programme' : 'Reopen the programme'}
              </Button>
            </div>
            <Button onClick={() => save()}>Save</Button>
          </div>
        </div>
      </Card>

      <Card title={`Founding members (${data.members.length})`} pad={false}>
        {data.members.length === 0 ? (
          <p className="p-5 text-sm text-fg/45">No founding seats claimed yet — share the invite link with your first chefs.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-fg/45">
                <th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Chef</th><th className="px-4 py-2.5">Joined</th><th className="px-4 py-2.5">Days in</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Day-5 check-in</th>
              </tr></thead>
              <tbody className="divide-y divide-line/60">
                {data.members.map((m) => (
                  <tr key={m.id} className={m.feedback ? 'cursor-pointer hover:bg-parchment/40' : ''}
                    onClick={() => m.feedback && setViewing(m)}>
                    <td className="px-4 py-3 font-display font-semibold text-copper">#{m.founder_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{m.business_name || m.name || '—'}</p>
                      <p className="text-xs text-fg/45">{m.email}</p>
                    </td>
                    <td className="px-4 py-3 text-fg/55">{m.founder_since || '—'}</td>
                    <td className="px-4 py-3">{m.days_in}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[m.subscription_status] || 'gray'}>{label(m.subscription_status)}</Badge></td>
                    <td className="px-4 py-3">
                      {m.feedback
                        ? <Badge tone="sage"><Icon name="check" size={11} /> received — view</Badge>
                        : m.days_in >= 5 ? <Badge tone="copper">awaiting</Badge> : <Badge tone="gray">day {m.days_in} of 5</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)}
        title={viewing ? `Check-in — Founding member #${viewing.founder_number}` : ''}>
        {viewing?.feedback && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-fg/45">
              {viewing.business_name || viewing.name || viewing.email} · {viewing.email} ·
              submitted {new Date(viewing.feedback.created_at).toLocaleString()}
            </p>
            {[['Thoughts on the programme', 'thoughts'], ['How it benefited them', 'benefits'], ["What they'd change / like to see", 'changes']].map(([t, k]) => (
              <div key={k}>
                <p className="label">{t}</p>
                <p className="whitespace-pre-wrap rounded-lg bg-parchment/50 px-3 py-2 text-fg/75">{viewing.feedback[k] || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
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
  const [tickets, setTickets] = useState([])
  const [founders, setFounders] = useState(null)
  const [sessions, setSessions] = useState(null)

  const load = () => {
    api.get('/admin/overview').then(setOverview).catch(toastErr)
    api.get('/admin/chefs').then(setChefs).catch(toastErr)
    api.get('/admin/payments').then(setPayments).catch(toastErr)
    api.get('/admin/settings').then(setSettings).catch(toastErr)
    api.get('/admin/support').then(setTickets).catch(() => {})
    api.get('/admin/founders').then(setFounders).catch(() => {})
    api.get('/admin/onboarding').then(setSessions).catch(() => {})
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
        { id: 'onboarding', label: 'Onboarding', count: sessions?.upcoming?.length },
        { id: 'founders', label: 'Founders', count: founders?.members?.length },
        { id: 'payments', label: 'Payments' },
        { id: 'support', label: 'Support', count: tickets.filter((t) => t.status === 'open').length },
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
                {Object.keys(overview.by_status).length === 0 && <li className="px-4 py-4 text-sm text-fg/45">No chefs yet — share your landing page!</li>}
              </ul>
            </Card>
            <Card title="Recent payments" pad={false}>
              {overview.recent_payments.length === 0 ? <p className="p-5 text-sm text-fg/45">No payments yet.</p> : (
                <ul className="divide-y divide-line/70">
                  {overview.recent_payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div><p className="font-medium">{p.user_email}</p><p className="text-xs text-fg/45">{p.note || p.kind} · {p.provider}</p></div>
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
          <div className="overflow-x-auto rounded-xl border border-line bg-card shadow-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-fg/45">
                <th className="px-4 py-2.5">Chef</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Bookings</th><th className="px-4 py-2.5">Joined</th>
              </tr></thead>
              <tbody className="divide-y divide-line/60">
                {visibleChefs.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-parchment/40" onClick={() => setSelectedChef(c)}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.business_name || c.name || '—'}</p>
                      <p className="text-xs text-fg/45">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{c.plan || '—'}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[c.subscription_status]}>{label(c.subscription_status)}</Badge></td>
                    <td className="px-4 py-3">{c.bookings_count}</td>
                    <td className="px-4 py-3 text-fg/55">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {visibleChefs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-fg/45">No chefs found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="overflow-x-auto rounded-xl border border-line bg-card shadow-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line bg-parchment/50 text-left text-[11px] uppercase tracking-wider text-fg/45">
              <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Chef</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Provider</th><th className="px-4 py-2.5 text-right">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-line/60">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-fg/55">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{p.user_email}</td>
                  <td className="px-4 py-3 capitalize">{p.kind}</td>
                  <td className="px-4 py-3 capitalize">{p.provider}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(p.amount, p.currency)}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-fg/45">No payments recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'support' && (
        <div className="space-y-2.5">
          {tickets.length === 0 ? (
            <Card><p className="text-sm text-fg/45">No support requests yet.</p></Card>
          ) : tickets.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">#{t.id} — {t.subject}</p>
                  <p className="text-xs text-fg/50">{t.name || '—'} · {t.email} · {new Date(t.created_at).toLocaleString()}</p>
                </div>
                <Button size="sm" variant={t.status === 'open' ? 'primary' : 'secondary'}
                  onClick={() => api.patch(`/admin/support/${t.id}`, { status: t.status === 'open' ? 'closed' : 'open' }).then(load).catch(toastErr)}>
                  {t.status === 'open' ? 'Mark resolved' : 'Reopen'}
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-parchment/50 px-3 py-2 text-sm text-fg/75">{t.message}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'onboarding' && <OnboardingPanel data={sessions} onSaved={load} />}

      {tab === 'founders' && <FoundersPanel data={founders} onSaved={load} />}

      {tab === 'pricing' && <PlansEditor settings={settings} onSaved={load} />}

      <ChefModal chef={selectedChef} plans={settings?.plans} onClose={() => setSelectedChef(null)}
        onSaved={() => { setSelectedChef(null); load() }} />
    </div>
  )
}
