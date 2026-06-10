import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { fmtMoney, label, SYMBOLS } from '../format'
import { Badge, Button, Card, Field, Input, PageHeader, Select, toast, toastErr } from '../ui'

export default function Settings() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({ name: '', business_name: '', phone: '', currency: 'GBP' })
  const [pw, setPw] = useState({ current: '', new: '' })
  const [billing, setBilling] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', business_name: user.business_name || '', phone: user.phone || '', currency: user.currency || 'GBP' })
    api.get('/billing/status').then(setBilling).catch(() => {})
    api.get('/ai/status').then(setAiStatus).catch(() => {})
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
          <Card title="Membership">
            {billing ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink/60">Status</span>
                  <Badge tone={statusTone[billing.subscription_status] || 'gray'}>{label(billing.subscription_status)}</Badge>
                </div>
                <div className="flex items-center justify-between"><span className="text-ink/60">Plan</span><span className="font-medium capitalize">{billing.plan || '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-ink/60">Onboarding fee</span><span>{billing.onboarding_paid ? 'Paid ✓' : 'Not paid'}</span></div>
                {billing.trial_ends_at && <div className="flex items-center justify-between"><span className="text-ink/60">Trial ends</span><span>{billing.trial_ends_at}</span></div>}
                {billing.payments?.length > 0 && (
                  <div className="border-t border-line/70 pt-3">
                    <p className="label">Payment history</p>
                    <ul className="space-y-1.5">
                      {billing.payments.slice(0, 6).map((p) => (
                        <li key={p.id} className="flex justify-between text-xs">
                          <span className="text-ink/60">{p.note || p.kind} <span className="text-ink/35">({p.provider})</span></span>
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
            ) : <p className="text-sm text-ink/45">Loading…</p>}
          </Card>

          <Card title="AI sous-chef">
            <p className="text-sm text-ink/65">
              {aiStatus?.enabled
                ? <>AI features are <span className="font-medium text-sage">enabled</span> (model: {aiStatus.model}).</>
                : <>AI features are <span className="font-medium text-red-600">not configured</span>. The platform owner needs to set <code className="rounded bg-ink/5 px-1">ANTHROPIC_API_KEY</code> on the server to enable recipe generation, smart shopping lists and prep plans.</>}
            </p>
          </Card>

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
