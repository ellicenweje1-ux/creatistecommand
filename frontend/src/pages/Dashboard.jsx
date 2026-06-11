import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { BOOKING_TONES, fmtDate, fmtMoney, label, relDays } from '../format'
import { Badge, Card, Icon, ProgressBar, Spinner, StatCard, toastErr } from '../ui'

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/dashboard').then(setData).catch(toastErr) }, [])
  if (!data) return <Spinner />

  const cur = user?.currency || 'GBP'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">{greeting}, {user?.name?.split(' ')[0] || 'chef'}.</h1>
        <p className="mt-1 text-sm text-fg/55">Here's the state of the kitchen today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tasks" value={data.tasks.open} hint={`${data.tasks.overdue} overdue · ${data.tasks.due_today} due today`} tone={data.tasks.overdue ? 'red' : 'ink'} icon="checks" />
        <StatCard label="Paid this month" value={fmtMoney(data.finance.month_paid, cur)} hint={`${fmtMoney(data.finance.outstanding, cur)} outstanding`} tone="sage" icon="coins" />
        <StatCard label="Expenses this month" value={fmtMoney(data.finance.month_expenses, cur)} icon="cart" />
        <StatCard label="Stock alerts" value={data.expiring.length + data.low_stock.length} hint={`${data.expiring.length} expiring · ${data.low_stock.length} low${data.expired_count ? ` · ${data.expired_count} expired` : ''}`} tone={data.expiring.length ? 'copper' : 'ink'} icon="box" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Upcoming bookings" action={<Link to="/app/bookings" className="text-xs font-medium text-copper">View all</Link>} pad={false}>
            {data.upcoming_bookings.length === 0 ? (
              <p className="p-5 text-sm text-fg/45">No bookings in the next 3 weeks. <Link className="text-copper" to="/app/bookings">Add one →</Link></p>
            ) : (
              <ul className="divide-y divide-line/70">
                {data.upcoming_bookings.map((b) => (
                  <li key={b.id}>
                    <Link to={`/app/bookings/${b.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-parchment/50">
                      <div className="w-14 shrink-0 text-center">
                        <p className="font-display text-xl font-semibold leading-none text-copper">{b.date?.slice(8, 10)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-fg/45">{fmtDate(b.date).split(' ')[2]}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{b.title}</p>
                        <p className="truncate text-xs text-fg/50">{b.guest_count} guests · {b.venue_name || 'venue TBC'} · {relDays(b.date)}</p>
                      </div>
                      <Badge tone={BOOKING_TONES[b.status]}>{label(b.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Next tasks" action={<Link to="/app/tasks" className="text-xs font-medium text-copper">All tasks</Link>} pad={false}>
            {data.tasks.next.length === 0 ? <p className="p-5 text-sm text-fg/45">Nothing pending. Enjoy the calm.</p> : (
              <ul className="divide-y divide-line/70">
                {data.tasks.next.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Icon name={t.status === 'doing' ? 'clock' : 'checks'} size={15} className="shrink-0 text-fg/35" />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <span className="shrink-0 text-xs text-fg/45">{t.due_date ? fmtDate(t.due_date) : ''}</span>
                    {t.due_date && t.due_date < data.today && <Badge tone="red">overdue</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Orders in transit" action={<Link to="/app/orders" className="text-xs font-medium text-copper">All orders</Link>} pad={false}>
            {data.orders_in_transit.length === 0 ? <p className="p-5 text-sm text-fg/45">No deliveries on the way.</p> : (
              <ul className="divide-y divide-line/70">
                {data.orders_in_transit.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Icon name="truck" size={15} className="shrink-0 text-fg/35" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{o.supplier} <span className="text-fg/40">— {o.items_summary}</span></p>
                    </div>
                    <span className="shrink-0 text-xs text-fg/45">{o.expected_date ? `eta ${fmtDate(o.expected_date)}` : ''}</span>
                    <Badge tone={o.status === 'delayed' ? 'red' : 'copper'}>{label(o.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Use it or lose it" action={<Link to="/app/inventory" className="text-xs font-medium text-copper">Inventory</Link>} pad={false}>
            {data.expiring.length === 0 ? <p className="p-5 text-sm text-fg/45">Nothing expiring this week.</p> : (
              <ul className="divide-y divide-line/70">
                {data.expiring.map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="truncate">{i.name}</span>
                    <Badge tone={relDays(i.expiry_date) === 'today' ? 'red' : 'amber'}>{relDays(i.expiry_date)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Running low" pad={false}>
            {data.low_stock.length === 0 ? <p className="p-5 text-sm text-fg/45">Stock levels look healthy.</p> : (
              <ul className="divide-y divide-line/70">
                {data.low_stock.map((i) => (
                  <li key={i.id} className="px-4 py-2.5 text-sm">
                    <div className="flex justify-between"><span className="truncate">{i.name}</span><span className="text-fg/45">{i.quantity} {i.unit}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Shopping lists" action={<Link to="/app/shopping" className="text-xs font-medium text-copper">All lists</Link>} pad={false}>
            {data.shopping_lists.length === 0 ? <p className="p-5 text-sm text-fg/45">No open lists.</p> : (
              <ul className="divide-y divide-line/70">
                {data.shopping_lists.map((sl) => (
                  <li key={sl.id} className="px-4 py-3">
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="truncate font-medium">{sl.title}</span>
                      <span className="shrink-0 text-xs text-fg/45">{sl.purchased_items}/{sl.total_items}</span>
                    </div>
                    <ProgressBar value={sl.purchased_items} max={sl.total_items || 1} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="My Brain — pinned" action={<Link to="/app/ideas" className="text-xs font-medium text-copper">My Brain</Link>} pad={false}>
            {data.pinned_ideas.length === 0 ? <p className="p-5 text-sm text-fg/45">Pin the things you must not forget.</p> : (
              <ul className="divide-y divide-line/70">
                {data.pinned_ideas.map((i) => (
                  <li key={i.id} className="px-4 py-2.5">
                    <p className="text-sm font-medium">{i.title || 'Untitled idea'}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-fg/50">{i.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
