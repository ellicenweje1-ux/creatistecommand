import { useEffect, useState } from 'react'
import { api } from '../api'
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

  return (
    <div>
      <PageHeader title="Allergen matrix" sub="Dish-by-allergen grid built from your recipe sheets — print it for the buffet table."
        actions={<Button variant="secondary" icon="doc" onClick={() => window.print()}>Print</Button>} />
      <div className="mb-4 max-w-sm print:hidden">
        <Field label="Menu source">
          <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            <option value="all">All recipe sheets</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </Select>
        </Field>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="grid2" title="Nothing to map yet"
          hint={booking ? 'This booking has no menu yet — build it on the booking page first.' : 'Add recipes with allergen tags and the matrix builds itself.'} />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-line bg-parchment/50">
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-fg/45">Dish</th>
                  {ALLERGENS.map(([col]) => (
                    <th key={col} className={cls('px-1 py-2.5 text-center text-[10px] uppercase tracking-wide',
                      activeColumns.some(([c]) => c === col) ? 'text-copper' : 'text-fg/30')}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-medium">
                      {row.name}
                      {!row.known && <span className="ml-1.5 text-[10px] font-normal text-amber-600">no recipe sheet — verify by hand</span>}
                    </td>
                    {ALLERGENS.map(([col, terms]) => (
                      <td key={col} className="px-1 py-2.5 text-center">
                        {!row.known ? <span className="text-fg/25">?</span>
                          : matches(row.allergens, terms, col)
                            ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-copper text-[11px] font-bold text-ink">✓</span>
                            : <span className="text-fg/15">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-fg/45">
            Built from allergen tags on recipe sheets. Always verify against actual ingredients & labels — cross-contamination is not represented.
          </p>
        </Card>
      )}
    </div>
  )
}
