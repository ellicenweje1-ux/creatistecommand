/* The app's sections, in one place: the sidebar and phone menu (App.jsx) and "Your menu" in Settings both read this. */

// Ordered to follow a catering job's natural flow: see the day → take the booking →
// plan the menu → source & prep → deliver → bill. (Reordered 2026, owner's steer.)
// Anything in the signed-in user's `nav_hidden` list moves under "More tools" (Settings → Appearance → Your menu),
// so a chef keeps only the sections they use every day in view. Today can't be hidden.
export const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/app', icon: 'sun', label: 'Today', end: true },
      { to: '/app/calendar', icon: 'clock', label: 'Calendar' },
      { to: '/app/standing', icon: 'check', label: 'Paid & booked', min: 2, ownerOnly: true },
      { to: '/app/bookings', icon: 'calendar', label: 'Bookings' },
      { to: '/app/preorders', icon: 'cart', label: 'Pre-orders', min: 2 },
      { to: '/app/clients', icon: 'users', label: 'Clients', min: 2 },
      { to: '/app/tastings', icon: 'fork', label: 'Tastings', min: 2 },
      { to: '/app/tasks', icon: 'checks', label: 'To-dos' },
      { to: '/app/routes', icon: 'map', label: 'Routes', min: 2 },
      { to: '/app/team', icon: 'users', label: 'Team', min: 3 },
    ],
  },
  {
    label: 'Kitchen',
    items: [
      { to: '/app/menus', icon: 'doc', label: 'Menus' },
      { to: '/app/recipes', icon: 'book', label: 'Recipes' },
      { to: '/app/allergens', icon: 'grid2', label: 'Allergens' },
      { to: '/app/inventory', icon: 'box', label: 'Inventory' },
      { to: '/app/shopping', icon: 'cart', label: 'Shopping' },
      { to: '/app/orders', icon: 'truck', label: 'Orders', min: 2 },
      { to: '/app/suppliers', icon: 'tag', label: 'Suppliers', min: 2 },
      { to: '/app/packing', icon: 'clipboard', label: 'Packing' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/app/finance', icon: 'coins', label: 'Finance', min: 2, ownerOnly: true },
      { to: '/app/reviews', icon: 'star', label: 'Reviews', min: 2 },
      { to: '/app/designs', icon: 'layout', label: 'Designs', min: 2 },
      { to: '/app/ideas', icon: 'bulb', label: 'My Brain' },
      { to: '/app/dashboard', icon: 'pulse', label: 'Dashboard' },
      { to: '/app/guide', icon: 'home', label: 'Guide' },
    ],
  },
]
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

// Bottom-nav quick links (mobile): the first four of these the signed-in user can open and hasn't tucked away.
export const QUICK_PATHS = ['/app', '/app/calendar', '/app/standing', '/app/tasks', '/app/preorders', '/app/shopping', '/app/bookings', '/app/finance']
