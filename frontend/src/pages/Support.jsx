import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls } from '../format'
import { Button, Card, Field, Icon, Input, PageHeader, Textarea, toastErr } from '../ui'

const FAQS = [
  ['What is The Creatiste Command?',
   'A command centre for private chefs and caterers: bookings, recipes, inventory with shelf life, shopping lists by shop, packing, tasks, route planning, tastings, clients, quotes, invoices, staff rotas and more — built to be used on the move.'],
  ['How do the plans work?',
   'There are three tiers: Solo Chef (the core kitchen toolkit), Pro Caterer (adds clients, tastings, orders, routes, the design studio, supplier price book, public enquiry form and invoicing) and Elite Kitchen (adds Mise the AI sous-chef, staff logins with rotas & oversight, and client quote approval links). You can upgrade any time from Settings → Membership.'],
  ['How does the free trial work?',
   'After you sign up, you book a personal onboarding video call — that’s how every kitchen is verified and set up. The moment it’s complete, your 5-day free trial unlocks (no card needed for the trial). When it ends, you pay a one-time onboarding fee plus your first month to keep your kitchen. Everything you added during the trial stays.'],
  ['What is the onboarding session?',
   'A short video call with the platform founder before your workspace opens: we set up your kitchen together, answer questions and verify your account. You book it right after signing up, and you can rebook the time whenever you need.'],
  ['What is Mise?',
   'Mise is your AI sous-chef (Elite plan), named after mise en place — the chef’s discipline of having everything prepped and in its place before service. It drafts recipe sheets from a sentence, builds a shopping list from a booking’s menu minus what’s already in stock, plans prep timelines backwards from event day, suggests menus from client preferences and polishes rough notes in My Brain.'],
  ['How do staff logins work?',
   'On the Elite plan, go to Team → Staff and create a login for each team member. They sign in with their own email, see the workspace, work their rota and assignments — and every change they make is recorded in Team → Activity for the owner to review. Staff never see Finance or Quotes.'],
  ['How do client quote approvals work?',
   'Draft a quote under Finance → Quotes and hit Send. You get a private link to share — your client opens it on their phone, sees the quote beautifully laid out, and taps Approve or Decline. You’re notified instantly, and approved quotes convert to invoices in one click. Tip: on a booking, build the menu (each dish “serves N @ £X”), then tap “Build a quote from this menu” — it works out how many of each you need for the guest count and itemises the whole quote for you.'],
  ['What is the public enquiry form?',
   'A branded page you can link from your website or Instagram bio. Enquiries land straight in your Bookings as new leads with the client attached — open the Pipeline view there to fill in the rough details and progress the lead. Find your personal link in Settings → App & integrations.'],
  ['Can my business be featured on your site?',
   'Yes. In Settings → Business, add your logo, a link to your website or socials, a star rating and an optional testimonial, then tap “Submit for review”. We check every listing before it goes live (to catch typos and keep the site tidy) — once approved, your logo appears in the scrolling bar on our landing page and your testimonial on the wall. It’s opt-in, you can remove it any time, and founding members get a “Founding member” badge.'],
  ['How does the allergen matrix work?',
   'It reads the allergen tags on your recipe sheets and builds a dish-by-allergen table (the UK’s 14 regulated allergens) for any booking’s menu. Tap “Print / PDF” and it lays out as a tidy A4 card for the dining table — with the FSA “speak to a member of staff” allergy statement and a Natasha’s Law note built in — or download it as CSV. Always double-check against actual labels; cross-contamination isn’t represented.'],
  ['I deleted something by accident — can I get it back?',
   'Yes. Go to Settings → Recently deleted. Anything you delete (a recipe, menu, client, list, supplier, task and more) is kept there for 30 days — tap Restore and it comes straight back exactly as it was. After 30 days it clears automatically. So a mis-tap is never the end of your work.'],
  ['Can I use it on my phone?',
   'Yes — the whole platform is built mobile-first: check off shopping at the market, tick packing in the van, follow your route in Google Maps, capture ideas at the event. You can also install it as an app and keep working offline — see Settings → App & integrations.'],
  ['Can I build a route from a shopping list?',
   'Yes. The “Shop” on each shopping-list item is steered from your Suppliers (add them under Suppliers, with addresses). On Routes, open a route and choose “Add stops from a shopping list” — each shop on that list becomes a stop, with its address filled in from your Suppliers, ready to open in Google Maps. No more zig-zagging across town.'],
  ['Can I add my bookings to my phone calendar?',
   'Yes. Settings → App & integrations has a private “Calendar subscription” link — add it to Apple, Google or Outlook calendar (subscribe by URL) and your bookings and tastings appear alongside everything else, updating automatically whenever you change them here. It’s read-only and the link is private to you.'],
  ['Can I export my data?',
   'Always — your data is yours. Settings → App & integrations → “Export your data” downloads CSV files of your bookings, clients, invoices and expenses (open them in any spreadsheet or hand them to your accountant). There are quick export buttons on the Clients, Finance and Allergen-matrix pages too.'],
  ['How do I cancel or change my plan?',
   'Settings → Membership shows your plan and payment history, and lets you switch tier (upgrade or downgrade) yourself and cancel any time. With card billing a tier change is prorated on your next invoice; on the Founders Membership, contact support so your lifetime rate is preserved. When you go to cancel, we’ll first offer a smaller plan in case a lighter tier suits better — you can switch and keep everything, or cancel anyway.'],
  ['How do I see what’s new when the platform updates?',
   'Open Settings → Version (or tap the version at the foot of any page) for the release notes — short bullet points of what changed in each update, newest first, like an app’s “What’s New”. Each release has its own version number that updates whenever we ship something new.'],
]

