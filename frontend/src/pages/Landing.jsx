import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtMoney } from '../format'
import { Button, Icon } from '../ui'

const FEATURES = [
  { icon: 'calendar', title: 'Bookings & calendar', text: 'Every enquiry, quote and confirmed event in one diary — with guest counts, venues, menus and dietary flags attached.' },
  { icon: 'box', title: 'Inventory with shelf life', text: 'Know what is in stock, what expires this week and what is running low before you write a single shopping list.' },
  { icon: 'cart', title: 'Multi-shop shopping lists', text: 'One list per booking, grouped by butcher, fishmonger, market and wholesaler. Check items off on your phone as you go.' },
  { icon: 'truck', title: 'Online order tracking', text: 'Track speciality orders and deliveries so nothing arrives late for prep day — with chase reminders for delays.' },
  { icon: 'checks', title: 'Prep & service tasks', text: 'Work backwards from event day: marinades, advance prep, pack lists and a service-day timeline you can trust.' },
  { icon: 'map', title: 'Prep-day route planner', text: 'Order your market runs and supplier stops, with timings — then open the whole route in Google Maps.' },
  { icon: 'users', title: 'Client portfolio', text: 'Preferences, allergies, reviews and booking history for every client — repeat business made effortless.' },
  { icon: 'layout', title: 'Setup design canvas', text: 'Sketch buffet lines, guest tables, bars and stations on a drag-and-drop floor plan you can share.' },
  { icon: 'bulb', title: 'Idea capture', text: 'That dish you dreamt up mid-service? Capture it in seconds, pin it, and let AI polish it into a usable note.' },
  { icon: 'coins', title: 'Invoices & finances', text: 'Quote, invoice, log expenses and watch profit per month — without leaving your command centre.' },
  { icon: 'sparkle', title: 'AI sous-chef', text: 'Generate recipes, build shopping lists from menus minus stock, and draft full prep plans with Claude-powered AI.' },
  { icon: 'shield', title: 'Built for the move', text: 'Fully responsive: at the pass, in the van, at the market. Your whole operation in your pocket.' },
]

const STEPS = [
  ['Create your account', 'Sign up in under a minute with your business details.'],
  ['Choose your plan', 'Pick the tier that fits your kitchen and complete onboarding.'],
  ['Load your world', 'Add recipes, stock and clients — or start from your next booking.'],
  ['Run the pass', 'Plan, shop, prep and serve with everything in one place.'],
]

export default function Landing() {
  const { user } = useAuth()
  const [pricing, setPricing] = useState(null)
  useEffect(() => { api.get('/billing/plans').then(setPricing).catch(() => {}) }, [])

  const currency = pricing?.currency || 'GBP'

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl font-semibold tracking-tight">
          The Creatiste <em className="italic text-copper">Command</em>
        </span>
        <nav className="flex items-center gap-2">
          <a href="#pricing" className="hidden px-3 text-sm font-medium text-ink/60 hover:text-ink sm:block">Pricing</a>
          {user ? (
            <Link to="/app"><Button variant="dark">Open the app</Button></Link>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost">Log in</Button></Link>
              <Link to="/register"><Button>Get started</Button></Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 md:pt-16">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-copper/30 bg-copper/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-copper">
          <Icon name="flame" size={13} /> For private chefs & caterers
        </p>
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
          Run every booking like a <em className="italic text-copper">brigade of one.</em>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/60">
          Stock lists, shopping runs, prep schedules, supplier orders, client preferences, floor plans and invoices —
          the entire back-of-house of your business in one command centre, built to be used on the move.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to={user ? '/app' : '/register'}><Button size="lg" icon="arrowRight">Start commanding your kitchen</Button></Link>
          <a href="#features"><Button size="lg" variant="secondary">See what's inside</Button></a>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {[['10,000×', 'less chaos on prep day'], ['1 place', 'for stock, shops & schedules'], ['0 lost', 'on-the-spot ideas'], ['24/7', 'in your pocket']].map(([big, small]) => (
            <div key={small} className="bg-white p-5">
              <p className="font-display text-2xl font-semibold text-copper">{big}</p>
              <p className="mt-1 text-sm text-ink/55">{small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-ink py-16 text-cream">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Everything between the enquiry <em className="italic text-copper">and the applause.</em></h2>
          <p className="mt-3 max-w-2xl text-cream/55">Built around the real workflow of catering: what you have, what you need, where to get it, when to prep it, and who it's for.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-copper/40">
                <Icon name={f.icon} size={22} className="text-copper" />
                <h3 className="mt-3 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/55">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-3xl font-semibold">From sign-up to service.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <span className="font-display text-3xl font-semibold text-copper/30">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 font-display font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-ink/55">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-parchment py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Onboarding + membership.</h2>
          <p className="mt-3 max-w-2xl text-ink/60">
            Every chef starts with a one-time onboarding & setup fee, then a monthly membership.
            {pricing?.trial_days ? ` Includes a ${pricing.trial_days}-day free trial.` : ''}
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {pricing ? Object.entries(pricing.plans).map(([key, plan]) => (
              <div key={key} className={cls('flex flex-col rounded-2xl border bg-white p-6 shadow-card', key === 'pro' ? 'border-copper ring-2 ring-copper/25' : 'border-line')}>
                {key === 'pro' && <span className="mb-2 self-start rounded-full bg-copper px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-cream">Most popular</span>}
                <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-ink/55">{plan.tagline}</p>
                <p className="mt-4 font-display text-4xl font-semibold">{fmtMoney(plan.monthly, currency)}<span className="text-base font-normal text-ink/45">/month</span></p>
                <p className="text-sm text-ink/50">+ {fmtMoney(plan.onboarding, currency)} one-time onboarding</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {(plan.features || []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
                      <Icon name="check" size={15} className="mt-0.5 shrink-0 text-sage" />{f}
                    </li>
                  ))}
                </ul>
                <Link to={user ? '/onboarding' : '/register'} className="mt-6">
                  <Button className="w-full" variant={key === 'pro' ? 'primary' : 'secondary'}>Choose {plan.name}</Button>
                </Link>
              </div>
            )) : <p className="text-ink/40">Loading plans…</p>}
          </div>
        </div>
      </section>

      {/* CTA + footer */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold md:text-4xl">
          Your kitchen already runs on your standards. <em className="italic text-copper">Now your admin can too.</em>
        </h2>
        <Link to={user ? '/app' : '/register'} className="mt-8 inline-block"><Button size="lg" icon="arrowRight">Get started today</Button></Link>
      </section>
      <footer className="border-t border-line py-8 text-center text-sm text-ink/40">
        © {new Date().getFullYear()} The Creatiste Command — the command centre for chefs & caterers.
      </footer>
    </div>
  )
}
