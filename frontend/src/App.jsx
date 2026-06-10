import { useState } from 'react'
import { NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { RequireActive, RequireAdmin, RequireAuth, useAuth } from './auth'
import { cls } from './format'
import Admin from './pages/Admin'
import AuthPage from './pages/AuthPage'
import BookingDetail from './pages/BookingDetail'
import Bookings from './pages/Bookings'
import Clients from './pages/Clients'
import Dashboard from './pages/Dashboard'
import Designs from './pages/Designs'
import Finance from './pages/Finance'
import Ideas from './pages/Ideas'
import Inventory from './pages/Inventory'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Orders from './pages/Orders'
import Recipes from './pages/Recipes'
import RoutesPage from './pages/RoutesPage'
import Settings from './pages/Settings'
import Shopping from './pages/Shopping'
import Tasks from './pages/Tasks'
import { Icon } from './ui'

const NAV = [
  { to: '/app', icon: 'home', label: 'Dashboard', end: true },
  { to: '/app/bookings', icon: 'calendar', label: 'Bookings' },
  { to: '/app/clients', icon: 'users', label: 'Clients' },
  { to: '/app/recipes', icon: 'book', label: 'Recipes' },
  { to: '/app/inventory', icon: 'box', label: 'Inventory' },
  { to: '/app/shopping', icon: 'cart', label: 'Shopping' },
  { to: '/app/orders', icon: 'truck', label: 'Orders' },
  { to: '/app/tasks', icon: 'checks', label: 'Tasks' },
  { to: '/app/routes', icon: 'map', label: 'Routes' },
  { to: '/app/designs', icon: 'layout', label: 'Designs' },
  { to: '/app/ideas', icon: 'bulb', label: 'Ideas' },
  { to: '/app/finance', icon: 'coins', label: 'Finance' },
]

function Wordmark({ light = false, small = false }) {
  return (
    <span className={cls('font-display font-semibold tracking-tight', small ? 'text-lg' : 'text-xl', light ? 'text-cream' : 'text-ink')}>
      The Creatiste <em className="text-copper not-italic font-display italic">Command</em>
    </span>
  )
}

function SideLink({ item, onClick }) {
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

function AppShell() {
  const { user, logout } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()
  const mobileMain = NAV.slice(0, 4)

  return (
    <div className="min-h-screen bg-cream lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-ink lg:flex">
        <div className="px-5 pb-5 pt-6"><Wordmark light small /></div>
        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((item) => <SideLink key={item.to} item={item} />)}
          {user?.role === 'admin' && <SideLink item={{ to: '/app/admin', icon: 'shield', label: 'Admin' }} />}
        </nav>
        <div className="border-t border-white/10 p-3">
          <SideLink item={{ to: '/app/settings', icon: 'settings', label: 'Settings' }} />
          <button onClick={logout} className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-cream/60 hover:bg-white/5 hover:text-cream">
            <Icon name="logout" size={17} /> Log out
          </button>
          <p className="mt-3 truncate px-3 text-xs text-cream/35">{user?.business_name || user?.email}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => navigate('/app')}><Wordmark small /></button>
        <button onClick={() => setMoreOpen(true)} className="rounded-lg p-2 text-ink/60 hover:bg-ink/5"><Icon name="menu" /></button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileMain.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => cls('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-copper' : 'text-ink/45')}>
            <Icon name={item.icon} size={19} />
            {item.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-ink/45">
          <Icon name="dots" size={19} /> More
        </button>
      </nav>

      {/* Mobile "more" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-cream p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <div className="grid grid-cols-4 gap-3">
              {[...NAV.slice(4), { to: '/app/settings', icon: 'settings', label: 'Settings' },
                ...(user?.role === 'admin' ? [{ to: '/app/admin', icon: 'shield', label: 'Admin' }] : [])].map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white p-3 text-xs font-medium text-ink/70">
                  <Icon name={item.icon} size={20} className="text-copper" />
                  {item.label}
                </NavLink>
              ))}
              <button onClick={logout} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white p-3 text-xs font-medium text-ink/70">
                <Icon name="logout" size={20} className="text-red-700" /> Log out
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
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth><RequireActive><AppShell /></RequireActive></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="shopping" element={<Shopping />} />
        <Route path="orders" element={<Orders />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="designs" element={<Designs />} />
        <Route path="ideas" element={<Ideas />} />
        <Route path="finance" element={<Finance />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
