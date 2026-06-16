import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { RequireActive, RequireAdmin, RequireAuth, useAuth } from './auth'
import { cls } from './format'
import { useOfflineState } from './offline'
import Admin from './pages/Admin'
import Allergens from './pages/Allergens'
import AuthPage from './pages/AuthPage'
import BookingDetail from './pages/BookingDetail'
import Bookings from './pages/Bookings'
import Clients from './pages/Clients'
import Dashboard from './pages/Dashboard'
import Designs from './pages/Designs'
import Finance from './pages/Finance'
import FoundersInvite from './pages/Founders'
import FounderExperience, { FounderBadge } from './founders'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Ideas from './pages/Ideas'
import Inventory from './pages/Inventory'
import Landing from './pages/Landing'
import { Privacy, Terms } from './pages/Legal'
import Onboarding from './pages/Onboarding'
import ResetPassword from './pages/ResetPassword'
import Orders from './pages/Orders'
import Packing from './pages/Packing'
import PublicEnquiry from './pages/PublicEnquiry'
import PublicQuote from './pages/PublicQuote'
import Recipes from './pages/Recipes'
import RoutesPage from './pages/RoutesPage'
import Settings, { SettingsAppearance, SettingsIntegrations, SettingsMembership, SettingsProfile, SettingsSecurity } from './pages/Settings'
import Support from './pages/Support'
import Shopping from './pages/Shopping'
import Suppliers from './pages/Suppliers'
import Tastings from './pages/Tastings'
import Tasks from './pages/Tasks'
import Team from './pages/Team'
import { Brand, Icon, toast } from './ui'

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/app', icon: 'home', label: 'Home', end: true },
      { to: '/app/dashboard', icon: 'pulse', label: 'Dashboard' },
      { to: '/app/bookings', icon: 'calendar', label: 'Bookings' },
      { to: '/app/tastings', icon: 'spoon', label: 'Tastings', min: 2 },
      { to: '/app/tasks', icon: 'checks', label: 'Tasks' },
      { to: '/app/routes', icon: 'map', label: 'Routes', min: 2 },
      { to: '/app/team', icon: 'users', label: 'Team', min: 3 },
    ],
  },
  {
    label: 'Kitchen',
    items: [
      { to: '/app/recipes', icon: 'book', label: 'Recipes' },
      { to: '/app/inventory', icon: 'box', label: 'Inventory' },
      { to: '/app/shopping', icon: 'cart', label: 'Shopping' },
      { to: '/app/packing', icon: 'clipboard', label: 'Packing' },
      { to: '/app/orders', icon: 'truck', label: 'Orders', min: 2 },
      { to: '/app/allergens', icon: 'grid2', label: 'Allergens' },
      { to: '/app/suppliers', icon: 'tag', label: 'Suppliers', min: 2 },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/app/clients', icon: 'users', label: 'Clients', min: 2 },
      { to: '/app/finance', icon: 'coins', label: 'Finance', min: 2, ownerOnly: true },
      { to: '/app/designs', icon: 'layout', label: 'Designs', min: 2 },
      { to: '/app/ideas', icon: 'bulb', label: 'My Brain' },
    ],
  },
]

const PLAN_NAMES = { 2: 'Pro Caterer', 3: 'Elite Kitchen' }

function userLevel(user) {
  if (!user) return 1
  if (user.role === 'admin') return 3
  return user.plan_level ?? ({ starter: 1, pro: 2, elite: 3 }[user.plan] || 1)
}

function visibleItems(items, user) {
  return items.filter((i) => !(i.ownerOnly && user?.is_staff))
}

function lockToast(item) {
  toast(`${item.label} is part of the ${PLAN_NAMES[item.min]} plan — upgrade in Settings → Membership`, 'red')
}

function SideLink({ item, locked, onClick }) {
  if (locked) {
    return (
      <button onClick={() => lockToast(item)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-cream/30 hover:bg-white/5">
        <Icon name={item.icon} size={17} />
        <span className="flex-1 text-left">{item.label}</span>
        <Icon name="lock" size={13} />
      </button>
    )
  }
  return (
    <NavLink to={item.to} end={item.end} onClick={onClick}
      className={({ isActive }) => cls(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-copper/15 text-copper' : 'text-cream/60 hover:bg-white/5 hover:text-cream')}>
      <Icon name={item.icon} size={17} />
      {item.label}
    </NavLink>
  )
}

/* Connectivity chip: shows when the kitchen is offline (with how many changes are
   waiting) and while queued changes are syncing back to the cloud. */
function OfflineChip() {
  const { online, pending, syncing } = useOfflineState()
  if (online && !pending && !syncing) return null
  const text = !online
    ? pending
      ? `Offline — ${pending} change${pending === 1 ? '' : 's'} saved on this device`
      : 'Offline — your work is saved on this device'
    : syncing
      ? 'Back online — syncing your changes…'
      : `${pending} change${pending === 1 ? '' : 's'} waiting to sync`
  return (
    <div className={cls(
      'fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur lg:bottom-4',
      !online ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'border-copper/40 bg-copper/15 text-copper')}>
      <span className={cls('mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle', !online ? 'bg-amber-500' : 'animate-pulse bg-copper')} />
      {text}
    </div>
  )
}

function TrialBanner({ user }) {
  if (user?.is_staff || user?.subscription_status !== 'trialing') return null
  const days = user.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(`${user.trial_ends_at}T23:59:59`) - new Date()) / 86400000))
    : 0
  return (
    <Link to="/onboarding" className="block bg-copper px-4 py-2 text-center text-xs font-semibold text-ink transition-colors hover:bg-copper-dark">
      Free trial — {days} day{days === 1 ? '' : 's'} left · Activate your kitchen now →
    </Link>
  )
}

