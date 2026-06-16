import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { cls } from '../format'
import { Badge, Button, Icon, Modal } from '../ui'

const PLAN_NAMES = { 2: 'Pro Caterer', 3: 'Elite Kitchen' }

/* The module guide: every part of the command centre, what it's for, why it earns
   its place, and how to use it well. `min` mirrors the plan gating (1 Solo / 2 Pro /
   3 Elite); `ownerOnly` modules are hidden from staff logins, like the sidebar. */
const GROUPS = [
  {
    label: 'Run the operation',
    modules: [
      {
        key: 'dashboard', icon: 'pulse', label: 'Dashboard', title: 'Dashboard — the state of the kitchen', to: '/app/dashboard',
        blurb: 'Your kitchen at a glance: today’s bookings, open tasks, stock alerts and money on one screen.',
        benefits: [
          'Spot overdue tasks and expiring stock before they bite',
          'See the next three weeks of bookings without opening the diary',
          'Watch the month’s money — paid, outstanding, expenses — at a glance',
        ],
        how: [
          'Make it your first stop with the morning coffee — scan the four stat cards first',
          'Click any card or list straight through to the module behind it',
          'Clear the red flags (overdue tasks, expiring stock) before starting prep',
          'Pin must-not-forget notes in My Brain so they surface here every day',
        ],
        tip: 'If a number surprises you, click it — every card on the dashboard is a shortcut to the full story.',
      },
      {
        key: 'bookings', icon: 'calendar', label: 'Bookings', title: 'Bookings — one diary for every event', to: '/app/bookings',
        blurb: 'Every enquiry, quote and confirmed event in one diary — menus, guest counts and dietaries attached.',
        benefits: [
          'One source of truth per event — no more notes-app archaeology',
          'Statuses from enquiry to completed keep your pipeline honest',
          'Each booking carries its own menu, shopping, packing and task lists',
        ],
        how: [
          'Create a booking the moment an enquiry lands, even with half the details',
          'Open the booking and work from its workspace: menu, lists and tasks in one place',
          'Move the status as it progresses — enquiry, quoted, confirmed, completed',
          'Record guest counts and dietaries here so lists and the allergen matrix stay true',
        ],
        tip: 'Treat the booking as the folder for the whole event — if something isn’t attached to it, it will get lost.',
      },
      {
        key: 'tastings', icon: 'fork', label: 'Tastings', title: 'Tastings & consultations diary', to: '/app/tastings', min: 2,
        blurb: 'A dedicated diary for tastings, consultations, site visits and calls — linked to clients and bookings.',
        benefits: [
          'Tastings stop colliding with event prep in your head',
          'Each appointment links to the client and the booking it could become',
          'Outcomes are recorded while the palate notes are still fresh',
        ],
        how: [
          'Log every tasting, consultation and site visit as its own appointment',
          'Link it to the client — and the booking, once there is one',
          'Write the outcome straight after the meeting; detail fades by dinner',
        ],
        tip: 'Book the follow-up tasting before the client leaves the table — then it’s already in the diary.',
      },
      {
        key: 'tasks', icon: 'checks', label: 'Tasks', title: 'Tasks — prep & service to-dos', to: '/app/tasks',
        blurb: 'Prep and service to-dos with due dates, worked backwards from event day.',
        benefits: [
          'Marinades, advance prep and orders all land on the right day',
          'Overdue work is impossible to miss — it goes red on the dashboard',
          'Tasks can belong to bookings, so the context travels with them',
        ],
        how: [
          'Work backwards from event day: order day, shop day, prep day, service timeline',
          'Give every task a due date — a task without a date is a wish',
          'Start each morning by clearing the overdue count on the dashboard',
        ],
        tip: 'Five minutes after confirming a booking, batch-create its task spine — future you will be grateful.',
      },
      {
        key: 'routes', icon: 'map', label: 'Routes', title: 'Routes — the prep-day route planner', to: '/app/routes', min: 2,
        blurb: 'Order your market runs and supplier stops with timings — then open the whole route in Google Maps.',
        benefits: [
          'No more zig-zagging across town with melting ice in the boot',
          'Timings keep an ambitious shop run realistic',
          'One tap opens the full route, stop by stop, in Google Maps',
        ],
        how: [
          'List every stop for the day, then arrange them in driving order',
          'Add arrive-by times around opening hours and traffic',
          'Open the route in Maps and check off each shop’s list as you leave it',
        ],
        tip: 'Pair the route with that day’s shopping lists — each stop becomes one screen of items.',
      },
      {
        key: 'team', icon: 'users', label: 'Team', title: 'Team — staff, rotas & oversight', to: '/app/team', min: 3,
        blurb: 'Staff logins, rotas and event assignments — with an activity trail of every change they make.',
        benefits: [
          'Staff see and update the work without seeing your money',
          'Rotas and assignments live next to the bookings they serve',
          'The activity trail shows who changed what, and when',
        ],
        how: [
          'Invite staff with their own logins — owner-only areas stay hidden from them',
          'Build the week’s rota, then assign people to specific bookings',
          'Skim the activity trail after busy service days to stay in the loop',
        ],
        tip: 'Give casual staff logins too — them checking off a packing list beats relaying it over the phone.',
      },
    ],
  },
  {
    label: 'In the kitchen',
    modules: [
      {
        key: 'recipes', icon: 'book', label: 'Recipes', title: 'Recipes — your master sheets', to: '/app/recipes',
        blurb: 'Master sheets for every dish: ingredients, method, yields and allergens in one place.',
        benefits: [
          'Scale and cost a dish without reverse-engineering your own cooking',
          'Allergen tags feed the allergen matrix automatically',
          'Anyone in the kitchen can cook the dish to your standard',
        ],
        how: [
          'Write the master sheet once — ingredients with quantities, method, true yield',
          'Tag allergens on the recipe so menus and the matrix inherit them',
          'On Elite, ask Mise for a first draft, then correct it to your taste',
        ],
        tip: 'Record the yield the recipe really gives you, not the optimistic one — every list downstream depends on it.',
      },
      {
        key: 'inventory', icon: 'box', label: 'Inventory', title: 'Inventory — stock & shelf life', to: '/app/inventory',
        blurb: 'What’s in stock, what’s running low and what expires this week — before you write a single list.',
        benefits: [
          'Shelf-life alerts catch the cream before it catches you',
          'Low-stock flags write the start of your next shopping list',
          'Real counts at your fingertips when a last-minute booking lands',
        ],
        how: [
          'Do one honest stock-take, then keep it true after each shop and each event',
          'Set expiry dates on perishables — the dashboard warns you in time',
          'Check “use it or lose it” before menu planning: waste becomes specials',
        ],
        tip: 'Update quantities as you unload the van — thirty seconds now, or a mystery on prep day.',
      },
      {
        key: 'shopping', icon: 'cart', label: 'Shopping', title: 'Shopping — multi-shop lists', to: '/app/shopping',
        blurb: 'One list per booking, grouped by shop — butcher, market, wholesaler — check off as you go.',
        benefits: [
          'Grouped by shop, every stop is exactly one screen',
          'Progress bars show how done a list actually is',
          'Lists attach to bookings, so quantities trace back to the menu',
        ],
        how: [
          'Create the list from the booking so it stays attached to the event',
          'Group items by where you’ll buy them, in the order you’ll drive',
          'Check items off at the shelf with your phone in hand',
          'On Elite, let Mise draft the list from the menu minus what’s in stock',
        ],
        tip: 'Anything still unchecked at the end of the day either moves to tomorrow or gets deleted — never limbo.',
      },
      {
        key: 'packing', icon: 'clipboard', label: 'Packing', title: 'Packing — van-load checklists', to: '/app/packing',
        blurb: 'Van-load checklists per event — equipment, crockery, signage — nothing left on the kitchen floor.',
        benefits: [
          'The 2 a.m. “did I pack the chafers?” question, answered',
          'Similar events pack alike — lists become reusable patterns',
          'Check off at the van door, not from memory',
        ],
        how: [
          'Build the packing list while planning the menu — they’re connected',
          'Walk the kitchen with the list open as you load',
          'Add a return-trip section for what must come back with you',
        ],
        tip: 'Keep a “last out the door” section: knives, chargers, the cake.',
      },
      {
        key: 'orders', icon: 'truck', label: 'Orders', title: 'Orders — deliveries & tracking', to: '/app/orders', min: 2,
        blurb: 'Track speciality and online orders so nothing arrives after prep day.',
        benefits: [
          'Expected dates surface late deliveries while there’s still time to chase',
          'In-transit orders show up on your dashboard automatically',
          'Supplier, items and status in one line per order',
        ],
        how: [
          'Log the order the moment you place it, with its expected date',
          'Mark it delayed as soon as you suspect it — then chase or re-plan the menu',
          'Check arrivals off so the list only ever shows what’s genuinely outstanding',
        ],
        tip: 'Order speciality items to land two days before you need them — buffer is flavour insurance.',
      },
      {
        key: 'allergens', icon: 'grid2', label: 'Allergens', title: 'Allergens — the matrix generator', to: '/app/allergens',
        blurb: 'A dish-by-allergen matrix generated from your recipe sheets — print-ready for the buffet table.',
        benefits: [
          'One glance answers “what can I eat?” for any guest',
          'Built from your recipe data, so it stays truthful',
          'A professional, printable answer in the Natasha’s Law era',
        ],
        how: [
          'Keep allergens tagged on recipes — the matrix only knows what you tell it',
          'Pick the menu’s dishes and generate the grid',
          'Print a copy for the buffet table and brief staff from the same sheet',
        ],
        tip: 'Regenerate after any recipe tweak — one new garnish can change a whole row.',
      },
      {
        key: 'suppliers', icon: 'tag', label: 'Suppliers', title: 'Suppliers — the price book', to: '/app/suppliers', min: 2,
        blurb: 'Every supplier’s prices in one book — instantly see who sells an item cheapest.',
        benefits: [
          'Quote-time costing from real prices, not memory',
          'Cheapest-source lookup for any item you buy',
          'Contacts, notes and prices together on the supplier card',
        ],
        how: [
          'Add your suppliers, then log items and prices as you buy',
          'Compare sources before big orders — loyalty is good, margins are better',
          'Refresh prices when invoices change; old prices tell lies',
        ],
        tip: 'Note delivery minimums and order cut-off times on each supplier card — they decide your prep-day timings.',
      },
    ],
  },
  {
    label: 'Grow the business',
    modules: [
      {
        key: 'clients', icon: 'users', label: 'Clients', title: 'Clients — your portfolio', to: '/app/clients', min: 2,
        blurb: 'Everyone you’ve cooked for — preferences, dietaries, booking history and reviews.',
        benefits: [
          '“You remembered my husband hates coriander” is repeat-booking gold',
          'History shows who’s overdue a friendly check-in',
          'Reviews collected where you can actually use them',
        ],
        how: [
          'Create the client at first enquiry and link every booking to them',
          'Capture preferences and dietaries during events — tiny notes, huge returns',
          'Skim a client’s card before any call so the details are on the tip of your tongue',
        ],
        tip: 'After each event, add one line you’d want to know next year: “anniversary in June, loves lamb”.',
      },
      {
        key: 'quotes', icon: 'doc', label: 'Quotes', title: 'Quotes — client approval links', to: '/app/finance', min: 3, ownerOnly: true, cta: 'Open Finance → Quotes',
        blurb: 'Build proper quotes and send a link your client approves from their phone — no login, no chasing.',
        benefits: [
          'Priced line by line, so you stop quoting 120 covers from memory',
          'Clients approve on a simple link — the yes is recorded, in writing',
          'Approved quotes flow into invoicing on the same screen',
        ],
        how: [
          'Open Finance and switch to the Quotes tab',
          'Build the quote from real line items and your supplier prices',
          'Send the approval link by email or text — then invoice from the same record once they say yes',
        ],
        tip: 'Add a validity date to every quote — it nudges slow deciders without a single awkward call.',
      },
      {
        key: 'finance', icon: 'coins', label: 'Finance', title: 'Finance — invoices, expenses & profit', to: '/app/finance', min: 2, ownerOnly: true,
        blurb: 'Invoices out, expenses in, profit visible month by month — without leaving the platform.',
        benefits: [
          'Profit per month, not a year-end surprise',
          'Outstanding invoices sit in plain sight, easy to chase',
          'Expenses logged at the point of spend, not from a shoebox',
        ],
        how: [
          'Invoice from the booking as soon as it’s confirmed or served',
          'Log expenses the day they happen — receipts fade and so does memory',
          'Review the outstanding column weekly; chase politely and early',
        ],
        tip: 'Make Friday the ten-minute money habit: log the week’s expenses, chase one invoice, glance at the month.',
      },
      {
        key: 'designs', icon: 'layout', label: 'Designs', title: 'Design studio — floor plans & sketches', to: '/app/designs', min: 2,
        blurb: 'Floor plans with tables, stations and bars — plus pens, shapes and colours to sketch freely.',
        benefits: [
          'The room is agreed before you arrive — fewer day-of surprises',
          'Stations placed deliberately: flow, power, fire exits',
          'Sketches saved with the event, not on the back of a napkin',
        ],
        how: [
          'Drop tables, stations and bars onto the canvas to mirror the venue',
          'Use the drawing tools for notes the venue manager will understand',
          'Walk staff through the plan at the pre-service briefing',
        ],
        tip: 'Mark the power sockets on every plan — it’s the lesson every caterer only learns once.',
      },
      {
        key: 'ideas', icon: 'bulb', label: 'My Brain', title: 'My Brain — idea capture', to: '/app/ideas',
        blurb: 'Offload ideas and reminders the second they strike — before service clouds them.',
        benefits: [
          'Ideas survive the moment they arrive in',
          'Pinned notes surface on your dashboard every day',
          'Searchable later, exactly when inspiration is needed',
        ],
        how: [
          'Capture in seconds — title optional, perfection unnecessary',
          'Pin anything that absolutely must not be forgotten',
          'Review weekly: promote the good ones to tasks, let the rest go',
        ],
        tip: 'Genius arrives mid-service and rarely survives the night — type it the second the event allows.',
      },
      {
        key: 'mise', icon: 'sparkle', label: 'Mise AI', title: 'Mise — your AI sous-chef', to: '/app/recipes', min: 3, cta: 'Open Recipes — Mise lives there',
        blurb: 'Named for mise en place — everything in its place before service. Drafts recipes, builds shopping lists from menus minus stock, and plans prep backwards from event day.',
        benefits: [
          'First drafts in seconds — you stay on the chef part: judgement',
          'Shopping lists computed from the menu minus what’s already in stock',
          'Prep timelines worked back from event day, ready to become tasks',
        ],
        how: [
          'Look for the Mise button inside Recipes, Bookings and Shopping',
          'Give it real constraints: guests, dietaries, budget, the kit you own',
          'Treat the output like a capable junior’s draft — taste it, correct it, make it yours',
        ],
        tip: 'Mise works from your data — the truer your inventory and recipes, the smarter it gets.',
      },
    ],
  },
  {
    label: 'Help & housekeeping',
    modules: [
      {
        key: 'mobileapp', icon: 'mobile', label: 'Mobile app', title: 'The mobile app — yours, even offline', to: '/app/settings',
        cta: 'Open Settings — install from there',
        blurb: 'Install the platform on your phone like a real app — and keep working with no signal: basement kitchens, marquees in a field, mid-flight.',
        benefits: [
          'Installs from the browser in two taps — no app store, nothing to update',
          'Everything you’ve viewed works offline: bookings, recipes, lists, tasks',
          'Offline changes save on the device and sync to the cloud the moment you’re back',
        ],
        how: [
          'Open Settings → “Use it as an app” and follow the one-tap install for your phone',
          'Open your key modules once while online — that’s what makes them available offline',
          'Work normally with no signal; the amber chip counts the changes waiting to sync',
          'Reconnect and watch the sync toast — your edits land in the cloud by themselves',
        ],
        tip: 'Open tomorrow’s booking, lists and recipes over breakfast Wi-Fi — then the venue’s dead spot can’t touch you.',
      },
      {
        key: 'support', icon: 'help', label: 'Support', title: 'Support — help & FAQs', to: '/app/support',
        blurb: 'FAQs and a direct line to the platform — your tickets land straight in the founder’s inbox.',
        benefits: [
          'Answers without leaving the kitchen',
          'Tickets are tracked, not lost in an email thread',
          'Feature requests genuinely shape the roadmap',
        ],
        how: [
          'Check the FAQs first — most answers are already there',
          'Raise a ticket naming the screen or booking in question',
          'Send ideas too: this platform is built with its chefs',
        ],
        tip: 'Describe what you expected and what happened instead — it halves the back-and-forth.',
      },
      {
        key: 'settings', icon: 'settings', label: 'Settings', title: 'Settings — your business & membership', to: '/app/settings',
        blurb: 'Business details, theme, membership — and your public enquiry link on Pro and above.',
        benefits: [
          'Your business details flow onto client-facing pages',
          'Signature dark or bright light theme — your kitchen, your mood',
          'Membership visible and manageable without emailing anyone',
        ],
        how: [
          'Fill in your business details first — clients see them on quotes and forms',
          'On Pro and above, copy your public enquiry link into your Instagram bio and website',
          'Check Settings → Membership to see your plan, trial and payment history',
        ],
        tip: 'That enquiry link in your bio quietly becomes your best maître d’ — it never sleeps.',
      },
    ],
  },
]

