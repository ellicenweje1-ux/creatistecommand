import { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { cls, fmtMoney } from './format'
import { Input } from './ui'

/* Shared "pull it in from your price book" search — one engine for shopping lists,
   expenses, online orders and inventory. Type → live results (cheapest first);
   Enter (or a click) hands the chosen row to onPick and clears the box. */

// A row's pack size as text: "2 l", "6 pk", "" when neither is set.
export const priceQtyUnit = (r) => [Number(r?.quantity) > 0 ? +Number(r.quantity) : '', r?.unit || ''].filter(Boolean).join(' ')

export function PriceBookSearch({ onPick, currency = 'GBP', placeholder = 'Search your price book (e.g. cream) then press Enter to add' }) {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  // The price book lives in Suppliers (Pro+): on Solo the search endpoint 403s, so
  // don't show a search box that can never return anything (Shopping/Inventory are all-plan).
  const gated = (user?.plan_level || 0) < 2
  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(() => api.get(`/suppliers/prices/search?q=${encodeURIComponent(q)}`).then((r) => setResults(r.slice(0, 6))).catch(() => {}), 200)
    return () => clearTimeout(t)
  }, [q])
  const pick = (p) => { onPick(p); setQ(''); setResults([]) }
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); if (results[0]) pick(results[0]) } }
  if (gated) return null
  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={placeholder} />
      {results.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-card shadow-pop">
          {results.map((r, idx) => (
            <button type="button" key={r.id} onClick={() => pick(r)}
              className={cls('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-parchment/50', idx === 0 && 'bg-parchment/30')}>
              <span>{r.item_name} <span className="text-fg/45">{priceQtyUnit(r)}</span> <span className="text-fg/35">· {r.supplier_name}</span></span>
              <span className="shrink-0 font-medium">{fmtMoney(r.price, currency)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
