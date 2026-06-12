import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { isActive, useAuth } from '../auth'
import { SessionCard, SlotPicker, perkTitle } from '../booking'
import { cls, fmtMoney } from '../format'
import { FounderBadge } from '../founders'
import { Brand, Button, Icon, Spinner, toast, toastErr } from '../ui'

/* Two-step activation, verification-first:
   Step 1 — book the onboarding video session. The workspace stays locked until the
            platform owner marks that call complete; the free trial starts right then.
   Step 2 — choose a plan (or the founders card) and activate. */

function BookingStep({ user, refresh, trialDays }) {
  const [mine, setMine] = useState(null)
  const [rebooking, setRebooking] = useState(false)
  const load = () => api.get('/onboarding/mine').then(setMine).catch(toastErr)
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const booked = mine?.sessions?.find((s) => s.kind === 'onboarding' && s.status === 'booked')

  // While waiting on the call, quietly poll so the page unlocks itself the moment
  // Ellice marks the session complete.
  useEffect(() => {
    if (!booked) return
    const tick = setInterval(() => refresh().catch(() => {}), 8000)
    return () => clearInterval(tick)
  }, [booked]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mine) return <Spinner />

  return (
    <div className="mx-auto mt-10 max-w-xl space-y-5">
      {booked && !rebooking ? (
        <>
          <SessionCard
            session={booked}
            title="Your onboarding session is booked"
            note="This call is how we verify and set up every kitchen personally. The moment it's done, your workspace unlocks and your free trial starts."
            onRebook={() => setRebooking(true)}
            onCancelled={load}
          />
          <div className="rounded-xl border border-line bg-card p-4 text-sm leading-relaxed text-fg/60">
            <p className="font-display font-semibold text-fg">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Join the video call at your booked time — bring your questions.</li>
              <li>We walk through your kitchen together and verify your account.</li>
              <li>Your {trialDays || 5}-day free trial unlocks immediately after — no card needed for the trial.</li>
            </ol>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-card p-6 shadow-card">
          <h3 className="font-display text-lg font-semibold">Pick a time for your onboarding session</h3>
          <p className="mb-4 mt-1 text-sm text-fg/55">
            A {user?.is_founder ? 'personal founders ' : ''}video call with Ellice to set up your kitchen and
            verify your account — your {trialDays || 5}-day free trial starts as soon as it's complete.
          </p>
          <SlotPicker kind="onboarding" confirmLabel="Book my session"
            onBooked={() => { toast('Session booked — see you on the call!', 'sage'); setRebooking(false); load() }} />
          {rebooking && (
            <button className="mt-3 text-xs text-fg/45 hover:text-fg/70" onClick={() => setRebooking(false)}>
              ← Keep my current booking
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Onboarding() {
  const { user, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [pricing, setPricing] = useState(null)
  const [founders, setFounders] = useState(null) // the founder's private offer (lifetime rate)
  const [selected, setSelected] = useState(user?.is_founder ? 'founders' : 'pro')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.get('/billing/plans').then(setPricing).catch(toastErr) }, [])
  useEffect(() => {
    if (user?.is_founder) api.get('/founders/status').then(setFounders).catch(toastErr)
  }, [user?.is_founder])

  // Back from Stripe Checkout: confirm the session server-side straight away (works
  // even if the webhook isn't configured/delayed), then poll until the account flips.
  useEffect(() => {
    if (!params.get('paid')) return
    const sessionId = params.get('session_id')
    if (sessionId) api.post('/billing/confirm', { session_id: sessionId }).catch(() => {})
    let tries = 0
    const tick = setInterval(async () => {
      tries += 1
      const u = await refresh().catch(() => null)
      if (u && isActive(u)) { clearInterval(tick); toast('Payment received — welcome aboard!', 'sage'); navigate('/app') }
      if (tries > 20) clearInterval(tick)
    }, 1500)
    return () => clearInterval(tick)
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.role === 'admin' || (user?.subscription_status === 'active' && user?.onboarded_at)) navigate('/app')
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async () => {
    setBusy(true)
    try {
      const res = await api.post('/billing/checkout', { plan: selected })
      if (res.url) {
        window.location.assign(res.url)
        return
      }
      // Demo billing mode (no Stripe key configured)
      await api.post('/billing/demo-activate', { plan: selected })
      await refresh()
      toast('Account activated — welcome aboard!', 'sage')
      navigate('/app')
    } catch (err) {
      toastErr(err)
    } finally {
      setBusy(false)
    }
  }

  const currency = pricing?.currency || 'GBP'
  const plan = pricing?.plans?.[selected]
  const needsCall = user && user.role !== 'admin' && !user.onboarded_at

  return (
    <div className="min-h-screen bg-base">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/"><Brand /></Link>
        <button onClick={logout} className="text-sm font-medium text-fg/50 hover:text-fg">Log out</button>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-copper">
            {needsCall ? 'Step 1 of 2 — your onboarding session' : 'Step 2 of 2 — activate your kitchen'}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            {needsCall
              ? `Let's get you onboarded, ${user?.name?.split(' ')[0] || 'chef'}.`
              : user?.is_founder
                ? `Activate your founding seat, ${user?.name?.split(' ')[0] || 'chef'}.`
                : `Choose your plan, ${user?.name?.split(' ')[0] || 'chef'}.`}
          </h1>
          <p className="mt-3 text-fg/55">
            {needsCall
              ? 'Every kitchen on the platform is onboarded personally. Book your video session below — access unlocks once it’s complete.'
              : user?.is_founder
                ? 'Your founders rate covers everything — locked for as long as you stay.'
                : "Activation includes your one-time onboarding & setup fee plus your first month's membership."}
            {!needsCall && pricing?.stripe_enabled ? ' Payment is handled securely by Stripe.' : ''}
          </p>
          {!needsCall && user?.subscription_status === 'trialing' && (
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-copper/40 bg-copper/10 px-4 py-3 text-sm">
              You're on your <span className="font-semibold">free trial</span>
              {user.trial_ends_at ? <> — it ends <span className="font-semibold">{user.trial_ends_at}</span></> : null}.
              {pricing?.stripe_enabled
                ? ' Subscribe now and your card is only charged when the trial ends.'
                : ' Activate below to keep your kitchen, or'}{' '}
              {!pricing?.stripe_enabled && (
                <button className="font-semibold text-copper underline" onClick={() => navigate('/app')}>keep exploring →</button>
              )}
            </div>
          )}
        </div>

        {needsCall ? (
          <BookingStep user={user} refresh={refresh} trialDays={pricing?.trial_days} />
        ) : user?.is_founder ? (
          /* Founders skip the plan grid — one membership, one lifetime rate */
          founders ? (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-copper bg-card p-6 shadow-card ring-2 ring-copper/25">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{founders.name}</h3>
                <FounderBadge number={founders.founder_number} />
              </div>
              <p className="mt-3 font-display text-4xl font-semibold">
                {fmtMoney(founders.monthly, founders.currency)}<span className="text-base font-normal text-fg/45">/month</span>
              </p>
              <p className="mt-1 text-sm font-medium text-copper">Your lifetime founders rate — it never rises while you stay.</p>
              <ul className="mt-4 space-y-1.5">
                {(founders.perks || []).map((p) => (
                  <li key={perkTitle(p)} className="flex items-start gap-1.5 text-xs leading-relaxed text-fg/65">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-sage" />{perkTitle(p)}
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-fg/60">Onboarding & setup</span>
                  <span>{user?.onboarding_paid ? 'Paid ✓' : founders.onboarding > 0 ? fmtMoney(founders.onboarding, founders.currency) : <span className="font-medium text-sage">Waived</span>}</span>
                </div>
                <div className="flex justify-between"><span className="text-fg/60">First month membership</span><span>{fmtMoney(founders.monthly, founders.currency)}</span></div>
                <div className="flex justify-between border-t border-line pt-2 font-semibold">
                  <span>Due today</span>
                  <span>{fmtMoney((user?.onboarding_paid ? 0 : founders.onboarding) + founders.monthly, founders.currency)}</span>
                </div>
              </div>
              <Button className="mt-5 w-full" size="lg" disabled={busy} onClick={pay}>
                {busy ? 'Processing…' : pricing?.stripe_enabled ? 'Pay securely with Stripe' : 'Activate my founding seat'}
              </Button>
              {!pricing?.stripe_enabled && (
                <p className="mt-3 text-center text-xs text-fg/40">
                  Demo billing mode — no Stripe key configured, so activation is simulated.
                </p>
              )}
            </div>
          ) : <Spinner />
        ) : (
        <>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {pricing && Object.entries(pricing.plans).map(([key, p]) => (
            <button key={key} onClick={() => setSelected(key)}
              className={cls('rounded-2xl border bg-card p-5 text-left shadow-card transition-all',
                selected === key ? 'border-copper ring-2 ring-copper/30' : 'border-line hover:border-copper/40')}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                {selected === key && <span className="rounded-full bg-copper p-1 text-ink"><Icon name="check" size={12} /></span>}
              </div>
              <p className="mt-3 font-display text-3xl font-semibold">{fmtMoney(p.monthly, currency)}<span className="text-sm font-normal text-fg/45">/mo</span></p>
              <p className="text-xs text-fg/50">+ {fmtMoney(p.onboarding, currency)} onboarding (one-time)</p>
              <ul className="mt-4 space-y-1.5">
                {(p.features || []).slice(0, 5).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-fg/65">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-sage" />{f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {plan && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-line bg-card p-6 shadow-card">
            <h3 className="font-display font-semibold">Due today</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-fg/60">Onboarding & setup ({plan.name})</span><span>{user?.onboarding_paid ? 'Paid ✓' : fmtMoney(plan.onboarding, currency)}</span></div>
              <div className="flex justify-between"><span className="text-fg/60">First month membership</span><span>{fmtMoney(plan.monthly, currency)}</span></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <span>Total</span>
                <span>{fmtMoney((user?.onboarding_paid ? 0 : plan.onboarding) + plan.monthly, currency)}</span>
              </div>
            </div>
            <Button className="mt-5 w-full" size="lg" disabled={busy} onClick={pay}>
              {busy ? 'Processing…' : pricing?.stripe_enabled ? 'Pay securely with Stripe' : 'Activate my account'}
            </Button>
            {!pricing?.stripe_enabled && (
              <p className="mt-3 text-center text-xs text-fg/40">
                Demo billing mode — no Stripe key configured, so activation is simulated.
              </p>
            )}
          </div>
        )}
        </>
        )}
      </main>
    </div>
  )
}
