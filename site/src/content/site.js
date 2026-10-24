/* ─────────────────────────────────────────────────────────────────────────────
   The Creatiste Catering — all site copy and settings live here.
   Edit words in this file; the pages read from it. Lines marked "TODO Ellice"
   are placeholders waiting on her.
   ───────────────────────────────────────────────────────────────────────────── */

export const SETTINGS = {
  // Pricing stays private by default. Flip to true to show the "from" figures
  // that are set on individual services below.
  showFromPrices: false,
  // Where the enquiry form posts (The Creatiste Command). Both come from .env.
  apiBase: (import.meta.env.VITE_API_BASE || '').replace(/\/$/, ''),
  enquiryToken: import.meta.env.VITE_ENQUIRY_TOKEN || '',
}

export const CONTACT = {
  email: 'enquiries@thecreatistecatering.com',
  instagram: 'thecreatistecatering',
  tiktok: 'thecreatistecatering',
  linktree: 'https://linktr.ee/thecreatistecatering', // TODO Ellice: confirm the Linktree URL
  whatsapp: '', // TODO Ellice: digits with country code (e.g. 447700900123) to enable the WhatsApp button
  area: 'Based just outside London · travelling for bookings', // TODO Ellice: confirm wording
}

export const HOURS = [
  { label: 'Client enquiries & consultations', value: 'Mon – Fri · 9:00am – 6:00pm' },
  { label: 'Personal chef bookings', value: 'Sun – Thurs' },
  { label: 'Catering bookings', value: 'Mon – Sun · by request' },
]

export const HERO = {
  eyebrow: 'The Creatiste Catering',
  title: ['The Art of Premium,', 'Bespoke Catering'],
  sub: 'Providing culinary-crafted, flavour-forward, hearty meals tailored to your home, workload or your milestone moment.',
}

export const ABOUT = {
  eyebrow: 'About',
  title: 'Flavour. Freedom. Finesse.',
  tagline: 'Curated for the Committed.',
  body: 'The Creatiste Catering is a new-age personal chef and private catering service. It is designed to bridge the gap between busy lifestyles and hearty, flavourful home-cooked food, all curated with premium, chef-level flair.',
  pillars: [
    { k: 'Flavour', v: 'Hearty, flavour-forward cooking that tastes like it was made for you — because it was.' }, // TODO Ellice: your original Flavour line
    { k: 'Freedom', v: 'Putting crucial time back into the client’s day by handling planning, shopping, prepping, cooking, and cleaning.' },
    { k: 'Finesse', v: 'Providing a seamless service where every element, from the menu to the packaging, reflects creativity and refinement.' },
  ],
}

export const MISSION = {
  eyebrow: 'What we do',
  title: 'No two days look the same with us.',
  body: 'Our mission is to bridge the gap between busy lifestyles and nourishing meals — giving you freedom to eat well, without compromise.',
}

/* Two umbrellas. Each service: slug, name, strap (short), body, includes[], from (optional, hidden unless showFromPrices). */
export const PERSONAL_CHEF = {
  slug: 'personal-chef',
  name: 'Personal Chef Services',
  short: 'Personal chef',
  strap: 'Your week, cooked for you.',
  intro: 'For clients who are committed to their ambitious lifestyles — but not always to their food. Weekly, by-demand, or whenever the week gets away from you.',
  services: [
    {
      slug: 'batchfully-made',
      name: 'Batchfully Made',
      strap: 'Batch-cooked components, dropped to your door.',
      body: 'Freshly batched and prepared meal components curated around your food focuses, from proteins to sides to sauces. Delivered portioned to perfection so you can plate your meals, your way.',
      includes: [
        'Individually priced batch containers in two sizes — 32oz and 58oz per component',
        'Curated from a standard dish list, or built around your requests',
        'Delivered chilled and labelled, ready to dish up through the week',
        'Weekly or ad-hoc — no subscription, no commitment beyond the batch',
      ],
      note: 'A set price list for the 32oz and 58oz containers is available on request.',
    },
    {
      slug: 'the-home-edit',
      name: 'The Home Edit',
      strap: 'In-home personal chef service.',
      body: 'In-house personal chef service where all meals are cooked and served fresh in the comfort of your home, covering breakfast, lunch, dinner and even the snacks in between — enough to fulfil your week and store what you need for later.',
      includes: [
        'All-inclusive: planning, shopping, travel, cooking, packaging and cleaning',
        'Fresh meals served hot on the day, the rest packaged for the week ahead',
        'Ingredients sourced and bought on your behalf',
        'Menus written around your tastes, goals and dietary needs',
      ],
    },
    {
      slug: 'the-pantry-edit',
      name: 'The Pantry Edit',
      strap: 'Your ingredients. Our hands.',
      body: 'You order and pay for the ingredients; we do the cooking. Your shop is turned into a week of batch containers, plated with care and delivered back to you — a lighter, labour-only way to keep the week fed.',
      includes: [
        'Labour-only pricing — you supply the ingredients',
        'Cooked, portioned into batch containers and delivered',
        'Ideal for regular weekly clients who like to do their own shop',
        'The same chef-level standard, a simpler bill',
      ],
      suggested: true, // name suggested this build — rename freely
    },
  ],
}

