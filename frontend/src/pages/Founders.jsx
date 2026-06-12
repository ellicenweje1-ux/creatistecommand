import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
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

          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:col-span-3">
              <h2 className="font-display text-lg font-semibold text-copper">What founding members hold</h2>
              <ul className="mt-4 space-y-3">
                {offer.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-cream/75">
                    <Icon name="check" size={15} className="mt-0.5 shrink-0 text-copper" />{p}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-relaxed text-cream/55">
                In your first week we'll walk you through the platform personally — and after 5 days
                we'll check in for your thoughts, what's helped, and what you'd change.
              </p>
            </div>

            <div className="flex flex-col rounded-2xl border border-copper/40 bg-copper/[0.07] p-6 md:col-span-2">
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
                {offer.trial_days > 0 && <> Starts with a {offer.trial_days}-day free trial — no card needed.</>}
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
