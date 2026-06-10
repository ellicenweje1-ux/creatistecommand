import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { cls, uid } from '../format'
import { Button, EmptyState, Field, Icon, IconButton, Input, Modal, PageHeader, Spinner, toast, toastErr } from '../ui'

const ITEM_TYPES = {
  round_table: { label: 'Round table', w: 110, h: 110, color: '#5C6F5A' },
  rect_table: { label: 'Long table', w: 240, h: 70, color: '#B4622D' },
  chair: { label: 'Chair', w: 34, h: 34, color: '#8A6D3B' },
  buffet: { label: 'Buffet line', w: 300, h: 60, color: '#B4622D' },
  bar: { label: 'Bar', w: 200, h: 60, color: '#1C1A17' },
  station: { label: 'Chef station', w: 140, h: 90, color: '#7A4E9E' },
  stage: { label: 'Stage / DJ', w: 220, h: 110, color: '#444444' },
  dance_floor: { label: 'Dance floor', w: 220, h: 220, color: '#C8B89A' },
  plant: { label: 'Plant', w: 44, h: 44, color: '#3E7C4F' },
  entrance: { label: 'Entrance', w: 100, h: 40, color: '#888888' },
  text: { label: 'Text label', w: 140, h: 30, color: '#1C1A17' },
}

function CanvasItem({ item, selected, onPointerDown }) {
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  const stroke = selected ? '#B4622D' : 'rgba(28,26,23,0.25)'
  const common = { onPointerDown, style: { cursor: 'move' }, transform: `rotate(${item.rotation || 0} ${cx} ${cy})` }
  const labelEl = (fill = '#fff', dy = 4) => (
    <text x={cx} y={cy + dy} textAnchor="middle" fontSize="13" fontFamily="Outfit, sans-serif" fill={fill} pointerEvents="none">
      {item.label}
    </text>
  )
  if (item.type === 'round_table' || item.type === 'plant') {
    return (
      <g {...common}>
        <circle cx={cx} cy={cy} r={item.w / 2} fill={item.color} opacity="0.88" stroke={stroke} strokeWidth={selected ? 2.5 : 1} />
        {labelEl()}
      </g>
    )
  }
  if (item.type === 'text') {
    return (
      <g {...common}>
        <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={selected ? 'rgba(180,98,45,0.08)' : 'transparent'} stroke={selected ? stroke : 'transparent'} strokeDasharray="4 3" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="600" fontFamily="Fraunces, serif" fill={item.color} pointerEvents="none">{item.label}</text>
      </g>
    )
  }
  return (
    <g {...common}>
      <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.type === 'dance_floor' ? 4 : 10}
        fill={item.color} opacity={item.type === 'dance_floor' ? 0.45 : 0.88} stroke={stroke} strokeWidth={selected ? 2.5 : 1} />
      {labelEl(item.type === 'dance_floor' ? '#1C1A17' : '#fff')}
    </g>
  )
}