export const PRIVATE_CATERING = {
  slug: 'private-catering',
  name: 'Private Catering Services',
  short: 'Private catering',
  strap: 'Hot, fresh and served live.',
  intro: 'For intimate and refined settings — offices, launches, private homes and milestone moments. We don’t do foil trays dropped at the door; we cook and serve in the room.',
  services: [
    {
      slug: 'the-loaded-bar',
      name: 'The Loaded Bar',
      strap: 'A live hot food station at your next event.',
      body: 'Our primary service. A portable, loaded bar station brought into your space, serving hot, fresh build-your-own bowls — endless combinations and a premium catering experience, with full service from setup to breakdown.',
      includes: [
        '2-hour live service by our qualified catering team',
        'Fully customisable: 1 bowl base, 2 proteins, 6 toppings, 1 side and 3 sauces or seasonings',
        'Full setup and breakdown with a custom printed menu and component name cards',
        'Disposable bowls, cutlery and napkins, with allergen labelling and food-safety compliance',
      ],
      from: '£21 per head',
      link: '/the-loaded-bar',
    },
    {
      slug: 'corporate-curations',
      name: 'Corporate Curations',
      strap: 'Offices, launches and client-facing moments.',
      body: 'Menus tailored for offices, launches, and client-facing moments, delivered hot & fresh with the brand new CC Loaded Bar station. We ensure to keep your team fuelled and focused.',
      includes: ['Team lunches, launches and away-days', 'Served live from The Loaded Bar', 'Dietary needs labelled and handled'],
    },
    {
      slug: 'private-and-personal',
      name: 'Private & Personal',
      strap: 'Birthdays, anniversaries and intimate gatherings.',
      body: 'Elevate birthdays, anniversaries, and intimate gatherings with food catered hot and served beautifully with the brand new CC Loaded Bar station. We want your guests to remember the food when they think of your special day.',
      includes: ['Intimate gatherings in large homes and private spaces', 'Hot, served live — never a tray drop', 'Menus built around the occasion'],
    },
    {
      slug: 'the-creatiste-table',
      name: 'The Creatiste Table',
      strap: 'A dedicated private chef experience — by special request.',
      body: 'A dedicated private chef experience for your bespoke event with freshly prepared set menus, so hosts stay present while we run the kitchen with calm precision. Three courses, priced per head, on a special-request basis.',
      includes: ['Set three-course menus', 'Priced per head after consultation', 'Available by special request only'],
      special: true,
    },
  ],
}

export const LOADED_BAR = {
  eyebrow: 'The CC Loaded Bar',
  title: 'The Loaded Bar',
  sub: 'Experience a live hot food station at your next event.',
  body: 'Customisable loaded bowls, endless combinations, and a premium catering experience.',
  from: '£21 per head',
  included: {
    title: 'What’s included',
    intro: 'Bring the excitement of a live, chef-curated hot food station to your celebration. The Loaded Bar serves customisable loaded bowls so every guest can build something they love.',
    line: 'Our service is sleek, compact, and built for almost any venue.',
    items: [
      ['2-hour live service', 'a catered hot food station run by our qualified catering team.'],
      ['Fully customisable', 'your choice of 1 bowl base, 2 proteins, 6 toppings, 1 side, and 3 sauces or seasonings.'],
      ['Endless combinations', 'guests create fully personalised bowls.'],
      ['Professional setup', 'full setup and breakdown, with a custom printed menu and component name cards.'],
      ['Complete essentials', 'disposable bowls, cutlery, and napkins, with allergen labelling and food safety compliance.'],
    ],
  },
  requirements: {
    title: 'Information & requirements',
    items: [
      ['Guest count', 'minimum 15 guests, maximum 50 (larger events considered on request).'],
      ['Site requirements', 'access to a 13-amp double plug outlet, running water, and ramp or lift accessibility if above ground level.'],
      ['Lead time', 'book at least 14 days in advance. A 50% booking fee secures your date.'],
      ['Extra time', 'additional service time available by the hour.'],
    ],
  },
  deckUrl: '', // TODO Ellice: upload the brochure PDF to site/public/docs/ and put its path here, e.g. '/docs/the-loaded-bar.pdf'
}

/* "Now" — what's happening in real time. Leave items with `live: false` and they
   won't render. Eventually this feeds from The Creatiste Command. */
