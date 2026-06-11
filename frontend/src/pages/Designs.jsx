import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { cls, uid } from '../format'
import { Button, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, Spinner, toast, toastErr } from '../ui'

const ITEM_TYPES = {
  round_table: { label: 'Round table', w: 110, h: 110, color: '#5C6F5A' },
  rect_table: { label: 'Long table', w: 240, h: 70, color: '#9A7C4A' },
  chair: { label: 'Chair', w: 34, h: 34, color: '#8A6D3B' },
  buffet: { label: 'Buffet line', w: 300, h: 60, color: '#9A7C4A' },
  bar: { label: 'Bar', w: 200, h: 60, color: '#141210' },
  station: { label: 'Chef station', w: 140, h: 90, color: '#7A4E9E' },
  stage: { label: 'Stage / DJ', w: 220, h: 110, color: '#444444' },
  dance_floor: { label: 'Dance floor', w: 220, h: 220, color: '#C8B89A' },
  plant: { label: 'Plant', w: 44, h: 44, color: '#3E7C4F' },
  entrance: { label: 'Entrance', w: 100, h: 40, color: '#888888' },
  text: { label: 'Text label', w: 140, h: 30, color: '#B89B68' },
  rect_shape: { label: 'Rectangle', w: 140, h: 90, color: '#BFA987' },
  circle_shape: { label: 'Circle', w: 100, h: 100, color: '#BFA987' },
}

const isStroke = (item) => item.type === 'draw' || item.type === 'line'

function strokePath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
}

export function CanvasItem({ item, selected, onPointerDown, interactive = true }) {
  const handlers = interactive ? { onPointerDown, style: { cursor: 'move' } } : {}
  if (isStroke(item)) {
    return (
      <g {...handlers}>
        {interactive && (
          <path d={strokePath(item.points || [])} fill="none" stroke="transparent" strokeWidth={(item.width || 3) + 10} strokeLinecap="round" strokeLinejoin="round" />
        )}
        <path d={strokePath(item.points || [])} fill="none" stroke={item.color} strokeWidth={item.width || 3}
          strokeLinecap="round" strokeLinejoin="round" opacity={selected ? 1 : 0.92}
          strokeDasharray={selected ? '6 4' : undefined} />
      </g>
    )
  }
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  const stroke = selected ? 'rgb(var(--c-gold))' : 'rgba(135,122,96,0.5)'
  const common = { ...handlers, transform: `rotate(${item.rotation || 0} ${cx} ${cy})` }
  const labelEl = (fill = '#fff', dy = 4) => (
    item.label ? (
      <text x={cx} y={cy + dy} textAnchor="middle" fontSize="13" fontFamily="Outfit, sans-serif" fill={fill} pointerEvents="none">
        {item.label}
      </text>
    ) : null
  )
  if (item.type === 'round_table' || item.type === 'plant' || item.type === 'circle_shape') {
    return (
      <g {...common}>
        <circle cx={cx} cy={cy} r={item.w / 2} fill={item.color} opacity={item.type === 'circle_shape' ? 0.45 : 0.88}
          stroke={stroke} strokeWidth={selected ? 2.5 : 1} />
        {labelEl(item.type === 'circle_shape' ? 'rgb(var(--c-fg))' : '#fff')}
      </g>
    )
  }
  if (item.type === 'text') {
    return (
      <g {...common}>
        <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={selected ? 'rgba(184,155,104,0.12)' : 'transparent'} stroke={selected ? stroke : 'transparent'} strokeDasharray="4 3" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="600" fontFamily="'Playfair Display', serif" fill={item.color} pointerEvents="none">{item.label}</text>
      </g>
    )
  }
  return (
    <g {...common}>
      <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.type === 'dance_floor' ? 4 : 10}
        fill={item.color} opacity={item.type === 'dance_floor' || item.type === 'rect_shape' ? 0.45 : 0.88}
        stroke={stroke} strokeWidth={selected ? 2.5 : 1} />
      {labelEl(item.type === 'dance_floor' || item.type === 'rect_shape' ? 'rgb(var(--c-fg))' : '#fff')}
    </g>
  )
}

