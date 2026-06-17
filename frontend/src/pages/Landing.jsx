import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtMoney } from '../format'
import IntroFilm from '../introfilm'
import { Brand, Button, Icon } from '../ui'
import { VersionStamp } from '../version'

const HOOKS = [
  { icon: 'doc', q: '…one event lived in your notes app, another in a spreadsheet — and the timings only in your head?', a: 'Here, every booking keeps its menu, guest count, dietaries, tasks and lists attached to it.' },
  { icon: 'truck', q: '…you packed the van at 2 a.m., hoping nothing was left on the kitchen floor?', a: 'Packing checklists per event mean the chafers, signage and serving spoons all make the trip.' },
  { icon: 'coins', q: '…you quoted a 120-guest menu from memory — and felt it on the night you underpriced?', a: 'Build quotes properly, send a link your client approves from their phone, then invoice from the same screen.' },
  { icon: 'mail', q: '…a dream client enquired mid-service, and the message sat unread until they booked elsewhere?', a: 'A branded enquiry form feeds new leads straight into your bookings diary, so nothing slips.' },
]

const GAP_POINTS = [
  'One subscription that replaces six scattered apps',
  'Built around real prep days — shop runs, van packs, service timelines',
  'From first enquiry to final invoice without switching tabs',
  'With you on the move: at the market, in the van, at the event',
]

const FEATURES = [
  { icon: 'calendar', title: 'Bookings & calendar', text: 'Every enquiry, quote and confirmed event in one diary — guest counts, venues, menus and dietary flags attached.' },
  { icon: 'fork', title: 'Tastings & consultations', text: 'A dedicated diary for tastings, consultations, site visits and calls — linked to clients and bookings.' },
  { icon: 'box', title: 'Inventory with shelf life', text: 'Know what is in stock, what expires this week and what is running low before you write a single list.' },
  { icon: 'cart', title: 'Multi-shop shopping lists', text: 'One list per booking, grouped by butcher, fishmonger, market and wholesaler. Check off as you go.' },
  { icon: 'clipboard', title: 'Packing checklists', text: 'Van-load lists for equipment, crockery and signage — nothing left on the kitchen floor.' },
  { icon: 'truck', title: 'Online order tracking', text: 'Track speciality orders and deliveries so nothing arrives late for prep day.' },
  { icon: 'checks', title: 'Prep & service tasks', text: 'Work backwards from event day: marinades, advance prep, pack lists and a service-day timeline.' },
  { icon: 'map', title: 'Prep-day route planner', text: 'Order your market runs and supplier stops with timings — then open the whole route in Google Maps.' },
  { icon: 'users', title: 'Staff, rotas & oversight', text: 'Give staff their own logins, set rotas and assignments, and see every change they make in your activity trail.' },
  { icon: 'doc', title: 'Client quote approvals', text: 'Send a quote link your client can approve from their phone — no login, no printing, no chasing.' },
  { icon: 'flame', title: 'Public enquiry form', text: 'A branded enquiry link for your website or Instagram that feeds new leads straight into your bookings.' },
  { icon: 'grid2', title: 'Allergen matrix', text: 'Generate a dish-by-allergen matrix for any menu from your recipe sheets — print it for the buffet table.' },
  { icon: 'tag', title: 'Supplier price book', text: 'Keep every supplier\u2019s prices in one book and instantly see who sells an item cheapest.' },
  { icon: 'layout', title: 'Design studio', text: 'Floor plans with tables, stations and bars — plus pens, lines, shapes and colours to sketch freely.' },
  { icon: 'bulb', title: 'My Brain', text: 'Offload ideas, reminders and things to keep in mind the second they strike — captured before they\u2019re clouded by a million things.' },
  { icon: 'sparkle', title: 'Mise — your AI sous-chef', text: 'Named for mise en place — everything in its place before service. Mise drafts recipes, builds shopping lists from menus minus stock, and plans prep timelines back from event day.' },
  { icon: 'coins', title: 'Quotes, invoices & finances', text: 'Quote, invoice, log expenses and watch profit per month — without leaving your command centre.' },
  { icon: 'shield', title: 'Built for the move', text: 'Fully responsive: at the event, in the van, at the market. Your whole operation in your pocket.' },
]

