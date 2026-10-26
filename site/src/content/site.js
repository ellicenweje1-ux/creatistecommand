/* ─────────────────────────────────────────────────────────────────────────────
   The Creatiste Catering. All site copy and settings live here.
   Edit words in this file; the pages read from it. Lines marked "TODO Ellice"
   are placeholders waiting on her. House style: no em dashes in copy.
   ───────────────────────────────────────────────────────────────────────────── */

export const SETTINGS = {
  // Pricing stays private by default. Flip to true to show the "from" figures set on services below.
  showFromPrices: false,
  // Where the enquiry form and the Clean Dream order page talk to The Creatiste Command.
  apiBase: (import.meta.env.VITE_API_BASE || '').replace(/\/$/, ''),
  enquiryToken: import.meta.env.VITE_ENQUIRY_TOKEN || '',
}

export const CONTACT = {
  email: 'enquiries@thecreatistecatering.com',
  phone: '07471 081237',
  instagram: 'thecreatistecatering',
  tiktok: 'thecreatistecatering',
  linktree: 'https://linktr.ee/thecreatistecatering', // TODO Ellice: confirm the Linktree URL
  whatsapp: '447471081237', // the number from the Clean Dream menu, in international digits
  area: 'Based in Slough, serving West London, Surrey and Berkshire', // TODO Ellice: confirm wording
}

export const HOURS = [
  { label: 'Client enquiries & consultations', value: 'Mon to Fri, 9:00am to 6:00pm' },
  { label: 'Personal chef bookings', value: 'Sun to Thurs' },
  { label: 'Private catering bookings', value: 'Mon to Sun, by request' },
]

export const HERO = {
  eyebrow: 'The Creatiste Catering',
  title: ['The Art of Premium,', 'Bespoke Catering'],
  sub: 'Providing culinary-crafted, flavour-forward, hearty meals tailored to your home, workload or your milestone moment.',
  strip: 'Personal Chef · Private Catering Services · Brand-led Pop-ups & Food Activations',
  photo: '/photos/serving-bowl.jpg',
}

export const ABOUT = {
  eyebrow: 'About',
  title: 'Flavour. Freedom. Finesse.',
  tagline: 'Curated for the Committed.',
  body: 'The Creatiste Catering is a new-age personal chef and private catering service. It is designed to bridge the gap between busy lifestyles and hearty, flavourful home-cooked food, all curated with premium, chef-level flair.',
  pillars: [
    { k: 'Flavour', v: 'Flavour-forward food curated to your exact tastes and requirements, with premium ingredients so your plates are full of vibrant colours and textures.' },
    { k: 'Freedom', v: 'Putting crucial time back into the client’s day by handling planning, shopping, prepping, cooking, and cleaning.' },
    { k: 'Finesse', v: 'Providing a seamless service where every element, from the menu to the packaging, reflects creativity and refinement.' },
  ],
  photos: ['/photos/buffet-ellice.jpg', '/photos/jollof-box.jpg'],
}

export const MISSION = {
  eyebrow: 'What we do',
  title: 'No two days look the same with us.',
  body: 'Our mission is to bridge the gap between busy lifestyles and nourishing meals, giving you freedom to eat well, without compromise.',
}

/* The Home Edit packages, from the package options document. Labour is billed at £23 per hour;
   weekly figures are indicative and confirmed at consultation. Groceries are paid at cost by the client. */
export const HOME_EDIT_PACKAGES = {
  rate: 23,
  docUrl: '/docs/the-home-edit-packages.pdf',
  items: [
    { n: '01', name: 'The Full Table', cover: 'Five days, breakfast, lunch & dinner', weekly: 690, hours: '30 hours a week, around 6 hours on site a day', body: 'Every meal handled, Monday to Friday. You never have to think about food.' },
    { n: '02', name: 'The Daily Dinner', cover: 'Five days, dinner', weekly: 287.5, hours: '12.5 hours a week, around 2.5 hours an evening', body: 'A fresh dinner every weekday evening, served hot or stored for later.' },
    { n: '03', name: 'The Midweek Dinner', cover: 'Three days, dinner', weekly: 172.5, hours: '7.5 hours a week, around 2.5 hours an evening', body: 'Three fresh dinners spread across the week.' },
    { n: '04', name: 'The Half Week', cover: 'Three days, lunch & dinner', weekly: 276, hours: '12 hours a week, around 4 hours on site a day', body: 'Lunch and dinner covered on three chosen days.' },
    { n: '05', name: 'The Twice Weekly', cover: 'Two days, lunch & dinner', weekly: 184, hours: '8 hours a week, around 4 hours on site a day', body: 'Two full days of lunch and dinner each week.' },
    { n: '06', name: 'The Prep Day', cover: 'One full day, five days of meals batch-prepped in house', weekly: 184, hours: 'One full day of around 8 hours', body: 'One full day in your kitchen preparing the week’s meals, fridge-ready and labelled, with that evening’s dinner served hot and fresh. The lowest cost per meal across all packages.' },
  ],
  week: [
    ['Menu design', 'A fresh weekly menu curated around your tastes and dietary needs.'],
    ['Invoicing', 'The week’s invoice sent and settled ahead of service.'],
    ['Shopping ordered', 'The full grocery order arranged and delivered to the door.'],
    ['Cook day', 'Everything cooked fresh on site, served hot or portioned and stored, whatever suits your day.'],
    ['Meals stored', 'Remaining portions labelled and stored fridge-ready.'],
    ['Clean down', 'The kitchen left spotless after every visit.'],
  ],
  goodToKnow: [
    'Dietary requirements, such as halal, allergies and dislikes, are submitted at the very start and shape every menu.',
    'Every meal served includes a dessert or snack option, or a fresh juice.',
    'Groceries are paid at cost, directly by you. The weekly service fee covering menu design, the shopping list, equipment and travel is agreed at consultation.',
  ],
}

