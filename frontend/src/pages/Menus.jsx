import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtMoney } from '../format'
import { DishRowsEditor } from '../dishrows'
import { Badge, Button, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, SearchInput, Select, Spinner, Textarea, toast, toastErr } from '../ui'

const MENU_TYPES = ['Tasting menu', 'Set menu', 'Canapé selection', 'Sharing feast', 'Buffet', 'Bowl food', 'BBQ', 'Brunch', 'Drinks & cocktails']

export function MenuForm({ initial = {}, currency = 'GBP', onSaved, onClose }) {
  const [form, setForm] = useState({ title: '', menu_type: '', description: '', price_per_head: 0, courses: [], pdf_url: '', pdf_name: '', active: true, notes: '', ...initial })
  const [recipes, setRecipes] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  useEffect(() => { api.get('/recipes').then(setRecipes).catch(() => {}) }, [])
  const set = (k, cast = (v) => v) => (e) => setForm({ ...form, [k]: cast(e.target.value) })

  const onPdf = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const r = await api.upload(file)
      setForm((f) => ({ ...f, pdf_url: r.url, pdf_name: r.filename || 'menu.pdf' }))
      toast('PDF attached', 'sage')
    } catch (err) { toastErr(err) } finally { setUploading(false) }
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...form, price_per_head: Number(form.price_per_head) || 0 }
      const saved = initial.id ? await api.patch(`/menus/${initial.id}`, payload) : await api.post('/menus', payload)
      onSaved(saved)
    } catch (err) { toastErr(err) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Menu title"><Input value={form.title} onChange={set('title')} placeholder="Summer Tasting Menu" required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Menu type">
          <Input list="cc-menu-types" value={form.menu_type} onChange={set('menu_type')} placeholder="Tasting menu" />
          <datalist id="cc-menu-types">{MENU_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Price per head"><Input type="number" min="0" step="0.01" value={form.price_per_head} onChange={set('price_per_head')} /></Field>
      </div>
      <Field label="Description"><Textarea rows={2} value={form.description} onChange={set('description')} placeholder="A short summary you can read to a client." /></Field>
      <Field label="Courses">
        <DishRowsEditor rows={form.courses} recipes={recipes} currency={currency} onChange={(courses) => setForm({ ...form, courses })} />
      </Field>
      <Field label="Menu PDF — the version you share with clients">
        {form.pdf_url ? (
          <div className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2 text-sm">
            <a href={form.pdf_url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-medium text-copper hover:underline">
              <Icon name="doc" size={15} className="shrink-0" /><span className="truncate">{form.pdf_name || 'View PDF'}</span>
            </a>
            <IconButton icon="trash" label="Remove PDF" onClick={() => setForm({ ...form, pdf_url: '', pdf_name: '' })} />
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line py-3 text-sm font-medium text-fg/55 hover:border-copper/50 hover:text-copper">
            <Icon name="plus" size={15} /> {uploading ? 'Uploading…' : 'Attach a PDF'}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPdf} />
          </label>
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm text-fg/70">
        <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-copper" />
        Keep this menu live (uncheck to archive)
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={busy}>{initial.id ? 'Save menu' : 'Create menu'}</Button>
      </div>
    </form>
  )
}

function MenuCard({ menu, currency, onEdit, onDeleted }) {
  const remove = () => { if (window.confirm(`Delete "${menu.title}"?`)) api.del(`/menus/${menu.id}`).then(onDeleted).catch(toastErr) }
  return (
    <div className={cls('flex flex-col rounded-xl border bg-card p-4 shadow-card', menu.active ? 'border-line' : 'border-line opacity-70')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display font-semibold leading-snug">{menu.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {menu.menu_type && <Badge tone="copper">{menu.menu_type}</Badge>}
            {!menu.active && <Badge tone="gray">archived</Badge>}
            {menu.price_per_head > 0 && <span className="text-xs text-fg/55">{fmtMoney(menu.price_per_head, currency)}/head</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton icon="edit" label="Edit menu" onClick={() => onEdit(menu)} />
          <IconButton icon="trash" label="Delete menu" onClick={remove} />
        </div>
      </div>
      {menu.description && <p className="mt-2 text-sm text-fg/65">{menu.description}</p>}
      {(menu.courses || []).length > 0 && (
        <ul className="mt-2 flex-1 space-y-0.5 text-sm text-fg/70">
          {menu.courses.slice(0, 6).map((c, i) => (
            <li key={c.id || i} className="truncate"><span className="text-fg/40">{c.course || '—'}:</span> {c.name}</li>
          ))}
          {menu.courses.length > 6 && <li className="text-xs text-fg/40">+{menu.courses.length - 6} more…</li>}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
        {menu.pdf_url ? (
          <a href={menu.pdf_url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-copper hover:underline">
            <Icon name="doc" size={13} className="shrink-0" /> <span className="truncate">{menu.pdf_name || 'View PDF'}</span>
          </a>
        ) : <span className="text-xs text-fg/35">No PDF attached</span>}
        <span className="shrink-0 text-[11px] text-fg/35">{(menu.courses || []).length} dishes</span>
      </div>
    </div>
  )
}

export default function Menus() {
  const { user } = useAuth()
  const [menus, setMenus] = useState(null)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState({ open: false, initial: null })

  const load = () => api.get('/menus').then(setMenus).catch(toastErr)
  useEffect(load, [])
  if (!menus) return <Spinner />

  const close = () => setModal({ open: false, initial: null })
  const visible = q ? menus.filter((m) => `${m.title} ${m.menu_type} ${m.description}`.toLowerCase().includes(q.toLowerCase())) : menus

  return (
    <div>
      <PageHeader title="Menus" sub="Your set menus, kept live — build them from your recipes and attach the PDF you share with clients."
        actions={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New menu</Button>} />
      {menus.length > 0 && <SearchInput value={q} onChange={setQ} className="mb-4 w-full sm:w-72" />}
      {visible.length === 0 ? (
        <EmptyState icon="doc" title="No menus yet"
          hint="Create your set menus once — tasting menus, canapé selections, sharing feasts. Build them from your recipes, attach the PDF you send to clients, and pick them on a booking."
          action={<Button icon="plus" onClick={() => setModal({ open: true, initial: null })}>New menu</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => <MenuCard key={m.id} menu={m} currency={user?.currency} onEdit={(menu) => setModal({ open: true, initial: menu })} onDeleted={load} />)}
        </div>
      )}
      <Modal open={modal.open} onClose={close} title={modal.initial ? 'Edit menu' : 'New menu'} wide>
        {modal.open && <MenuForm initial={modal.initial || {}} currency={user?.currency} onClose={close} onSaved={() => { close(); load() }} />}
      </Modal>
    </div>
  )
}