/* Tier comparison matrix — each row is [benefit, minimum plan level that includes it].
   Levels mirror the server-side gating: 1 = Solo Chef, 2 = Pro Caterer, 3 = Elite Kitchen. */
const PLAN_LEVELS = { starter: 1, pro: 2, elite: 3 }
const COMPARE = [
  {
    group: 'Plan & run events',
    rows: [
      ['Bookings & event calendar', 1],
      ['Prep & service task lists', 1],
      ['Live kitchen dashboard', 1],
      ['Tastings & consultations diary', 2],
      ['Client portfolio & preferences', 2],
      ['Prep-day route planner', 2],
      ['Public enquiry form → bookings', 2],
    ],
  },
  {
    group: 'Kitchen & shopping',
    rows: [
      ['Recipe master sheets', 1],
      ['Allergen matrix generator', 1],
      ['Inventory with shelf-life alerts', 1],
      ['Multi-shop shopping lists', 1],
      ['Packing checklists', 1],
      ['Online order tracking', 2],
      ['Supplier price book', 2],
    ],
  },
  {
    group: 'Business & money',
    rows: [
      ['My Brain — idea capture', 1],
      ['Design studio & floor plans', 2],
      ['Invoicing & expense tracking', 2],
      ['Monthly profit overview', 2],
      ['Email notifications', 2],
      ['Client quote approval links', 3],
    ],
  },
  {
    group: 'Team & the edge',
    rows: [
      ['Mise — your AI sous-chef', 3],
      ['Staff logins, rotas & assignments', 3],
      ['Owner oversight: activity trail', 3],
      ['Priority onboarding & support', 3],
    ],
  },
]

function CompareCell({ included, highlight }) {
  return (
    <td className={cls('py-2.5 text-center', highlight && 'bg-copper/[0.06]')}>
      {included
        ? <Icon name="check" size={17} className="inline text-sage" strokeWidth={2.2} />
        : <Icon name="x" size={14} className="inline text-fg/25" />}
      <span className="sr-only">{included ? 'Included' : 'Not included'}</span>
    </td>
  )
}

const STEPS = [
  ['Create your account', 'Sign up in under a minute with your business details.'],
  ['Book your onboarding call', 'A personal video session to set up and verify your kitchen — your free trial unlocks the moment it’s done.'],
  ['Load your world', 'Add recipes, stock and clients — or start from your next booking.'],
  ['Run the operation', 'Plan, shop, prep and serve — and pick the plan that fits when your trial ends.'],
]

