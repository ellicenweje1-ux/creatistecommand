import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { perkIcon, perkTitle } from '../booking'
import { DEFAULT_CONTACT_TEMPLATE } from '../contact'
import { cls, fmtMoney, label, SYMBOLS } from '../format'
import { getInstallPrompt, isStandalone } from '../offline'
import { Badge, Button, Card, Field, Icon, Input, PageHeader, Select, Textarea, toast, toastErr } from '../ui'
import { CURRENT, VERSIONS, VersionNotes, versionRef } from '../version'

/* Settings is split into individual pages (own URL each) under /app/settings, so the
   whole lot no longer sits on one long wall. This file holds the shared layout + one
   component per section; the routes are wired in App.jsx. */
const SETTINGS_NAV = [
  { to: '/app/settings', end: true, icon: 'users', label: 'Profile' },
  { to: '/app/settings/business', icon: 'flame', label: 'Business', ownerOnly: true },
  { to: '/app/settings/security', icon: 'lock', label: 'Security' },
  { to: '/app/settings/appearance', icon: 'moon', label: 'Appearance' },
  { to: '/app/settings/membership', icon: 'coins', label: 'Membership' },
  { to: '/app/settings/integrations', icon: 'mobile', label: 'App & integrations' },
  { to: '/app/settings/about', icon: 'circleV', label: 'Version' },
]

function SettingsNav() {
  const { user } = useAuth()
  const items = SETTINGS_NAV.filter((item) => !(item.ownerOnly && user?.is_staff))
  return (
    <nav className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}
          className={({ isActive }) => cls(
            'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors lg:shrink',
            isActive
              ? 'bg-copper/15 text-copper lg:border lg:border-copper/20'
              : 'border border-line bg-card text-fg/60 hover:text-copper lg:border-transparent lg:bg-transparent')}>
          <Icon name={item.icon} size={16} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" sub="Profile, security, membership and app integrations." />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <SettingsNav />
        <div className="min-w-0 flex-1"><Outlet /></div>
      </div>
    </div>
  )
}

/* --------------------------------- Profile --------------------------------- */
export function SettingsProfile() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({ name: '', business_name: '', phone: '', currency: 'GBP' })
  useEffect(() => {
    if (user) setProfile({ name: user.name || '', business_name: user.business_name || '', phone: user.phone || '', currency: user.currency || 'GBP' })
  }, [user])

  const saveProfile = (e) => {
    e.preventDefault()
    api.put('/auth/me', profile).then((u) => { setUser(u); toast('Profile saved', 'sage') }).catch(toastErr)
  }

  return (
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
  )
}

/* ----------------------------- Business profile ---------------------------- */
// Internal "all in one place": logo, description, the services you offer (these
// become the New-Booking dropdown), contact + socials, and a gallery. Logo and
// gallery photos save on upload; the text fields save with the button.
const SOCIAL_FIELDS = [
  ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'],
  ['website', 'Website'], ['x', 'X / Twitter'], ['youtube', 'YouTube'],
]

