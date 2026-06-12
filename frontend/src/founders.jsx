import { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { cls } from './format'
import { Button, Field, Icon, Modal, Textarea, toast, toastErr } from './ui'

/* Everything founders-specific that lives inside the app shell: the numbered badge,
   the first-login walkthrough, and the day-5 check-in. The public invite page is
   pages/Founders.jsx. */

export function FounderBadge({ number, className = '' }) {
  return (
    <span className={cls('inline-flex items-center gap-1.5 rounded-full border border-copper/40 bg-copper/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-copper', className)}>
      <Icon name="star" size={12} /> Founding member{number ? ` #${number}` : ''}
    </span>
  )
}

const tourSteps = (n) => [
  {
    icon: 'star',
    title: `Welcome, Founding member${n ? ` #${n}` : ''}`,
    text: 'You’re one of the first chefs on The Creatiste Command — which means the platform grows around you. Your membership carries a lifetime founders rate, a direct line to the founder, and a real say in what gets built next.',
  },
  {
    icon: 'calendar',
    title: 'Bookings are the spine',
    text: 'Everything hangs off a booking: the menu, shopping lists, packing, prep tasks and routes. Start by adding your next event under Operations → Bookings and watch the rest line up around it.',
  },
  {
    icon: 'book',
    title: 'Load your kitchen',
    text: 'Add recipe sheets, stock and suppliers under Kitchen. Shopping lists build from a menu minus what you already have, and the allergen matrix generates itself from your recipes.',
  },
  {
    icon: 'sparkle',
    title: 'Everything is unlocked',
    text: 'Founders hold the full Elite toolkit: clients & tastings, the design studio, finance & quotes, staff logins with rotas and oversight, and Mise — your AI sous-chef.',
  },
  {
    icon: 'flame',
    title: 'Your direct line — and a catch-up on day 5',
    text: 'Anything you need goes straight to the founder via Help & FAQs. After your first 5 days we’ll check in right here for your thoughts, what’s helped, and what you’d change — founders steer the roadmap.',
  },
]

function FounderWelcome({ status, onDone }) {
  const [step, setStep] = useState(0)
  const steps = tourSteps(status.founder_number)
  const s = steps[step]
  const last = step === steps.length - 1
  const finish = () => api.post('/founders/tour-done').then(onDone).catch(toastErr)
  return (
    <Modal open onClose={finish} title="Founders walkthrough">
      <div className="pb-2 text-center">
        <div className="mx-auto mb-4 inline-flex rounded-full bg-copper/10 p-4 text-copper"><Icon name={s.icon} size={28} /></div>
        <h3 className="font-display text-xl font-semibold">{s.title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg/65">{s.text}</p>
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} aria-label={`Step ${i + 1}`}
              className={cls('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-copper' : 'w-1.5 bg-fg/20')} />
          ))}
        </div>
        <div className="mt-5 flex justify-center gap-2">
          {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
          {last
            ? <Button icon="flame" onClick={finish}>Into the kitchen</Button>
            : <Button icon="arrowRight" onClick={() => setStep(step + 1)}>Next</Button>}
        </div>
        {!last && <button onClick={finish} className="mt-3 text-xs text-fg/40 hover:text-fg/70">Skip the walkthrough</button>}
      </div>
    </Modal>
  )
}

function FounderCheckIn({ status, onDone, onSnooze }) {
  const [form, setForm] = useState({ thoughts: '', benefits: '', changes: '' })
  const [busy, setBusy] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    setBusy(true)
    api.post('/founders/feedback', form)
      .then(() => { toast('Thank you — your feedback went straight to the founder', 'sage'); onDone() })
      .catch(toastErr)
      .finally(() => setBusy(false))
  }
  return (
    <Modal open onClose={onSnooze} title={`Founders check-in — day ${status.days_in}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed text-fg/65">
          You've had {status.days_in} days in the kitchen with the platform. Three quick questions —
          your answers go straight to the founder and shape what gets built next.
        </p>
        <Field label="Your thoughts on the programme so far">
          <Textarea rows={3} value={form.thoughts} onChange={(e) => setForm({ ...form, thoughts: e.target.value })} placeholder="Honest is best…" />
        </Field>
        <Field label="How has it benefited you?">
          <Textarea rows={3} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="Where has it saved you time, stress or money?" />
        </Field>
        <Field label="What would you change — or like to see?">
          <Textarea rows={3} value={form.changes} onChange={(e) => setForm({ ...form, changes: e.target.value })} placeholder="Missing features, rough edges, wild ideas…" />
        </Field>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onSnooze} className="text-sm text-fg/45 hover:text-fg/70">Remind me later</button>
          <Button disabled={busy}>{busy ? 'Sending…' : 'Send to the founder'}</Button>
        </div>
      </form>
    </Modal>
  )
}

const SNOOZE_KEY = 'cc_founder_checkin_snooze'

export default function FounderExperience() {
  const { user } = useAuth()
  const [status, setStatus] = useState(null)
  const [show, setShow] = useState('') // '' | 'tour' | 'checkin'

  useEffect(() => {
    if (!user?.is_founder || user?.is_staff) { setStatus(null); setShow(''); return }
    api.get('/founders/status').then((s) => {
      setStatus(s)
      if (!s.tour_done) setShow('tour')
      else if (s.check_in_due && !sessionStorage.getItem(SNOOZE_KEY)) setShow('checkin')
    }).catch(() => {})
  }, [user?.is_founder, user?.is_staff]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!status || !show) return null
  if (show === 'tour') {
    return <FounderWelcome status={status} onDone={() => setShow(status.check_in_due ? 'checkin' : '')} />
  }
  return (
    <FounderCheckIn
      status={status}
      onDone={() => setShow('')}
      onSnooze={() => { sessionStorage.setItem(SNOOZE_KEY, '1'); setShow('') }}
    />
  )
}