/* Recommended starting budgets shown on the enquiry form, by service and billing frequency.
   TODO Ellice: confirm these figures. Home Edit figures follow the lightest package (The Prep Day). */
/* All budgets are weekly (Ellice: more standardised). The Home Edit figure is read from the packages
   so it can never disagree with the package guide. */
export const RECOMMENDED_BUDGET = {
  'Batchfully Made': '£55 to £70 a week',
  'The Home Edit': `from £${Math.min(...HOME_EDIT_PACKAGES.items.map((p) => p.weekly)).toLocaleString('en-GB')} a week for the lightest package (${HOME_EDIT_PACKAGES.items.reduce((a, b) => (a.weekly <= b.weekly ? a : b)).name}) to £${Math.max(...HOME_EDIT_PACKAGES.items.map((p) => p.weekly)).toLocaleString('en-GB')} for ${HOME_EDIT_PACKAGES.items.reduce((a, b) => (a.weekly >= b.weekly ? a : b)).name}`,
  'Sorted & Served': 'from £46 per order (two hours of labour; you order the ingredients to us, we cook and deliver)',
}

export const PERSONAL_CHEF = {
  slug: 'personal-chef',
  name: 'Personal Chef Services',
  short: 'Personal Chef',
  intro: 'For clients who are committed to their ambitious lifestyles, but not always to their food. Weekly, by demand, or whenever the week gets away from you.',
  services: [
    {
      slug: 'batchfully-made',
      name: 'Batchfully Made',
      strap: 'Batch-cooked components, dropped to your door.',
      body: 'Freshly batched and prepared meal components curated around your food focuses, from proteins to sides to sauces. Delivered portioned to perfection so you can plate your meals, your way.',
      includes: [
        'Individually priced batch containers in two sizes, 32oz and 58oz per component',
        'Curated from a standard dish list, or built around your requests',
        'Delivered chilled and labelled, ready to dish up through the week',
        'Weekly or ad hoc, with no subscription and no commitment beyond the batch',
      ],
      note: 'Component-based batch prep in 32oz and 58oz containers, built around your preferences. Not on the menu? Let us know, we’ll make it and add it.',
      docUrl: '/docs/batchfully-made-price-list.pdf', docLabel: 'Download the price list',
      photo: '/photos/batch-containers.jpg',
    },
    {
      slug: 'the-home-edit',
      name: 'The Home Edit',
      strap: 'In-home personal chef service.',
      body: 'In-house personal chef service where all meals are cooked and served fresh in the comfort of your home, covering breakfast, lunch, dinner and even the snacks in between, enough to fuel your day and perfectly store the rest to fulfil your week ahead.',
      includes: [
        'All-inclusive: planning, shopping, travel, cooking, packaging and cleaning',
        'Fresh meals served hot on the day, the rest packaged for the week ahead',
        'Ingredients sourced and bought on your behalf',
        'Six set packages, from one prep day a week to every weekday meal',
      ],
      packages: true,
      photo: '/photos/batch-salmon.jpg',
    },
    {
      slug: 'sorted-and-served',
      name: 'Sorted & Served',
      strap: 'Your ingredients, our hands. Portioned to your preference.',
      body: 'A mid-range service to provide the perfect balance between our personal chef services: you simply provide the ingredients, we do the cooking. We prep and portion to your preference, and deliver straight to you.',
      includes: [
        'Labour-only pricing, you supply the ingredients',
        'Cooked, portioned into batch containers and delivered',
        'Ideal for regular weekly clients who like to do their own shop',
        'The same chef-level standard, a simpler process',
      ],
      photo: '/photos/prep-labelled.jpg',
    },
  ],
}

