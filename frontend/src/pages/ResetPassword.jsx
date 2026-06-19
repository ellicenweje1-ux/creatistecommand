import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Brand, Button, Field, PasswordInput, toast, toastErr } from '../ui'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast('Those passwords don’t match', 'red'); return }
    setBusy(true)
    try {
      await api.post('/auth/reset-password', { token, password: form.password })
      toast('Password updated — log in with your new password', 'sage')
      navigate('/login')
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
          {!token ? (
            <>
              <h1 className="font-display text-2xl font-semibold">Link incomplete</h1>
              <p className="mt-2 text-sm leading-relaxed text-fg/60">
                This reset link is missing its token. Open the most recent link from your email, or{' '}
                <Link to="/forgot-password" className="font-medium text-copper">request a new one</Link>.
              </p>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
              <p className="mt-1 text-sm text-fg/55">Choose a new password for your account.</p>
              <div className="mt-6 space-y-4">
                <Field label="New password" hint="At least 8 characters">
                  <PasswordInput minLength={8} required value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </Field>
                <Field label="Confirm new password">
                  <PasswordInput minLength={8} required value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
                </Field>
              </div>
              <Button className="mt-6 w-full" size="lg" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </Button>
              <p className="mt-4 text-center text-sm text-fg/55">
                <Link to="/login" className="font-medium text-copper">Back to log in</Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
