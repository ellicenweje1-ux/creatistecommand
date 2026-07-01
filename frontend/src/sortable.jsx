import { useEffect, useRef, useState } from 'react'
import { cls } from './format'
import { Icon } from './ui'

/* Touch-friendly drag-to-reorder for the checklist-style lists (shopping items, packing
   items). Uses Pointer Events so the same code works with a mouse on desktop and a finger
   on a phone — the chef's main use is on the move. Drag by the grip handle.

   Usage:
     <DragList items={items} onReorder={(next) => save(next)}>
       {(item, handle, dragging) => (
         <li {...handle.row}>
           <button {...handle.grip} className="cc-grip"><Icon name="grip" /></button>
           …row content…
         </li>
       )}
     </DragList>

   `handle.row` props go on the row element (needs data-drag-row for hit-testing); `handle.grip`
   props go on the drag handle. `dragging` is true on the row currently being moved. */
export function DragList({ items, onReorder, keyOf = (i) => i.id, className = '', children }) {
  const [working, setWorking] = useState(null) // live order while dragging, else null
  const [activeKey, setActiveKey] = useState(null)
  const fromRef = useRef(-1)
  const containerRef = useRef(null)
  const list = working || items
  // Clear the dragging override only once the parent re-renders with a genuinely different
  // order (the save round-tripped), so the final position holds smoothly. Comparing the
  // id-signature — not the array identity — keeps this correct even when the parent rebuilds
  // the items array on every render (e.g. Packing groups aren't memoised).
  const sig = items.map(keyOf).join('|')
  const lastSig = useRef(sig)
  useEffect(() => {
    if (sig !== lastSig.current) { lastSig.current = sig; setWorking(null) }
  }, [sig])

  const start = (index) => (e) => {
    if (items.length < 2) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    fromRef.current = index
    setActiveKey(keyOf(list[index]))
    setWorking(items.slice())
  }

  const move = (e) => {
    if (fromRef.current < 0) return
    const rows = Array.from(containerRef.current?.querySelectorAll('[data-drag-row]') || [])
    const y = e.clientY
    let to = rows.findIndex((r) => {
      const b = r.getBoundingClientRect()
      return y < b.top + b.height / 2
    })
    if (to === -1) to = rows.length - 1
    if (to === fromRef.current || to < 0) return
    setWorking((cur) => {
      const next = (cur || items).slice()
      const [moved] = next.splice(fromRef.current, 1)
      next.splice(to, 0, moved)
      fromRef.current = to
      return next
    })
  }

  const end = () => {
    const finished = working
    const moved = fromRef.current >= 0
    fromRef.current = -1
    setActiveKey(null)
    // Only persist if the order actually changed. Keep `working` shown until the parent
    // re-renders with the saved order (cleared by the effect above); otherwise clear now.
    if (moved && finished && finished.some((it, i) => keyOf(it) !== keyOf(items[i]))) onReorder(finished)
    else setWorking(null)
  }

  return (
    <ul ref={containerRef} className={className}>
      {list.map((item) => {
        const dragging = activeKey != null && keyOf(item) === activeKey
        const handle = {
          row: { 'data-drag-row': true },
          grip: {
            onPointerDown: start(list.indexOf(item)),
            onPointerMove: move,
            onPointerUp: end,
            onPointerCancel: end,
            style: { touchAction: 'none' },
            'aria-label': 'Drag to reorder',
            title: 'Drag to reorder',
          },
        }
        return children(item, handle, dragging)
      })}
    </ul>
  )
}

// Standard grip handle button (the ⠿ dots) used to start a drag.
export function GripHandle({ handle, className = '' }) {
  return (
    <button type="button" {...handle}
      className={cls('shrink-0 cursor-grab touch-none rounded-md p-1 text-fg/30 hover:text-fg/60 active:cursor-grabbing', className)}>
      <Icon name="grip" size={16} />
    </button>
  )
}

