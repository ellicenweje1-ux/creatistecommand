import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtMoney, label, SYMBOLS } from '../format'
import { Badge, Button, Card, Field, Icon, Input, PageHeader, Select, toast, toastErr } from '../ui'

export default function Settings() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({ name: '', business_name: '', phone: '', currency: 'GBP' })
  const [pw, setPw] = useState({ current: '', new: '' })
  const [billing, setBilling] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [founders, setFounders] = useState(null)

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', business_name: user.business_name || '', phone: user.phone || '', currency: user.currency || 'GBP' })
    api.get('/billing/status').then(setBilling).catch(() => {})
    api.get('/ai/status').then(setAiStatus).catch(() => {})
    if (user?.is_founder && !user?.is_staff) api.get('/founders/status').then(setFounders).catch(() => {})
  }, [user])

  const saveProfile = (e) => {
    e.preventDefault()
    api.put('/auth/me', profile).then((u) => { setUser(u); toast('Profile saved', 'sage') }).catch(toastErr)
  }
  const changePassword = (e) => {
    e.preventDefault()
    api.put('/auth/password', pw).then(() => { setPw({ current: '', new: '' }); toast('Password updated', 'sage') }).catch(toastErr)
  }
  const cancelSub = () => {
    if (!window.confirm('Cancel your subscription? You will lose access to the workspace.')) return
    api.post('/billing/cancel').then(() => window.location.reload()).catch(toastErr)
  }

  const statusTone = { active: 'sage', trialing: 'copper', pending: 'amber', suspended: 'red', canceled: 'ink' }

  const [theme, setThemeState] = useState(() => localStorage.getItem('cc_theme') || 'dark')
  const setTheme = (t) => {
    localStorage.setItem('cc_theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    setThemeState(t)
  }

  return (
    <div>
      <PageHeader title="Settings" sub="Profile, security, membership." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Your name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Business name"><Input value={profile.business_name} onChange={(e) => setProfile({ ...profile, business_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
              <Field label="Currency">
                <Select value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}>
                  {Object.keys(SYMBOLS).map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Email"><Input value={user?.email || ''} disabled className="opacity-60" /></Field>
            <div className="flex justify-end"><Button>Save profile</Button></div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card title="Appearance">
            <p className="mb-3 text-sm text-fg/60">
              The signature Creatiste look is dark & sultry — switch to the brighter mode whenever it
              suits the light you're working in. Applies across every module.
            </p>
            <div className="flex gap-2">
              {[['dark', 'moon', 'Dark — signature'], ['light', 'sun', 'Light — bright kitchen']].map(([t, ic, lbl]) => (
                <button key={t} type="button" onClick={() => setTheme(t)}
                  className={cls('flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all',
                    theme === t ? 'border-copper ring-2 ring-copper/30 text-copper' : 'border-line text-fg/55 hover:border-copper/40')}>
                  <Icon name={ic} size={18} />
                  {lbl}
                </button>
              ))}
            </div>
          </Card>

          {founders && (
            <Card title={`Founding member #${founders.founder_number}`}>
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed text-fg/65">
                  You're one of the platform's founding chefs — your {fmtMoney(founders.monthly, founders.currency)}/month
                  rate is locked for life, and your voice steers the roadmap.
                </p>
                <ul className="space-y-1.5">
                  {(founders.perks || []).map((p) => (
                    <li key={p} className="flex items-start gap-2 leading-relaxed text-fg/70">
                      <Icon name="star" size={13} className="mt-0.5 shrink-0 text-copper" />{p}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-line/70 pt-3">
                  <span className="text-fg/60">Member since</span><span>{founders.founder_since || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-fg/60">Day-{founders.check_in_after_days} check-in</span>
                  {founders.feedback_submitted
                    ? <Badge tone="sage">submitted — thank you</Badge>
                    : founders.check_in_due
                      ? <Badge tone="copper">due — see the pop-up on your dashboard</Badge>
                      : <Badge tone="gray">day {founders.days_in} of {founders.check_in_after_days}</Badge>}
                </div>
              </div>
            </Card>
          )}

          <Card title="Membership">
            {billing ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-fg/60">Status</span>
                  <Badge tone={statusTone[billing.subscription_status] || 'gray'}>{label(billing.subscription_status)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-fg/60">Plan</span>
                  <span className="font-medium capitalize">{billing.plan === 'founders' ? 'Founders Membership — lifetime rate' : billing.plan || '—'}</span>
                </div>
                <div className="flex items-center justify-between"><span className="text-fg/60">Onboarding fee</span><span>{billing.onboarding_paid ? 'Paid ✓' : 'Not paid'}</span></div>
                {billing.trial_ends_at && <div className="flex items-center justify-between"><span className="text-fg/60">Trial ends</span><span>{billing.trial_ends_at}</span></div>}
                {billing.payments?.length > 0 && (
                  <div className="border-t border-line/70 pt-3">
                    <p className="label">Payment history</p>
                    <ul className="space-y-1.5">
                      {billing.payments.slice(0, 6).map((p) => (
                        <li key={p.id} className="flex justify-between text-xs">
                          <span className="text-fg/60">{p.note || p.kind} <span className="text-fg/35">({p.provider})</span></span>
                          <span className="font-medium">{fmtMoney(p.amount, p.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {user?.role !== 'admin' && billing.subscription_status === 'active' && (
                  <div className="border-t border-line/70 pt-3 text-right">
                    <Button variant="danger" size="sm" onClick={cancelSub}>Cancel subscription</Button>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-fg/45">Loading…</p>}
          </Card>

          <Card title="Mise — your AI sous-chef">
            <p className="text-sm text-fg/65">
              Mise handles your mise en place before you tie your apron: drafts recipe sheets, builds
              shopping lists from a menu minus your stock, plans prep timelines back from event day and
              polishes rough ideas.{' '}
              {aiStatus?.enabled
                ? <>Mise is <span className="font-medium text-sage">enabled</span> (model: {aiStatus.model}).</>
                : <>Mise is <span className="font-medium text-red-600">not configured</span> — the platform owner needs to set <code className="rounded bg-fg/5 px-1">ANTHROPIC_API_KEY</code> on the server.</>}
            </p>
          </Card>

          <Card title="Email notifications">
            <p className="text-sm text-fg/65">
              {aiStatus?.email_enabled
                ? <>Email notifications are <span className="font-medium text-sage">on</span> — enquiries, quote responses and staff assignments are emailed automatically.</>
                : <>Email notifications are <span className="font-medium text-red-600">off</span> — set <code className="rounded bg-fg/5 px-1">SMTP_HOST</code> (and friends) on the server to enable them.</>}
            </p>
          </Card>

          {!user?.is_staff && (user?.plan_level ?? 1) >= 2 && user?.enquiry_token && (
            <Card title="Public enquiry form">
              <p className="mb-3 text-sm text-fg/65">
                Share this link on your website or Instagram — enquiries land straight in your Bookings
                as new leads (and email you{aiStatus?.email_enabled ? '' : ', once email is configured'}).
              </p>
              <div className="flex gap-2">
                <Input readOnly value={`${window.location.origin}/enquire/${user.enquiry_token}`} onFocus={(e) => e.target.select()} />
                <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/enquire/${user.enquiry_token}`); toast('Link copied', 'sage') }}>Copy</Button>
              </div>
            </Card>
          )}

          <Card title="Change password">
            <form onSubmit={changePassword} className="space-y-4">
              <Field label="Current password"><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
              <Field label="New password"><Input type="password" minLength={8} value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} required /></Field>
              <div className="flex justify-end"><Button variant="secondary">Update password</Button></div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
