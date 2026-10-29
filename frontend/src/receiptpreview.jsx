import { Button, Modal } from './ui'

/* A "this is what will be sent" modal: the exact email (to, subject, body) or message text, with one deliberate
   confirm. Used before an invoice receipt or a pre-order receipt goes to the client, and for the WhatsApp text. */
export function EmailPreview({ to, subject, body, note }) {
  return (
    <div className="space-y-3" data-email-preview>
      {note ? <p className="text-sm text-fg/70">{note}</p> : null}
      <div className="rounded-lg border border-line bg-parchment/60 p-4 text-sm">
        <p className="text-xs uppercase tracking-wider text-fg/50">To</p>
        <p className="font-medium" data-preview-to>{to || 'No email on file'}</p>
        <p className="mt-3 text-xs uppercase tracking-wider text-fg/50">Subject</p>
        <p className="font-medium" data-preview-subject>{subject}</p>
        <p className="mt-3 text-xs uppercase tracking-wider text-fg/50">Message</p>
        <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg/90" data-preview-body>{body}</pre>
      </div>
    </div>
  )
}

export function PreviewModal({ open, onClose, title, children, confirmLabel, onConfirm, busy = false, confirmDisabled = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Not yet</Button>{onConfirm ? <Button onClick={onConfirm} disabled={busy || confirmDisabled} data-preview-confirm>{busy ? 'Sending…' : confirmLabel}</Button> : null}</div>}>
      {children}
    </Modal>
  )
}
