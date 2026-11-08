/** One-tap choice inside a category: optional label ("Drankje") and an amount in the category's unit. */
export type Opt = { id: string; label: string; value?: number }
/** What the front screen shows as one big button. `unit` ('ml', '' = none) applies to all its options. */
export type Cat = { id: string; name: string; icon: string; color: string; unit: string; opts: Opt[] }
/** A registration. Names/unit/color are copied so history and charts survive edits and deletes. */
export type Entry = { id: string; ts: number; catId: string; cat: string; color: string; label: string; unit: string; value?: number }
export type State = { cats: Cat[]; entries: Entry[]; server: string }
export type Period = 'today' | 'week' | 'all'

/** Where `ship.ps1` serves the IPAs; editable in the app. */
export const DEFAULT_SERVER = 'http://192.168.2.9:8000'
export const PALETTE = ['#2b7cff', '#f08c00', '#12b886', '#e64980', '#7950f2', '#0ca5b0']

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const mkOpt = (label: string, value?: number): Opt => ({ id: newId(), label, ...(value != null ? { value } : {}) })
const mkCat = (name: string, icon: string, color: string, unit: string, opts: Opt[]): Cat => ({ id: newId(), name, icon, color, unit, opts })
const defaultCats = () => [
  mkCat('Drinken', 'glass', PALETTE[0], 'ml', [mkOpt('Drankje', 200), mkOpt('Drankje', 300), mkOpt('Yoghurt (250gr)', 150)]),
  mkCat('Plassen', 'drop', PALETTE[1], 'ml', [50, 100, 150, 200, 300].map((v) => mkOpt('', v))),
]

/** Next palette color not used yet (cycles when all are taken). */
export const nextColor = (cats: Cat[]) => PALETTE.find((c) => !cats.some((k) => k.color === c)) ?? PALETTE[cats.length % PALETTE.length]

const num = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 && x !== '' && x != null ? Number(x) : undefined)

export function load(raw: string | null | undefined): State {
  let p: any = null
  try {
    p = JSON.parse(raw || '')
  } catch {
    // corrupt or empty -> defaults
  }
  const cats: Cat[] = Array.isArray(p?.cats)
    ? p.cats
        .filter((c: any) => c && typeof c.name === 'string')
        .map((c: any) => ({
          id: String(c.id || newId()),
          name: c.name,
          icon: String(c.icon || 'star'),
          color: String(c.color || PALETTE[0]),
          unit: String(c.unit || ''),
          opts: Array.isArray(c.opts)
            ? c.opts.filter((o: any) => o).map((o: any) => ({ id: String(o.id || newId()), label: String(o.label || ''), ...(num(o.value) ? { value: num(o.value) } : {}) }))
            : [],
        }))
    : defaultCats()
  const entries: Entry[] = Array.isArray(p?.entries)
    ? p.entries
        .filter((e: any) => e && Number.isFinite(e.ts) && typeof e.cat === 'string')
        .map((e: any) => ({
          id: String(e.id || newId()),
          ts: Number(e.ts),
          catId: String(e.catId || ''),
          cat: e.cat,
          color: String(e.color || PALETTE[0]),
          label: String(e.label || ''),
          unit: String(e.unit || ''),
          ...(num(e.value) ? { value: num(e.value) } : {}),
        }))
    : []
  const server = typeof p?.server === 'string' && p.server ? p.server : DEFAULT_SERVER
  return { cats, entries, server }
}

/** Timestamp is always "now": never typed in. A value only counts for categories that have a unit. */
export function addEntry(s: State, c: Cat, label = '', value?: number, ts = Date.now()): [State, Entry] {
  const e: Entry = {
    id: newId(), ts, catId: c.id, cat: c.name, color: c.color, label, unit: c.unit,
    ...(c.unit && value != null && value > 0 ? { value } : {}),
  }
  return [{ ...s, entries: [...s.entries, e] }, e]
}

export const removeEntry = (s: State, id: string): State => ({ ...s, entries: s.entries.filter((e) => e.id !== id) })

export const saveCat = (s: State, c: Cat): State =>
  s.cats.some((k) => k.id === c.id) ? { ...s, cats: s.cats.map((k) => (k.id === c.id ? c : k)) } : { ...s, cats: [...s.cats, c] }

