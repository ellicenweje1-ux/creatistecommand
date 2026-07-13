import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtDate, label, todayISO } from '../format'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea, toast, toastErr, Toggle } from '../ui'
import ExampleCard from '../examples'

const ACTION_TONES = { created: 'sage', updated: 'amber', completed: 'copper', deleted: 'red', approved: 'sage', declined: 'red' }

/* ------------------------------- staff modal ------------------------------- */
function StaffModal({ open, onClose, onSaved, initial = null }) {
  const blank = { name: '', email: '', phone: '', job_title: '', password: '' }
  const [form, setForm] = useState(blank)
  useEffect(() => { if (open) setForm(initial ? { ...blank, ...initial, password: '' } : blank) }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    const req = initial?.id
      ? api.patch(`/team/staff/${initial.id}`, form)
      : api.post('/team/staff', form)
    req.then(onSaved).catch(toastErr)
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? `Edit ${initial.name || 'staff member'}` : 'Add a staff member'}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input value={form.name} onChange={set('name')} required /></Field>
          <Field label="Role / job title"><Input value={form.job_title} onChange={set('job_title')} placeholder="Sous chef" /></Field>
        </div>
        <Field label="Email (their login)"><Input type="email" value={form.email} onChange={set('email')} required disabled={!!initial?.id} className={initial?.id ? 'opacity-60' : ''} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
        <Field label={initial?.id ? 'Reset password (leave blank to keep)' : 'Set their password'} hint="At least 8 characters — share it with them securely">
          <Input type="text" value={form.password} onChange={set('password')} minLength={initial?.id ? 0 : 8} required={!initial?.id} />
        </Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>{initial?.id ? 'Save' : 'Create login'}</Button></div>
      </form>
    </Modal>
  )
}

