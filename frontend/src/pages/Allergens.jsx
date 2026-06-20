import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { cls } from '../format'
import { Button, Card, EmptyState, Field, PageHeader, Select, Spinner, toastErr } from '../ui'

/* UK FSA's 14 regulated allergens, with fuzzy matching against recipe tags */
const ALLERGENS = [
  ['Celery', ['celery']],
  ['Gluten', ['gluten', 'wheat', 'flour', 'cereal', 'barley', 'rye']],
  ['Crustaceans', ['crustacean', 'shellfish', 'prawn', 'shrimp', 'crab', 'lobster']],
  ['Eggs', ['egg']],
  ['Fish', ['fish', 'cod', 'bream', 'anchovy']],
  ['Lupin', ['lupin']],
  ['Milk', ['milk', 'dairy', 'cream', 'cheese', 'butter']],
  ['Molluscs', ['mollusc', 'mussel', 'oyster', 'squid']],
  ['Mustard', ['mustard']],
  ['Tree nuts', ['nut', 'almond', 'cashew', 'walnut', 'pistachio', 'hazelnut']],
  ['Peanuts', ['peanut', 'groundnut']],
  ['Sesame', ['sesame', 'tahini']],
  ['Soya', ['soy', 'soya', 'miso', 'tofu']],
  ['Sulphites', ['sulphite', 'sulfite', 'wine vinegar']],
]
// "Tree nuts" must not swallow "peanuts"
const matches = (recipeAllergens, terms, column) => {
  const joined = (recipeAllergens || []).join(' ').toLowerCase()
  if (column === 'Tree nuts' && /peanut/.test(joined) && !/(almond|cashew|walnut|pistachio|hazelnut|tree nut)/.test(joined)) return false
  return terms.some((t) => joined.includes(t))
}

export default function Allergens() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState(null)
  const [recipes, setRecipes] = useState([])
  const [bookingId, setBookingId] = useState('all')
  useEffect(() => {
    api.get('/bookings').then(setBookings).catch(toastErr)
    api.get('/recipes').then(setRecipes).catch(toastErr)
  }, [])
  if (!bookings) return <Spinner />

  const booking = bookings.find((b) => String(b.id) === bookingId)
  const rows = booking
    ? (booking.menu || []).map((m) => {
        const recipe = recipes.find((r) => r.id === m.recipe_id)
        return { name: `${m.course ? `${m.course} — ` : ''}${m.name}`, allergens: recipe?.allergens, known: !!recipe }
      })
    : recipes.map((r) => ({ name: r.title, allergens: r.allergens, known: true }))

  const activeColumns = ALLERGENS.filter(([col, terms]) => rows.some((row) => row.known && matches(row.allergens, terms, col)))

  const downloadCsv = () => {
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v))
    const header = ['Dish', ...ALLERGENS.map(([c]) => c)]
    const body = rows.map((row) => [
      row.name,
      ...ALLERGENS.map(([col, terms]) => (!row.known ? '?' : matches(row.allergens, terms, col) ? 'Yes' : '')),
    ])
    const csv = '﻿' + [header, ...body].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `allergen-matrix-${booking ? booking.title.replace(/\W+/g, '-').toLowerCase() : 'all-recipes'}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const sourceLabel = booking ? booking.title : 'All recipe sheets'
  const businessName = user?.business_name || user?.name || 'The Creatiste Command'
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <PageHeader title="Allergen matrix" sub="A dish-by-allergen table built from your recipe sheets — print it for the table or save it as a PDF."
        actions={
          <>
            {rows.length > 0 && <Button variant="secondary" icon="down" onClick={downloadCsv}>CSV</Button>}
            {rows.length > 0 && <Button variant="secondary" icon="doc" onClick={() => window.print()}>Print / PDF</Button>}
          </>
        } />
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <Field label="Menu source" className="max-w-sm flex-1">
          <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            <option value="all">All recipe sheets</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-fg/45 sm:max-w-xs">
          To save as a PDF, choose <span className="font-medium text-fg/60">Print</span> then “Save as PDF” as the destination.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="grid2" title="Nothing to map yet"
          hint={booking ? 'This booking has no menu yet — build it on the booking page first.' : 'Add recipes with allergen tags and the matrix builds itself.'} />
      ) : (
        <div className="print-doc space-y-4">
          {/* This page prints landscape (the 14-allergen table is wide). Rendered only while
              the allergen page is mounted, so it overrides the app's default portrait @page. */}
          <style>{'@media print{@page{size:A4 landscape;margin:12mm}}'}</style>
          {/* Print-only document header (the screen already has the page header above). */}
          <div className="hidden print:block">
            <h1 className="font-display text-2xl font-bold">{businessName}</h1>
            <p className="text-sm text-fg/70">Allergen information — {sourceLabel}</p>
            <p className="text-xs text-fg/50">Prepared {today}</p>
          </div>

          {/* UK FSA guidance template — the mandatory signposting statement. */}
          <div className="rounded-xl border border-copper/40 bg-copper/5 p-4 print:border-black/30 print:bg-transparent">
            <p className="font-display text-[15px] font-semibold text-copper-dark print:text-black">Allergies &amp; intolerances</p>
            <p className="mt-1 text-sm leading-relaxed text-fg/80 print:text-black">
              <span className="font-semibold">Before you order, please speak to a member of staff</span> if you
              have a food allergy or intolerance. The table below shows which of the 14 allergens regulated under
              UK law (Food Information Regulations 2014 / Natasha’s Law) are present in each dish, based on our recipes.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-fg/55 print:text-black/70">
              Our dishes are prepared in a kitchen that handles all 14 allergens, so we cannot guarantee any dish is
              completely free from traces. Full ingredient information is available on request.
            </p>
          </div>

          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-parchment/50 print:bg-transparent">
                    <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-fg/45 print:text-black">Dish</th>
                    {ALLERGENS.map(([col]) => (
                      <th key={col} className={cls('px-1 py-2.5 text-center text-[10px] uppercase tracking-wide print:text-black',
                        activeColumns.some(([c]) => c === col) ? 'text-copper' : 'text-fg/30')}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-medium print:text-black">
                        {row.name}
                        {!row.known && <span className="ml-1.5 text-[10px] font-normal text-amber-600">no recipe sheet — verify by hand</span>}
                      </td>
                      {ALLERGENS.map(([col, terms]) => (
                        <td key={col} className="px-1 py-2.5 text-center">
                          {!row.known ? <span className="text-fg/25 print:text-black">?</span>
                            : matches(row.allergens, terms, col)
                              ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-copper text-[11px] font-bold text-ink print:bg-black print:text-white">✓</span>
                              : <span className="text-fg/15 print:text-black/20">·</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-4 py-2.5 text-xs text-fg/45 print:text-black/70">
              <p><span className="font-semibold">Key:</span> ✓ contains this allergen · · not present · ? no recipe sheet on file (verify by hand).</p>
              <p className="mt-1">
                Built from allergen tags on recipe sheets. Always verify against the actual ingredients &amp; supplier
                labels before service — cross-contamination is not represented here.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
