/* Worked-example cards — a dismissible "here's what a filled-in entry looks like"
   shown at the top of every module for new chefs (owner's ask, 27th wave). All the
   sample content uses generic aliases (Jane Doe, 07700 900123 — the Ofcom drama
   range, example.com emails) so nothing reads as a real person or business.

   Nothing here is real data: the card is purely visual — no rows are created, so
   dashboards, exports and finance totals are never polluted. Dismissals persist on
   the user (users.examples_hidden — a list of page keys; "all" hides every card)
   so they stay gone across devices. Settings → Appearance can bring them back. */
import { api } from './api'
import { useAuth } from './auth'
import { Badge, Button, Icon, IconButton, toastErr } from './ui'

/* ------------------------- tiny mock-layout helpers ------------------------ */
function Meta({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-fg/55">
      {icon && <Icon name={icon} size={12} className="shrink-0" />}
      {children}
    </span>
  )
}

function MockItem({ title, badges, metas, note }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {badges}
      </div>
      {metas && <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">{metas}</div>}
      {note && <p className="mt-2 rounded-lg bg-fg/[0.04] px-2.5 py-1.5 text-xs italic text-fg/55">{note}</p>}
    </div>
  )
}

function MockCheck({ done, children }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${done ? 'border-copper bg-copper text-ink' : 'border-fg/25'}`}>
        {done && <Icon name="check" size={12} />}
      </span>
      <span className={done ? 'text-fg/45 line-through' : ''}>{children}</span>
    </li>
  )
}

/* ------------------------------ the examples ------------------------------- */
/* One entry per module page. title = what the example shows; blurb = how to read
   it; item = the mock entry rendered like a real row; tips = how to use the page. */
const EXAMPLES = {
  dashboard: {
    title: 'Your day at a glance',
    blurb: 'The dashboard fills itself from your bookings, tasks and invoices — you never type anything here.',
    item: (
      <div className="grid grid-cols-3 gap-3 text-center">
        {[['3', 'events this month'], ['12', 'open tasks'], ['£4,250', 'invoiced']].map(([v, l]) => (
          <div key={l}>
            <p className="font-display text-xl font-semibold text-copper">{v}</p>
            <p className="text-[11px] text-fg/50">{l}</p>
          </div>
        ))}
      </div>
    ),
    tips: [
      'Add a booking, a task or an invoice and watch these numbers update on their own.',
      'Tap any figure’s module in the sidebar to see the detail behind it.',
    ],
  },

  bookings: {
    title: 'A booking, filled in properly',
    blurb: 'Every event lives here from first enquiry to final presentation. This is what a confirmed one looks like:',
    item: (
      <MockItem
        title="Jane Doe — 40th birthday dinner"
        badges={<Badge tone="sage">confirmed</Badge>}
        metas={[
          <Meta key="d" icon="calendar">Sat 22 Aug · 7pm</Meta>,
          <Meta key="g" icon="users">24 guests</Meta>,
          <Meta key="v" icon="pin">Rosewood Barn, Kent</Meta>,
          <Meta key="p" icon="coins">Quoted £1,450</Meta>,
        ]}
        note="Client asked for a sharing-style main — confirm final numbers by the 15th."
      />
    ),
    tips: [
      'Open a booking to reach everything for that event in one place — menu, money, shopping, route and packing.',
      'New enquiries from your public enquiry link land in the Pipeline view as leads — move them along with one tap.',
      'Link a client so their contact details and allergies follow the event automatically.',
    ],
  },

  clients: {
    title: 'A client worth remembering',
    blurb: 'Your relationship book — preferences, allergies and history, so every repeat booking starts ahead:',
    item: (
      <MockItem
        title="Jane Doe"
        badges={<Badge tone="copper">repeat ×3</Badge>}
        metas={[
          <Meta key="m" icon="mail">jane.doe@example.com</Meta>,
          <Meta key="p" icon="phone">07700 900123</Meta>,
          <Meta key="a" icon="alert">Allergy: shellfish</Meta>,
        ]}
        note="Prefers family-style service · red wine over white · always books for late August."
      />
    ),
    tips: [
      'Saved clients appear in the Client dropdown when you create a booking.',
      'The Contact button opens WhatsApp or email with your saved template pre-filled — menus can be attached as a PDF link.',
    ],
  },

  tastings: {
    title: 'A tasting on the books',
    blurb: 'Tastings are how a quote becomes a yes — track who’s tasting what, and what they thought:',
    item: (
      <MockItem
        title="Menu tasting — Jane & John Doe"
        badges={<Badge tone="amber">scheduled</Badge>}
        metas={[
          <Meta key="d" icon="calendar">Thu 3 Sep · 6:30pm</Meta>,
          <Meta key="n" icon="fork">3 dishes to try</Meta>,
        ]}
        note="Feedback: loved the lamb, swap the dessert for something lighter."
      />
    ),
    tips: [
      'Record the verdict on each dish while it’s fresh — it writes your final menu for you.',
      'Link the tasting to the client and booking so the history stays together.',
    ],
  },

  tasks: {
    title: 'A task that won’t be forgotten',
    blurb: 'Anything with a deadline goes here — tasks group themselves by day and order themselves by time:',
    item: (
      <MockItem
        title="Confirm final guest numbers with Jane Doe"
        badges={<Badge tone="red">high</Badge>}
        metas={[
          <Meta key="d" icon="clock">Fri · 6:00pm</Meta>,
          <Meta key="b" icon="calendar">Doe birthday dinner</Meta>,
        ]}
      />
    ),
    tips: [
      'Priority is optional — leave it blank for everyday jobs.',
      'With phone notifications on (Settings → App & integrations), you get a nudge before a task is due.',
    ],
  },

  routes: {
    title: 'A prep-day run, mapped out',
    blurb: 'Plan the driving once — shops, collections and the venue drop, in order:',
    item: (
      <MockItem
        title="Doe birthday — prep run"
        metas={[<Meta key="d" icon="calendar">Sat 22 Aug</Meta>, <Meta key="s" icon="map">3 stops</Meta>]}
        note="07:00 Smithfield Wholesale Meats → 08:15 Borough Greengrocer → 10:30 Rosewood Barn (drop + set-up)."
      />
    ),
    tips: [
      '"Add stops from a shopping list" turns each shop on a list into a stop — addresses fill in from your Suppliers.',
      'Start a route from inside a booking and it stays linked to that event.',
    ],
  },

  team: {
    title: 'A team member, set up',
    blurb: 'Give your staff their own logins — they see the work, not your money pages:',
    item: (
      <MockItem
        title="Alex Smith"
        badges={<Badge tone="ink">Sous chef</Badge>}
        metas={[
          <Meta key="m" icon="mail">alex.smith@example.com</Meta>,
          <Meta key="s" icon="calendar">On shift: Sat 22 Aug</Meta>,
        ]}
      />
    ),
    tips: [
      'Assign tasks and shifts to a person — they see their own list when they log in.',
      'Staff never see Finance or Quotes; those stay owner-only.',
    ],
  },

  menus: {
    title: 'A set menu, ready to share',
    blurb: 'Build your menus once, price them per head, and attach a PDF to send to clients:',
    item: (
      <MockItem
        title="Summer Garden Menu"
        badges={[<Badge key="t" tone="copper">Set menu</Badge>, <Badge key="p" tone="ink">£45 / head</Badge>]}
        metas={[<Meta key="c" icon="doc">3 courses · PDF attached</Meta>]}
        note="Starter: heritage tomato & burrata · Main: herb-crusted lamb · Dessert: lemon posset."
      />
    ),
    tips: [
      'Each course can link a recipe sheet, so costs and allergens follow the dish.',
      'Menu titles appear in the Menu dropdown on New booking — and the PDF can be sent from any client’s Contact button.',
    ],
  },

  recipes: {
    title: 'A recipe sheet that pays its way',
    blurb: 'More than the method — a recipe sheet feeds your menus, allergen matrix and shopping lists:',
    item: (
      <MockItem
        title="Herb-crusted rack of lamb"
        badges={<Badge tone="ink">serves 4</Badge>}
        metas={[
          <Meta key="i" icon="book">9 ingredients</Meta>,
          <Meta key="a" icon="alert">Contains: mustard, celery</Meta>,
        ]}
        note="Rest 10 minutes before carving — crust holds better."
      />
    ),
    tips: [
      'Tick the allergens on each recipe — the Allergens page builds your legal matrix from them automatically.',
      'On Elite, Mise can draft a recipe sheet for you — you just check and tweak it.',
    ],
  },

  allergens: {
    title: 'How your matrix builds itself',
    blurb: 'You never fill this page in by hand — it reads the allergens you ticked on each recipe sheet:',
    item: (
      <MockItem
        title="Herb-crusted rack of lamb"
        metas={[<Meta key="a" icon="grid2">✓ mustard · ✓ celery · 12 other allergens clear</Meta>]}
      />
    ),
    tips: [
      'Print / PDF gives you an FSA-style A4 table for the dining table, with the required allergy statement.',
      'If a dish is missing, add (or update) its recipe sheet — the matrix updates instantly.',
    ],
  },

  inventory: {
    title: 'A stock item, tracked',
    blurb: 'What’s on your shelves and what it’s worth — so shopping starts from what you already have:',
    item: (
      <MockItem
        title="Olive oil (extra virgin)"
        badges={<Badge tone="sage">in stock</Badge>}
        metas={[
          <Meta key="q" icon="box">2 l · £1.75 / l</Meta>,
          <Meta key="s" icon="tag">Riverside Wholesale</Meta>,
        ]}
      />
    ),
    tips: [
      'Pull items straight in from your price book — the cost per unit works itself out from the pack price.',
      'Stock value is quantity × cost per unit, summed at the top of the page.',
    ],
  },

  shopping: {
    title: 'A shopping list you can shop from',
    blurb: 'Items group by shop, with prices — tick things off in the aisle on your phone:',
    item: (
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Doe birthday — shopping</p>
          <Badge tone="copper">Smithfield Wholesale Meats</Badge>
        </div>
        <ul className="space-y-1.5">
          <MockCheck done>Chicken thighs · 5 kg · £22.50</MockCheck>
          <MockCheck>Lamb racks · 6 · £54.00</MockCheck>
        </ul>
      </div>
    ),
    tips: [
      'Link the list to a booking when you create it — the event’s date and name fill in for you.',
      '"Add from your price book" drops an item in with its price and supplier already set.',
      'The Shop field is driven by your Suppliers — which is what lets a list turn into route stops.',
    ],
  },

  orders: {
    title: 'An online order, logged',
    blurb: 'Hire equipment, specialist ingredients, anything arriving by delivery — with the arrival date visible:',
    item: (
      <MockItem
        title="Cake stand & chafing dish hire"
        badges={<Badge tone="amber">ordered</Badge>}
        metas={[
          <Meta key="s" icon="truck">Party Hire Co · arrives Thu 20 Aug</Meta>,
          <Meta key="c" icon="coins">£35.00</Meta>,
          <Meta key="b" icon="calendar">Doe birthday dinner</Meta>,
        ]}
      />
    ),
    tips: [
      'Link an order to its booking so it shows on that event’s Orders tab too.',
      'Search your price book inside the order form — picks add themselves to the summary and cost.',
    ],
  },

  suppliers: {
    title: 'A supplier and their price book',
    blurb: 'Who you buy from, where they are, and what you last paid — the backbone of shopping and routes:',
    item: (
      <MockItem
        title="Smithfield Wholesale Meats"
        metas={[
          <Meta key="a" icon="pin">12 Market Row, London</Meta>,
          <Meta key="p" icon="phone">07700 900456</Meta>,
        ]}
        note="Price book: Chicken thighs · 5 kg · £22.50 — last checked 12 Jul."
      />
    ),
    tips: [
      'Log prices as you shop — the price book then auto-fills shopping lists, orders, expenses and inventory.',
      'Supplier names power the Shop dropdown, and their addresses fill in your route stops.',
    ],
  },

  packing: {
    title: 'A van pack, category by category',
    blurb: 'Everything that leaves the kitchen, grouped so nothing gets left on the counter:',
    item: (
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Doe birthday — van pack</p>
          <Badge tone="copper">Equipment</Badge>
        </div>
        <ul className="space-y-1.5">
          <MockCheck done>Chafing dishes ×4</MockCheck>
          <MockCheck>Serving platters ×12</MockCheck>
        </ul>
      </div>
    ),
    tips: [
      'Drag items to reorder them into your real packing order.',
      'Start the list from a booking and it stays linked to that event.',
    ],
  },

  finance: {
    title: 'An invoice and an expense, side by side',
    blurb: 'Money in and money out, per event — so you can see what each job actually made:',
    item: (
      <div className="space-y-2.5">
        <MockItem
          title="INV-2026-014 · Jane Doe"
          badges={<Badge tone="sage">sent</Badge>}
          metas={[<Meta key="a" icon="coins">£1,450.00</Meta>, <Meta key="d" icon="calendar">Due 15 Aug</Meta>]}
        />
        <div className="border-t border-line/60 pt-2.5">
          <MockItem
            title="Wholesale shop — Doe birthday"
            badges={<Badge tone="ink">expense</Badge>}
            metas={[<Meta key="a" icon="coins">£86.20</Meta>, <Meta key="r" icon="doc">receipt attached</Meta>]}
          />
        </div>
      </div>
    ),
    tips: [
      'Build an invoice straight from a booking’s menu — every dish becomes a line, and the doc carries your branding, bank details and deposit terms (set once in Settings → Invoices).',
      '"Send to client" always shows you a preview first — nothing goes out on one click.',
      'Itemise an expense from your price book, or just type the total — both work.',
    ],
  },

  designs: {
    title: 'A design saved with its event',
    blurb: 'Sketches, table plans and mood boards — drawn here or uploaded, kept with the job:',
    item: (
      <MockItem
        title="Doe birthday — table plan"
        metas={[<Meta key="t" icon="layout">Sketch · updated yesterday</Meta>, <Meta key="b" icon="calendar">Doe birthday dinner</Meta>]}
      />
    ),
    tips: [
      'Use the drawing tools for quick layouts, or upload photos of paper sketches.',
      'Open the booking’s Designs tab to see everything for that event together.',
    ],
  },

  ideas: {
    title: 'An idea, captured before it escapes',
    blurb: 'My Brain is your notebook — half-thoughts welcome, tidy them later:',
    item: (
      <MockItem
        title="Smoked mackerel pâté canapé"
        badges={<Badge tone="copper">idea</Badge>}
        note="Try for autumn menus — rye crisp base? Ask the fishmonger about a regular smoked batch."
      />
    ),
    tips: [
      'Capture the idea the second the event allows — one line is enough.',
      'On Elite, Mise can polish a rough note into a worked-up concept.',
    ],
  },
}

/* --------------------------------- the card -------------------------------- */
export default function ExampleCard({ k }) {
  const { user, setUser } = useAuth()
  const ex = EXAMPLES[k]
  const hidden = user?.examples_hidden || []
  if (!ex || !user || hidden.includes('all') || hidden.includes(k)) return null

  const dismiss = async (keys) => {
    const next = [...new Set([...hidden, ...keys])]
    setUser({ ...user, examples_hidden: next }) // hide immediately; server confirms below
    try {
      const updated = await api.put('/auth/me', { examples_hidden: next })
      setUser(updated)
    } catch (e) {
      toastErr(e)
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-dashed border-copper/45 bg-copper/[0.05] p-4 print:hidden">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="copper" className="uppercase tracking-wider">Example</Badge>
          <p className="text-sm font-semibold">{ex.title}</p>
        </div>
        <IconButton icon="x" label="Remove this example" onClick={() => dismiss([k])} className="-mr-1 -mt-1" />
      </div>
      <p className="mb-3 text-xs text-fg/55">{ex.blurb}</p>
      <div className="rounded-xl border border-line bg-card p-3.5 shadow-card">{ex.item}</div>
      {ex.tips?.length > 0 && (
        <ul className="mt-3 space-y-1">
          {ex.tips.map((t) => (
            <li key={t} className="flex gap-2 text-xs text-fg/60">
              <Icon name="check" size={13} className="mt-0.5 shrink-0 text-copper" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-fg/40">Just a worked example — nothing here is saved in your account.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => dismiss(['all'])}>Hide all examples</Button>
          <Button size="sm" variant="secondary" icon="check" onClick={() => dismiss([k])}>Got it — remove</Button>
        </div>
      </div>
    </section>
  )
}