const TOOLS = [
  ['select', 'dots', 'Select & move'],
  ['pen', 'pen', 'Pen — freehand'],
  ['line', 'lineTool', 'Straight line'],
]

export function DesignEditorModal({ open, design, onClose, onSaved }) {
  const svgRef = useRef(null)
  const [canvas, setCanvas] = useState({ width: 1000, height: 700, items: [] })
  const [title, setTitle] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [tool, setTool] = useState('select')
  const [strokeColor, setStrokeColor] = useState('#BFA987')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [temp, setTemp] = useState(null) // in-progress pen stroke / line
  const dragRef = useRef(null)

  useEffect(() => {
    if (open && design) {
      setCanvas(design.canvas?.items ? design.canvas : { width: 1000, height: 700, items: [] })
      setTitle(design.title || 'Untitled design')
      setSelectedId(null)
      setTool('select')
      setTemp(null)
    }
  }, [open, design])

  // Delete key removes the selected element
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && document.activeElement?.tagName !== 'INPUT') {
        setCanvas((c) => ({ ...c, items: c.items.filter((i) => i.id !== selectedId) }))
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selectedId])

  if (!open || !design) return null
  const items = canvas.items || []
  const selected = items.find((i) => i.id === selectedId)

  const toSvgPoint = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return [
      Math.round(((e.clientX - rect.left) / rect.width) * canvas.width),
      Math.round(((e.clientY - rect.top) / rect.height) * canvas.height),
    ]
  }

  const addItem = (type) => {
    const spec = ITEM_TYPES[type]
    const item = {
      id: uid(), type, x: canvas.width / 2 - spec.w / 2, y: canvas.height / 2 - spec.h / 2,
      w: spec.w, h: spec.h, rotation: 0,
      label: ['rect_shape', 'circle_shape'].includes(type) ? '' : spec.label,
      color: spec.color,
    }
    setCanvas({ ...canvas, items: [...items, item] })
    setSelectedId(item.id)
    setTool('select')
  }

  const updateSelected = (patch) =>
    setCanvas({ ...canvas, items: items.map((i) => (i.id === selectedId ? { ...i, ...patch } : i)) })

  /* ── pointer logic: select-drag / pen / line ─────────────────────────── */
  const startDragItem = (item) => (e) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelectedId(item.id)
    const p = toSvgPoint(e)
    dragRef.current = isStroke(item)
      ? { id: item.id, start: p, origPoints: item.points }
      : { id: item.id, dx: p[0] - item.x, dy: p[1] - item.y }
    svgRef.current.setPointerCapture?.(e.pointerId)
  }

  const onCanvasDown = (e) => {
    const p = toSvgPoint(e)
    svgRef.current.setPointerCapture?.(e.pointerId)
    if (tool === 'pen') setTemp({ type: 'draw', points: [p], color: strokeColor, width: strokeWidth })
    else if (tool === 'line') setTemp({ type: 'line', points: [p, p], color: strokeColor, width: strokeWidth })
    else setSelectedId(null)
  }

  const onMove = (e) => {
    if (temp) {
      const p = toSvgPoint(e)
      setTemp((t) => {
        if (!t) return t
        if (t.type === 'line') return { ...t, points: [t.points[0], p] }
        const last = t.points[t.points.length - 1]
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3) return t
        return { ...t, points: [...t.points, p] }
      })
      return
    }
    if (!dragRef.current) return
    const p = toSvgPoint(e)
    const drag = dragRef.current
    setCanvas((c) => ({
      ...c,
      items: c.items.map((i) => {
        if (i.id !== drag.id) return i
        if (isStroke(i)) {
          const dx = p[0] - drag.start[0]
          const dy = p[1] - drag.start[1]
          return { ...i, points: drag.origPoints.map(([x, y]) => [x + dx, y + dy]) }
        }
        return { ...i, x: p[0] - drag.dx, y: p[1] - drag.dy }
      }),
    }))
  }

  const endPointer = () => {
    if (temp) {
      const long = temp.type === 'line'
        ? Math.hypot(temp.points[1][0] - temp.points[0][0], temp.points[1][1] - temp.points[0][1]) > 4
        : temp.points.length > 1
      if (long) {
        const item = { id: uid(), ...temp }
        setCanvas((c) => ({ ...c, items: [...c.items, item] }))
        setSelectedId(item.id)
      }
      setTemp(null)
    }
    dragRef.current = null
  }

  const save = async () => {
    try {
      const payload = { title, canvas }
      if (design.id) await api.patch(`/designs/${design.id}`, payload)
      else await api.post('/designs', { ...payload, booking_id: design.booking_id ?? null })
      toast('Design saved', 'sage')
      onSaved()
    } catch (err) { toastErr(err) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Design studio" wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <Input className="max-w-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button icon="check" onClick={save}>Save design</Button>
          </div>
        </div>
      }>
      {/* Drawing toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {TOOLS.map(([id, icon, tip]) => (
            <button key={id} title={tip} onClick={() => { setTool(id); setSelectedId(null) }}
              className={cls('rounded-md px-2.5 py-1.5', tool === id ? 'bg-copper text-ink' : 'text-fg/55 hover:text-fg')}>
              <Icon name={icon} size={16} />
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-fg/60">
          Colour
          <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-line bg-card" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-fg/60">
          Width
          <input type="range" min="1" max="16" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-24 accent-[#BFA987]" />
          <span className="w-5 text-center font-medium text-fg/75">{strokeWidth}</span>
        </label>
        <span className="hidden text-xs text-fg/35 sm:block">
          {tool === 'select' ? 'Drag elements to move · click to select' : tool === 'pen' ? 'Draw freehand on the canvas' : 'Drag to draw a straight line'}
        </span>
      </div>

      {/* Furniture & shapes palette */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {Object.entries(ITEM_TYPES).map(([type, spec]) => (
          <button key={type} onClick={() => addItem(type)}
            className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-fg/70 transition-colors hover:border-copper hover:text-copper">
            + {spec.label}
          </button>
        ))}
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        className={cls('w-full touch-none rounded-xl border border-line bg-card shadow-inner', tool !== 'select' && 'cursor-crosshair')}
        onPointerMove={onMove} onPointerUp={endPointer} onPointerLeave={endPointer}
        onPointerDown={onCanvasDown}>
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(140,126,98,0.16)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={canvas.width} height={canvas.height} fill="url(#grid)" />
        <g style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}>
          {items.map((item) => (
            <CanvasItem key={item.id} item={item} selected={item.id === selectedId} onPointerDown={startDragItem(item)} />
          ))}
        </g>
        {temp && (
          <path d={strokePath(temp.points)} fill="none" stroke={temp.color} strokeWidth={temp.width}
            strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        )}
      </svg>

      {selected ? (
        isStroke(selected) ? (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3">
            <label className="flex items-center gap-1.5 text-xs text-fg/60">
              Colour
              <input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} className="h-9 w-9 cursor-pointer rounded border border-line bg-card" />
            </label>
            <Field label="Width" className="w-24">
              <Input type="number" min="1" max="20" value={selected.width || 3} onChange={(e) => updateSelected({ width: Number(e.target.value) || 1 })} />
            </Field>
            <div className="flex items-center gap-1.5">
              <IconButton icon="copy" label="Duplicate" onClick={() => {
                const copy = { ...selected, id: uid(), points: selected.points.map(([x, y]) => [x + 24, y + 24]) }
                setCanvas({ ...canvas, items: [...items, copy] }); setSelectedId(copy.id)
              }} />
              <IconButton icon="trash" label="Delete stroke" onClick={() => { setCanvas({ ...canvas, items: items.filter((i) => i.id !== selectedId) }); setSelectedId(null) }} />
            </div>
            <p className="text-xs text-fg/40">Tip: Delete key removes the selected stroke.</p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 items-end gap-2 rounded-xl border border-line bg-card p-3 sm:grid-cols-6">
            <Field label="Label" className="col-span-2"><Input value={selected.label} onChange={(e) => updateSelected({ label: e.target.value })} /></Field>
            <Field label="W"><Input type="number" min="20" value={selected.w} onChange={(e) => updateSelected({ w: Number(e.target.value) || 20 })} /></Field>
            <Field label="H"><Input type="number" min="20" value={selected.h} onChange={(e) => updateSelected({ h: Number(e.target.value) || 20 })} /></Field>
            <Field label="Rotate"><Input type="number" step="15" value={selected.rotation || 0} onChange={(e) => updateSelected({ rotation: Number(e.target.value) || 0 })} /></Field>
            <div className="flex items-center gap-1.5">
              <input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} className="h-9 w-9 cursor-pointer rounded border border-line bg-card" />
              <IconButton icon="copy" label="Duplicate" onClick={() => {
                const copy = { ...selected, id: uid(), x: selected.x + 24, y: selected.y + 24 }
                setCanvas({ ...canvas, items: [...items, copy] }); setSelectedId(copy.id)
              }} />
              <IconButton icon="trash" label="Delete item" onClick={() => { setCanvas({ ...canvas, items: items.filter((i) => i.id !== selectedId) }); setSelectedId(null) }} />
            </div>
          </div>
        )
      ) : (
        <p className="mt-3 text-center text-xs text-fg/40">
          Add elements from the palette, sketch with the pen & line tools, drag to position, click to edit.
        </p>
      )}
    </Modal>
  )
}

