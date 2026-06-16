/* "Contact client" — one tap to message a client over WhatsApp or email, with the
   chef's saved template pre-filled and (optionally) a menu PDF link attached. The
   chef sets their preferred channel + template in Settings → Business. */
import { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { Button, Field, Modal, Select, Textarea } from './ui'

export const DEFAULT_CONTACT_TEMPLATE =
  "Hi {client}, it's {business}. Thank you for your enquiry — I'd love to help with your event. Could we find a good time to talk through the details?"

/* Replace {client} {business} {event} {date} placeholders; drop any that are empty. */
export function fillTemplate(tpl, vars) {
  return (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : '')).trim()
}

const waDigits = (phone) => (phone || '').replace(/\D/g, '')

export function ContactClient({ client, booking = null, size = 'sm', variant = 'secondary', className = '', label = 'Contact' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [menus, setMenus] = useState([])
  const [msg, setMsg] = useState('')
  const [menuId, setMenuId] = useState('')

  const channel = user?.contact_channel || 'both'
  const business = user?.business_name || user?.name || 'us'
  const origin = window.location.origin

  useEffect(() => {
    if (!open) return
    api.get('/menus').then((m) => setMenus((m || []).filter((x) => x.pdf_url))).catch(() => {})
    setMenuId('')
    setMsg(fillTemplate(user?.contact_template || DEFAULT_CONTACT_TEMPLATE, {
      client: client?.name?.split(' ')[0] || client?.name || 'there',
      business,
      event: booking?.title || '',
      date: booking?.date || '',
    }))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const attachMenu = (id) => {
    setMenuId(id)
    const m = menus.find((x) => String(x.id) === String(id))
    if (!m?.pdf_url) return
    const url = m.pdf_url.startsWith('http') ? m.pdf_url : `${origin}${m.pdf_url}`
    setMsg((cur) => (cur.includes(url) ? cur : `${cur}\n\nHere's our ${m.title}: ${url}`))
  }

  const phone = waDigits(client?.phone)
  const email = (client?.email || '').trim()
  const showWa = (channel === 'both' || channel === 'whatsapp') && phone
  const showEmail = (channel === 'both' || channel === 'email') && email

  const openWa = () => { window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener'); setOpen(false) }
  const openEmail = () => {
    const subject = booking?.title ? `${business} — ${booking.title}` : `A message from ${business}`
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`
    setOpen(false)
  }

  if (!client || (!client.phone && !client.email)) return null

  return (
    <>
      <Button size={size} variant={variant} icon="phone" className={className} onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Contact ${client?.name || 'client'}`}>
        <div className="space-y-4">
          <Field label="Message" hint="Edit before sending — nothing goes out until you tap a channel below.">
            <Textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </Field>
          {menus.length > 0 && (
            <Field label="Attach a menu PDF (optional)" hint="Adds a link to the menu's PDF — handy for clients who've enquired.">
              <Select value={menuId} onChange={(e) => attachMenu(e.target.value)}>
                <option value="">— No menu —</option>
                {menus.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </Select>
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            {showWa && <Button icon="phone" onClick={openWa} className="flex-1">Open in WhatsApp</Button>}
            {showEmail && <Button icon="mail" variant={showWa ? 'secondary' : 'primary'} onClick={openEmail} className="flex-1">Open in email</Button>}
            {!showWa && !showEmail && (
              <p className="text-sm text-fg/55">
                This client has no {channel === 'whatsapp' ? 'phone number' : channel === 'email' ? 'email' : 'phone or email'} saved
                {channel !== 'both' ? ' for your chosen channel' : ''}. Add one on their client record.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