export function DesignEditorModal({ open, design, onClose, onSaved }) {
  const svgRef = useRef(null)
  const [canvas, setCanvas] = useState({ width: 1000, height: 700, items: [] })
  const [title, setTitle] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const dragRef = useRef(null)

  useEffect(() => {
    if (open && design) {
      setCanvas(design.canvas?.items ? design.canvas : { width: 1000, height: 700, items: [] })
      setTitle(design.title || 'Untitled design')
      setSelectedId(null)
    }
  }, [open, design])

  if (!open || !design) return null
  const items = canvas.items || []
  const selected = items.find((i) => i.id === selectedId)

  const toSvgPoint = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const addItem = (type) => {
    const spec = ITEM_TYPES[type]
    const item = {
      id: uid(), type, x: canvas.width / 2 - spec.w / 2, y: canvas.height / 2 - spec.h / 2,
      w: spec.w, h: spec.h, rotation: 0, label: spec.label, color: spec.color,
    }
    setCanvas({ ...canvas, items: [...items, item] })
    setSelectedId(item.id)
  }

  const updateSelected = (patch) =>
    setCanvas({ ...canvas, items: items.map((i) => (i.id === selectedId ? { ...i, ...patch } : i)) })

  const startDrag = (item) => (e) => {
    e.stopPropagation()
    setSelectedId(item.id)
    const p = toSvgPoint(e)
    dragRef.current = { id: item.id, dx: p.x - item.x, dy: p.y - item.y }
    svgRef.current.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    if (!dragRef.current) return
    const p = toSvgPoint(e)
    const { id, dx, dy } = dragRef.current
    setCanvas((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === id ? { ...i, x: Math.round(p.x - dx), y: Math.round(p.y - dy) } : i)),
    }))
  }
  const endDrag = () => { dragRef.current = null }

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
    <Modal open={open} onClose={onClose} title="Setup designer" wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <Input className="max-w-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button icon="check" onClick={save}>Save design</Button>
          </div>
        </div>
      }>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {Object.entries(ITEM_TYPES).map(([type, spec]) => (
          <button key={type} onClick={() => addItem(type)}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-copper hover:text-copper">
            + {spec.label}
          </button>
        ))}
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        className="w-full touch-none rounded-xl border border-line bg-white shadow-inner"
        onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag}
        onPointerDown={() => setSelectedId(null)}>
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(28,26,23,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={canvas.width} height={canvas.height} fill="url(#grid)" />
        {items.map((item) => (
          <CanvasItem key={item.id} item={item} selected={item.id === selectedId} onPointerDown={startDrag(item)} />
        ))}
      </svg>

      {selected ? (
        <div className="mt-3 grid grid-cols-2 items-end gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-6">
          <Field label="Label" className="col-span-2"><Input value={selected.label} onChange={(e) => updateSelected({ label: e.target.value })} /></Field>
          <Field label="W"><Input type="number" min="20" value={selected.w} onChange={(e) => updateSelected({ w: Number(e.target.value) || 20 })} /></Field>
          <Field label="H"><Input type="number" min="20" value={selected.h} onChange={(e) => updateSelected({ h: Number(e.target.value) || 20 })} /></Field>
          <Field label="Rotate"><Input type="number" step="15" value={selected.rotation || 0} onChange={(e) => updateSelected({ rotation: Number(e.target.value) || 0 })} /></Field>
          <div className="flex items-center gap-1.5">
            <input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} className="h-9 w-9 cursor-pointer rounded border border-line" />
            <IconButton icon="copy" label="Duplicate" onClick={() => {
              const copy = { ...selected, id: uid(), x: selected.x + 24, y: selected.y + 24 }
              setCanvas({ ...canvas, items: [...items, copy] }); setSelectedId(copy.id)
            }} />
            <IconButton icon="trash" label="Delete item" onClick={() => { setCanvas({ ...canvas, items: items.filter((i) => i.id !== selectedId) }); setSelectedId(null) }} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-ink/40">Add elements from the palette, drag to position, click to select & edit.</p>
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
    <button onClick={onOpen} className="group overflow-hidden rounded-xl border border-line bg-white text-left shadow-card transition-all hover:border-copper/40">
      <svg viewBox={`0 0 ${canvas.width} ${canvas.height}`} className="aspect-[10/7] w-full bg-parchment/40">
        {(canvas.items || []).map((item) => (
          <CanvasItem key={item.id} item={item} selected={false} onPointerDown={() => {}} />
        ))}
      </svg>
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div>
          <p className="text-sm font-medium">{design.title}</p>
          <p className="text-xs text-ink/45">{(canvas.items || []).length} elements</p>
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
      <PageHeader title="Setup designs" sub="Floor plans for buffets, stations and seating — drag, drop, done."
        actions={<Button icon="plus" onClick={() => setModal({ open: true, design: { title: 'New layout', canvas: { width: 1000, height: 700, items: [] } } })}>New design</Button>} />
      {designs.length === 0 ? (
        <EmptyState icon="layout" title="No designs yet" hint="Sketch your first event layout — tables, buffet lines, bar, dance floor."
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