/* A smoother reorder for tall rows inside a scrollable container (e.g. invoice line items in
   a modal). Unlike DragList (which reflows the whole list as you cross midpoints), the grabbed
   row visually LIFTS and follows the pointer, the other rows stay put, and the list commits a
   single reorder on drop — so it feels smooth and always stays where you let go. Edge
   auto-scroll keeps long lists reachable. Pointer Events → works with finger or mouse.

   Usage:
     <SortableList items={items} onReorder={(next) => save(next)} className="space-y-1.5">
       {(item, sort) => (
         <li key={item.id} {...sort.row} className={sort.active ? 'cursor-grabbing' : ''}>
           <GripHandle handle={sort.grip} /> …row content…
         </li>
       )}
     </SortableList>
   `sort.grip` → the drag handle; `sort.row` → the row element (adds data-sort-row + the lift
   transform while active); `sort.active` → true for the row being dragged. */
export function SortableList({ items, keyOf = (i) => i.id, onReorder, className = '', children }) {
  const [drag, setDrag] = useState(null) // { key, dy } — for the visual lift only
  const wrapRef = useRef(null)
  const scrollerRef = useRef(null)
  const fromRef = useRef(-1)
  const grabYRef = useRef(0)
  const pyRef = useRef(0)
  const rafRef = useRef(0)

  const findScroller = (el) => {
    let n = el?.parentElement
    while (n) {
      const oy = getComputedStyle(n).overflowY
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n
      n = n.parentElement
    }
    return null
  }
  const loop = () => {
    if (fromRef.current < 0) return
    const sc = scrollerRef.current
    if (sc) {
      const b = sc.getBoundingClientRect()
      const M = 44
      if (pyRef.current < b.top + M) sc.scrollTop -= 10
      else if (pyRef.current > b.bottom - M) sc.scrollTop += 10
    }
    rafRef.current = requestAnimationFrame(loop)
  }
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const start = (index, key) => (e) => {
    if ((items?.length || 0) < 2) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    scrollerRef.current = findScroller(wrapRef.current)
    fromRef.current = index
    grabYRef.current = e.clientY
    pyRef.current = e.clientY
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
    setDrag({ key, dy: 0 })
  }
  const move = (e) => {
    if (fromRef.current < 0) return
    pyRef.current = e.clientY
    setDrag((d) => (d ? { ...d, dy: e.clientY - grabYRef.current } : d))
  }
  const finish = (e) => {
    if (fromRef.current < 0) return
    cancelAnimationFrame(rafRef.current)
    const clientY = (e && typeof e.clientY === 'number') ? e.clientY : pyRef.current
    const from = fromRef.current
    fromRef.current = -1
    setDrag(null)
    // Drop target = how many OTHER rows have their midpoint above the cursor (= insertion index).
    const rows = Array.from(wrapRef.current?.querySelectorAll('[data-sort-row]') || [])
    let to = 0
    rows.forEach((r, idx) => {
      if (idx === from) return
      const b = r.getBoundingClientRect()
      if (clientY > b.top + b.height / 2) to += 1
    })
    if (to !== from) {
      const next = items.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      onReorder(next)
    }
  }

  return (
    <ul ref={wrapRef} className={className}>
      {items.map((item, index) => {
        const key = keyOf(item)
        const active = drag?.key === key
        const grip = {
          onPointerDown: start(index, key),
          onPointerMove: move,
          onPointerUp: finish,
          onPointerCancel: finish,
          style: { touchAction: 'none' },
          'aria-label': 'Drag to reorder',
          title: 'Drag to reorder',
        }
        const row = {
          'data-sort-row': true,
          style: active
            ? { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 30, opacity: 0.97, boxShadow: '0 10px 26px rgba(0,0,0,.28)', borderRadius: 8 }
            : undefined,
        }
        return children(item, { grip, row, active }, index)
      })}
    </ul>
  )
}