export default function Landing() {
  const { user } = useAuth()
  const [pricing, setPricing] = useState(null)
  useEffect(() => { api.get('/billing/plans').then(setPricing).catch(() => {}) }, [])

  const currency = pricing?.currency || 'GBP'

  return (
    <div className="min-h-screen bg-base">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <nav className="flex items-center gap-2">
          <a href="#film" className="hidden px-3 text-sm font-medium text-fg/60 hover:text-fg md:block">Intro</a>
          <a href="#why" className="hidden px-3 text-sm font-medium text-fg/60 hover:text-fg md:block">Why Us?</a>
          <a href="#pricing" className="hidden px-3 text-sm font-medium text-fg/60 hover:text-fg sm:block">Pricing</a>
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
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg/60">
          Stock lists, shopping runs, prep schedules, supplier orders, client preferences, floor plans and invoices —
          the entire back-of-house of your business in one command centre, built to be used on the move.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to={user ? '/app' : '/register'}><Button size="lg" icon="arrowRight">Start commanding your kitchen</Button></Link>
          <a href="#film"><Button size="lg" variant="secondary" icon="play">Watch the intro · 1 min</Button></a>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {[['10,000×', 'less chaos on prep day'], ['1 place', 'for stock, shops & schedules'], ['0 lost', 'on-the-spot ideas'], ['24/7', 'in your pocket']].map(([big, small]) => (
            <div key={small} className="bg-card p-5">
              <p className="font-display text-2xl font-semibold text-copper">{big}</p>
              <p className="mt-1 text-sm text-fg/55">{small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The introduction film */}
      <section id="film" className="bg-ink py-16 text-cream md:py-20">
        <div className="mx-auto max-w-4xl px-5">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-copper">The introduction</p>
            <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
              One minute inside <em className="italic text-copper">your new command centre.</em>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-cream/55">
              Press play for a guided welcome — what The Creatiste Command is, who it&rsquo;s built for,
              and the gap it closes between your kitchen and your admin. Sound on for the voiceover; captions run throughout.
            </p>
          </div>
          <div className="mt-9">
            <IntroFilm ctaTo={user ? '/app' : '/register'} ctaLabel={user ? 'Open the app' : 'Start your free trial'} />
          </div>
        </div>
      </section>

      {/* Why this exists — the hooks + the gap */}
      <section id="why" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-copper">Why this exists</p>
        <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">Have you ever been in a position where…</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {HOOKS.map((h) => (
            <div key={h.icon} className="rounded-xl border border-line bg-card p-5 shadow-card">
              <div className="flex items-start gap-3.5">
                <span className="rounded-lg bg-copper/10 p-2.5 text-copper"><Icon name={h.icon} size={19} /></span>
                <div>
                  <p className="font-display text-lg font-semibold leading-snug">{h.q}</p>
                  <p className="mt-2 text-sm leading-relaxed text-fg/55">{h.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-8 rounded-2xl border border-copper/30 bg-ink p-6 text-cream md:grid-cols-2 md:p-9">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper">The gap we fill</p>
            <h3 className="mt-2 font-display text-2xl font-semibold leading-snug md:text-3xl">
              You were trained for the event — <em className="italic text-copper">not the paperwork.</em>
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-cream/60">
              Restaurant software assumes a manager&rsquo;s office. Generic to-do apps don&rsquo;t know what a tasting,
              a van pack or an allergen matrix is. So independent chefs and caterers end up being the brigade, the office
              and the delivery driver — across six apps and a notebook. The Creatiste Command closes that gap:
              one purpose-built command centre for the whole job.
            </p>
          </div>
          <ul className="space-y-3 self-center">
            {GAP_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-cream/80">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-copper" />{p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-ink py-16 text-cream">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Everything between the enquiry <em className="italic text-copper">and the final presentation.</em></h2>
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
            <div key={title} className="rounded-xl border border-line bg-card p-5 shadow-card">
              <span className="font-display text-3xl font-semibold text-copper/30">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 font-display font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-fg/55">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-parchment py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Onboarding + membership.</h2>
          <p className="mt-3 max-w-2xl text-fg/60">
            Every chef starts with a personal onboarding session, a one-time setup fee, then a monthly membership.
            {pricing?.trial_days ? ` Includes a ${pricing.trial_days}-day free trial after your onboarding call — no card needed for the trial.` : ''}
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {pricing ? Object.entries(pricing.plans).map(([key, plan]) => (
              <div key={key} className={cls('flex flex-col rounded-2xl border bg-card p-6 shadow-card', key === 'pro' ? 'border-copper ring-2 ring-copper/25' : 'border-line')}>
                {key === 'pro' && <span className="mb-2 self-start rounded-full bg-copper px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink">Most popular</span>}
                <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-fg/55">{plan.tagline}</p>
                <p className="mt-4 font-display text-4xl font-semibold">{fmtMoney(plan.monthly, currency)}<span className="text-base font-normal text-fg/45">/month</span></p>
                <p className="text-sm text-fg/50">+ {fmtMoney(plan.onboarding, currency)} one-time onboarding</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {(plan.features || []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-fg/70">
                      <Icon name="check" size={15} className="mt-0.5 shrink-0 text-sage" />{f}
                    </li>
                  ))}
                </ul>
                <Link to={user ? '/onboarding' : '/register'} className="mt-6">
                  <Button className="w-full" variant={key === 'pro' ? 'primary' : 'secondary'}>Choose {plan.name}</Button>
                </Link>
              </div>
            )) : <p className="text-fg/40">Loading plans…</p>}
          </div>

          {/* Tier-by-tier comparison table */}
          {pricing && (
            <div id="compare" className="mt-14">
              <h3 className="font-display text-2xl font-semibold md:text-3xl">Every benefit, <em className="italic text-copper">tier by tier.</em></h3>
              <p className="mt-2 max-w-2xl text-sm text-fg/55">
                A <Icon name="check" size={13} className="inline -translate-y-px text-sage" strokeWidth={2.4} /> means it&rsquo;s included in that membership;
                a <Icon name="x" size={11} className="inline -translate-y-px text-fg/40" /> means it unlocks on a higher tier.
                Start where the business is today and move up when it grows.
              </p>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-card shadow-card">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="px-4 py-4 align-bottom sm:px-5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/45">What you get</span>
                      </th>
                      {Object.entries(pricing.plans).map(([key, plan]) => (
                        <th key={key} scope="col" className={cls('w-28 px-3 py-4 text-center align-bottom sm:w-36', key === 'pro' && 'bg-copper/[0.06]')}>
                          {key === 'pro' && <span className="mb-1.5 inline-block rounded-full bg-copper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">Most popular</span>}
                          <p className="font-display text-[15px] font-semibold leading-tight">{plan.name}</p>
                          <p className="mt-0.5 text-xs font-normal text-fg/50">{fmtMoney(plan.monthly, currency)}/mo</p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE.map(({ group, rows }) => (
                      <Fragment key={group}>
                        <tr className="border-b border-line/70 bg-parchment/60">
                          <td colSpan={1 + Object.keys(pricing.plans).length} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-copper sm:px-5">
                            {group}
                          </td>
                        </tr>
                        {rows.map(([benefit, min]) => (
                          <tr key={benefit} className="border-b border-line/40 last:border-line/70">
                            <th scope="row" className="px-4 py-2.5 text-sm font-normal text-fg/80 sm:px-5">{benefit}</th>
                            {Object.entries(pricing.plans).map(([key], i) => (
                              <CompareCell key={key} included={(PLAN_LEVELS[key] ?? i + 1) >= min} highlight={key === 'pro'} />
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="px-4 py-4 text-xs text-fg/45 sm:px-5">One-time onboarding fee<br />— then pick your tier</td>
                      {Object.entries(pricing.plans).map(([key, plan]) => (
                        <td key={key} className={cls('px-3 py-4 text-center', key === 'pro' && 'bg-copper/[0.06]')}>
                          <p className="text-xs text-fg/55">{fmtMoney(plan.onboarding, currency)} once</p>
                          <Link to={user ? '/onboarding' : '/register'} className="mt-2 inline-block">
                            <Button size="sm" variant={key === 'pro' ? 'primary' : 'secondary'}>Choose</Button>
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-3 text-xs text-fg/45">
                Every membership includes the personal onboarding video call{pricing.trial_days ? `, a ${pricing.trial_days}-day free trial` : ''},
                unlimited bookings and recipes, and the full command centre on any device — phone, tablet or laptop.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA + footer */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold md:text-4xl">
          Your kitchen already runs on your standards. <em className="italic text-copper">Now your admin can too.</em>
        </h2>
        <Link to={user ? '/app' : '/register'} className="mt-8 inline-block"><Button size="lg" icon="arrowRight">Get started today</Button></Link>
      </section>
      <footer className="border-t border-line py-8 text-center text-sm text-fg/40">
        <p>© {new Date().getFullYear()} The Creatiste Command — the command centre for chefs &amp; caterers.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/app/support" className="font-medium text-copper hover:underline">Support &amp; FAQs</Link>
          <span className="text-fg/20" aria-hidden>·</span>
          <Link to="/terms" className="font-medium text-copper hover:underline">Terms of Service</Link>
          <span className="text-fg/20" aria-hidden>·</span>
          <Link to="/privacy" className="font-medium text-copper hover:underline">Privacy Policy</Link>
        </p>
        <p className="mt-4 flex justify-center"><VersionStamp /></p>
      </footer>
    </div>
  )
}
