import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import { cls } from './format'
import { Button, Icon, toast, toastErr } from './ui'

/* Mise, the assistant: one box. Type, or tap the microphone and speak, and it does the admin: to-dos, notes, invoices,
   payments, dates, shopping, blocked-out time, and answers about the week and the money. Everything it does comes back
   as a card with an Undo, and nothing it does ever reaches a client.

   <AssistantBox />      the box itself (inline on Today, and inside the launcher's panel)
   <AssistantLauncher /> the floating button on every other page
   The conversation is shared between the two and kept for this browser session only. */

const KEY = 'cc_mise_thread'
const listeners = new Set()
let thread = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch { return [] } })()
const setThread = (next) => {
  thread = next.slice(-30)
  try { sessionStorage.setItem(KEY, JSON.stringify(thread)) } catch { /* private window: the thread just isn't kept */ }
  listeners.forEach((fn) => fn(thread))
}
function useThread() {
  const [t, setT] = useState(thread)
  useEffect(() => { listeners.add(setT); return () => listeners.delete(setT) }, [])
  return t
}

let statusPromise = null
export function useAssistantStatus() {
  const [st, setSt] = useState(null)
  useEffect(() => {
    statusPromise = statusPromise || api.get('/assistant/status').catch(() => ({ enabled: false, voice: false, why: 'error' }))
    let live = true
    statusPromise.then((s) => live && setSt(s))
    return () => { live = false }
  }, [])
  return st
}