export const removeCat = (s: State, id: string): State => ({ ...s, cats: s.cats.filter((k) => k.id !== id) })

export function setServer(s: State, server: string): State {
  const v = server.trim().replace(/\/+$/, '')
  return v ? { ...s, server: /^https?:\/\//.test(v) ? v : 'http://' + v } : s
}

// ---------- text

/** "Drankje 200 ml", "150 ml", "Yoghurt (250gr) 150 ml", "Poepen" -> label + amount. */
export const optText = (unit: string, o: { label: string; value?: number }) =>
  [o.label, o.value != null ? `${o.value} ${unit}` : ''].filter(Boolean).join(' ')
export const entryName = (e: Entry) => [e.cat, e.label].filter(Boolean).join(' · ')
export const fmtValue = (e: Entry) => (e.value != null ? `${e.value} ${e.unit}` : '')

// ---------- dates (local time)

const p2 = (n: number) => String(n).padStart(2, '0')
export const dayKey = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}
export const clock = (ts: number) => {
  const d = new Date(ts)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}
export function isoLocal(ts: number) {
  const d = new Date(ts)
  const off = -d.getTimezoneOffset()
  const a = Math.abs(off)
  return `${dayKey(ts)}T${clock(ts)}:${p2(d.getSeconds())}${off < 0 ? '-' : '+'}${p2(Math.floor(a / 60))}:${p2(a % 60)}`
}

export const PERIOD_LABEL: Record<Period, string> = { today: 'Vandaag', week: 'Laatste 7 dagen', all: 'Alles' }

export function since(p: Period, now = Date.now()) {
  if (p === 'all') return 0
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (p === 'week') d.setDate(d.getDate() - 6)
  return d.getTime()
}
export const inPeriod = (es: Entry[], p: Period, now = Date.now()) => es.filter((e) => e.ts >= since(p, now))

// ---------- grouping

export type Total = { name: string; unit: string; n: number; sum: number }
export type Day = { day: string; ts: number; entries: Entry[]; totals: Total[] }

export function totals(es: Entry[]): Total[] {
  const m = new Map<string, Total>()
  for (const e of es) {
    const k = e.cat + '|' + e.unit
    const t = m.get(k) ?? { name: e.cat, unit: e.unit, n: 0, sum: 0 }
    t.n++
    t.sum += e.value ?? 0
    m.set(k, t)
  }
  return [...m.values()]
}

export function byDay(es: Entry[], newestFirst = true): Day[] {
  const days: Day[] = []
  for (const e of [...es].sort((a, b) => (newestFirst ? b.ts - a.ts : a.ts - b.ts))) {
    const k = dayKey(e.ts)
    let d = days[days.length - 1]
    if (!d || d.day !== k) days.push((d = { day: k, ts: e.ts, entries: [], totals: [] }))
    d.entries.push(e)
  }
  for (const d of days) d.totals = totals(d.entries)
  return days
}

export const fmtTotal = (t: Total) => `${t.name} ${t.n}×` + (t.unit ? ` · ${Math.round(t.sum * 100) / 100} ${t.unit}` : '')

// ---------- chart data (amounts in ml, stacked per category)

export type View = { level: 'month' | 'day' | 'hour'; anchor?: number }
export type Bar = { from: number; to: number; label: string; sums: Record<string, number>; total: number }

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
export const isMl = (e: Entry) => e.unit === 'ml' && e.value != null

/** Start zoomed out as far as needed: one day -> hours, a few months -> days, more -> months. */
export function autoView(es: Entry[]): View {
  if (!es.length) return { level: 'day' }
  const ts = es.map((e) => e.ts)
  const first = Math.min(...ts)
  const last = Math.max(...ts)
  if (dayKey(first) === dayKey(last)) return { level: 'hour', anchor: first }
  return { level: last - first > 120 * 864e5 ? 'month' : 'day' }
}

