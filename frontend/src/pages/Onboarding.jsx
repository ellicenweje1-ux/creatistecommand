import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { isActive, useAuth } from '../auth'
import { cls, fmtMoney } from '../format'
import { Brand, Button, Icon, toast, toastErr } from '../ui'

export default function Onboarding() {
  const { user, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [pricing, setPricing] = useState(null)
  const [selected, setSelected] = useState('pro')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.get('/billing/plans').then(setPricing).catch(toastErr) }, [])

  // After Stripe redirects back, poll until the webhook flips the account active.
  useEffect(() => {
    if (!params.get('paid')) return
    let tries = 0
    const tick = setInterval(async () => {
      tries += 1
      const u = await refresh().catch(() => null)
      if (u && isActive(u)) { clearInterval(tick); toast('Payment received — welcome aboard!', 'sage'); navigate('/app') }
      if (tries > 20) clearInterval(tick)
    }, 1500)
    return () => clearInterval(tick)
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (isActive(user)) navigate('/app') }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="min-h-screen bg-base">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/"><Brand /></Link>
        <button onClick={logout} className="text-sm font-medium text-fg/50 hover:text-fg">Log out</button>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-copper">Step 2 of 2 — activate your kitchen</p>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Choose your plan, {user?.name?.split(' ')[0] || 'chef'}.</h1>
          <p className="mt-3 text-fg/55">
            Activation includes your one-time onboarding & setup fee plus your first month's membership.
            {pricing?.stripe_enabled ? ' Payment is handled securely by Stripe.' : ''}
          </p>
        </div>

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
      </main>
    </div>
  )
}
