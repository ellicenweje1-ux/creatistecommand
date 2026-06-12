import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { perkIcon, perkText, perkTitle } from '../booking'
import { fmtMoney } from '../format'
import { Brand, Button, Icon, Spinner } from '../ui'

/* The private founders invite page. Reached only through the secret link shared by
   the platform owner (Admin → Founders) — it is never linked from public pages.
   A wrong code and a closed programme look identical: "the programme has closed." */
export default function FoundersInvite() {
  const { code } = useParams()
  const { user } = useAuth()
  const [offer, setOffer] = useState(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    api.get(`/founders/offer/${code}`).then(setOffer).catch(() => setClosed(true))
  }, [code])

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/"><Brand on="dark" /></Link>
        <Link to="/login" className="text-sm font-medium text-cream/50 hover:text-cream">Log in</Link>
      </header>

      {!offer && !closed && <Spinner className="min-h-[50vh]" />}

      {closed && (
        <main className="mx-auto max-w-xl px-5 py-24 text-center">
          <Icon name="lock" size={30} className="mx-auto text-copper" />
          <h1 className="mt-4 font-display text-3xl font-semibold">The founders programme has closed.</h1>
          <p className="mt-3 leading-relaxed text-cream/55">
            Every founding seat has been claimed. The founders membership was a one-time launch offer
            for the platform's first chefs — it won't return. The full command centre is still yours to take.
          </p>
          <Link to="/" className="mt-8 inline-block"><Button size="lg" icon="arrowRight">See the standard plans</Button></Link>
        </main>
      )}

      {offer && (
        <main className="mx-auto max-w-5xl px-5 pb-20">
          <div className="mx-auto max-w-2xl pt-8 text-center md:pt-14">
            <p className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-copper">
              <Icon name="star" size={13} /> Private invitation · {offer.spots_left} of {offer.spots} founding seats left
            </p>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] md:text-5xl">
              The <em className="italic text-copper">Founders</em> Membership.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-cream/60">{offer.tagline}</p>
          </div>

          {/* Founder privilege badges */}
          <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offer.perks.map((p) => (
              <div key={perkTitle(p)} className="rounded-2xl border border-copper/25 bg-white/[0.04] p-5 transition-colors hover:border-copper/60">
                <span className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-copper">
                  <Icon name={perkIcon(p)} size={12} /> Founders only
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-cream">{perkTitle(p)}</h3>
                {perkText(p) && <p className="mt-1.5 text-sm leading-relaxed text-cream/55">{perkText(p)}</p>}
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="font-display text-lg font-semibold text-copper">How joining works</h2>
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-cream/70">
                <li className="flex gap-2.5"><span className="font-display font-semibold text-copper">1.</span> Claim your seat — no card needed.</li>
                <li className="flex gap-2.5"><span className="font-display font-semibold text-copper">2.</span> Book your personal onboarding video call with Ellice — we set up your kitchen together and verify your account.</li>
                <li className="flex gap-2.5"><span className="font-display font-semibold text-copper">3.</span> Your {offer.trial_days || 5}-day free trial unlocks the moment the call's done.</li>
                <li className="flex gap-2.5"><span className="font-display font-semibold text-copper">4.</span> On day 5 we book your check-in call — your thoughts, what's helped, what you'd change — then you keep your kitchen at the lifetime rate.</li>
              </ol>
            </div>

            <div className="flex flex-col rounded-2xl border border-copper/40 bg-copper/[0.07] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-copper">Lifetime founders rate</p>
              <p className="mt-3 font-display text-5xl font-semibold">
                {fmtMoney(offer.monthly, offer.currency)}<span className="text-base font-normal text-cream/45">/month</span>
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-cream/55">
                <span className="line-through">{fmtMoney(offer.compare_monthly, offer.currency)}/month</span> on {offer.compare_name} —
                locked at this rate for as long as you stay.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-cream/55">
                {offer.onboarding > 0 ? (
                  <>One-time onboarding {fmtMoney(offer.onboarding, offer.currency)} <span className="line-through">{fmtMoney(offer.compare_onboarding, offer.currency)}</span>.</>
                ) : (
                  <>Onboarding fee <span className="font-semibold text-copper">waived</span> (normally {fmtMoney(offer.compare_onboarding, offer.currency)}).</>
                )}
                {offer.trial_days > 0 && <> {offer.trial_days}-day free trial after your onboarding call — no card needed for the trial.</>}
              </p>
              <div className="flex-1" />
              <Link to={`/register?founders=${code}`} className="mt-6 block">
                <Button size="lg" className="w-full" icon="arrowRight">Claim a founding seat</Button>
              </Link>
              {user && <p className="mt-2 text-center text-xs text-cream/40">You're already signed in — founding seats are for new accounts.</p>}
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-cream/40">
            This is a private link for invited chefs only — the founders membership never appears on the public site.
            Once the founding seats are gone, the programme closes for good: existing founders keep their rate and
            their number for life.
          </p>
        </main>
      )}
    </div>
  )
}