export function bars(es: Entry[], v: View, now = Date.now()): Bar[] {
  const ts = es.map((e) => e.ts)
  const lo = new Date(ts.length ? Math.min(...ts) : now)
  const hi = new Date(ts.length ? Math.max(...ts) : now)
  const a = new Date(v.anchor ?? lo.getTime())
  const out: Bar[] = []
  const push = (from: Date, to: Date, label: string) => out.push({ from: from.getTime(), to: to.getTime(), label, sums: {}, total: 0 })
  if (v.level === 'hour') {
    for (let h = 0; h < 24; h++) push(new Date(a.getFullYear(), a.getMonth(), a.getDate(), h), new Date(a.getFullYear(), a.getMonth(), a.getDate(), h + 1), String(h))
  } else if (v.level === 'day') {
    // drilled from a month: that month; otherwise first..last day with data
    const start = v.anchor != null ? new Date(a.getFullYear(), a.getMonth(), 1) : new Date(lo.getFullYear(), lo.getMonth(), lo.getDate())
    const end = v.anchor != null ? new Date(a.getFullYear(), a.getMonth() + 1, 0) : new Date(hi.getFullYear(), hi.getMonth(), hi.getDate())
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      push(d, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), `${d.getDate()} ${MONTHS[d.getMonth()]}`)
    }
  } else {
    for (let d = new Date(lo.getFullYear(), lo.getMonth(), 1); d <= hi; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      push(d, new Date(d.getFullYear(), d.getMonth() + 1, 1), `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`)
    }
  }
  for (const e of es.filter(isMl)) {
    const b = out.find((x) => e.ts >= x.from && e.ts < x.to)
    if (b) {
      b.sums[e.catId] = (b.sums[e.catId] ?? 0) + e.value!
      b.total += e.value!
    }
  }
  return out
}

/** Round the y axis up to a friendly max (1/2/2.5/5 x 10^n) with about `ticks` steps. */
export function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: 1, step: 1 }
  const raw = max / ticks
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw)!
  return { max: Math.ceil(max / step - 1e-9) * step, step }
}

// ---------- export (oldest first, local time)

export const filename = (ext: string, now = Date.now()) => `dagboek-${dayKey(now)}.${ext}`
const line = (e: Entry) => [e.cat, e.label, fmtValue(e)].filter(Boolean).join(' - ')

export function toTxt(es: Entry[], period: Period, now = Date.now()) {
  const out = [`Dagboek - export ${dayKey(now)} ${clock(now)}`, `Periode: ${PERIOD_LABEL[period]} (${es.length} registraties)`]
  for (const d of byDay(es, false)) {
    out.push('', d.day)
    for (const e of d.entries) out.push(`  ${clock(e.ts)}  ${line(e)}`)
    out.push(`  Totaal: ${d.totals.map(fmtTotal).join(', ')}`)
  }
  return out.join('\n') + '\n'
}

export const toJson = (es: Entry[], period: Period, now = Date.now()) =>
  JSON.stringify(
    {
      app: 'Dagboek',
      exported: isoLocal(now),
      period: PERIOD_LABEL[period],
      entries: [...es]
        .sort((a, b) => a.ts - b.ts)
        .map((e) => ({
          time: isoLocal(e.ts), date: dayKey(e.ts), clock: clock(e.ts),
          category: e.cat, label: e.label || null, value: e.value ?? null, unit: e.unit || null,
        })),
    },
    null,
    2,
  ) + '\n'

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Plain HTML: the iOS shell turns it into a paginated A4 PDF. */
export function toHtml(es: Entry[], period: Period, now = Date.now()) {
  const days = byDay(es, false)
    .map(
      (d) =>
        `<h3>${d.day}</h3><table width="100%" cellpadding="3">` +
        d.entries
          .map((e) => `<tr><td width="60">${clock(e.ts)}</td><td>${esc(entryName(e))}</td><td align="right">${esc(fmtValue(e))}</td></tr>`)
          .join('') +
        `</table><p><i>Totaal: ${esc(d.totals.map(fmtTotal).join(', '))}</i></p>`,
    )
    .join('')
  return (
    `<body style="font-family:Helvetica;font-size:11pt"><h1>Dagboek</h1>` +
    `<p>Periode: ${PERIOD_LABEL[period]} (${es.length} registraties)<br>Export: ${dayKey(now)} ${clock(now)}</p>${days}</body>`
  )
}