function Faq({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-line bg-card shadow-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} className="shrink-0 text-copper" />
        <span className="flex-1 text-sm font-medium">{q}</span>
      </button>
      {open && <p className="border-t border-line/60 px-4 py-3 text-sm leading-relaxed text-fg/65">{a}</p>}
    </div>
  )
}

function MiseChat({ onEscalate }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi — I’m Mise. Ask me anything about using The Creatiste Command.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const send = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    api.post('/ai/support-chat', { messages: next })
      .then((r) => setMessages((m) => [...m, { role: 'assistant', content: r.reply }]))
      .catch((err) => {
        if (err.status === 503) {
          setOffline(true)
          setMessages((m) => [...m, { role: 'assistant', content: 'I’m offline right now — please use the support request form below and a human will get back to you.' }])
        } else {
          setMessages((m) => [...m, { role: 'assistant', content: `Something went wrong (${err.message}). Try again, or send a support request below.` }])
        }
      })
      .finally(() => setBusy(false))
  }

  return (
    <Card title="Ask Mise" pad={false}>
      <div className="scrollbar-thin max-h-72 space-y-2.5 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div key={i} className={cls('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <p className={cls('max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
              m.role === 'user' ? 'bg-copper text-ink' : 'bg-parchment/70 text-fg/80')}>
              {m.content}
            </p>
          </div>
        ))}
        {busy && <p className="text-xs text-fg/40">Mise is typing…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line/70 p-3">
        <Input placeholder="e.g. How do I add a staff member?" value={input} onChange={(e) => setInput(e.target.value)} disabled={offline} />
        <Button size="sm" disabled={busy || offline}>Send</Button>
      </form>
      <p className="border-t border-line/60 px-4 py-2 text-xs text-fg/45">
        Still stuck? <button className="font-medium text-copper underline" onClick={onEscalate}>Send a support request</button> — a human will reply by email.
      </p>
    </Card>
  )
}

export default function Support() {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const formRef = useRef(null)

  const submit = (e) => {
    e.preventDefault()
    setBusy(true)
    api.post('/support/request', { subject, message })
      .then((r) => setDone(r.ticket_id))
      .catch(toastErr)
      .finally(() => setBusy(false))
  }

  return (
    <div>
      <PageHeader title="Help & FAQs" sub="Answers first, Mise second, a human whenever you need one." />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          {FAQS.map(([q, a]) => <Faq key={q} q={q} a={a} />)}
        </div>
        <div className="space-y-5 lg:col-span-2">
          {user?.is_founder && (
            <div className="flex items-start gap-2.5 rounded-xl border border-copper/40 bg-copper/10 px-4 py-3">
              <Icon name="star" size={16} className="mt-0.5 shrink-0 text-copper" />
              <p className="text-sm leading-relaxed text-fg/75">
                <span className="font-semibold text-copper">Founders direct line</span> — as Founding member
                #{user.founder_number}, your requests go straight to the founder and jump the queue.
              </p>
            </div>
          )}
          <MiseChat onEscalate={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })} />
          <div ref={formRef}>
            <Card title="Send a support request">
              {done ? (
                <div className="py-4 text-center">
                  <Icon name="check" size={26} className="mx-auto text-sage" />
                  <p className="mt-2 font-display font-semibold">Request #{done} sent</p>
                  <p className="mt-1 text-sm text-fg/55">We'll reply to {user?.email} as soon as possible.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's it about?" required /></Field>
                  <Field label="Tell us what's happening">
                    <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="The more detail, the faster we can help…" required />
                  </Field>
                  <Button className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
                  <p className="text-xs text-fg/40">Goes straight to the support inbox, and we reply to your account email.</p>
                </form>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