function AppShell() {
  const { user, logout } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()
  const level = userLevel(user)
  // After offline changes replay to the server, remount the current page so it
  // refetches and swaps optimistic local copies for the server's records.
  const [syncEpoch, setSyncEpoch] = useState(0)
  useEffect(() => {
    const bump = () => setSyncEpoch((n) => n + 1)
    window.addEventListener('cc-synced', bump)
    return () => window.removeEventListener('cc-synced', bump)
  }, [])
  // Daily-use shortcuts; Home (the module guide at /app) stays reachable via the
  // brand logo tap and the "More" sheet.
  const mobileMain = [NAV_GROUPS[0].items[1], NAV_GROUPS[0].items[2], NAV_GROUPS[0].items[4], NAV_GROUPS[1].items[2]]
  const allItems = NAV_GROUPS.flatMap((g) => visibleItems(g.items, user))

  return (
    <div className="min-h-screen bg-base lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/5 bg-ink lg:flex">
        <div className="px-5 pb-4 pt-6"><Brand on="dark" small /></div>
        <nav className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-3 pb-2">
          {NAV_GROUPS.map((group) => {
            const items = visibleItems(group.items, user)
            if (items.length === 0) return null
            return (
              <div key={group.label}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/25">{group.label}</p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <SideLink key={item.to} item={item} locked={item.min && level < item.min} />
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <SideLink item={{ to: '/app/support', icon: 'help', label: 'Help & FAQs' }} />
          <SideLink item={{ to: '/app/settings', icon: 'settings', label: 'Settings' }} />
          {user?.role === 'admin' && <SideLink item={{ to: '/app/admin', icon: 'shield', label: 'Platform admin' }} />}
          <button onClick={logout} className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-cream/60 hover:bg-white/5 hover:text-cream">
            <Icon name="logout" size={17} /> Log out
          </button>
          <p className="mt-2 truncate px-3 text-xs text-cream/35">
            {user?.business_name || user?.email}{user?.is_staff ? ' · staff' : ''}
          </p>
          {user?.is_founder && <FounderBadge number={user.founder_number} className="mx-3 mt-1.5" />}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-base/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => navigate('/app')}><Brand small /></button>
        <button onClick={() => setMoreOpen(true)} className="rounded-lg p-2 text-fg/60 hover:bg-fg/5"><Icon name="menu" /></button>
      </header>

      <TrialBanner user={user} />
      <FounderExperience />

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
        <Outlet key={syncEpoch} />
      </main>

      <OfflineChip />

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileMain.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => cls('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-copper' : 'text-fg/45')}>
            <Icon name={item.icon} size={19} />
            {item.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-fg/45">
          <Icon name="dots" size={19} /> More
        </button>
      </nav>

      {/* Mobile "more" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-base p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-fg/15" />
            <div className="grid grid-cols-4 gap-3">
              {[...allItems, { to: '/app/support', icon: 'help', label: 'Help' }, { to: '/app/settings', icon: 'settings', label: 'Settings' },
                ...(user?.role === 'admin' ? [{ to: '/app/admin', icon: 'shield', label: 'Admin' }] : [])].map((item) => {
                const locked = item.min && level < item.min
                if (locked) {
                  return (
                    <button key={item.to} onClick={() => lockToast(item)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-card p-3 text-xs font-medium text-fg/30">
                      <Icon name="lock" size={20} />
                      {item.label}
                    </button>
                  )
                }
                return (
                  <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-card p-3 text-xs font-medium text-fg/70">
                    <Icon name={item.icon} size={20} className="text-copper" />
                    {item.label}
                  </NavLink>
                )
              })}
              <button onClick={logout} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-card p-3 text-xs font-medium text-fg/70">
                <Icon name="logout" size={20} className="text-red-500" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/q/:token" element={<PublicQuote />} />
      <Route path="/enquire/:token" element={<PublicEnquiry />} />
      <Route path="/founders/:code" element={<FoundersInvite />} />
      <Route path="/app" element={<RequireAuth><RequireActive><AppShell /></RequireActive></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="tastings" element={<Tastings />} />
        <Route path="clients" element={<Clients />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="shopping" element={<Shopping />} />
        <Route path="packing" element={<Packing />} />
        <Route path="orders" element={<Orders />} />
        <Route path="allergens" element={<Allergens />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="team" element={<Team />} />
        <Route path="designs" element={<Designs />} />
        <Route path="ideas" element={<Ideas />} />
        <Route path="finance" element={<Finance />} />
        <Route path="support" element={<Support />} />
        <Route path="settings" element={<Settings />}>
          <Route index element={<SettingsProfile />} />
          <Route path="security" element={<SettingsSecurity />} />
          <Route path="appearance" element={<SettingsAppearance />} />
          <Route path="membership" element={<SettingsMembership />} />
          <Route path="integrations" element={<SettingsIntegrations />} />
        </Route>
        <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
