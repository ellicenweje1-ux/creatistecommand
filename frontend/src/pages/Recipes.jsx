import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls, fmtMoney, uid } from '../format'
import { Badge, Button, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, SearchInput, Select, Spinner, Textarea, toast, toastErr } from '../ui'

const CATEGORIES = ['Canapé', 'Starter', 'Main', 'Side', 'Dessert', 'Sauce', 'Bread', 'Drink', 'Other']

function RecipeEditor({ open, onClose, onSaved, initial = null }) {
  const blank = {
    title: '', category: '', cuisine: '', servings: 4, prep_minutes: 0, cook_minutes: 0,
    description: '', ingredients: [], steps: [], tags: [], allergens: [], image_url: '',
    cost_per_serving: 0, price_per_serving: 0, notes: '', is_favorite: false,
  }
  const [form, setForm] = useState(blank)
  const [tagText, setTagText] = useState('')
  const [allergenText, setAllergenText] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...blank, ...initial } : blank)
    setTagText(initial?.tags?.join(', ') || '')
    setAllergenText(initial?.allergens?.join(', ') || '')
    setAiPrompt('')
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, cast = (v) => v) => (e) => setForm({ ...form, [k]: cast(e.target.value) })
  const ingredients = form.ingredients || []
  const steps = form.steps || []

  const setIng = (i, key, value) => setForm({ ...form, ingredients: ingredients.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)) })
  const setStep = (i, value) => setForm({ ...form, steps: steps.map((s, idx) => (idx === i ? value : s)) })

  const generate = async () => {
    if (!aiPrompt.trim()) return
    setAiBusy(true)
    try {
      const r = await api.post('/ai/recipe', { prompt: aiPrompt, servings: form.servings || 4 })
      setForm({
        ...form, ...r,
        ingredients: (r.ingredients || []).map((i) => ({ id: uid(), ...i })),
        steps: r.steps || [], tags: r.tags || [], allergens: r.allergens || [],
      })
      setTagText((r.tags || []).join(', '))
      setAllergenText((r.allergens || []).join(', '))
      toast('Recipe drafted — review and save', 'sage')
    } catch (err) { toastErr(err) } finally { setAiBusy(false) }
  }

  const save = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      servings: Number(form.servings) || 1,
      prep_minutes: Number(form.prep_minutes) || 0,
      cook_minutes: Number(form.cook_minutes) || 0,
      cost_per_serving: Number(form.cost_per_serving) || 0,
      price_per_serving: Number(form.price_per_serving) || 0,
      tags: tagText.split(',').map((t) => t.trim()).filter(Boolean),
      allergens: allergenText.split(',').map((t) => t.trim()).filter(Boolean),
    }
    const req = initial?.id ? api.patch(`/recipes/${initial.id}`, payload) : api.post('/recipes', payload)
    req.then(onSaved).catch(toastErr)
  }

  const uploadImage = (e) => {
    const file = e.target.files?.[0]
    if (file) api.upload(file).then(({ url }) => setForm((f) => ({ ...f, image_url: url }))).catch(toastErr)
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit recipe sheet' : 'New recipe sheet'} wide>
      <form onSubmit={save} className="space-y-4">
        {!initial?.id && (
          <div className="rounded-xl border border-copper/30 bg-copper/5 p-3">
            <p className="mb-2 text-xs font-medium text-copper"><Icon name="sparkle" size={13} className="mr-1 inline" />Draft with the AI sous-chef</p>
            <div className="flex gap-2">
              <Input placeholder="e.g. 'smoked aubergine canapé, West African twist, 30 portions'" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
              <Button type="button" variant="dark" disabled={aiBusy} onClick={generate}>{aiBusy ? 'Drafting…' : 'Generate'}</Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" className="col-span-2 sm:col-span-1"><Input value={form.title} onChange={set('title')} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category} onChange={set('category')}>
                <option value="">—</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Cuisine"><Input value={form.cuisine} onChange={set('cuisine')} /></Field>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Servings"><Input type="number" min="1" value={form.servings} onChange={set('servings')} /></Field>
          <Field label="Prep (min)"><Input type="number" min="0" value={form.prep_minutes} onChange={set('prep_minutes')} /></Field>
          <Field label="Cook (min)"><Input type="number" min="0" value={form.cook_minutes} onChange={set('cook_minutes')} /></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={form.description} onChange={set('description')} /></Field>

        <div>
          <p className="label">Ingredients</p>
          <div className="space-y-1.5">
            {ingredients.map((ing, i) => (
              <div key={ing.id || i} className="grid grid-cols-12 gap-1.5">
                <Input className="col-span-5" placeholder="Ingredient" value={ing.name || ''} onChange={(e) => setIng(i, 'name', e.target.value)} />
                <Input className="col-span-2" placeholder="Qty" value={ing.qty ?? ''} onChange={(e) => setIng(i, 'qty', e.target.value)} />
                <Input className="col-span-2" placeholder="Unit" value={ing.unit || ''} onChange={(e) => setIng(i, 'unit', e.target.value)} />
                <Input className="col-span-2" placeholder="Note" value={ing.note || ''} onChange={(e) => setIng(i, 'note', e.target.value)} />
                <IconButton icon="trash" label="Remove" className="col-span-1 self-center justify-self-center"
                  onClick={() => setForm({ ...form, ingredients: ingredients.filter((_, idx) => idx !== i) })} />
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="secondary" icon="plus" className="mt-2"
            onClick={() => setForm({ ...form, ingredients: [...ingredients, { id: uid(), name: '', qty: '', unit: '', note: '' }] })}>
            Add ingredient
          </Button>
        </div>

        <div>
          <p className="label">Method</p>
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-2">
                <span className="mt-2 w-5 shrink-0 text-right font-display text-sm font-semibold text-copper">{i + 1}.</span>
                <Textarea rows={1} value={s} onChange={(e) => setStep(i, e.target.value)} />
                <IconButton icon="trash" label="Remove step" className="self-center" onClick={() => setForm({ ...form, steps: steps.filter((_, idx) => idx !== i) })} />
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="secondary" icon="plus" className="mt-2" onClick={() => setForm({ ...form, steps: [...steps, ''] })}>Add step</Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tags (comma-separated)"><Input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="party, signature" /></Field>
          <Field label="Allergens (comma-separated)"><Input value={allergenText} onChange={(e) => setAllergenText(e.target.value)} placeholder="dairy, nuts" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost / serving"><Input type="number" step="0.01" min="0" value={form.cost_per_serving} onChange={set('cost_per_serving')} /></Field>
          <Field label="Price / serving"><Input type="number" step="0.01" min="0" value={form.price_per_serving} onChange={set('price_per_serving')} /></Field>
        </div>
        <Field label="Photo" hint={form.image_url ? 'Image attached ✓' : undefined}>
          <input type="file" accept="image/*" onChange={uploadImage} className="block w-full text-sm text-fg/60 file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-xs file:font-medium file:text-cream" />
        </Field>
        <Field label="Chef's notes"><Textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>{initial?.id ? 'Save recipe' : 'Create recipe'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function RecipeView({ recipe, onClose, onEdit, currency }) {
  if (!recipe) return null
  return (
    <Modal open={!!recipe} onClose={onClose} title={recipe.title} wide
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" icon="edit" onClick={onEdit}>Edit</Button></div>}>
      {recipe.image_url && <img src={recipe.image_url} alt="" className="mb-4 max-h-60 w-full rounded-xl object-cover" />}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {recipe.category && <Badge tone="copper">{recipe.category}</Badge>}
        {recipe.cuisine && <Badge tone="ink">{recipe.cuisine}</Badge>}
        <Badge tone="gray">serves {recipe.servings}</Badge>
        <Badge tone="gray">{recipe.prep_minutes + recipe.cook_minutes} min total</Badge>
        {(recipe.allergens || []).map((a) => <Badge key={a} tone="red">{a}</Badge>)}
      </div>
      {recipe.description && <p className="mb-4 text-sm text-fg/65">{recipe.description}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="label">Ingredients</h4>
          <ul className="space-y-1 text-sm">
            {(recipe.ingredients || []).map((i, idx) => (
              <li key={idx} className="flex justify-between gap-2 border-b border-line/50 pb-1">
                <span>{i.name}{i.note ? <span className="text-fg/40"> · {i.note}</span> : null}</span>
                <span className="shrink-0 text-fg/55">{i.qty} {i.unit}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="label">Method</h4>
          <ol className="space-y-2 text-sm">
            {(recipe.steps || []).map((s, idx) => (
              <li key={idx} className="flex gap-2"><span className="font-display font-semibold text-copper">{idx + 1}.</span><span className="text-fg/75">{s}</span></li>
            ))}
          </ol>
        </div>
      </div>
      {(recipe.cost_per_serving > 0 || recipe.price_per_serving > 0) && (
        <p className="mt-4 rounded-lg bg-parchment/60 px-3 py-2 text-sm">
          Cost {fmtMoney(recipe.cost_per_serving, currency)}/serving · Price {fmtMoney(recipe.price_per_serving, currency)}/serving
          {recipe.cost_per_serving > 0 && recipe.price_per_serving > 0 &&
            <span className="ml-2 font-medium text-sage">({Math.round((1 - recipe.cost_per_serving / recipe.price_per_serving) * 100)}% margin)</span>}
        </p>
      )}
      {recipe.notes && <p className="mt-3 text-sm text-fg/55"><span className="font-medium">Notes:</span> {recipe.notes}</p>}
    </Modal>
  )
}

export default function Recipes() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [editor, setEditor] = useState({ open: false, initial: null })
  const [viewing, setViewing] = useState(null)

  const load = () => api.get('/recipes').then(setRecipes).catch(toastErr)
  useEffect(load, [])
  if (!recipes) return <Spinner />

  const toggleFav = (r, e) => {
    e.stopPropagation()
    api.patch(`/recipes/${r.id}`, { is_favorite: !r.is_favorite }).then(load).catch(toastErr)
  }
  const remove = (r, e) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${r.title}"?`)) api.del(`/recipes/${r.id}`).then(load).catch(toastErr)
  }

  let visible = recipes
  if (q) visible = visible.filter((r) => `${r.title} ${r.cuisine} ${r.tags?.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  if (cat !== 'all') visible = visible.filter((r) => r.category === cat)
  visible = [...visible].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))

  return (
    <div>
      <PageHeader title="Recipe master sheets" sub="Your repertoire — costed, tagged, allergen-flagged."
        actions={<Button icon="plus" onClick={() => setEditor({ open: true, initial: null })}>New recipe</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} className="w-full sm:w-64" />
        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto">
          {['all', ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cls('whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium', cat === c ? 'bg-ink text-cream' : 'border border-line bg-card text-fg/55')}>{c}</button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState icon="book" title="No recipes found" hint="Build your master sheets — or let the AI sous-chef draft one from a sentence."
          action={<Button icon="plus" onClick={() => setEditor({ open: true, initial: null })}>New recipe</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <button key={r.id} onClick={() => setViewing(r)}
              className="group overflow-hidden rounded-xl border border-line bg-card text-left shadow-card transition-all hover:border-copper/40">
              <div className="relative h-32 bg-gradient-to-br from-parchment to-copper/25">
                {r.image_url && <img src={r.image_url} alt="" className="h-full w-full object-cover" />}
                <button onClick={(e) => toggleFav(r, e)} className={cls('absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow', r.is_favorite ? 'text-copper' : 'text-fg/30')}>
                  <Icon name="star" size={15} />
                </button>
              </div>
              <div className="p-3.5">
                <p className="font-display font-semibold leading-tight">{r.title}</p>
                <p className="mt-0.5 text-xs text-fg/50">{[r.category, r.cuisine, `serves ${r.servings}`].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {(r.allergens || []).slice(0, 3).map((a) => <Badge key={a} tone="red">{a}</Badge>)}
                  {(r.tags || []).slice(0, 2).map((t) => <Badge key={t} tone="gray">{t}</Badge>)}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-fg/45">
                  <span>{r.prep_minutes + r.cook_minutes} min</span>
                  <span className="flex items-center gap-2">
                    {r.price_per_serving > 0 && <span className="font-medium text-fg/70">{fmtMoney(r.price_per_serving, user?.currency)}/pp</span>}
                    <IconButton icon="trash" label="Delete" className="opacity-0 group-hover:opacity-100" onClick={(e) => remove(r, e)} />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <RecipeEditor open={editor.open} initial={editor.initial} onClose={() => setEditor({ open: false, initial: null })}
        onSaved={() => { setEditor({ open: false, initial: null }); setViewing(null); load() }} />
      <RecipeView recipe={viewing} currency={user?.currency} onClose={() => setViewing(null)}
        onEdit={() => { setEditor({ open: true, initial: viewing }); setViewing(null) }} />
    </div>
  )
}
