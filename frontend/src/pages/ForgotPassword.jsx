import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Brand, Button, Field, Input, toastErr } from '../ui'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null) // null | { email_enabled, support_email }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      setSent(await api.post('/auth/forgot-password', { email }))
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
        <div className="w-full max-w-md rounded-2xl border border-line bg-card p-7 shadow-card">
          {sent ? (
            <>
              <h1 className="font-display text-2xl font-semibold">
                {sent.email_enabled ? 'Check your inbox' : 'Let’s get you back in'}
              </h1>
              {sent.email_enabled ? (
                <p className="mt-2 text-sm leading-relaxed text-fg/60">
                  If an account exists for <span className="font-medium text-fg/80">{email}</span>, a password-reset
                  link is on its way. It lasts two hours — check your spam folder if it doesn’t arrive shortly.
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-fg/60">
                  Password resets by email aren’t switched on yet. Email{' '}
                  <a href={`mailto:${sent.support_email}?subject=Password%20reset`} className="font-medium text-copper">
                    {sent.support_email}
                  </a>{' '}
                  from the address on your account and we’ll reset it for you right away.
                </p>
              )}
              <Link to="/login" className="mt-6 inline-block text-sm font-medium text-copper">← Back to log in</Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
              <p className="mt-1 text-sm text-fg/55">
                Enter the email on your account and we’ll send a link to set a new password.
              </p>
              <div className="mt-6">
                <Field label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kitchen.com" required />
                </Field>
              </div>
              <Button className="mt-6 w-full" size="lg" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
              <p className="mt-4 text-center text-sm text-fg/55">
                Remembered it? <Link to="/login" className="font-medium text-copper">Log in</Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
