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
export const RECOMMENDED_BUDGET = {
  'Batchfully Made': { Weekly: 120, Monthly: 480, 'Per visit': 120 },
  'The Home Edit': { Weekly: 184, Monthly: 736, 'Per visit': 184 },
  'Sorted & Served': { Weekly: 90, Monthly: 360, 'Per visit': 90 },
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
      note: 'A set price list for the 32oz and 58oz containers is available on request.',
      photo: '/photos/batch-containers.jpg',
    },
    {
      slug: 'the-home-edit',
      name: 'The Home Edit',
      strap: 'In-home personal chef service.',
      body: 'In-house personal chef service where all meals are cooked and served fresh in the comfort of your home, covering breakfast, lunch, dinner and even the snacks in between, enough to fulfil your week and store what you need for later.',
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
        'The same chef-level standard, a simpler bill',
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
      menuNote: 'Menu offerings for corporate bookings to follow.', // TODO Ellice: corporate menu offerings
      photo: '/photos/bowls-table.jpg',
    },
    {
      slug: 'private-and-personal',
      name: 'Private & Personal',
      strap: 'Birthdays, anniversaries and intimate gatherings.',
      body: 'The CC Loaded Bar for birthdays, anniversaries and intimate gatherings, with food catered hot and served beautifully, so your guests remember the food when they think of your special day.',
      includes: ['Intimate gatherings in large homes and private spaces', 'Hot, served live, never a tray drop', 'Menus built around the occasion'],
      menuNote: 'Menu offerings for private bookings to follow.', // TODO Ellice: private menu offerings
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
      photo: '/photos/duck-salad.jpg',
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
  from: '£21 per head',
  photo: '/photos/loaded-bar.jpg',
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
  menu: {
    title: 'The bowl menu',
    groups: [
      { name: 'Base', pick: 'choose one', items: ['Seasoned rice', 'Sweet potato mash', 'Salad mix', 'Creamy mac & cheese (+£1.50 per head)', 'Herby coconut bulgur', 'Cubed roasted red potatoes', 'Tortilla nacho chips'], extra: 'Add one additional base: +£2.50 per head' },
      { name: 'Protein', pick: 'choose two', items: ['Sweet chilli BBQ or suya chicken thigh', 'Pepper steak', 'Baked sweet chilli BBQ salmon bites', 'Asian marinated prawns', 'Roasted Mediterranean vegetables with grilled halloumi (V)', 'Honey harissa roasted chickpeas & sweet potato (VG)', 'Fried tofu bites (VG)'], extra: 'Add one additional protein: +£4 per head' },
      { name: 'Toppings', pick: 'choose six', items: ['Crispy onions', 'Red onion', 'Sweetcorn', 'Cucumber', 'Tomato', 'Pickled pink slaw', 'Sliced jalapeños', 'Fresh coriander', 'Fresh parsley', 'Grated Padano cheese', 'Pomegranate', 'Crumbled feta (+£0.50 per head)', 'Smashed avocado (+£0.80 per head)'] },
      { name: 'Sauce & seasoning', pick: 'choose three', items: ['Garlic white sauce', 'Sweet chilli BBQ', 'Hot honey', 'Balsamic glaze', 'Sriracha', 'Cholula hot sauce', 'Olive oil', 'Salt & pepper', 'Chilli flakes', 'Peri peri salt', 'Lemon wedges', 'Lime wedges'] },
      { name: 'Side', pick: 'choose one', items: ['Pitta chips', 'Tortilla nacho chips', 'Fried plantain', 'Mini naan breads'] },
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
  eyebrow: 'Happening now',
  title: 'What’s up with Us?',
  intro: 'Lunch services, pop-ups and the occasional Creatiste-hosted event. This page changes, so check back or ask to be kept posted.',
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
  title: 'Clean Dream',
  sub: 'Clean, whole-food lunch bowls, cooked fresh and served hot. Comforting, home-cooked and beautiful, built to keep you going.',
  photo: '/photos/bowls-table.jpg',
  how: [
    ['Order by 11am', 'Orders in by 11:00am are made the same day, Monday to Friday. After 11am, your order rolls to the next weekday.'],
    ['Collect at 1pm or 2:30pm', 'Two collection points each day. Pick the one that suits you at checkout.'],
    ['Or have it delivered', 'Deliveries between the two locations by request, at +£0.65 per mile. We confirm by WhatsApp after you order and the delivery fee is charged separately.'],
    ['Paid is confirmed', 'Your order is confirmed once payment goes through. Every box is named so each person’s food is labelled correctly.'],
  ],
}

export const PROCESS = {
  eyebrow: 'How it works',
  title: 'Consultation first. Always.',
  steps: [
    ['Tell us about your table', 'A short enquiry: who it’s for, when, and roughly what you have in mind.'],
    ['A conversation', 'We reply personally, usually within one business day, and arrange a consultation to understand your tastes, needs and dates.'],
    ['Your proposal', 'A tailored menu and a full quotation breakdown, written for you, not pulled from a price board.'],
    ['The day itself', 'We shop, cook, serve and clear. You stay present.'],
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
    'Over 9 years of food service & industry experience',
    'BSc Food Science with Business',
    'Currently studying MSc Food Business Management',
    'Experience in food technical & new product development in industry',
  ],
  story: 'Ellice launched The Creatiste [kree·ay·teest] Catering in September 2025, a concept aimed to serve those who are committed to their ambitious lifestyles, but not always to their food.',
  specialisms: ['Flavour-forward home cooking', 'Batch & meal-prep systems', 'Live-service catering', 'Allergen-aware menus'], // TODO Ellice: your real specialisms
  dietary: 'Vegan, vegetarian and gluten-free diets catered for, adhering to food safety and hygiene standards throughout.',
  profile: [
    // TODO Ellice: the profile details from your attachment, as [label, value]
    ['Based', 'Slough, serving West London, Surrey and Berkshire'],
    ['Launched', 'September 2025'],
    ['Education', 'BSc Food Science with Business; MSc Food Business Management (in progress)'],
    ['Experience', 'Over 9 years in food service and industry, including food technical and new product development'],
  ],
  accreditations: [
    // TODO Ellice: add each certificate as { name, issuer, year, file: '/docs/….pdf' }
    { name: 'Level 2 Food Safety & Hygiene', issuer: 'Issuer to confirm', year: '' },
    { name: 'Allergen awareness', issuer: 'Issuer to confirm', year: '' },
    { name: 'Food hygiene rating', issuer: 'Local authority', year: '' },
  ],
}

export const PORTFOLIO = {
  eyebrow: 'Our portfolio',
  title: 'Who we’ve worked with',
  intro: 'A few of the tables, teams and rooms we’ve fed. More to come as the diary fills.',
  clients: [
    // TODO Ellice: the businesses and hosts you can name, with a logo file in /photos/clients/ if you have one
    { name: '15 Under 30 × Kasa', kind: 'Seated dinner collaboration', logo: '' },
    { name: 'G4 Boys', kind: 'Private chef · International artists · May 2026', logo: '' },
    { name: 'Indigo Kxd', kind: 'Personal chef · Producer & label owner', logo: '' },
  ],
  features: [
    { title: 'A seated dinner for 15 Under 30 × Kasa', kind: 'The Creatiste Table', photo: '/photos/duck-salad.jpg', body: 'A four-stage set menu, served sharing style: marinated olives and glazed sausage bites on arrival, burrata and roasted aubergine dip with rosemary focaccia, spiced fruit braised duck on butter bean orzo, and a cardamom and orange tiramisu to finish.' },
    { title: 'Office lunch, served live', kind: 'Corporate Curations', photo: '/photos/bowls-table.jpg', body: 'Build-your-own bowls for a team lunch, served hot from The Loaded Bar and cleared away without a trace.' },
    { title: 'A week of meals, fridge-ready', kind: 'The Home Edit', photo: '/photos/prep-labelled.jpg', body: 'Labelled, portioned and stored: the week handled in a single visit.' },
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
  ],
  /* Social mirror: paste Instagram post or reel links here (public posts). They render as
     official Instagram embeds, pictures and videos alike. TODO Ellice: your best 6 to 9 posts. */
  instagram: [],
}

export const MENUS_PAGE = {
  eyebrow: 'The Menus',
  title: 'Every menu, in one place.',
  intro: 'The brochures and menus from across the site, tidy and ready to download.',
  items: [
    { title: 'The Loaded Bar', kind: 'Brochure', body: 'What’s included, the bowl menu, requirements and terms for the live hot food station.', file: '/docs/the-loaded-bar.pdf', to: '/the-loaded-bar' },
    { title: 'The Creatiste Table', kind: 'Seasonal menu', body: 'The current set menu, £43 per head. Travel fee and staffing may be charged, subject to final consultation.', file: '/docs/the-creatiste-table-menu.pdf', to: '/private-catering#the-creatiste-table' },
    { title: 'The Home Edit', kind: 'Package options', body: 'Six packages for the in-home personal chef service, how each week looks, and the pricing basis.', file: '/docs/the-home-edit-packages.pdf', to: '/personal-chef#the-home-edit' },
    { title: 'Clean Dream', kind: 'Lunch menu', body: 'Build your own bowl: bases, proteins, toppings and extras for the weekday lunch service.', file: '/docs/clean-dream-menu.pdf', to: '/clean-dream' },
    // TODO Ellice: Corporate Curations and Private & Personal menu offerings when ready
  ],
}

export const KIND_WORDS = {
  eyebrow: 'Kind words',
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
    { id: 'pricing-guide', label: 'Request the Pricing Guide', hint: 'A guide to how we price, sent to your inbox' },
    { id: 'events', label: 'Pop-ups & Events', hint: 'Keep me posted, or let’s collaborate' },
  ],
  followUp: 'After we receive your enquiry, we’ll contact you to arrange a consultation and finalise menu and service details, including a fuller discussion of dietary requirements, in which you will then receive a full quotation breakdown.',
}

export const FOOTER = {
  tagline: 'A new-age personal chef & private catering service bridging the gap between busy lifestyles and hearty, flavourful home-cooked food, curated with premium, chef-level flair.',
}