export function DesignCard({ design, onOpen, onDeleted }) {
  const canvas = design.canvas || { width: 1000, height: 700, items: [] }
  const remove = (e) => {
    e.stopPropagation()
    if (window.confirm('Delete this design?')) api.del(`/designs/${design.id}`).then(onDeleted).catch(toastErr)
  }
  return (
    <button onClick={onOpen} className="group w-full overflow-hidden rounded-xl border border-line bg-card text-left shadow-card transition-all hover:border-copper/40">
      <svg viewBox={`0 0 ${canvas.width} ${canvas.height}`} className="aspect-[10/7] w-full bg-parchment/40">
        {(canvas.items || []).map((item) => (
          <CanvasItem key={item.id} item={item} selected={false} interactive={false} />
        ))}
      </svg>
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div>
          <p className="text-sm font-medium">{design.title}</p>
          <p className="text-xs text-fg/45">{(canvas.items || []).length} elements</p>
        </div>
        <IconButton icon="trash" label="Delete" className="opacity-0 group-hover:opacity-100" onClick={remove} />
      </div>
    </button>
  )
}

export default function Designs() {
  const [designs, setDesigns] = useState(null)
  const [bookings, setBookings] = useState([])
  const [modal, setModal] = useState({ open: false, design: null })
  const load = () => api.get('/designs').then(setDesigns).catch(toastErr)
  useEffect(() => { load(); api.get('/bookings').then(setBookings).catch(() => {}) }, [])
  if (!designs) return <Spinner />
  const bookingTitle = (id) => bookings.find((b) => b.id === id)?.title

  return (
    <div>
      <PageHeader title="Design studio" sub="Floor plans plus free drawing — tables, stations, pens, lines, shapes and colour."
        actions={<Button icon="plus" onClick={() => setModal({ open: true, design: { title: 'New layout', canvas: { width: 1000, height: 700, items: [] } } })}>New design</Button>} />
      {designs.length === 0 ? (
        <EmptyState icon="layout" title="No designs yet" hint="Sketch your first event layout — drag in tables and stations, then draw over the top with the pen tools."
          action={<Button icon="plus" onClick={() => setModal({ open: true, design: { title: 'New layout', canvas: { width: 1000, height: 700, items: [] } } })}>New design</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <div key={d.id}>
              {d.booking_id && bookingTitle(d.booking_id) && (
                <Link to={`/app/bookings/${d.booking_id}`} className="mb-1 inline-block text-[11px] font-medium text-copper">↳ {bookingTitle(d.booking_id)}</Link>
              )}
              <DesignCard design={d} onOpen={() => setModal({ open: true, design: d })} onDeleted={load} />
            </div>
          ))}
        </div>
      )}
      <DesignEditorModal open={modal.open} design={modal.design} onClose={() => setModal({ open: false, design: null })}
        onSaved={() => { setModal({ open: false, design: null }); load() }} />
    </div>
  )
}
