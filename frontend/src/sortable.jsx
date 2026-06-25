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