function userLevel(user) {
  if (!user) return 1
  if (user.role === 'admin') return 3
  return user.plan_level ?? ({ starter: 1, pro: 2, elite: 3 }[user.plan] || 1)
}

function Bubble({ module: m, locked, onOpen, delay }) {
  return (
    <div className="group relative">
      <button
        onClick={onOpen}
        aria-label={`${m.label} — open module guide`}
        className={cls(
          'bubble-in relative flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-full border bg-card text-fg shadow-card transition-all duration-200',
          'hover:-translate-y-1.5 hover:shadow-pop focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 sm:h-32 sm:w-32',
          locked ? 'border-line hover:border-fg/30' : 'border-line hover:border-copper/70'
        )}
        style={{ animationDelay: `${delay}ms` }}
      >
        <span className={cls('rounded-full p-2.5', locked ? 'bg-fg/5 text-fg/40' : 'bg-copper/10 text-copper')}>
          <Icon name={m.icon} size={22} />
        </span>
        <span className={cls('px-2 text-center text-xs font-semibold leading-tight', locked && 'text-fg/45')}>{m.label}</span>
        {locked && (
          <span className="absolute right-1.5 top-1.5 rounded-full border border-line bg-base p-1 text-fg/45" title={`Part of ${PLAN_NAMES[m.min]}`}>
            <Icon name="lock" size={11} />
          </span>
        )}
      </button>
      {/* Hover / focus preview bubble */}
      {/* z-[45]: above the fixed sidebar (z-40) so left-column tooltips aren't clipped, below modals (z-50) */}
      <div className="pointer-events-none absolute left-1/2 top-full z-[45] mt-2 w-60 -translate-x-1/2 translate-y-1 rounded-xl border border-white/10 bg-ink p-3 text-left opacity-0 shadow-pop transition-all duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="text-xs leading-relaxed text-cream/85">{m.blurb}</p>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-copper">
          {locked ? `${PLAN_NAMES[m.min]} · click for what it unlocks` : 'Click for benefits & how to use it'}
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState(null)
  const level = userLevel(user)

  const isLocked = (m) => !!m.min && level < m.min
  const visible = (modules) => modules.filter((m) => !(m.ownerOnly && user?.is_staff))
  const activeLocked = active ? isLocked(active) : false

  const openModule = () => {
    const m = active
    setActive(null)
    navigate(activeLocked ? '/app/settings' : m.to)
  }

  let bubbleIndex = 0

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Welcome to your command centre{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-fg/55">
            Every module, explained. Hover a bubble for the gist; click it for the benefits and how to use it well.
            Bubbles with a <Icon name="lock" size={11} className="inline -translate-y-px text-fg/45" /> are part of a higher tier — click to see what they&rsquo;d unlock.
          </p>
        </div>
        <Link to="/app/dashboard"><Button icon="pulse" variant="dark">Today&rsquo;s dashboard</Button></Link>
      </div>

      <div className="space-y-9">
        {GROUPS.map((group) => {
          const modules = visible(group.modules)
          if (modules.length === 0) return null
          return (
            <section key={group.label}>
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">{group.label}</h2>
              <div className="flex flex-wrap gap-4 sm:gap-5">
                {modules.map((m) => (
                  <Bubble key={m.key} module={m} locked={isLocked(m)} onOpen={() => setActive(m)} delay={(bubbleIndex++ % 12) * 45} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <p className="mt-10 text-xs text-fg/40">
        You can come back to this guide any time — it&rsquo;s <span className="font-medium text-fg/60">Home</span> in the sidebar.
      </p>

      {/* Module guide modal */}
      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active && (
          <span className="inline-flex items-center gap-2.5">
            <span className="rounded-lg bg-copper/10 p-1.5 text-copper"><Icon name={active.icon} size={17} /></span>
            {active.title}
          </span>
        )}
        footer={active && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {active.min ? <Badge tone="copper">{PLAN_NAMES[active.min]} & above</Badge> : <Badge tone="sage">In every plan</Badge>}
            <Button onClick={openModule} icon={activeLocked ? 'lock' : 'arrowRight'}>
              {activeLocked ? 'See membership options' : active.cta || `Open ${active.label}`}
            </Button>
          </div>
        )}
      >
        {active && (
          <div className="space-y-5">
            {activeLocked && (
              <div className="flex items-start gap-2.5 rounded-xl border border-copper/30 bg-copper/10 p-3.5 text-sm">
                <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-copper" />
                <p className="text-fg/80">
                  This module is part of the <span className="font-semibold text-copper">{PLAN_NAMES[active.min]}</span> membership.
                  Upgrade in Settings → Membership and it unlocks instantly — everything below is waiting.
                </p>
              </div>
            )}
            <p className="leading-relaxed text-fg/65">{active.blurb}</p>
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg/45">Why it earns its place</h3>
              <ul className="space-y-2">
                {active.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-fg/80">
                    <Icon name="check" size={15} className="mt-0.5 shrink-0 text-sage" strokeWidth={2.2} />{b}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg/45">How to use it well</h3>
              <ol className="space-y-2.5">
                {active.how.map((step, i) => (
                  <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-fg/80">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-copper/15 font-display text-[11px] font-semibold text-copper">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
            <div className="flex items-start gap-2.5 rounded-xl bg-parchment p-3.5">
              <Icon name="sparkle" size={15} className="mt-0.5 shrink-0 text-copper" />
              <p className="text-sm leading-relaxed text-fg/70"><span className="font-semibold text-copper">Chef&rsquo;s tip:</span> {active.tip}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