/* Anything the assistant changed: pages showing that data listen for this and reload. */
export const ASSISTANT_CHANGED = 'cc-assistant-changed'
const changed = () => window.dispatchEvent(new Event(ASSISTANT_CHANGED))
export function useAssistantChanged(fn) {
  useEffect(() => {
    window.addEventListener(ASSISTANT_CHANGED, fn)
    return () => window.removeEventListener(ASSISTANT_CHANGED, fn)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

const CARD_ICON = { todos: 'checks', done: 'check', note: 'bulb', client: 'users', invoice: 'doc', paid: 'coins', job: 'calendar', block: 'clock',
  step: 'cart', shopping: 'cart', message: 'mail' }

const QUICK = [
  { label: 'What needs sorting?', text: 'What needs sorting out? Who has paid, and who still needs a date?' },
  { label: 'What’s on this week?', text: 'What is on this week?' },
  { label: 'Who hasn’t paid?', text: 'Who has not paid yet?' },
]

function historyFor(turns) {
  return turns.slice(-10).map((t) => ({
    role: t.role,
    text: t.role === 'assistant' && t.cards?.length
      ? `${t.text}\n(Done in the app: ${t.cards.filter((c) => !c.undone).map((c) => [c.title, c.lines?.[0]].filter(Boolean).join(': ')).join('; ') || 'nothing kept'})`
      : t.text,
  }))
}

function MessageCard({ card }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(card.text); toast('Copied. Paste it wherever you like.', 'sage') } catch { toast('Press and hold the message to copy it') }
  }
  return (
    <div>
      <p className="whitespace-pre-line rounded-lg bg-parchment px-3 py-2.5 text-sm leading-relaxed" data-card-message>{card.text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon="copy" onClick={copy}>Copy</Button>
        {card.phone ? <Button size="sm" variant="secondary" icon="phone" onClick={() => window.open(`https://wa.me/${card.phone}?text=${encodeURIComponent(card.text)}`, '_blank', 'noopener')}>WhatsApp</Button> : null}
        {card.email ? <Button size="sm" variant="secondary" icon="mail" onClick={() => { window.location.href = `mailto:${card.email}?subject=${encodeURIComponent(card.subject || '')}&body=${encodeURIComponent(card.text)}` }}>Email</Button> : null}
      </div>
    </div>
  )
}

function CardView({ card, onUndo, go }) {
  const [busy, setBusy] = useState(false)
  const undo = async () => {
    setBusy(true)
    try { await api.post('/assistant/undo', { undo: card.undo }); onUndo(card.id); toast('Undone') } catch (e) { toastErr(e) } finally { setBusy(false) }
  }
  const act = () => {
    if (card.action?.type === 'open_invoice') go(`/app/finance?tab=invoices&invoice=${card.action.id}`)
    else if (card.action?.type === 'send_receipt') go(`/app/finance?tab=invoices&receipt=${card.action.id}`)
  }
  return (
    <div className={cls('rounded-xl border border-line bg-card px-3 py-2.5', card.undone && 'opacity-50')} data-mise-card={card.kind}>
      <p className={cls('flex items-center gap-2 text-sm font-semibold', card.undone && 'line-through')}>
        <Icon name={CARD_ICON[card.kind] || 'check'} size={15} className="shrink-0 text-copper" />{card.title}
      </p>
      {card.lines?.length ? (
        <ul className="mt-1 space-y-0.5 pl-[23px] text-[13px] leading-snug text-fg/70">
          {card.lines.map((l, i) => <li key={i} className={cls('break-words', card.undone && 'line-through')}>{l}</li>)}
        </ul>
      ) : null}
      {card.kind === 'message' && !card.undone ? <div className="mt-2"><MessageCard card={card} /></div> : null}
      {!card.undone && (card.link || card.action || card.undo) ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-[23px]">
          {card.action ? <Button size="sm" variant="secondary" onClick={act} data-card-action>{card.action.label}</Button> : null}
          {card.link ? <Button size="sm" variant="ghost" onClick={() => go(card.link.to)}>{card.link.label}</Button> : null}
          {card.undo ? <Button size="sm" variant="ghost" icon="replay" className="ml-auto" disabled={busy} onClick={undo} data-card-undo>Undo</Button> : null}
        </div>
      ) : null}
      {card.undone ? <p className="mt-1 pl-[23px] text-xs text-fg/50">Undone</p> : null}
    </div>
  )
}

const fmtSecs = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
const MAX_RECORD_SECONDS = 180

export function AssistantBox({ status, onNavigate, autoFocus = false, className = '' }) {
  const turns = useThread()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')            // '' | 'thinking' | 'hearing'
  const [recording, setRecording] = useState(false)
  const [secs, setSecs] = useState(0)
  const rec = useRef(null)
  const chunks = useRef([])
  const tick = useRef(null)
  const box = useRef(null)
  const scroller = useRef(null)
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [turns, busy])
  useEffect(() => () => { clearInterval(tick.current); try { rec.current?.stream?.getTracks().forEach((t) => t.stop()) } catch { /* already stopped */ } }, [])
  useEffect(() => {      // the box grows with what is typed, up to a point
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [text])

  const go = (to) => { navigate(to); onNavigate?.() }

  const send = async (override) => {
    const say = (override ?? text).trim()
    if (!say || busy) return
    const before = thread
    setThread([...before, { role: 'user', text: say }])
    if (override == null) setText('')
    setBusy('thinking')
    try {
      const r = await api.post('/assistant', { text: say, history: historyFor(before) })
      setThread([...thread, { role: 'assistant', text: r.reply, cards: r.cards || [] }])
      if (r.cards?.length) changed()
    } catch (e) {
      setThread(before)
      if (override == null) setText(say)       // nothing typed is lost
      toastErr(e)
    } finally { setBusy('') }
  }

  const markUndone = (id) => {
    setThread(thread.map((t) => (t.cards ? { ...t, cards: t.cards.map((c) => (c.id === id ? { ...c, undone: true } : c)) } : t)))
    changed()
  }

  const stop = () => {
    clearInterval(tick.current)
    setRecording(false)
    try { rec.current?.stop() } catch { /* never started */ }
  }
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return toast('This browser can’t record here. Tap the microphone on your keyboard to speak instead.')
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find((m) => window.MediaRecorder.isTypeSupported?.(m)) || ''
      const mr = new window.MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      mr.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = (mr.mimeType || mime || 'audio/mp4').split(';')[0]
        const ext = type.includes('webm') ? 'webm' : type.includes('ogg') ? 'ogg' : 'm4a'
        const blob = new Blob(chunks.current, { type })
        setBusy('hearing')
        try {
          const r = await api.postFile('/assistant/transcribe', new File([blob], `speech.${ext}`, { type }))
          setText((t) => (t.trim() ? `${t.trim()} ${r.text}` : r.text))
          box.current?.focus()
        } catch (e) { toastErr(e) } finally { setBusy('') }
      }
      mr.start()
      rec.current = mr
      setSecs(0)
      setRecording(true)
      tick.current = setInterval(() => setSecs((n) => { if (n + 1 >= MAX_RECORD_SECONDS) stop(); return n + 1 }), 1000)
    } catch {
      toast('Allow the microphone to speak to Mise, or type instead.', 'red')
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !coarse) { e.preventDefault(); send() }
  }

  if (!status?.enabled) return null
  return (
    <div className={cls('rounded-2xl border border-copper/40 bg-card', className)} data-mise>
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="flex items-center gap-2 font-display text-[15px] font-semibold"><Icon name="sparkle" size={16} className="text-copper" />Mise, your assistant</p>
        {turns.length ? <button type="button" className="text-xs text-fg/45 hover:text-fg" onClick={() => setThread([])} data-mise-clear>Clear</button> : null}
      </div>

      {turns.length || busy === 'thinking' ? (
        <div ref={scroller} className="scrollbar-thin mt-2 max-h-[46vh] space-y-3 overflow-y-auto px-4" data-mise-thread>
          {turns.map((t, i) => (t.role === 'user' ? (
            <p key={i} className="ml-auto w-fit max-w-[88%] whitespace-pre-line rounded-2xl rounded-br-md bg-copper/15 px-3 py-2 text-sm" data-mise-you>{t.text}</p>
          ) : (
            <div key={i} className="space-y-2" data-mise-reply>
              {t.text ? <p className="whitespace-pre-line text-sm leading-relaxed">{t.text}</p> : null}
              {(t.cards || []).map((c) => <CardView key={c.id} card={c} onUndo={markUndone} go={go} />)}
            </div>
          )))}
          {busy === 'thinking' ? <p className="flex items-center gap-2 text-sm text-fg/55" data-mise-thinking><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-copper" />On it…</p> : null}
        </div>
      ) : (
        <p className="px-4 pt-1 text-sm text-fg/60">Tell me what’s happened or what you need, the way you’d say it. “Rita paid, her dates are the 24th and 26th.” “Remind me to call the bank tomorrow.” “Draft Iva’s invoice, same as last time.”</p>
      )}

      <div className="p-3">
        <div className={cls('rounded-xl border bg-base px-3 py-2', recording ? 'border-red-400' : 'border-line focus-within:border-copper')}>
          {recording ? (
            <p className="flex items-center gap-2 py-1.5 text-sm" data-mise-recording><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Listening… {fmtSecs(secs)} <span className="text-fg/45">Tap stop when you’re done.</span></p>
          ) : (
            <textarea ref={box} rows={1} value={text} autoFocus={autoFocus} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
              placeholder={busy === 'hearing' ? 'Writing down what you said…' : 'Type here, or tap the microphone and speak'}
              disabled={busy === 'hearing'} data-mise-input
              className="block w-full resize-none bg-transparent text-[16px] leading-snug outline-none placeholder:text-fg/35" />
          )}
          <div className="mt-1.5 flex items-center gap-2">
            {status.voice ? (
              <button type="button" onClick={recording ? stop : start} disabled={!!busy} aria-label={recording ? 'Stop recording' : 'Speak'} data-mise-mic
                className={cls('inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50',
                  recording ? 'border-red-500 bg-red-500 text-white' : 'border-line text-fg/70 hover:border-copper hover:text-copper')}>
                <Icon name={recording ? 'stopSquare' : 'mic'} size={18} />
              </button>
            ) : null}
            {!turns.length && !text && !recording ? (
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto" data-mise-quick>
                {QUICK.map((q) => (
                  <button key={q.label} type="button" onClick={() => send(q.text)} disabled={!!busy}
                    className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-fg/65 hover:border-copper/60 hover:text-copper">{q.label}</button>
                ))}
              </div>
            ) : <span className="flex-1" />}
            <Button size="sm" icon="send" onClick={() => send()} disabled={!text.trim() || !!busy || recording} data-mise-send>Send</Button>
          </div>
        </div>
        {!status.voice ? <p className="mt-1.5 px-1 text-xs text-fg/45">To speak instead of typing, tap the microphone on your phone’s keyboard.</p> : null}
        <p className="mt-1 px-1 text-xs text-fg/40">Nothing Mise does is sent to a client. Everything can be undone.</p>
      </div>
    </div>
  )
}

/* The floating button on every page except Today (where the box is on the page itself). */
export function AssistantLauncher() {
  const status = useAssistantStatus()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  if (!status?.enabled || pathname === '/app' || pathname === '/app/') return null
  return (
    <>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="Ask Mise" data-mise-launcher
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-[45] inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full bg-copper text-sm font-semibold text-ink shadow-lg transition-transform hover:scale-105 sm:h-12 sm:w-auto sm:px-4 lg:bottom-6 lg:right-6 print:hidden">
          <Icon name="sparkle" size={18} /><span className="hidden sm:inline">Mise</span>
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-end bg-black/50 backdrop-blur-[1px] lg:items-end lg:bg-transparent lg:p-6 lg:backdrop-blur-0 print:hidden" onClick={() => setOpen(false)} data-mise-panel>
          <div className="w-full rounded-t-2xl bg-base pb-[env(safe-area-inset-bottom)] shadow-pop lg:w-[26rem] lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end px-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-fg/50 hover:bg-fg/5 hover:text-fg" data-mise-close><Icon name="x" size={18} /></button>
            </div>
            <AssistantBox status={status} onNavigate={() => setOpen(false)} autoFocus className="!border-0" />
          </div>
        </div>
      ) : null}
    </>
  )
}