export function SettingsBusiness() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ business_description: '', business_email: '', services: [], socials: {}, contact_channel: 'both', contact_template: '' })
  const [gallery, setGallery] = useState([])
  const [logo, setLogo] = useState('')
  const [svc, setSvc] = useState('')
  const [busy, setBusy] = useState(false)
  // Initialise from the user once — later saves call setUser, and we must NOT let
  // that wipe in-progress edits in this form.
  const inited = useRef(false)
  useEffect(() => {
    if (!user || inited.current) return
    inited.current = true
    setForm({
      business_description: user.business_description || '',
      business_email: user.business_email || '',
      services: user.services || [],
      socials: user.socials || {},
      contact_channel: user.contact_channel || 'both',
      contact_template: user.contact_template || '',
    })
    setGallery(user.gallery || [])
    setLogo(user.avatar_url || '')
  }, [user])

  if (user?.is_staff) {
    return <Card title="Business profile"><p className="text-sm text-fg/55">Your business owner sets up the business profile.</p></Card>
  }

  const patch = (fields) => api.put('/auth/me', fields).then((u) => { setUser(u); return u })

  const save = () => {
    setBusy(true)
    patch(form).then(() => toast('Business profile saved', 'sage')).catch(toastErr).finally(() => setBusy(false))
  }
  const onLogo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try { const r = await api.upload(file); setLogo(r.url); await patch({ avatar_url: r.url }); toast('Logo updated', 'sage') } catch (err) { toastErr(err) }
  }
  const addGallery = async (e) => {
    const files = Array.from(e.target.files || [])
    let next = gallery
    for (const f of files) {
      try { const r = await api.upload(f); next = [...next, r.url]; setGallery(next) } catch (err) { toastErr(err) }
    }
    if (next !== gallery) patch({ gallery: next }).catch(toastErr)
  }
  const removeGallery = (url) => { const next = gallery.filter((g) => g !== url); setGallery(next); patch({ gallery: next }).catch(toastErr) }

  const addService = () => {
    const s = svc.trim()
    if (s && !form.services.includes(s)) setForm({ ...form, services: [...form.services, s] })
    setSvc('')
  }
  const removeService = (s) => setForm({ ...form, services: form.services.filter((x) => x !== s) })
  const setSocial = (k, v) => setForm({ ...form, socials: { ...form.socials, [k]: v } })

  return (
    <div className="space-y-5">
      <Card title="Logo & description">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-line bg-parchment/40">
              {logo ? <img src={logo} alt="Business logo" className="h-full w-full object-cover" /> : <Icon name="flame" size={28} className="text-fg/25" />}
            </div>
            <label className="mt-2 block cursor-pointer text-center text-xs font-medium text-copper hover:underline">
              {logo ? 'Change logo' : 'Upload logo'}
              <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            </label>
          </div>
          <Field label="Business description" className="flex-1">
            <Textarea rows={4} value={form.business_description} onChange={(e) => setForm({ ...form, business_description: e.target.value })}
              placeholder="A few lines about your kitchen — your style, your specialities, the experience you create." />
          </Field>
        </div>
      </Card>

      <Card title="Services you offer">
        <p className="mb-3 text-sm text-fg/60">These appear as a dropdown when you create a booking, so your event types stay consistent.</p>
        <div className="flex gap-2">
          <Input value={svc} onChange={(e) => setSvc(e.target.value)} placeholder="e.g. Private dining, Wedding catering, Canapé reception"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addService() } }} />
          <Button type="button" variant="secondary" icon="plus" onClick={addService}>Add</Button>
        </div>
        {form.services.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {form.services.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-sm">
                {s}
                <button type="button" onClick={() => removeService(s)} className="text-fg/40 hover:text-red-500" aria-label={`Remove ${s}`}><Icon name="x" size={13} /></button>
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card title="Contact & social media">
        <div className="space-y-3">
          <Field label="Business contact email">
            <Input type="email" value={form.business_email} onChange={(e) => setForm({ ...form, business_email: e.target.value })} placeholder="hello@yourkitchen.com" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIAL_FIELDS.map(([k, lbl]) => (
              <Field key={k} label={lbl}>
                <Input value={form.socials[k] || ''} onChange={(e) => setSocial(k, e.target.value)} placeholder={k === 'website' ? 'https://…' : '@yourhandle or link'} />
              </Field>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Contacting clients">
        <p className="mb-3 text-sm text-fg/60">
          Defaults for the <span className="font-medium text-fg">Contact client</span> button on bookings and clients — it opens
          WhatsApp or email with your message ready to send (you can still edit it each time).
        </p>
        <div className="space-y-3">
          <Field label="Preferred channel">
            <Select value={form.contact_channel} onChange={(e) => setForm({ ...form, contact_channel: e.target.value })}>
              <option value="both">WhatsApp &amp; email</option>
              <option value="whatsapp">WhatsApp only</option>
              <option value="email">Email only</option>
            </Select>
          </Field>
          <Field label="Message template" hint="Placeholders {client}, {business}, {event} and {date} are filled in automatically.">
            <Textarea rows={4} value={form.contact_template} onChange={(e) => setForm({ ...form, contact_template: e.target.value })}
              placeholder={DEFAULT_CONTACT_TEMPLATE} />
          </Field>
        </div>
      </Card>

      <Card title="Gallery">
        <p className="mb-3 text-sm text-fg/60">Showcase your work — dishes, setups, events. Saved to your profile for use on shared documents.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {gallery.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => removeGallery(url)} aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-fg/45 hover:border-copper/50 hover:text-copper">
            <Icon name="plus" size={20} /><span className="text-[11px] font-medium">Add photos</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={addGallery} />
          </label>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save business profile'}</Button>
      </div>
    </div>
  )
}

/* --------------------------------- Security -------------------------------- */
export function SettingsSecurity() {
  const [pw, setPw] = useState({ current: '', new: '' })

  const changePassword = (e) => {
    e.preventDefault()
    api.put('/auth/password', pw).then(() => { setPw({ current: '', new: '' }); toast('Password updated', 'sage') }).catch(toastErr)
  }

  return (
    <Card title="Change password">
      <p className="mb-4 text-sm text-fg/60">
        You stay signed in on this device for several days at a time. If you ever forget your
        password, use the “Forgot password?” link on the sign-in page.
      </p>
      <form onSubmit={changePassword} className="space-y-4">
        <Field label="Current password"><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
        <Field label="New password"><Input type="password" minLength={8} value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} required /></Field>
        <div className="flex justify-end"><Button variant="secondary">Update password</Button></div>
      </form>
    </Card>
  )
}

/* -------------------------------- Appearance ------------------------------- */
export function SettingsAppearance() {
  const [theme, setThemeState] = useState(() => localStorage.getItem('cc_theme') || 'dark')
  const setTheme = (t) => {
    localStorage.setItem('cc_theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    setThemeState(t)
  }

  return (
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
  )
}

/* Self-serve plan switch — upgrade/downgrade between the standard tiers. */
function ChangePlanCard({ billing, plans, onChanged }) {
  const [switching, setSwitching] = useState(null)
  const symbol = plans.symbol || ''
  const switchPlan = (key) => {
    const p = plans.plans[key]
    if (!window.confirm(
      `Switch to ${p.name} (${symbol}${p.monthly}/mo)?` +
      (plans.stripe_enabled ? ' Your next invoice is adjusted (prorated) for the change.' : ''),
    )) return
    setSwitching(key)
    api.post('/billing/change-plan', { plan: key })
      .then(async () => { toast(`You're now on ${p.name}`, 'sage'); await onChanged() })
      .catch(toastErr)
      .finally(() => setSwitching(null))
  }
  return (
    <Card title="Change plan">
      <p className="mb-3 text-sm text-fg/65">
        Move up or down a tier whenever you like.
        {plans.stripe_enabled ? ' The difference is prorated on your next invoice.' : ''}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(plans.plans).map(([key, p]) => {
          const current = key === billing.plan
          return (
            <div key={key} className={cls('flex flex-col rounded-xl border p-3.5', current ? 'border-copper ring-1 ring-copper/30' : 'border-line')}>
              <p className="font-display text-sm font-semibold">{p.name}</p>
              <p className="mt-1 font-display text-xl font-semibold">{symbol}{p.monthly}<span className="text-xs font-normal text-fg/45">/mo</span></p>
              <p className="mt-0.5 text-[11px] text-fg/45">{p.tagline}</p>
              <div className="mt-3 flex-1" />
              {current
                ? <Badge tone="copper" className="justify-center">Current plan</Badge>
                : <Button size="sm" variant="secondary" disabled={!!switching} onClick={() => switchPlan(key)}>
                    {switching === key ? 'Switching…' : `Switch to ${p.name.split(' ')[0]}`}
                  </Button>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* -------------------------------- Membership ------------------------------- */
export function SettingsMembership() {
  const { user, refresh } = useAuth()
  const [billing, setBilling] = useState(null)
  const [founders, setFounders] = useState(null)
  const [plans, setPlans] = useState(null)

  const loadBilling = () => api.get('/billing/status').then(setBilling).catch(() => {})
  useEffect(() => {
    loadBilling()
    api.get('/billing/plans').then(setPlans).catch(() => {})
    if (user?.is_founder && !user?.is_staff) api.get('/founders/status').then(setFounders).catch(() => {})
  }, [user])

  const canSwitchPlan = user && user.role !== 'admin' && !user.is_staff && !user.is_founder
    && plans && billing && ['active', 'trialing'].includes(billing.subscription_status)

  const statusTone = { active: 'sage', trialing: 'copper', pending: 'amber', suspended: 'red', canceled: 'ink' }

  const cancelSub = () => {
    if (!window.confirm('Cancel your subscription? With Stripe billing you keep access until the end of the period you’ve already paid for.')) return
    api.post('/billing/cancel').then((r) => {
      if (r?.ends_at) toast(`Cancellation set — your membership stays active until ${r.ends_at}`, 'sage')
      setTimeout(() => window.location.reload(), r?.ends_at ? 1800 : 0)
    }).catch(toastErr)
  }
  const openPortal = () => {
    api.post('/billing/portal').then((r) => window.location.assign(r.url)).catch(toastErr)
  }

  return (
    <div className="space-y-5">
      {founders && (
        <Card title={`Founding member #${founders.founder_number}`}>
          <div className="space-y-3 text-sm">
            <p className="leading-relaxed text-fg/65">
              You're one of the platform's founding chefs — your {fmtMoney(founders.monthly, founders.currency)}/month
              rate is locked for life, and your voice steers the roadmap.
            </p>
            <ul className="space-y-1.5">
              {(founders.perks || []).map((p) => (
                <li key={perkTitle(p)} className="flex items-start gap-2 leading-relaxed text-fg/70">
                  <Icon name={perkIcon(p)} size={13} className="mt-0.5 shrink-0 text-copper" />{perkTitle(p)}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line/70 pt-3">
              <span className="text-fg/60">Member since</span><span>{founders.founder_since || '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg/60">Day-{founders.check_in_after_days} check-in call</span>
              {founders.checkin_call
                ? <Badge tone={founders.checkin_call.status === 'completed' ? 'sage' : 'copper'}>
                    {founders.checkin_call.status === 'completed' ? 'done — thank you' : `booked · ${founders.checkin_call.date} ${founders.checkin_call.start_time}`}
                  </Badge>
                : founders.feedback_submitted
                  ? <Badge tone="sage">feedback sent — thank you</Badge>
                  : founders.check_in_due
                    ? <Badge tone="copper">due — see the pop-up on your dashboard</Badge>
                    : <Badge tone="gray">day {founders.days_in} of {founders.check_in_after_days}</Badge>}
            </div>
            {founders.checkin_call?.status === 'booked' && (
              <a href={founders.checkin_call.meeting_url} target="_blank" rel="noreferrer"
                className="block text-right text-xs font-medium text-copper hover:underline">
                Join your check-in call →
              </a>
            )}
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
            {user?.role !== 'admin' && (billing.stripe_enabled && billing.has_stripe_customer) && (
              <div className="border-t border-line/70 pt-3">
                <Button variant="secondary" size="sm" icon="external" onClick={openPortal}>Manage billing — card, invoices & receipts</Button>
                <p className="mt-1.5 text-xs text-fg/40">Opens your secure Stripe billing portal.</p>
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

      {canSwitchPlan && (
        <ChangePlanCard billing={billing} plans={plans} onChanged={async () => { await refresh(); await loadBilling() }} />
      )}
    </div>
  )
}

/* "Use it as an app": install to the home screen (PWA) + how offline mode works. */
function MobileAppCard() {
  const [installable, setInstallable] = useState(!!getInstallPrompt())
  const [installed, setInstalled] = useState(isStandalone())
  useEffect(() => {
    const onReady = () => setInstallable(true)
    window.addEventListener('cc-installable', onReady)
    return () => window.removeEventListener('cc-installable', onReady)
  }, [])

  const install = async () => {
    const prompt = getInstallPrompt()
    if (!prompt) return
    prompt.prompt()
    const choice = await prompt.userChoice.catch(() => null)
    if (choice?.outcome === 'accepted') { setInstalled(true); toast('Installed — find Creatiste on your home screen', 'sage') }
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <Card title="Use it as an app — online or offline">
      <div className="space-y-3 text-sm text-fg/65">
        <p>
          Install The Creatiste Command on your phone or tablet and it behaves like a native app:
          opens from your home screen, full screen, and <span className="font-medium text-fg">keeps working with no signal</span> —
          in a basement kitchen, a venue with no Wi-Fi, or mid-flight.
        </p>
        <ul className="space-y-1.5 text-xs leading-relaxed">
          <li className="flex gap-1.5"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-sage" />Everything you've viewed is available offline — bookings, recipes, lists, tasks, the lot.</li>
          <li className="flex gap-1.5"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-sage" />Changes made offline are saved on the device and <span className="font-medium text-fg">sync automatically</span> when you're back online.</li>
          <li className="flex gap-1.5"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-sage" />Changes made on the website reach the app over the cloud the moment it's online.</li>
        </ul>
        {installed ? (
          <p className="rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-xs font-medium text-sage">
            You're running the installed app ✓
          </p>
        ) : installable ? (
          <Button size="sm" icon="arrowRight" onClick={install}>Install on this device</Button>
        ) : isIOS ? (
          <p className="rounded-lg border border-line bg-fg/[0.03] px-3 py-2 text-xs leading-relaxed">
            On iPhone/iPad: open this site in <span className="font-medium text-fg">Safari</span>, tap the
            <span className="font-medium text-fg"> Share</span> button, then
            <span className="font-medium text-fg"> "Add to Home Screen"</span>.
          </p>
        ) : (
          <p className="rounded-lg border border-line bg-fg/[0.03] px-3 py-2 text-xs leading-relaxed">
            In Chrome or Edge: open the browser menu (⋮) and choose
            <span className="font-medium text-fg"> "Install app"</span> / "Add to Home screen".
          </p>
        )}
      </div>
    </Card>
  )
}

/* Calendar feed: a private ICS link to subscribe to in any phone/desktop calendar. */
function CalendarFeedCard({ token }) {
  const httpsUrl = `${window.location.origin}/api/calendar/${token}.ics`
  const webcalUrl = `webcal://${window.location.host}/api/calendar/${token}.ics`
  return (
    <Card title="Calendar subscription">
      <p className="mb-3 text-sm text-fg/65">
        Subscribe to your bookings &amp; tastings from your phone or desktop calendar — they
        appear alongside your life and <span className="font-medium text-fg">update automatically</span> as
        you add or change events here. It's read-only and the link is private to you.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={httpsUrl} onFocus={(e) => e.target.select()} />
        <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(httpsUrl); toast('Calendar link copied', 'sage') }}>Copy</Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a href={webcalUrl} className="text-xs font-medium text-copper hover:underline">Subscribe on this device →</a>
        <span className="text-xs text-fg/40">or paste the link into Google Calendar → “From URL”, or Apple Calendar → “New Calendar Subscription”.</span>
      </div>
    </Card>
  )
}

/* "Your data is yours": one-tap CSV downloads for the accountant / a spreadsheet. */
function DataExportCard({ user }) {
  const isOwner = !user?.is_staff
  const pro = (user?.plan_level ?? 1) >= 2 || user?.role === 'admin'
  const dl = (path, filename) => api.download(path, filename).catch(toastErr)
  const rows = [
    { show: true, label: 'Bookings', hint: 'Every event with dates, guests, venue & status.', path: '/exports/bookings.csv', file: 'creatiste-bookings.csv' },
    { show: pro, label: 'Clients', hint: 'Contacts, dietary, allergies, tags & notes.', path: '/exports/clients.csv', file: 'creatiste-clients.csv' },
    { show: isOwner && pro, label: 'Invoices', hint: 'For your bookkeeping & accountant.', path: '/finance/export/invoices.csv', file: 'creatiste-invoices.csv' },
    { show: isOwner && pro, label: 'Expenses', hint: 'Categorised spend, ready to reconcile.', path: '/finance/export/expenses.csv', file: 'creatiste-expenses.csv' },
  ].filter((r) => r.show)
  return (
    <Card title="Export your data">
      <p className="mb-3 text-sm text-fg/65">Download your records as CSV — your data is always yours, ready for a spreadsheet or your accountant.</p>
      <div className="divide-y divide-line/70">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-xs text-fg/45">{r.hint}</p>
            </div>
            <Button size="sm" variant="secondary" icon="down" onClick={() => dl(r.path, r.file)}>CSV</Button>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ---------------------------- App & integrations --------------------------- */
export function SettingsIntegrations() {
  const { user } = useAuth()
  const [aiStatus, setAiStatus] = useState(null)
  useEffect(() => { api.get('/ai/status').then(setAiStatus).catch(() => {}) }, [])

  return (
    <div className="space-y-5">
      <MobileAppCard />

      {!user?.is_staff && user?.calendar_token && <CalendarFeedCard token={user.calendar_token} />}

      <DataExportCard user={user} />

      <Card title="Mise — your AI sous-chef">
        <p className="text-sm text-fg/65">
          Named after <em>mise en place</em> — everything in its place before service — Mise handles
          yours before you tie your apron: drafts recipe sheets, builds shopping lists from a menu
          minus your stock, plans prep timelines back from event day and polishes rough ideas.{' '}
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
    </div>
  )
}

/* --------------------------------- Version --------------------------------- */
// iOS-style release notes: what's new in the live version + the history of past
// releases. The version data is the single source of truth in ../version.jsx.
export function SettingsAbout() {
  const earlier = VERSIONS.slice(0, -1).reverse()
  return (
    <div className="space-y-5">
      <Card title="What’s new">
        <p className="mb-4 text-sm leading-relaxed text-fg/60">
          You’re on <span className="font-medium text-fg">{versionRef()}</span>. Here’s what changed in this
          update — a new entry is added each time the platform updates.
        </p>
        <VersionNotes version={CURRENT} />
      </Card>

      <Card title="Release history">
        {earlier.length ? (
          <ol className="space-y-6">
            {earlier.map((v) => <li key={v.n}><VersionNotes version={v} /></li>)}
          </ol>
        ) : (
          <p className="text-sm text-fg/55">This is the first release — earlier versions will appear here as the platform updates.</p>
        )}
      </Card>
    </div>
  )
}
