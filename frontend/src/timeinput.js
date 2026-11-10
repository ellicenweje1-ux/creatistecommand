// Times typed the way you'd write them on a pad: "8", "930", "9:30", "2pm", "14:00".
// parseTime returns "HH:MM", "" for blank, or null when it can't be read.
export function parseTime(s) {
  s = String(s || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return ''
  const m = s.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm|a|p)?$/)
  if (!m) return null
  let h = Number(m[1])
  const mi = m[2] ? Number(m[2]) : 0
  const suf = m[3]
  if (mi > 59 || h > 23) return null
  if (suf) {
    if (h > 12 || h === 0) return null
    if (suf[0] === 'p' && h < 12) h += 12
    if (suf[0] === 'a' && h === 12) h = 0
  } else if (h >= 1 && h <= 6) h += 12 // "2" on a pad means 2pm
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

// "09:30" -> "9:30am", "14:00" -> "2pm"
export function showTime(t) {
  if (!t) return ''
  const [hh, mm] = t.split(':').map(Number)
  const ap = hh >= 12 ? 'pm' : 'am'
  const h = hh % 12 || 12
  return mm ? `${h}:${String(mm).padStart(2, '0')}${ap}` : `${h}${ap}`
}

export const timeRange = (a, b) => (a ? showTime(a) + (b ? `–${showTime(b)}` : '') : '')

export function addHours(t, hrs) {
  if (!t || !hrs) return ''
  const [h, m] = t.split(':').map(Number)
  const mins = Math.min(h * 60 + m + Math.round(hrs * 60), 23 * 60 + 59)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

// A hint line under a time box: what the typed text will show as.
export function timeHint(text, blankHint = 'Leave it blank for any time that day.') {
  if (!String(text || '').trim()) return blankHint
  const t = parseTime(text)
  return t === null ? 'Try 9:30, 930 or 2pm.' : `Shows as ${showTime(t)}.`
}