/* Private catering: two event types, both served live from The Loaded Bar station. */
export const PRIVATE_CATERING = {
  slug: 'private-catering',
  name: 'Private Catering Services',
  short: 'Private Catering',
  intro: 'Two kinds of occasion, one way of serving. Every private catering booking is cooked and served in the room from The Loaded Bar, our portable hot food station. No foil trays dropped at the door.',
  howServed: {
    eyebrow: 'How it’s served',
    title: 'The Loaded Bar comes to you.',
    body: 'A live, chef-run station serving customisable loaded bowls. Guests build their own from a base, proteins, toppings, a side and sauces, and everything is set up and cleared away by us. The full details, menu and brochure live on its own page.',
    link: '/the-loaded-bar',
  },
  services: [
    {
      slug: 'corporate-curations',
      name: 'Corporate Curations',
      strap: 'Offices, launches and client-facing moments.',
      body: 'The CC Loaded Bar brought into your office, launch or client-facing moment, with menus tailored to the room and served hot and fresh, so your team stays fuelled and focused.',
      includes: ['Team lunches, launches and away days', 'Served live from The Loaded Bar', 'Dietary needs labelled and handled'],
      menuId: 'corporate',
      photo: '/photos/bowls-table.jpg',
    },
    {
      slug: 'private-and-personal',
      name: 'Private & Personal',
      strap: 'Birthdays, anniversaries and intimate gatherings.',
      body: 'The CC Loaded Bar for birthdays, anniversaries and intimate gatherings, with food catered hot and served beautifully, so your guests remember the food when they think of your special day.',
      includes: ['Intimate gatherings in large homes and private spaces', 'Hot, served live, never a tray drop', 'Menus built around the occasion'],
      menuId: 'personal',
      photo: '/photos/buffet-ellice.jpg',
    },
    {
      slug: 'the-creatiste-table',
      name: 'The Creatiste Table',
      strap: 'A dedicated private chef experience, by special request only.',
      body: 'A highly exclusive and dedicated private chef experience for your bespoke event, with beautifully curated dishes, so hosts stay present while we run the kitchen with precision. For tables starting at 5 guests to 12 max.',
      includes: ['By special request only', 'A seasonal menu, priced per head', 'Courses tailored to dietary requirements and preferences', 'Tables from 5 guests to 12 max'],
      special: true,
      tableMenu: true,
      photo: '/photos/kasa-dinner.jpg',
    },
  ],
}

/* The Creatiste Table set menu (seasonal). Generalised from the printed menu. */
export const TABLE_MENU = {
  title: 'The Creatiste Table',
  season: 'Autumn menu', // TODO Ellice: season label
  perHead: '£43',
  perHeadNote: 'Travel fee and staffing may be charged, subject to final consultation.',
  courses: [
    { name: 'On arrival', dishes: [{ d: 'Marinated olives, stuffed mini peppers, glazed sausage bites' }] },
    { name: 'Starter', note: 'Served sharing style with warm rosemary focaccia', dishes: [
      { d: 'Burrata plate with fresh tomatoes, balsamic, extra virgin olive oil, chilli flakes', tag: 'V' },
      { d: 'Roasted aubergine and red pepper dip with pomegranate, crispy onions and fresh herbs', tag: 'VG' },
      { d: 'Caesar salad with crispy calamari' },
    ] },
    { name: 'Main', dishes: [{ d: 'Spiced fruit braised duck leg, on creamy butter bean orzo, charred purple sprouting broccoli, garlic and herb pangrattato, with charred lemon' }] },
    { name: 'Dessert', dishes: [{ d: 'Cardamom and orange tiramisu, finished with rose petals and pistachio' }] },
  ],
  footer: 'Vegan, nut-free and gluten-free plates available upon request',
  docUrl: '/docs/the-creatiste-table-menu.pdf',
}

