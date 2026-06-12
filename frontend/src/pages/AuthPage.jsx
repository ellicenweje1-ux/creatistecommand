import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { isActive, useAuth } from '../auth'
import { Brand, Button, Field, Icon, Input, toastErr } from '../ui'

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login'
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const foundersCode = !isLogin ? params.get('founders') || '' : ''
  const [form, setForm] = useState({ email: '', password: '', name: '', business_name: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const user = isLogin
        ? await login(form.email, form.password)
        : await register(foundersCode ? { ...form, founders_code: foundersCode } : form)
      if (!isActive(user)) navigate('/onboarding')
      else navigate(location.state?.from || '/app')
    } catch (err) {
      toastErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <header className="mx-auto w-full max-w-6xl px-5 py-5">
        <Link to="/"><Brand /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-card p-7 shadow-card">
          <h1 className="font-display text-2xl font-semibold">
            {isLogin ? 'Welcome back, chef.' : foundersCode ? 'Claim your founding seat.' : 'Set up your command centre.'}
          </h1>
          <p className="mt-1 text-sm text-fg/55">
            {isLogin
              ? 'Log in to your kitchen.'
              : 'Create your account, then book your personal onboarding call — your 5-day free trial starts the moment it’s done. No card needed for the trial.'}
          </p>
          {foundersCode && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-copper/40 bg-copper/10 px-3.5 py-3 text-sm">
              <Icon name="star" size={16} className="mt-0.5 shrink-0 text-copper" />
              <p className="leading-relaxed text-fg/75">
                <span className="font-semibold text-copper">Founders invitation</span> — this account claims one of
                the founding seats: lifetime rate, a direct line to the founder, and your number on the founding roster.
              </p>
            </div>
          )}
          <div className="mt-6 space-y-4">
            {!isLogin && (
              <>
                <Field label="Your name"><Input value={form.name} onChange={set('name')} placeholder="Chef Ellice" required /></Field>
                <Field label="Business name"><Input value={form.business_name} onChange={set('business_name')} placeholder="The Creatiste Kitchen" /></Field>
              </>
            )}
            <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} placeholder="you@kitchen.com" required /></Field>
            <Field label="Password" hint={isLogin ? undefined : 'At least 8 characters'}>
              <Input type="password" value={form.password} onChange={set('password')} required minLength={8} />
            </Field>
          </div>
          <Button className="mt-6 w-full" size="lg" disabled={busy}>
            {busy ? 'One moment…' : isLogin ? 'Log in' : foundersCode ? 'Claim my founding seat' : 'Start free trial'}
          </Button>
          <p className="mt-4 text-center text-sm text-fg/55">
            {isLogin ? (
              <>New here? <Link to="/register" className="font-medium text-copper">Create an account</Link></>
            ) : (
              <>Already a member? <Link to="/login" className="font-medium text-copper">Log in</Link></>
            )}
          </p>
        </form>
      </main>
    </div>
  )
}
