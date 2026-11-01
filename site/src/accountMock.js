/* Canned responses for the design-preview build of the account page (see MOCK in account.js). Never part of the live site. */
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ref = (day) => { const d = new Date(`${day}T12:00:00`); return `Rita ${d.getDate()}${MON[d.getMonth()]}` }

// free dates: Sunday to Thursday, from a week ahead
const free = []
for (let i = 8; i <= 30; i++) { const d = new Date(); d.setDate(d.getDate() + i); if ([0, 1, 2, 3, 4].includes(d.getDay())) free.push(iso(d)) }

const holds = [
  { id: 1, date: free[1], service: 'The Home Edit', status: 'enquiry', paid: false, amount: 15, expires_at: new Date(Date.now() + 7.5 * 3600000).toISOString(), reference: ref(free[1]) },
  { id: 2, date: free[8], service: 'Batchfully Made', status: 'confirmed', paid: true, amount: 15, expires_at: '', reference: ref(free[6]) },
]
let nextId = 3
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function mockFetch(path, opts = {}) {
  await wait(250)
  const method = (opts.method || 'GET').toUpperCase()
  const body = opts.body ? JSON.parse(opts.body) : {}
  if (path === '/login') return { ok: true }
  if (path === '/verify') return { token: 'mock', customer: { name: 'Rita Regular', email: body.email || 'rita@example.com', phone: '' } }
  if (path === '/holds') {
    const taken = new Set(holds.map((h) => h.date))
    return { eligible: true, amount: 15, hours: 12, min_days: 7, window_days: 30, services: ['Batchfully Made', 'The Home Edit', 'Sorted & Served'], dates: free.filter((d) => !taken.has(d)), holds: [...holds].sort((a, b) => a.date.localeCompare(b.date)) }
  }
  if (path === '/hold' && method === 'POST') {
    if (!body.date || !body.service) throw new Error('Choose a date and a service.')
    holds.push({ id: nextId++, date: body.date, service: body.service, status: 'enquiry', paid: false, amount: 15, expires_at: new Date(Date.now() + 12 * 3600000).toISOString(), reference: ref(body.date) })
    return { hold: holds[holds.length - 1] }
  }
  if (path === '/me' && method === 'PATCH') return { name: body.name, email: 'rita@example.com', phone: body.phone }
  if (path === '/me') return {
    customer: { name: 'Rita Regular', email: 'rita@example.com', phone: '07700 900123' },
    orders: [], reviews: [],
    enquiries: [{ id: 9, title: 'Weekly meal prep', event_type: 'Personal chef · Batchfully Made', date: '', status: 'confirmed', guest_count: 2, venue_name: '' }],
  }
  return {}
}
