/* Canned responses for the design-preview build of the account page (see MOCK in account.js). Never part of the live site. */
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ref = (day) => { const d = new Date(`${day}T12:00:00`); return `Rita ${d.getDate()}${MON[d.getMonth()]}` }

// free dates: Sunday to Thursday, from a week ahead
const free = []
for (let i = 8; i <= 60; i++) { const d = new Date(); d.setDate(d.getDate() + i); if ([0, 1, 2, 3, 4].includes(d.getDay())) free.push(iso(d)) }

const holds = [
  { id: 1, date: free[1], service: 'The Home Edit', status: 'enquiry', paid: false, stage: 'awaiting_deposit', amount: 15, expires_at: new Date(Date.now() + 7.5 * 3600000).toISOString(), reference: ref(free[1]) },
  { id: 2, date: free[4], service: 'Batchfully Made', status: 'enquiry', paid: false, stage: 'requested', amount: 15, expires_at: '', reference: ref(free[4]) },
  { id: 3, date: free[8], service: 'Batchfully Made', status: 'confirmed', paid: true, stage: 'confirmed', amount: 15, expires_at: '', reference: ref(free[8]) },
]
let nextId = 4
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function mockFetch(path, opts = {}) {
  await wait(250)
  const method = (opts.method || 'GET').toUpperCase()
  const body = opts.body ? JSON.parse(opts.body) : {}
  if (path === '/login') return { ok: true }
  if (path === '/verify') return { token: 'mock', customer: { name: 'Rita Regular', email: body.email || 'rita@example.com', phone: '' } }
  if (path === '/holds') {
    const taken = new Set(holds.map((h) => h.date))
    const open = free.filter((d) => !taken.has(d))
    return { eligible: true, amount: 15, hours: 12, min_days: 7, window_days: 60, max_dates: 6, services: ['Batchfully Made', 'The Home Edit', 'Sorted & Served'],
      dates_by_service: { 'Batchfully Made': open, 'The Home Edit': open.filter((_, i) => i % 2 === 0), 'Sorted & Served': open }, holds: [...holds].sort((a, b) => a.date.localeCompare(b.date)) }
  }
  if (path === '/hold' && method === 'POST') {
    if (!(body.dates || []).length || !body.service) throw new Error('Choose a service and at least one date.')
    for (const d of body.dates) holds.push({ id: nextId++, date: d, service: body.service, status: 'enquiry', paid: false, stage: 'requested', amount: 15, expires_at: '', reference: ref(d) })
    return { holds: [] }
  }
  if (path === '/me' && method === 'PATCH') return { name: body.name, email: 'rita@example.com', phone: body.phone }
  if (path === '/me') return {
    customer: { name: 'Rita Regular', email: 'rita@example.com', phone: '07700 900123' },
    orders: [], reviews: [],
    enquiries: [{ id: 9, title: 'Weekly meal prep', event_type: 'Personal chef · Batchfully Made', date: '', status: 'confirmed', guest_count: 2, venue_name: '' }],
  }
  return {}
}