export const NOW = {
  eyebrow: 'Happening now',
  title: 'What’s on with The Creatiste',
  items: [
    {
      live: true,
      kind: 'Weekday lunch service',
      name: 'Clean Dream',
      when: 'Monday – Friday',
      detail: 'Our lunchtime service. Orders in by 11am for lunchtime delivery between 1pm and 4pm, or collection.',
      meta: ['Order by 11:00am', 'Delivery 1 – 4pm', 'Collection available'],
      cta: { label: 'Order Clean Dream', to: '/enquire?lane=clean-dream' },
      footnote: 'Collection point and delivery radius confirmed on enquiry.', // TODO Ellice: refine once settled
    },
    {
      live: false, // flip to true when there's an event to announce
      kind: 'Pop-up',
      name: 'Next pop-up',
      when: 'Date to be announced',
      detail: 'Where we’ll be next, what we’re serving, and how to get a plate.',
      meta: [],
      cta: { label: 'Keep me posted', to: '/enquire?lane=events' },
    },
    {
      live: false,
      kind: 'Event',
      name: 'A Creatiste event',
      when: 'Coming soon',
      detail: 'Hosted by The Creatiste. Details and tickets to follow.',
      meta: [],
      cta: { label: 'Register interest', to: '/enquire?lane=events' },
    },
  ],
}

export const PROCESS = {
  eyebrow: 'How it works',
  title: 'Consultation first. Always.',
  steps: [
    ['Tell us about your table', 'A short enquiry — who it’s for, when, and roughly what you have in mind.'],
    ['A conversation', 'We reply personally, usually within one business day, and arrange a consultation to understand your tastes, needs and dates.'],
    ['Your proposal', 'A tailored menu and a clear quote, written for you — not pulled from a price board.'],
    ['The day itself', 'We shop, cook, serve and clear. You stay present.'],
  ],
}

export const CHEF = {
  eyebrow: 'Meet the chef',
  lead: 'the chef behind it all.',
  name: 'Ellice Nweje',
  role: 'Personal Chef & Private Caterer',
  facts: [
    'Born & raised in London',
    'Self-taught, an avid home cook since age 11',
    'Over 9 years of food service & industry experience',
    'BSc Food Science with Business',
    'Currently studying MSc Food Business Management',
    'Experience in food technical & new product development in industry',
  ],
  story: 'Ellice launched The Creatiste [kree·ay·teest] Catering in September 2025 — a concept aimed to serve those who are committed to their ambitious lifestyles, but not always to their food.',
  specialisms: ['Flavour-forward home cooking', 'Batch & meal-prep systems', 'Live-service catering', 'Allergen-aware menus'], // TODO Ellice: your real specialisms
  accreditations: [
    // TODO Ellice: add each certificate — { name, issuer, year, file: '/docs/….pdf' }
    { name: 'Level 2 Food Safety & Hygiene', issuer: 'Issuer to confirm', year: '' },
    { name: 'Allergen awareness', issuer: 'Issuer to confirm', year: '' },
    { name: 'Food hygiene rating', issuer: 'Local authority', year: '' },
  ],
}

export const GALLERY = {
  eyebrow: 'Gallery',
  title: 'Premium Hospitality. Immaculate Presentation.',
  follow: 'Follow along on Instagram and TikTok',
  // Temporary low-res stand-ins cut from the old site recording. Replace with real
  // photos in site/public/photos/ and list them here.
  photos: [
    { src: '/photos/g2.jpg', alt: 'Plating canapés on a slatted board', w: 4, h: 3 },
    { src: '/photos/g1.jpg', alt: 'Guests at the table', w: 3, h: 4 },
    { src: '/photos/about-1.jpg', alt: 'Serving from the kitchen', w: 4, h: 4 },
    { src: '/photos/g3.jpg', alt: 'Finishing a tray', w: 3, h: 4 },
    { src: '/photos/loaded-bar.jpg', alt: 'The Loaded Bar station', w: 3, h: 4 },
    { src: '/photos/about-2.jpg', alt: 'A long table, lit warm', w: 4, h: 3 },
  ],
}

export const KIND_WORDS = {
  eyebrow: 'Kind words',
  title: 'What clients remember',
  quotes: [
    { text: 'They listened to dietary needs without compromising joy on the plate. Guests are still texting about dessert.', who: 'Host · Milestone celebration' },
    // TODO Ellice: more quotes you have permission to use — { text, who }
  ],
}

export const ENQUIRE = {
  eyebrow: 'Contact',
  title: 'Tell us about your table',
  sub: 'Choose your enquiry type to open the right form. We reply personally, usually within one business day.',
  lanes: [
    { id: 'personal-chef', label: 'Personal chef services', hint: 'Batchfully Made · The Home Edit · The Pantry Edit' },
    { id: 'private-catering', label: 'Private catering', hint: 'The Loaded Bar · Corporate · Private & Personal' },
    { id: 'creatiste-table', label: 'The Creatiste Table', hint: 'Private chef dinner, by special request' },
    { id: 'clean-dream', label: 'Clean Dream lunch', hint: 'Weekday lunch orders' },
    { id: 'pricing-guide', label: 'Request the pricing guide', hint: 'A guide to how we price, sent to your inbox' },
    { id: 'events', label: 'Pop-ups & events', hint: 'Keep me posted, or let’s collaborate' },
  ],
  followUp: 'After we receive your enquiry, we’ll contact you to arrange a consultation and finalise menu and service details, including a fuller discussion of dietary requirements.',
}

export const FOOTER = {
  tagline: 'A new-age personal chef & private catering service bridging the gap between busy lifestyles and hearty, flavourful home-cooked food — curated with premium, chef-level flair.',
}