/* ------------------------------- shift modal ------------------------------- */
function ShiftModal({ open, onClose, onSaved, staff, initial = null }) {
  const blank = { staff_id: '', date: todayISO(), start_time: '09:00', end_time: '17:00', role_label: '', location: '', booking_id: '', notes: '' }
  const [form, setForm] = useState(blank)
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...blank, ...initial } : { ...blank, staff_id: staff[0]?.id || '' })
    api.get('/bookings').then(setBookings).catch(() => {})
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    const payload = { ...form, staff_id: form.staff_id ? Number(form.staff_id) : null, booking_id: form.booking_id ? Number(form.booking_id) : null }
    const req = initial?.id ? api.patch(`/shifts/${initial.id}`, payload) : api.post('/shifts', payload)
    req.then(onSaved).catch(toastErr)
  }
  const remove = () => { if (initial?.id && window.confirm('Delete this shift?')) api.del(`/shifts/${initial.id}`).then(onSaved).catch(toastErr) }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit shift' : 'Add a shift'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Staff member">
          <Select value={form.staff_id || ''} onChange={set('staff_id')} required>
            <option value="">— pick —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={set('date')} required /></Field>
          <Field label="From"><Input type="time" value={form.start_time} onChange={set('start_time')} /></Field>
          <Field label="To"><Input type="time" value={form.end_time} onChange={set('end_time')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role on the day"><Input value={form.role_label} onChange={set('role_label')} placeholder="Service / Prep / KP" /></Field>
          <Field label="Location"><Input value={form.location} onChange={set('location')} /></Field>
        </div>
        <Field label="Linked booking">
          <Select value={form.booking_id || ''} onChange={set('booking_id')}>
            <option value="">—</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </Select>
        </Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-between gap-2">
          {initial?.id ? <Button type="button" variant="danger" icon="trash" onClick={remove}>Delete</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>{initial?.id ? 'Save' : 'Add shift'}</Button></div>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------ staff own view ----------------------------- */
function MyTeamView() {
  const [data, setData] = useState(null)
  const load = () => api.get('/team/me').then(setData).catch(toastErr)
  useEffect(load, [])
  if (!data) return <Spinner />
  const today = todayISO()
  const toggleTask = (t) => api.patch(`/tasks/${t.id}`, { status: t.status === 'done' ? 'todo' : 'done' }).then(load).catch(toastErr)

  return (
    <div>
      <PageHeader title="My rota & tasks" sub="Your shifts and the jobs assigned to you — tick them off as you go." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="My shifts" pad={false}>
          {data.shifts.filter((s) => s.date >= today).length === 0 ? <p className="p-5 text-sm text-fg/45">No upcoming shifts.</p> : (
            <ul className="divide-y divide-line/70">
              {data.shifts.filter((s) => s.date >= today).map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="font-display text-xl font-semibold leading-none text-copper">{s.date.slice(8, 10)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-fg/45">{fmtDate(s.date).replace(/^\w+ /, '')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.start_time}–{s.end_time} {s.role_label && <Badge tone="copper" className="ml-1">{s.role_label}</Badge>}</p>
                    <p className="truncate text-xs text-fg/50">{[s.location, s.booking_title].filter(Boolean).join(' · ')}</p>
                    {s.notes && <p className="truncate text-xs text-fg/40">{s.notes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="My assignments" pad={false}>
          {data.tasks.length === 0 ? <p className="p-5 text-sm text-fg/45">Nothing assigned right now.</p> : (
            <ul className="divide-y divide-line/70">
              {data.tasks.map((t) => (
                <li key={t.id} className={cls('flex items-center gap-3 px-4 py-3', t.status === 'done' && 'opacity-55')}>
                  <button onClick={() => toggleTask(t)}
                    className={cls('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                      t.status === 'done' ? 'border-sage bg-sage text-white' : 'border-fg/25 bg-card hover:border-copper')}>
                    {t.status === 'done' && <Icon name="check" size={12} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cls('truncate text-sm font-medium', t.status === 'done' && 'line-through')}>{t.title}</p>
                    <p className="truncate text-xs text-fg/50">{[t.due_date && fmtDate(t.due_date), t.booking_title, t.description].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Badge tone={{ low: 'gray', medium: 'amber', high: 'red' }[t.priority]}>{t.priority}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ----------------------------------- page ---------------------------------- */
export default function Team() {
  const { user } = useAuth()
  const [tab, setTab] = useState('rota')
  const [staff, setStaff] = useState([])
  const [shifts, setShifts] = useState(null)
  const [tasks, setTasks] = useState([])
  const [activity, setActivity] = useState([])
  const [actorFilter, setActorFilter] = useState('')
  const [staffModal, setStaffModal] = useState({ open: false, initial: null })
  const [shiftModal, setShiftModal] = useState({ open: false, initial: null })
  const [assign, setAssign] = useState({ staff_id: '', title: '', due_date: '' })

  const isStaff = user?.is_staff
  const load = () => {
    api.get('/team/staff').then(setStaff).catch(toastErr)
    api.get('/shifts').then(setShifts).catch(toastErr)
    api.get('/tasks').then(setTasks).catch(() => {})
    api.get(`/team/activity${actorFilter ? `?actor_id=${actorFilter}` : ''}`).then(setActivity).catch(() => {})
  }
  useEffect(() => { if (!isStaff) load() }, [actorFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isStaff) return <MyTeamView />
  if (!shifts) return <Spinner />

  const staffName = (id) => staff.find((s) => s.id === id)?.name || staff.find((s) => s.id === id)?.email || '—'
  const today = todayISO()
  const upcomingShifts = shifts.filter((s) => s.date >= today)
  const assignments = tasks.filter((t) => t.assignee_id)

  const createAssignment = (e) => {
    e.preventDefault()
    if (!assign.staff_id || !assign.title.trim()) return
    api.post('/team/assignments', { ...assign, staff_id: Number(assign.staff_id) })
      .then(() => { setAssign({ staff_id: assign.staff_id, title: '', due_date: '' }); toast('Assigned', 'sage'); load() }).catch(toastErr)
  }

  return (
    <div>
      <PageHeader title="Team" sub="Staff logins, the rota, assignments — and a full trail of every change they make." />
      <ExampleCard k="team" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'rota', label: 'Rota', count: upcomingShifts.length },
        { id: 'staff', label: 'Staff', count: staff.length },
        { id: 'assignments', label: 'Assignments', count: assignments.filter((t) => t.status !== 'done').length },
        { id: 'activity', label: 'Activity' },
      ]} />

      {tab === 'rota' && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button icon="plus" onClick={() => setShiftModal({ open: true, initial: null })} disabled={staff.length === 0}>Add shift</Button></div>
          {staff.length === 0 ? (
            <EmptyState icon="users" title="Add staff first" hint="Create staff logins on the Staff tab, then build the rota here." />
          ) : upcomingShifts.length === 0 ? (
            <EmptyState icon="calendar" title="No upcoming shifts" hint="Add shifts so everyone knows where to be and when." />
          ) : (
            Object.entries(upcomingShifts.reduce((acc, s) => { (acc[s.date] = acc[s.date] || []).push(s); return acc }, {})).map(([date, dayShifts]) => (
              <div key={date}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg/40">{fmtDate(date)}</p>
                <div className="space-y-1.5">
                  {dayShifts.map((s) => (
                    <button key={s.id} onClick={() => setShiftModal({ open: true, initial: s })}
                      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-left shadow-card hover:border-copper/40">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xs font-semibold text-cream">
                        {(staffName(s.staff_id) || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{staffName(s.staff_id)} <span className="text-fg/45">· {s.start_time}–{s.end_time}</span></p>
                        <p className="truncate text-xs text-fg/50">{[s.location, s.notes].filter(Boolean).join(' · ') || '—'}</p>
                      </div>
                      {s.role_label && <Badge tone="copper">{s.role_label}</Badge>}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button icon="plus" onClick={() => setStaffModal({ open: true, initial: null })}>Add staff member</Button></div>
          {staff.length === 0 ? (
            <EmptyState icon="users" title="No staff logins yet"
              hint="Give your team their own logins. They see the workspace, work their assignments — and every change they make is recorded for you." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {staff.map((s) => (
                <Card key={s.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-display font-semibold text-cream">
                        {(s.name || s.email).slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium">{s.name || '—'}</p>
                        <p className="text-xs text-fg/50">{s.job_title || 'Staff'} · {s.email}</p>
                      </div>
                    </div>
                    <IconButton icon="edit" label="Edit" onClick={() => setStaffModal({ open: true, initial: s })} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3">
                    <Toggle checked={s.subscription_status === 'active'} label={s.subscription_status === 'active' ? 'Active' : 'Deactivated'}
                      onChange={(on) => api.patch(`/team/staff/${s.id}`, { active: on }).then(load).catch(toastErr)} />
                    <Button size="sm" variant="danger" icon="trash"
                      onClick={() => { if (window.confirm(`Remove ${s.name || s.email}? Their login is deleted; the activity history stays.`)) api.del(`/team/staff/${s.id}`).then(load).catch(toastErr) }}>
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'assignments' && (
        <div className="space-y-3">
          <form onSubmit={createAssignment} className="flex flex-wrap gap-2 rounded-xl border border-line bg-card p-2.5 shadow-card">
            <Select className="w-44" value={assign.staff_id} onChange={(e) => setAssign({ ...assign, staff_id: e.target.value })} required>
              <option value="">Assign to…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
            </Select>
            <Input className="min-w-[180px] flex-1" placeholder="What needs doing? (e.g. Portion 12 cheesecakes)" value={assign.title} onChange={(e) => setAssign({ ...assign, title: e.target.value })} />
            <Input type="date" className="w-40" value={assign.due_date} onChange={(e) => setAssign({ ...assign, due_date: e.target.value })} />
            <Button icon="plus" disabled={staff.length === 0}>Assign</Button>
          </form>
          {assignments.length === 0 ? (
            <EmptyState icon="checks" title="No assignments yet" hint="Set tasks for specific staff — they tick them off, you see it in the activity trail." />
          ) : (
            staff.map((s) => {
              const mine = assignments.filter((t) => t.assignee_id === s.id)
              if (mine.length === 0) return null
              return (
                <Card key={s.id} title={`${s.name || s.email} · ${mine.filter((t) => t.status !== 'done').length} open`} pad={false}>
                  <ul className="divide-y divide-line/70">
                    {mine.map((t) => (
                      <li key={t.id} className={cls('flex items-center gap-3 px-4 py-2.5', t.status === 'done' && 'opacity-55')}>
                        <Icon name={t.status === 'done' ? 'check' : 'checks'} size={15} className={t.status === 'done' ? 'text-sage' : 'text-fg/35'} />
                        <span className={cls('min-w-0 flex-1 truncate text-sm', t.status === 'done' && 'line-through')}>{t.title}</span>
                        <span className="text-xs text-fg/45">{t.due_date ? fmtDate(t.due_date) : ''}</span>
                        <Badge tone={{ todo: 'gray', doing: 'copper', done: 'sage' }[t.status]}>{t.status}</Badge>
                        <IconButton icon="trash" label="Delete" onClick={() => api.del(`/tasks/${t.id}`).then(load).catch(toastErr)} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Select className="!w-56" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
              <option value="">All activity</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email} only</option>)}
            </Select>
          </div>
          {activity.length === 0 ? (
            <EmptyState icon="clock" title="No activity recorded yet" hint="Every create, edit, completion and deletion in this workspace lands here — with who did it and when." />
          ) : (
            <Card pad={false}>
              <ul className="divide-y divide-line/60">
                {activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 text-sm">
                    <Badge tone={a.actor_role === 'staff' ? 'copper' : a.actor_role === 'client' ? 'amber' : 'ink'}>{a.actor_role}</Badge>
                    <span className="font-medium">{a.actor_name}</span>
                    <Badge tone={ACTION_TONES[a.action] || 'gray'}>{label(a.action)}</Badge>
                    <span className="text-fg/55">{a.entity_type}</span>
                    <span className="min-w-0 flex-1 truncate text-fg/70">“{a.summary}”</span>
                    <span className="shrink-0 text-xs text-fg/40">{new Date(a.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <StaffModal open={staffModal.open} initial={staffModal.initial} onClose={() => setStaffModal({ open: false, initial: null })}
        onSaved={() => { setStaffModal({ open: false, initial: null }); load() }} />
      <ShiftModal open={shiftModal.open} initial={shiftModal.initial} staff={staff} onClose={() => setShiftModal({ open: false, initial: null })}
        onSaved={() => { setShiftModal({ open: false, initial: null }); load() }} />
    </div>
  )
}