export const LOADED_BAR = {
  eyebrow: 'The CC Loaded Bar',
  title: 'The Loaded Bar',
  sub: 'Experience a live hot food station at your next event.',
  body: 'Customisable loaded bowls, endless combinations, and a premium catering experience.',
  from: '£19 per head',
  photo: '/photos/loaded-bar.png', // the station itself, cut out on a transparent ground (glow removed)
  included: {
    title: 'What’s included',
    intro: 'Bring the excitement of a live, chef-curated hot food station to your celebration. The Loaded Bar serves customisable loaded bowls so every guest can build something they love.',
    line: 'Our service is sleek, compact, and built for almost any venue.',
    items: [
      ['2-hour live service', 'a catered hot food station run by our qualified catering team.'],
      ['Fully customisable', 'your choice of 1 bowl base, 2 proteins, 6 toppings, 1 side, and 3 sauces or seasonings.'],
      ['Endless combinations', 'guests create fully personalised bowls.'],
      ['Professional setup', 'full setup and breakdown, with a custom printed menu and component name cards.'],
      ['Complete essentials', 'disposable 1.5L bowls, cutlery and napkins, with allergen labelling and food safety compliance.'],
      ['Upgrades', 'personalised bowl branding, and cart branding tailored to your event.'],
    ],
  },
  /* Two bowl menus from the brochure: one for corporate bookings, one for private. The Loaded Bar page
     toggles between them; each Private Catering service shows its own. */
  menu: {
    title: 'The bowl menus',
    menus: [
      { id: 'corporate', name: 'Corporate Curations', groups: [
        { name: 'Base', pick: 'choose one', items: ['Seasoned rice', 'Sweet potato mash', 'Spring mix', 'Creamy mac & cheese (+£1.50 per head)', 'Roasted tomato & red pepper bulgur', 'Cubed roasted red potatoes'], extra: 'Add one additional base: +£2.50 per head' },
        { name: 'Protein', pick: 'choose two', items: ['Sweet chilli chicken thigh', 'Stewed pepper steak', 'Baked teriyaki salmon bites', 'Blackened Cajun prawns', 'Roasted Med vegetables with grilled halloumi (V)', 'Honey harissa roasted chickpeas & sweet potato (VG)', 'Fried tofu bites (VG)'], extra: 'Add one additional protein: +£4 per head' },
        { name: 'Toppings', pick: 'choose six', items: ['Crispy onions', 'Red onion', 'Sweetcorn', 'Cucumber', 'Tomato', 'Pickled pink slaw', 'Sliced jalapeños', 'Fresh coriander', 'Fresh parsley', 'Grated Padano cheese', 'Pomegranate', 'Crumbled feta (+£0.50 per head)', 'Smashed avocado (+£0.80 per head)'] },
        { name: 'Sauce & seasoning', pick: 'choose three', items: ['Garlic white sauce', 'Sweet chilli BBQ', 'Hot honey', 'Balsamic glaze', 'Sriracha', 'Cholula hot sauce', 'Olive oil', 'Salt & pepper', 'Chilli flakes', 'Peri peri salt', 'Lemon wedges', 'Lime wedges'] },
        { name: 'Side', pick: 'choose one', items: ['Pitta chips', 'Tortilla nacho chips', 'Mini naan breads'] },
      ] },
      { id: 'personal', name: 'Private & Personal', groups: [
        { name: 'Base', pick: 'choose one', items: ['Steamed coconut rice', 'Jollof rice', 'Creamy mac & cheese (+£1.50 per head)', 'Cubed roasted sweet potatoes'], extra: 'Add one additional base: +£2.50 per head' },
        { name: 'Protein', pick: 'choose two', items: ['Baked smothered chicken', 'Stewed pepper steak', 'Baked teriyaki salmon bites', 'Blackened Cajun prawns', 'Roasted Med vegetables with grilled halloumi (V)', 'Honey harissa roasted chickpeas & sweet potato (VG)', 'Fried tofu bites (VG)'], extra: 'Add one additional protein: +£4 per head' },
        { name: 'Sides & toppings', pick: 'choose six', items: ['Steamed veg', 'Garlic sweetcorn cobs', 'Fried plantain', 'Pitta chips', 'Crispy onions', 'Red onion', 'Tomato & cucumber', 'Pickled pink slaw', 'Sliced jalapeños', 'Fresh coriander / parsley', 'Grated Padano cheese', 'Pomegranate'] },
        { name: 'Sauce & seasoning', pick: 'choose three', items: ['Garlic white sauce', 'Sweet chilli BBQ', 'Hot honey', 'Sriracha', 'Cholula hot sauce', 'Salt & pepper', 'Chilli flakes', 'Lemon wedges', 'Lime wedges'] },
      ] },
    ],
  },
  requirements: {
    title: 'Information & requirements',
    items: [
      ['Guest count', 'minimum 15 guests, maximum 50 (larger events considered on request).'],
      ['Site requirements', 'access to a 13-amp double plug outlet, running water, and ramp or lift accessibility if above ground level.'],
      ['Lead time', 'book at least 14 days in advance. A 50% booking fee secures your date.'],
      ['Extra time', 'additional service time available by the hour, covering the extended station, hot holding, staffing and equipment.'],
      ['Portions', 'food is priced per head and served as one bowl per guest. Additional food can be added separately. Once all guests have been served, surplus food is distributed at the client’s discretion.'],
    ],
  },
  deckUrl: '/docs/the-loaded-bar.pdf',
}

