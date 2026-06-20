import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { perkIcon, perkTitle } from '../booking'
import { DEFAULT_CONTACT_TEMPLATE } from '../contact'
import { cls, fmtMoney, label, renderDocNumber, SYMBOLS } from '../format'
import { getInstallPrompt, isStandalone } from '../offline'
import { Badge, Button, Card, Field, Icon, Input, PasswordInput, Modal, PageHeader, Select, Stars, Textarea, toast, toastErr } from '../ui'
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
  { to: '/app/settings/recycle', icon: 'trash', label: 'Recently deleted' },
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

const FEATURE_STATUS = {
  none: { tone: 'gray', label: 'Not submitted' },
  pending: { tone: 'amber', label: 'Pending review' },
  approved: { tone: 'sage', label: 'Live on our site' },
  rejected: { tone: 'red', label: 'Not approved' },
}

export function SettingsBusiness() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ business_description: '', business_email: '', services: [], socials: {}, contact_channel: 'both', contact_template: '', feature_publicly: false, testimonial: '', testimonial_rating: 0, invoice_format: 'INV-{YYYY}-{nnn}', quote_format: 'Q-{YYYY}-{nnn}' })
  const [seqs, setSeqs] = useState({ invoice: 1, quote: 1 })
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
      feature_publicly: !!user.feature_publicly,
      testimonial: user.testimonial || '',
      testimonial_rating: user.testimonial_rating || 0,
      invoice_format: user.invoice_format || `${(user.invoice_prefix || 'INV').trim() || 'INV'}-{YYYY}-{nnn}`,
      quote_format: user.quote_format || `${(user.quote_prefix || 'Q').trim() || 'Q'}-{YYYY}-{nnn}`,
    })
    setGallery(user.gallery || [])
    setLogo(user.avatar_url || '')
  }, [user])
  // Current sequence numbers, so the numbering preview shows your real next number.
  useEffect(() => {
    api.get('/finance/next-invoice-number').then((r) => setSeqs((s) => ({ ...s, invoice: r.seq || 1 }))).catch(() => {})
    api.get('/quotes/meta/next-number').then((r) => setSeqs((s) => ({ ...s, quote: r.seq || 1 }))).catch(() => {})
  }, [])

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

  // Public "feature my business" listing — submitted for the owner's approval, not auto-published.
  const hasPublicLink = Object.values(form.socials || {}).some((v) => (v || '').trim())
  const featureMissing = [!logo && 'a logo', !hasPublicLink && 'a website or social link'].filter(Boolean)
  const fstatus = user?.feature_status || 'none'
  const submitFeature = () => {
    setBusy(true)
    api.post('/auth/feature-request', { testimonial: form.testimonial, rating: form.testimonial_rating })
      .then((u) => { setUser(u); toast('Sent for review — we’ll check it before it goes live', 'sage') })
      .catch(toastErr).finally(() => setBusy(false))
  }
  const withdrawFeature = () => {
    setBusy(true)
    api.post('/auth/feature-withdraw')
      .then((u) => { setUser(u); toast('Removed from our site', 'sage') })
      .catch(toastErr).finally(() => setBusy(false))
  }

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

      <Card title="Invoice & quote numbering">
        <p className="mb-2 text-sm text-fg/60">Set the format for new numbers. Build it from these tokens — anything else (letters, dashes) stays exactly as you type it:</p>
        <ul className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-fg/55 sm:grid-cols-3">
          <li><code className="rounded bg-fg/5 px-1">{'{n}'}</code> number (23)</li>
          <li><code className="rounded bg-fg/5 px-1">{'{nn}'}</code>/<code className="rounded bg-fg/5 px-1">{'{nnn}'}</code> padded (07 / 007)</li>
          <li><code className="rounded bg-fg/5 px-1">{'{DD}'}</code> day · <code className="rounded bg-fg/5 px-1">{'{MM}'}</code> month</li>
          <li><code className="rounded bg-fg/5 px-1">{'{YY}'}</code> year (26)</li>
          <li><code className="rounded bg-fg/5 px-1">{'{YYYY}'}</code> full year (2026)</li>
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field label="Invoice number format">
              <Input value={form.invoice_format} maxLength={40} onChange={(e) => setForm({ ...form, invoice_format: e.target.value })} placeholder="INV-{YYYY}-{nnn}" />
            </Field>
            <p className="mt-1.5 text-xs text-fg/50">Next invoice: <span className="font-semibold text-copper">{renderDocNumber(form.invoice_format, seqs.invoice)}</span></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[['INV-{YYYY}-{nnn}', 'INV-2026-001'], ['{nn}{DD}{MM}{YY}', '23200626'], ['{YYYY}{MM}{DD}-{nn}', '20260620-23']].map(([f, ex]) => (
                <button type="button" key={f} onClick={() => setForm({ ...form, invoice_format: f })}
                  className={cls('rounded-full border px-2.5 py-1 text-xs transition-colors', form.invoice_format === f ? 'border-copper bg-copper/10 text-copper' : 'border-line text-fg/55 hover:border-copper hover:text-copper')}>{ex}</button>
              ))}
            </div>
          </div>
          <div>
            <Field label="Quote number format">
              <Input value={form.quote_format} maxLength={40} onChange={(e) => setForm({ ...form, quote_format: e.target.value })} placeholder="Q-{YYYY}-{nnn}" />
            </Field>
            <p className="mt-1.5 text-xs text-fg/50">Next quote: <span className="font-semibold text-copper">{renderDocNumber(form.quote_format, seqs.quote)}</span></p>
          </div>
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

      <Card title="Feature on the Creatiste Command site">
        <p className="mb-3 text-sm text-fg/60">
          Ask to be showcased on our public site — your logo and a link to your website or socials, plus an
          optional testimonial. <span className="font-medium text-fg">We review every listing before it goes live</span>,
          so nothing is published until it’s approved. It’s opt-in, and you can remove it any time.
        </p>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-fg/55">Status:</span>
          <Badge tone={FEATURE_STATUS[fstatus].tone}>{FEATURE_STATUS[fstatus].label}</Badge>
        </div>
        {fstatus === 'rejected' && (
          <p className="mb-3 text-sm text-fg/60">Your listing isn’t live. Adjust it below and resubmit, or contact support if you’re unsure why.</p>
        )}
        {featureMissing.length > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-copper/30 bg-copper/5 p-3 text-sm text-fg/70">
            <Icon name="bulb" size={15} className="mt-0.5 shrink-0 text-copper" />
            <span>
              For the best listing, add {featureMissing.join(' and ')} — your logo shows in the scrolling bar on our site,
              and the link sends visitors to your business. Set these under <span className="font-medium text-fg">Logo &amp; description</span>
              {' '}and <span className="font-medium text-fg">Contact &amp; social media</span> above.
            </span>
          </div>
        )}
        <div className="mb-3">
          <span className="label">Your rating (optional)</span>
          <Stars value={form.testimonial_rating} size={24}
            onChange={(n) => setForm({ ...form, testimonial_rating: n === form.testimonial_rating ? 0 : n })} />
        </div>
        <Field label="Your words (optional testimonial)" hint="A sentence or two on how the platform helps your kitchen.">
          <Textarea rows={3} value={form.testimonial} onChange={(e) => setForm({ ...form, testimonial: e.target.value })}
            placeholder="The Creatiste Command keeps my whole operation in one place — I walk into every event prepped and calm." />
        </Field>
        <p className="mt-3 text-xs text-fg/55">
          Not every submission is published on the public site, but your testimonial is important to us — thank you for sharing it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={submitFeature} disabled={busy}>
            {fstatus === 'approved' ? 'Update & resubmit' : fstatus === 'pending' ? 'Update request' : 'Submit for review'}
          </Button>
          {fstatus !== 'none' && (
            <Button variant="secondary" onClick={withdrawFeature} disabled={busy}>Remove from our site</Button>
          )}
        </div>
        {fstatus === 'approved' && (
          <p className="mt-3 text-xs text-fg/45">Editing your testimonial (or changing your logo) sends the listing back for a quick re-check before it shows again.</p>
        )}
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
        <Field label="Current password"><PasswordInput value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
        <Field label="New password"><PasswordInput minLength={8} value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} required /></Field>
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

  // Cancellation with a retention step: before pulling the plug, offer a lighter (cheaper)
  // plan so a chef can stay on the platform instead of leaving.
  const [cancelOpen, setCancelOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const symbol = plans?.symbol || ''
  const currentMonthly = (plans?.plans?.[billing?.plan] || {}).monthly ?? Infinity
  const cheaperPlans = (plans && billing && !user?.is_founder)
    ? Object.entries(plans.plans).filter(([k, p]) => k !== billing.plan && (p.monthly || 0) < currentMonthly)
    : []

  const downgradeAndStay = (key) => {
    setBusy(key)
    api.post('/billing/change-plan', { plan: key })
      .then(async () => { toast(`You're now on ${plans.plans[key].name} — glad you're staying!`, 'sage'); await refresh(); await loadBilling(); setCancelOpen(false) })
      .catch(toastErr).finally(() => setBusy(null))
  }
  const doCancel = () => {
    setBusy('cancel')
    api.post('/billing/cancel').then((r) => {
      setCancelOpen(false)
      if (r?.ends_at) toast(`Cancellation set — your membership stays active until ${r.ends_at}`, 'sage')
      setTimeout(() => window.location.reload(), r?.ends_at ? 1800 : 400)
    }).catch(toastErr).finally(() => setBusy(null))
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
                <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>
              </div>
            )}
          </div>
        ) : <p className="text-sm text-fg/45">Loading…</p>}
      </Card>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Before you go…">
        <div className="space-y-4 text-sm">
          {user?.is_founder ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              You're a founding member on a <span className="font-medium">lifetime rate</span>. If you cancel you'll lose
              that rate for good — please contact support first if there's anything we can put right.
            </p>
          ) : cheaperPlans.length > 0 ? (
            <>
              <p className="leading-relaxed text-fg/70">
                Would a smaller plan suit you better? You'd <span className="font-medium text-fg">keep your kitchen and
                everything in it</span> — just on a lighter tier.
              </p>
              <div className="space-y-2">
                {cheaperPlans.map(([key, p]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-fg/50">{symbol}{p.monthly}/mo · {p.tagline}</p>
                    </div>
                    <Button size="sm" disabled={!!busy} onClick={() => downgradeAndStay(key)}>
                      {busy === key ? 'Switching…' : 'Switch & stay'}
                    </Button>
                  </div>
                ))}
              </div>
              {plans?.stripe_enabled && <p className="text-[11px] text-fg/40">A tier change is prorated on your next invoice.</p>}
            </>
          ) : (
            <p className="leading-relaxed text-fg/70">
              You're on our smallest plan already. Sorry to see you go — you can re-subscribe any time and your data will be waiting.
            </p>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-line/70 pt-3">
            <Button variant="danger" size="sm" disabled={!!busy} onClick={doCancel}>
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel anyway'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>Never mind, keep my plan</Button>
          </div>
        </div>
      </Modal>

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
      <div className="mt-3 space-y-1.5 text-xs">
        <p className="font-medium text-fg/70">Choose your calendar:</p>
        <p className="text-fg/55">
          <a href={webcalUrl} className="font-medium text-copper hover:underline">Add to Apple Calendar (one tap) →</a>
          <span className="text-fg/40"> — on iPhone, iPad or Mac it opens straight into “Subscribe to Calendar”.</span>
        </p>
        <p className="text-fg/55">
          <span className="font-medium text-fg/70">Google Calendar</span>
          <span className="text-fg/40"> — open Google Calendar → “Other calendars” → <span className="font-medium text-fg/60">From URL</span> → paste the link above.</span>
        </p>
        <p className="text-fg/55">
          <span className="font-medium text-fg/70">Outlook</span>
          <span className="text-fg/40"> — “Add calendar” → <span className="font-medium text-fg/60">Subscribe from web</span> → paste the link above.</span>
        </p>
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
        {/* Allergen matrix is built client-side from recipe sheets — CSV or a print/PDF table card. */}
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Allergen matrix</p>
            <p className="text-xs text-fg/45">FSA 14-allergen table for the dining table — CSV or print to PDF.</p>
          </div>
          <Link to="/app/allergens">
            <Button size="sm" variant="secondary" icon="grid2">Open</Button>
          </Link>
        </div>
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
          You’re on <span className="font-medium italic text-fg">{versionRef()}</span>. Here’s what changed in this
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

/* --------------------------------- Recently deleted (recycle bin) --------------------------------- */
function deletedWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SettingsRecycle() {
  const [data, setData] = useState(null)        // { retention_days, items }
  const [busy, setBusy] = useState(0)           // id being restored/removed
  const [confirm, setConfirm] = useState(null)  // item pending "delete forever", or 'empty'

  const load = () => api.get('/recycle').then(setData).catch(toastErr)
  useEffect(() => { load() }, [])

  const items = data?.items || []
  const retention = data?.retention_days || 30

  const restore = (item) => {
    setBusy(item.id)
    api.post(`/recycle/${item.id}/restore`)
      .then((res) => { toast(`${res.kind || 'Item'} restored`, 'sage'); load() })
      .catch(toastErr).finally(() => setBusy(0))
  }
  const removeForever = (item) => {
    setBusy(item.id)
    api.del(`/recycle/${item.id}`)
      .then(() => { setConfirm(null); toast('Deleted permanently'); load() })
      .catch(toastErr).finally(() => setBusy(0))
  }
  const emptyBin = () => {
    api.del('/recycle')
      .then(() => { setConfirm(null); toast('Recycle bin emptied'); load() })
      .catch(toastErr)
  }

  return (
    <div className="space-y-5">
      <Card title="How recovery works">
        <div className="space-y-3 text-sm leading-relaxed text-fg/65">
          <p>
            Deleted something by mistake? Don’t worry — you can bring it back yourself. When you delete
            a recipe, menu, client, list, supplier, task or any other item, it isn’t gone for good. It’s
            kept here for <span className="font-semibold text-fg">{retention} days</span>, then removed
            automatically.
          </p>
          <ul className="space-y-1.5">
            <li className="flex gap-2"><Icon name="replay" size={16} className="mt-0.5 shrink-0 text-copper" /><span><span className="font-medium text-fg">Restore</span> puts the item straight back where it was, exactly as it was.</span></li>
            <li className="flex gap-2"><Icon name="trash" size={16} className="mt-0.5 shrink-0 text-fg/50" /><span><span className="font-medium text-fg">Delete forever</span> removes it permanently — only use this if you’re certain.</span></li>
            <li className="flex gap-2"><Icon name="clock" size={16} className="mt-0.5 shrink-0 text-fg/50" /><span>Anything older than {retention} days clears itself, so the bin never piles up.</span></li>
          </ul>
          <p className="text-fg/50">
            Tip: if you can’t find an old item in its normal page, check here first — it may simply be waiting to be restored.
          </p>
        </div>
      </Card>

      <Card title={`In the bin${items.length ? ` · ${items.length}` : ''}`} action={
        items.length ? <Button variant="ghost" size="sm" onClick={() => setConfirm('empty')}>Empty bin</Button> : null
      }>
        {!data ? (
          <p className="py-6 text-center text-sm text-fg/45">Loading…</p>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <Icon name="trash" size={32} className="mx-auto mb-3 text-fg/25" />
            <p className="text-sm font-medium text-fg/70">Nothing deleted recently</p>
            <p className="mt-1 text-sm text-fg/45">Anything you delete will appear here for {retention} days, ready to restore.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="ink">{item.kind}</Badge>
                    <p className="truncate font-medium text-fg">{item.label}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-fg/45">
                    Deleted {deletedWhen(item.deleted_at)}{item.deleted_by ? ` by ${item.deleted_by}` : ''} ·{' '}
                    <span className={cls(item.days_left <= 3 ? 'font-medium text-red-500' : 'text-fg/45')}>
                      {item.days_left} day{item.days_left === 1 ? '' : 's'} left to restore
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" icon="replay" disabled={busy === item.id || !item.restorable} onClick={() => restore(item)}>
                    Restore
                  </Button>
                  <Button size="sm" variant="ghost" icon="trash" disabled={busy === item.id} onClick={() => setConfirm(item)}
                    className="text-fg/50 hover:text-red-500" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirm && (
        <Modal open onClose={() => setConfirm(null)} title={confirm === 'empty' ? 'Empty the recycle bin?' : 'Delete forever?'}>
          <div className="space-y-4">
            <p className="text-sm text-fg/70">
              {confirm === 'empty'
                ? 'This permanently removes everything in the bin. Restored items are unaffected — but anything still in here will be gone for good and cannot be recovered.'
                : <>This permanently removes <span className="font-medium text-fg">{confirm.label}</span>. It cannot be recovered afterwards.</>}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Keep it</Button>
              <Button variant="danger" onClick={() => confirm === 'empty' ? emptyBin() : removeForever(confirm)}>
                {confirm === 'empty' ? 'Empty bin' : 'Delete forever'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
