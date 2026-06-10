import { useEffect, useState } from 'react'
import { api } from '../api'
import { cls } from '../format'
import { Badge, Button, EmptyState, Icon, IconButton, Input, PageHeader, SearchInput, Spinner, Textarea, toast, toastErr } from '../ui'

function IdeaCard({ idea, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(idea)
  const [polishing, setPolishing] = useState(false)
  useEffect(() => { setForm(idea) }, [idea])

  const pin = () => api.patch(`/ideas/${idea.id}`, { pinned: !idea.pinned }).then(onChanged).catch(toastErr)
  const remove = () => { if (window.confirm('Delete this idea?')) api.del(`/ideas/${idea.id}`).then(onChanged).catch(toastErr) }
  const save = () =>
    api.patch(`/ideas/${idea.id}`, { title: form.title, content: form.content }).then(() => { setEditing(false); onChanged() }).catch(toastErr)

  const polish = async () => {
    setPolishing(true)
    try {
      const r = await api.post('/ai/idea-polish', { idea_id: idea.id })
      await api.patch(`/ideas/${idea.id}`, { title: r.title, content: r.content, tags: r.tags || [] })
      toast('Idea polished ✨', 'sage')
      onChanged()
    } catch (err) { toastErr(err) } finally { setPolishing(false) }
  }

  return (
    <div className={cls('flex flex-col rounded-xl border bg-white p-4 shadow-card', idea.pinned ? 'border-copper/50' : 'border-line')}>
      {editing ? (
        <div className="space-y-2">
          <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" />
          <Textarea rows={5} value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-semibold leading-snug">{idea.title || 'Untitled idea'}</h3>
            <button onClick={pin} className={idea.pinned ? 'text-copper' : 'text-ink/25 hover:text-ink/50'} title={idea.pinned ? 'Unpin' : 'Pin'}>
              <Icon name="star" size={16} />
            </button>
          </div>
          <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/70">{idea.content}</p>
          {(idea.tags || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">{idea.tags.map((t) => <Badge key={t} tone="gray">{t}</Badge>)}</div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
            <span className="text-[11px] text-ink/35">{new Date(idea.created_at).toLocaleDateString()}</span>
            <div className="flex gap-1">
              <IconButton icon="sparkle" label="Polish with AI" onClick={polish} className={polishing ? 'animate-pulse text-copper' : ''} />
              <IconButton icon="edit" label="Edit" onClick={() => setEditing(true)} />
              <IconButton icon="trash" label="Delete" onClick={remove} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Ideas() {
  const [ideas, setIdeas] = useState(null)
  const [q, setQ] = useState('')
  const [quick, setQuick] = useState('')

  const load = () => api.get('/ideas').then(setIdeas).catch(toastErr)
  useEffect(load, [])
  if (!ideas) return <Spinner />

  const capture = (e) => {
    e.preventDefault()
    if (!quick.trim()) return
    const [first, ...rest] = quick.trim().split('\n')
    api.post('/ideas', { title: first.slice(0, 120), content: rest.join('\n') || first, tags: [] })
      .then(() => { setQuick(''); load() }).catch(toastErr)
  }

  const visible = q ? ideas.filter((i) => `${i.title} ${i.content} ${i.tags?.join(' ')}`.toLowerCase().includes(q.toLowerCase())) : ideas

  return (
    <div>
      <PageHeader title="Ideas" sub="On-the-spot sparks, captured before service steals them." />
      <form onSubmit={capture} className="mb-4 rounded-xl border border-line bg-white p-3 shadow-card">
        <Textarea rows={2} placeholder="Quick capture… (first line becomes the title)" value={quick} onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) capture(e) }} />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-ink/40">⌘/Ctrl + Enter to save</p>
          <Button size="sm" icon="bulb">Capture</Button>
        </div>
      </form>
      <SearchInput value={q} onChange={setQ} className="mb-4 w-full sm:w-72" />
      {visible.length === 0 ? (
        <EmptyState icon="bulb" title="No ideas yet" hint="That plating idea from last night's service? Get it down before it evaporates." />
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {visible.map((i) => <IdeaCard key={i.id} idea={i} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}