/* "What's up with Us?" What is happening in real time. Items with `live: false` do not render on the home strip. */
export const NOW = {
  eyebrow: 'Find out what’s happening now',
  title: 'What’s up with Us?',
  intro: 'Lunch services, pop-ups and the occasional private hosted event. This page will be kept updated, so check back or ask to be kept posted.',
  items: [
    {
      live: true,
      kind: 'Weekday Lunch Service',
      name: 'Clean Dream',
      when: 'Monday to Friday',
      detail: 'Clean, whole-food lunch bowls, cooked fresh and served hot. Order by 11am for collection at 1pm or 2:30pm, or delivery between locations by arrangement.',
      meta: ['Order by 11:00am', 'Collection W5 · 1pm', 'Collection SW15 · 2:30pm'],
      cta: { label: 'Order Clean Dream', to: '/clean-dream' },
    },
    {
      live: false, // flip to true when there is an event to announce
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

/* Clean Dream: the public copy. The menu, slots and prices are served by The Creatiste Command
   (the offer is edited there), so prices are never trusted from the browser. */
export const CLEAN_DREAM = {
  eyebrow: 'Lunch by The Creatiste Catering',
  /* The live order menu. Mirrors the offer held in The Creatiste Command (which prices and takes
     payment for each order); if Command is reachable its copy wins, so the two never drift. */
  menu: {
    title: 'Clean Dream', currency: 'GBP', cutoff: '11:00', days: [0, 1, 2, 3, 4], days_ahead: 5,
    items: [{
      id: 'bowl', name: 'Build your own bowl', price: 8, desc: 'Whole-food lunch bowl, cooked fresh and served hot.',
      groups: [
        { id: 'base', label: 'Base', pick: 'choose one', min: 1, max: 1, options: [{ name: 'Whole sweet potato' }, { name: 'Tomato & pepper bulgur' }, { name: 'Spring mix' }] },
        { id: 'protein', label: 'Protein', pick: 'choose one', min: 1, max: 1, options: [{ name: 'Beef mince' }, { name: 'Chicken mince' }, { name: 'Tofu mince' }, { name: 'Steak', surcharge: 3 }, { name: 'Blackened prawns', surcharge: 2 }] },
        { id: 'toppings', label: 'Toppings', pick: 'choose up to five', min: 0, max: 5, extra_price: 0.5, extra_premium_price: 1, options: [
          { name: 'Avocado', premium: true }, { name: 'Feta', premium: true }, { name: 'Cottage cheese', premium: true }, { name: 'Boiled egg', premium: true }, { name: 'Fried egg', premium: true },
          { name: 'Cherry tomatoes' }, { name: 'Red onion' }, { name: 'Sweetcorn' }, { name: 'Pomegranate' }, { name: 'Pickled pink slaw' }, { name: 'Sliced pickles' }, { name: 'Pickled jalapeño' },
          { name: 'Coriander' }, { name: 'Parsley' }, { name: 'Rocket' }, { name: 'Hot honey' }, { name: 'Sriracha' }, { name: 'Balsamic glaze' }, { name: 'Raspberry balsamic glaze' }] },
        { id: 'extra_protein', label: 'Extra protein', pick: 'optional', min: 0, max: 2, options: [{ name: 'Beef mince', surcharge: 2 }, { name: 'Chicken mince', surcharge: 2 }, { name: 'Tofu mince', surcharge: 2 }, { name: 'Steak', surcharge: 4 }, { name: 'Blackened prawns', surcharge: 3 }] },
      ],
    }],
    slots: [
      { id: 'w5', label: 'Collection point 1', place: 'Sandringham Mews Car Park, W5', time: '1:00pm' },
      { id: 'sw15', label: 'Collection point 2', place: 'Sainsbury’s Putney Car Park, SW15', time: '2:30pm' },
    ],
    delivery: { enabled: true, per_mile: 0.65, note: 'Deliveries available between the collection locations upon request, at an additional £0.65 per mile. We confirm delivery by WhatsApp after you order and the delivery fee is charged separately.' },
  },
  /* Paying today is by bank transfer: the Pay step reveals these details behind a button, and the order
     comes to Ellice by WhatsApp. Card payment (Stripe via Command) takes over automatically once its key is set. */
  bank: { name: 'Ellice Nweje', bank: 'Monzo Bank', account: '22278287', sort: '04-00-06' },
  confirm: 'Your order will be confirmed once I send a receipt of payment and final collection/delivery details via WhatsApp.',
  title: 'Clean Dream',
  sub: 'Clean, whole-food lunch bowls, cooked fresh and served hot. Comforting, home-cooked and beautiful, built to keep you going.',
  photo: '/photos/clean-dream-boxes.jpg',
  how: [
    ['Order by 11am', 'Orders in by 11:00am are made the same day, Monday to Friday. After 11am, your order rolls to the next weekday.'],
    ['Collect at 1pm or 2:30pm', 'Two collection points each day. Pick the one that suits you at checkout.'],
    ['Or have it delivered', 'Deliveries between the two locations by request, at +£0.65 per mile. We confirm by WhatsApp after you order and the delivery fee is charged separately.'],
    ['Confirmed by WhatsApp', 'Your order will be confirmed once I send a receipt of payment and final collection/delivery details via WhatsApp. Every box is named so each person’s food is labelled correctly.'],
  ],
}

export const PROCESS = {
  eyebrow: 'How it works',
  title: 'Consultation first.',
  steps: [
    ['Tell us about your table', 'A short enquiry: who it’s for, when, and roughly what you have in mind.'],
    ['A conversation', 'We reply personally, usually within one business day, and arrange a consultation to understand your tastes, requirements and budget.'],
    ['Your proposal', 'A tailored breakdown, designed around your consultation, and amended until you are 100% happy to lock it in.'],
    ['Delivery day', 'We prep, cook, serve and everything in between. You stay happy, and remain present.'],
  ],
}

export const CHEF = {
  eyebrow: 'Meet the chef',
  lead: 'the chef behind it all.',
  name: 'Ellice Nweje',
  role: 'Personal Chef & Private Caterer',
  photo: '/photos/buffet-ellice.jpg',
  facts: [
    'Born & raised in London',
    'Self-taught, an avid home cook since age 11',
    '8 plus years of food service & FMCG industry experience',
    'BSc Food Science with Business',
    'Currently studying MSc Food Business Management',
    'Former Food Product Developer in industry',
  ],
  story: 'Ellice launched The Creatiste [kree·ay·teest] Catering in September 2025, a concept aimed to serve those who are committed to their ambitious lifestyles, but not always to their food.',
  /* About me, in her words (from the profile she supplied). */
  about: [
    'Hi, I’m Ellice. A self-taught chef with 8 plus years working in food service and experience at large FMCG industry companies, including time as a Food Product Developer. I bring a wealth of academic and practical knowledge with a BSc in Food Science with Business, and am currently studying an MSc in Food Business Management.',
    'I operate primarily through my business, The Creatiste Catering, offering personal chef and private catering services specialising in batch meal preps, in-home cooking and corporate and private catering.',
    'I focus on creating delicious, hearty meals that are nourishing, and aim to make life that little bit easier by covering the planning, shopping, prepping, cooking, storing and cleaning. All my clients need to do is eat and relax.',
  ],
  specialisms: ['Batch meal preps', 'In-home personal chef', 'Corporate & private catering', 'Live-service catering', 'Allergen-aware menus'],
  dietary: 'Vegan, vegetarian and gluten-free diets catered for, adhering to food safety and hygiene standards throughout.',
  profile: [
    ['Certified', 'CPD Level 2 Food Hygiene and Safety for Catering'],
    ['Travel', 'Travels and comfortably covers most surrounding areas'],
    ['Standards', 'Reputable, reliable and conscientious'],
    ['Education', 'BSc Food Science with Business; MSc Food Business Management (in progress)'],
    ['Experience', '8 plus years in food service and at large FMCG companies, including time as a Food Product Developer'],
    ['Based', 'Slough, serving West London, Surrey and Berkshire'],
  ],
  accreditations: [
    // TODO Ellice: add each certificate as { name, issuer, year, file: '/docs/….pdf' }
    { name: 'Level 2 Food Hygiene and Safety for Catering', issuer: 'High Speed Training · issued 11 March 2025, renewal due March 2028', year: '2025', file: '/docs/level-2-food-hygiene-and-safety-for-catering.pdf' },
    { name: 'Allergen awareness', issuer: 'Issuer to confirm', year: '' },
    { name: 'Food hygiene rating', issuer: 'Local authority', year: '' },
  ],
}

export const PORTFOLIO = {
  eyebrow: 'Our portfolio',
  title: 'Who we’ve worked with',
  intro: 'A few of the tables, teams and rooms we’ve fed. More to come as the diary fills.',
  /* The chips at the top are built from `features` below and jump to each entry. Each entry can carry a
     `logo` (the person or business, a photo or logo file in /photos/clients/) shown beside the name. */
  /* Selected work. Each entry: the photo of the person or booking sits beside its highlight header
     (`kind`), with the name and the details of the event below. */
  features: [
    { kind: 'Corporate Curations', title: 'Forte Network', meta: 'Autumn Apex Fitness Event 2025 · Live food station', photo: '/photos/serving-bowl.jpg', logo: '',
      body: 'Cooking for Forte Network at the Autumn Apex Fitness Event 2025: bowls built to order and served hot from The Loaded Bar, fuelling a full day of training and talks.' },
    { kind: 'Corporate Curations', title: 'Alicia’s Charity Sports Day', meta: 'Official vendor · Live food station · In advocation for Sickle Cell Disease', photo: '/photos/loaded-bar.png', fit: 'contain', logo: '', // TODO Ellice: a photo from the day, or Alicia's logo
      body: 'The official vendor for Alicia’s Charity Sports Day, held in advocation for Sickle Cell Disease. We brought our live food station concept to the day: bowls built to order and served hot from The Loaded Bar, keeping players and supporters fed from first whistle to last.' },
    { kind: 'The Creatiste Table', title: '15 Under 30 × Kasa', meta: 'Seated dinner collaboration', photo: '/photos/kasa-dinner.jpg', logo: '',
      body: 'A four-stage set menu, served sharing style: marinated olives and glazed sausage bites on arrival, burrata and roasted aubergine dip with rosemary focaccia, spiced fruit braised duck on butter bean orzo, and a cardamom and orange tiramisu to finish.' },
    { kind: 'Private & Personal', title: 'G4 Boys', meta: 'Private chef · International artists · May 2026', photo: '/photos/g4-buffet.jpg', logo: '',
      body: 'A private chef booking for international artists on a London stay: a full spread cooked in-house and set out against the skyline, with every course on the table before the room sat down.' },
    { kind: 'Batchfully Made', title: 'Ra’ees Bangura-Williams', meta: 'Personal chef service · Professional footballer', photo: '/photos/batch-black-spread.jpg', logo: '',
      body: 'Batchfully Made personal chef service for a professional footballer: proteins, sides and vegetables batch-cooked in 32oz and 58oz containers around his training week, delivered chilled, labelled and ready to plate.' },
    { kind: 'Personal Chef', title: 'Indigo Kxd', meta: 'Producer & label owner', photo: '/photos/batch-lidded.jpg', logo: '',
      body: 'A personal chef service for a producer and label owner with a packed studio diary: the week batch-cooked, portioned and labelled so the food keeps pace with the schedule.' },
  ],
}

export const GALLERY = {
  eyebrow: 'The Gallery',
  title: 'Premium Hospitality. Immaculate Presentation.',
  follow: 'Follow along on Instagram and TikTok',
  photos: [
    { src: '/photos/serving-bowl.jpg', alt: 'Serving a bowl at a live station', w: 3, h: 4 },
    { src: '/photos/duck-salad.jpg', alt: 'Crispy duck salad with pomegranate', w: 3, h: 4 },
    { src: '/photos/buffet-ellice.jpg', alt: 'Ellice at a buffet spread', w: 3, h: 4 },
    { src: '/photos/bowls-table.jpg', alt: 'Build-your-own bowls on a glass table', w: 3, h: 4 },
    { src: '/photos/canape-prep.jpg', alt: 'Plating canapés on bamboo boards', w: 3, h: 4 },
    { src: '/photos/jollof-box.jpg', alt: 'Jollof rice, puff puff and corn salad with pressed juices', w: 3, h: 4 },
    { src: '/photos/spring-rolls.jpg', alt: 'Filo rolls with micro herbs', w: 4, h: 4 },
    { src: '/photos/batch-salmon.jpg', alt: 'Sweet chilli salmon, rice and chicken, batch prepared', w: 3, h: 4 },
    { src: '/photos/prep-labelled.jpg', alt: 'Labelled meal prep boxes', w: 3, h: 4 },
    { src: '/photos/lamb-plate.jpg', alt: 'Lamb chops, mac and cheese and wings', w: 3, h: 4 },
    { src: '/photos/batch-containers.jpg', alt: 'A week of batch cooking', w: 3, h: 4 },
    { src: '/photos/chafing-hall.jpg', alt: 'Chafing dishes at a hall', w: 3, h: 4 },
    { src: '/photos/clean-dream-boxes.jpg', alt: 'Clean Dream lunch boxes', w: 3, h: 4 },
    { src: '/photos/kasa-dinner.jpg', alt: 'A seated dinner for 15 Under 30 × Kasa', w: 4, h: 3 },
    { src: '/photos/soup-pour.jpg', alt: 'Chilli oil poured over a roasted pepper soup', w: 3, h: 4 },
    { src: '/photos/canapes-terrazzo.jpg', alt: 'Canapés on a terrazzo table', w: 4, h: 3 },
    { src: '/photos/g4-buffet.jpg', alt: 'A private menu set out against the London skyline', w: 9, h: 16 },
    { src: '/photos/dessert-dusting.jpg', alt: 'Ellice dusting a dessert to finish', w: 3, h: 4 },
    { src: '/photos/batch-steak.jpg', alt: 'A week of batch meals: steak, salmon and stuffed peppers', w: 3, h: 4 },
    { src: '/photos/soup-table.jpg', alt: 'Soup served at the table', w: 4, h: 3 },
    { src: '/photos/guests-canapes.jpg', alt: 'Guests enjoying canapés', w: 1, h: 1 },
    { src: '/photos/batch-lidded.jpg', alt: 'Labelled meal prep containers', w: 9, h: 16 },
    { src: '/photos/island-spread.jpg', alt: 'Ellice setting out a spread at the kitchen island', w: 3, h: 4 },
    { src: '/photos/trays-jollof.jpg', alt: 'Jollof rice, rice and peas and wings, tray style', w: 3, h: 4 },
    { src: '/photos/juice-boxes.jpg', alt: 'Pressed juice and glass meal boxes', w: 3, h: 4 },
    { src: '/photos/batch-kitchen.jpg', alt: 'Batch meals cooling in the kitchen', w: 9, h: 16 },
    { src: '/photos/trays-mac.jpg', alt: 'Jollof, chicken and mac and cheese, tray style', w: 9, h: 16 },
    { src: '/photos/clean-dream-box.jpg', alt: 'A Clean Dream bowl: beef mince, bulgur, avocado and pickled slaw', w: 4, h: 5 },
    { src: '/photos/plated-steak.jpg', alt: 'Steak on mash with tenderstem and vine tomatoes, and a lemon pasta', w: 3, h: 4 },
    { src: '/photos/batch-black-spread.jpg', alt: 'A Batchfully Made week: corn, peppers, salad, rice, pasta and salmon', w: 3, h: 4 },
    { src: '/photos/steak-bulgur-bowl.jpg', alt: 'Steak and bulgur bowl with coriander', w: 3, h: 4 },
    { src: '/photos/trays-prawns.jpg', alt: 'Jollof, curry, breaded prawns and mac and cheese for a party', w: 3, h: 4 },
    { src: '/photos/salad-plates.jpg', alt: 'Chicken caesar and a watermelon, feta and cucumber salad', w: 3, h: 4 },
    { src: '/photos/trays-metal.jpg', alt: 'Trays of corn, rice, wings, chicken stew and jerk chicken', w: 3, h: 4 },
    { src: '/photos/batch-stacked.jpg', alt: 'Stacked, labelled batch containers ready to go', w: 3, h: 4 },
  ],
  /* Social mirror: paste Instagram post or reel links here (public posts). They render as
     official Instagram embeds, pictures and videos alike. TODO Ellice: your best 6 to 9 posts. */
  instagram: [],
  /* A live, auto-updating grid of the latest posts: paste the embed URL from a free feed widget here
     (LightWidget, SnapWidget or Elfsight give one after you connect the Instagram account once). Leave
     blank and the site shows Instagram's own profile embed of the latest posts instead. */
  feedEmbedUrl: '',
}

export const MENUS_PAGE = {
  eyebrow: 'The Menus',
  title: 'Every menu, in one place.',
  intro: 'The brochures and menus from across the site, tidy and ready to download.',
  items: [
    { title: 'The Loaded Bar', kind: 'Brochure', body: 'What’s included, the corporate and private bowl menus, requirements and terms for the live hot food station.', file: '/docs/the-loaded-bar.pdf', to: '/the-loaded-bar' },
    { title: 'The Creatiste Table', kind: 'Seasonal menu', body: 'The current set menu, from £43* per head. *Subject to final consultation. Travel fee and staffing may be charged.', file: '/docs/the-creatiste-table-menu.pdf', to: '/private-catering#the-creatiste-table' },
    { title: 'Batchfully Made', kind: 'Price list', body: 'Proteins, pastas, sides, vegetables and sauces, individually priced in 32oz and 58oz containers. Not on the menu? Ask and we’ll add it.', file: '/docs/batchfully-made-price-list.pdf', to: '/personal-chef#batchfully-made' },
    { title: 'The Home Edit', kind: 'Package options', body: 'Six packages for the in-home personal chef service, how each week looks, and the pricing basis.', file: '/docs/the-home-edit-packages.pdf', to: '/personal-chef#the-home-edit' },
    { title: 'Clean Dream', kind: 'Lunch menu', body: 'Build your own bowl: bases, proteins, toppings and extras for the weekday lunch service.', file: '/docs/clean-dream-menu.pdf', to: '/clean-dream' },
    // TODO Ellice: Corporate Curations and Private & Personal menu offerings when ready
  ],
}

export const KIND_WORDS = {
  eyebrow: 'Client testimonials',
  title: 'What clients remember',
  quotes: [
    { text: 'They listened to dietary needs without compromising joy on the plate. Guests are still texting about dessert.', who: 'Host, milestone celebration' },
    // TODO Ellice: more quotes you have permission to use, as { text, who }
  ],
}

export const ENQUIRE = {
  eyebrow: 'Contact',
  title: 'Tell us about your table',
  sub: 'Choose your enquiry type to open the right form. We reply personally, usually within one business day.',
  lanes: [
    { id: 'personal-chef', label: 'Personal Chef Services', hint: 'Batchfully Made · The Home Edit · Sorted & Served' },
    { id: 'private-catering', label: 'Private Catering', hint: 'Corporate Curations · Private & Personal · The Loaded Bar' },
    { id: 'creatiste-table', label: 'The Creatiste Table', hint: 'Private chef dinner, by special request' },
    { id: 'events', label: 'Pop-ups & Events', hint: 'Keep me posted, or let’s collaborate' },
  ],
  followUp: 'After we receive your enquiry, we’ll contact you to arrange a consultation and finalise menu and service details, including a fuller discussion of dietary requirements, in which you will then receive a full quotation breakdown.',
}

export const FOOTER = {
  tagline: 'A new-age personal chef & private catering service bridging the gap between busy lifestyles and hearty, flavourful home-cooked food, curated with premium, chef-level flair.',
}
