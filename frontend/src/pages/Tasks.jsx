import { useEffect, useState } from 'react'
import { api } from '../api'
import { cls, fmtDate, label, PRIORITY_TONES, todayISO } from '../format'
import { Badge, Button, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, Select, Spinner, Textarea, toastErr } from '../ui'

const CATEGORIES = ['prep', 'shopping', 'admin', 'service', 'logistics', 'other']

/* ------------------------------ quick composer ------------------------------ */
export function TaskComposer({ bookingId = null, onCreated }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [category, setCategory] = useState('prep')
  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    api.post('/tasks', { title: title.trim(), due_date: due, category, booking_id: bookingId, status: 'todo' })
      .then(() => { setTitle(''); setDue(''); onCreated() }).catch(toastErr)
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 rounded-xl border border-line bg-card p-2.5 shadow-card">
      <Input className="min-w-[180px] flex-1" placeholder="Add a task… (e.g. Cure the cod — 48h ahead)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input type="date" className="w-40" value={due} onChange={(e) => setDue(e.target.value)} />
      <Select className="w-32" value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Button icon="plus">Add</Button>
    </form>
  )
}

/* --------------------------------- task row --------------------------------- */
export function TaskItem({ task, onChanged, bookingLabel }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(task)
  useEffect(() => { setForm(task) }, [task])

  const toggle = () => api.patch(`/tasks/${task.id}`, { status: task.status === 'done' ? 'todo' : 'done' }).then(onChanged).catch(toastErr)
  const cycle = () => api.patch(`/tasks/${task.id}`, { status: task.status === 'todo' ? 'doing' : 'todo' }).then(onChanged).catch(toastErr)
  const remove = () => { if (window.confirm('Delete this task?')) api.del(`/tasks/${task.id}`).then(onChanged).catch(toastErr) }
  const save = (e) => {
    e.preventDefault()
    api.patch(`/tasks/${task.id}`, {
      title: form.title, description: form.description, category: form.category,
      priority: form.priority, due_date: form.due_date, due_time: form.due_time,
    }).then(() => { setEditing(false); onChanged() }).catch(toastErr)
  }

  const overdue = task.status !== 'done' && task.due_date && task.due_date < todayISO()
  return (
    <div className={cls('group flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-card', task.status === 'done' && 'opacity-60')}>
      <button onClick={toggle}
        className={cls('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          task.status === 'done' ? 'border-sage bg-sage text-white' : 'border-fg/25 bg-card hover:border-copper')}>
        {task.status === 'done' && <Icon name="check" size={12} />}
      </button>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(true)}>
        <p className={cls('truncate text-sm font-medium', task.status === 'done' && 'line-through')}>{task.title}</p>
        <p className="truncate text-xs text-fg/45">
          {task.due_date ? `${fmtDate(task.due_date)}${task.due_time ? ` ${task.due_time}` : ''}` : 'No due date'}
          {bookingLabel ? ` · ${bookingLabel}` : ''}{task.description ? ` · ${task.description}` : ''}
        </p>
      </div>
      {overdue && <Badge tone="red">overdue</Badge>}
      {task.status === 'doing' && <Badge tone="copper">doing</Badge>}
      <Badge tone={PRIORITY_TONES[task.priority]}>{task.priority}</Badge>
      <Badge tone="ink" className="hidden sm:inline-flex">{task.category}</Badge>
      <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
        {task.status !== 'done' && <IconButton icon="clock" label={task.status === 'doing' ? 'Back to todo' : 'Mark in progress'} onClick={cycle} />}
        <IconButton icon="trash" label="Delete" onClick={remove} />
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit task">
        <form onSubmit={save} className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="Details"><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date"><Input type="date" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="Due time"><Input type="time" value={form.due_time || ''} onChange={(e) => setForm({ ...form, due_time: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['low', 'medium', 'high'].map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button>Save</Button></div>
        </form>
      </Modal>
    </div>
  )
}

/* ----------------------------------- page ----------------------------------- */
export default function Tasks() {
  const [tasks, setTasks] = useState(null)
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('open')
  const [catFilter, setCatFilter] = useState('all')
  const load = () => api.get('/tasks').then(setTasks).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!tasks) return <Spinner />

  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title
  const today = todayISO()
  let visible = tasks.filter((t) => (filter === 'open' ? t.status !== 'done' : filter === 'done' ? t.status === 'done' : true))
  if (catFilter !== 'all') visible = visible.filter((t) => t.category === catFilter)

  const groups = [
    ['Overdue', visible.filter((t) => t.due_date && t.due_date < today && t.status !== 'done')],
    ['Today', visible.filter((t) => t.due_date === today)],
    ['Upcoming', visible.filter((t) => (!t.due_date || t.due_date > today) && t.status !== 'done')],
    ...(filter !== 'open' ? [['Done', visible.filter((t) => t.status === 'done' && (!t.due_date || t.due_date >= today || true))]] : []),
  ]

  return (
    <div>
      <PageHeader title="Tasks" sub="Prep, shopping, admin, logistics — everything with a deadline." />
      <TaskComposer onCreated={load} />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {['open', 'done', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cls('rounded-full px-3.5 py-1.5 text-xs font-medium capitalize', filter === f ? 'bg-ink text-cream' : 'border border-line bg-card text-fg/55')}>{f}</button>
        ))}
        <span className="mx-1 self-center text-fg/20">|</span>
        {['all', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={cls('rounded-full px-3 py-1.5 text-xs font-medium capitalize', catFilter === c ? 'bg-copper text-ink' : 'border border-line bg-card text-fg/55')}>{c}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="mt-4"><EmptyState icon="checks" title="Nothing here" hint="Add a task above, or generate a prep plan from a booking." /></div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map(([name, list]) => list.length > 0 && (
            <div key={name}>
              <p className={cls('mb-2 text-[11px] font-semibold uppercase tracking-wider', name === 'Overdue' ? 'text-red-600' : 'text-fg/40')}>{name} · {list.length}</p>
              <div className="space-y-1.5">
                {list.map((t) => <TaskItem key={t.id} task={t} onChanged={load} bookingLabel={bookingTitle(t.booking_id)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
