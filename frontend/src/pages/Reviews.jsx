import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { fmtDate } from '../format'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, Stars, toast, toastErr } from '../ui'

/* Reviews — testimonials left by anyone on the chef's own website land here as "awaiting approval";
   nothing shows publicly until the chef approves it. Reviews typed in on a client's card are private
   unless the chef chooses to show them on the site too. */
const LANES = [
  ['pending', 'Awaiting approval', 'New reviews from your website. Approve to show them on your site, or hide them.'],
  ['approved', 'Showing on your site', 'These appear publicly, newest event first.'],
  ['other', 'Private & hidden', 'Reviews you entered yourself, and any you have hidden. Show any of them on your site with one tap.'],
]

export default function Reviews() {
  const [rows, setRows] = useState(null)
  const load = () => api.get('/reviews').then(setRows).catch(toastErr)
  useEffect(() => { load() }, [])
  const lanes = useMemo(() => {
    const r = rows || []
    return { pending: r.filter((x) => x.status === 'pending'), approved: r.filter((x) => x.status === 'approved'), other: r.filter((x) => !['pending', 'approved'].includes(x.status)) }
  }, [rows])
  const set = async (r, status, msg) => { try { await api.patch(`/reviews/${r.id}`, { status }); toast(msg); load() } catch (e) { toastErr(e) } }
  const del = async (r) => { if (!window.confirm('Delete this review for good?')) return; try { await api.del(`/reviews/${r.id}`); toast('Review deleted'); load() } catch (e) { toastErr(e) } }

  if (!rows) return <Spinner />
  const avg = lanes.approved.length ? (lanes.approved.reduce((a, r) => a + r.rating, 0) / lanes.approved.length).toFixed(1) : null
  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" sub="Testimonials from your website, approved by you before they show." actions={avg ? <Badge tone="green">{avg} ★ · {lanes.approved.length} live</Badge> : null} />
      {!rows.length ? (
        <EmptyState icon="star" title="No reviews yet" hint="Reviews left on your website land here first. Nothing shows publicly until you approve it." />
      ) : LANES.map(([k, title, hint]) => (
        <Card key={k} title={`${title} (${lanes[k].length})`}>
          <p className="mb-3 text-sm text-fg/55">{hint}</p>
          {!lanes[k].length ? <p className="text-sm text-fg/40">Nothing here.</p> : (
            <div className="space-y-3">
              {lanes[k].map((r) => (
                <div key={r.id} className="rounded-lg border border-line bg-parchment/30 p-3" data-review={r.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-sm font-medium">{r.reviewer_name || r.client_name || 'Anonymous'}</span>
                      {r.event_name ? <span className="text-xs text-fg/55">· {r.event_name}</span> : null}
                      {r.date ? <span className="text-xs text-fg/45">· {fmtDate(r.date)}</span> : null}
                      <Badge tone={r.source === 'public' ? 'copper' : 'gray'}>{r.source === 'public' ? 'From your website' : 'Entered by you'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.status !== 'approved' ? <Button size="sm" onClick={() => set(r, 'approved', 'Now showing on your site')}>{r.status === 'pending' ? 'Approve' : 'Show on site'}</Button> : null}
                      {r.status !== 'hidden' ? <Button size="sm" variant="ghost" onClick={() => set(r, 'hidden', 'Hidden from your site')}>Hide</Button> : null}
                      <Button size="sm" variant="ghost" onClick={() => del(r)}>Delete</Button>
                    </div>
                  </div>
                  {r.comment ? <p className="mt-2 text-sm text-fg/75">“{r.comment}”</p> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
