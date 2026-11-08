import { expect, test } from 'vitest'
import {
  addEntry, autoView, bars, byDay, clock, dayKey, fmtTotal, inPeriod, isoLocal, load, niceScale, nextColor,
  optText, removeCat, removeEntry, saveCat, setServer, toHtml, toJson, toTxt, PALETTE,
} from './log'

const at = (d: number, h = 8, m = 15, mo = 10) => new Date(2026, mo, d, h, m).getTime() // month 10 = november

test('categories, options, entries', () => {
  // empty / corrupt -> the two example categories; an empty list is kept (user deleted everything)
  const s = load(null)
  expect(s.cats.map((c) => c.name)).toEqual(['Drinken', 'Plassen'])
  expect(load('{garbage').cats.length).toBe(2)
  expect(load('{"cats":[]}').cats.length).toBe(0)
  const [drinken, plassen] = s.cats
  expect(drinken.opts.map((o) => optText(drinken.unit, o))).toEqual(['Drankje 200 ml', 'Drankje 300 ml', 'Yoghurt (250gr) 150 ml'])
  expect(plassen.opts.map((o) => optText(plassen.unit, o))).toEqual(['50 ml', '100 ml', '150 ml', '200 ml', '300 ml'])
  expect(optText('', { label: 'Poepen' })).toBe('Poepen')
  expect(s.server).toBe('http://192.168.2.9:8000')

  // entries: timestamp is automatic, value only for categories with a unit
  const [a, e1] = addEntry(s, drinken, 'Drankje', 200, at(8))
  expect(e1).toMatchObject({ cat: 'Drinken', label: 'Drankje', unit: 'ml', value: 200, ts: at(8), color: drinken.color })
  const poepen = { ...plassen, id: 'p', name: 'Poepen', unit: '', opts: [] }
  expect(addEntry(a, poepen, '', 99)[1].value).toBeUndefined()
  expect(addEntry(a, drinken, 'x', 0)[1].value).toBeUndefined()
  expect(Math.abs(addEntry(s, poepen)[1].ts - Date.now())).toBeLessThan(1000)
  expect(load(JSON.stringify(a)).entries).toEqual(a.entries) // survives save/load

  // history keeps working after the category is deleted; edits replace, new ones append
  expect(removeCat(a, drinken.id).entries[0].cat).toBe('Drinken')
  expect(saveCat(s, { ...plassen, name: 'Pipi' }).cats[1].name).toBe('Pipi')
  expect(saveCat(s, { ...plassen, id: 'new' }).cats.length).toBe(3)
  expect(removeEntry(a, e1.id).entries.length).toBe(0)
  expect(nextColor(s.cats)).toBe(PALETTE[2])
  expect(nextColor(load('{"cats":[]}').cats)).toBe(PALETTE[0])
})

test('grouping + periods', () => {
  const s = load(null)
  const [drinken, plassen] = s.cats
  let b = s
  b = addEntry(b, plassen, '', 150, at(8))[0]
  b = addEntry(b, plassen, '', 100, at(8, 12, 0))[0]
  b = addEntry(b, drinken, 'Drankje', 200, at(8, 13, 0))[0]
  b = addEntry(b, plassen, '', 200, at(3))[0]
  const days = byDay(b.entries)
  expect(days.map((d) => d.day)).toEqual(['2026-11-08', '2026-11-03'])
  expect(days[0].entries.map((e) => clock(e.ts))).toEqual(['13:00', '12:00', '08:15'])
  expect(days[0].totals.map(fmtTotal)).toEqual(['Drinken 1× · 200 ml', 'Plassen 2× · 250 ml'])
  expect(inPeriod(b.entries, 'today', at(8, 20)).length).toBe(3)
  expect(inPeriod(b.entries, 'week', at(8, 20)).length).toBe(4)
  expect(inPeriod(b.entries, 'week', at(10)).length).toBe(3) // 3 nov drops out
  expect(inPeriod(b.entries, 'all', at(30)).length).toBe(4)
})

test('chart: auto zoom, buckets, drill down, scale', () => {
  const s = load(null)
  const [drinken, plassen] = s.cats
  const one = addEntry(addEntry(s, plassen, '', 150, at(8, 9, 30))[0], drinken, 'Drankje', 200, at(8, 9, 45))[0].entries
  // one day -> hours
  expect(autoView(one)).toEqual({ level: 'hour', anchor: at(8, 9, 30) })
  const h = bars(one, autoView(one))
  expect(h.length).toBe(24)
  expect(h[9].sums).toEqual({ [plassen.id]: 150, [drinken.id]: 200 })
  expect(h[9].total).toBe(350)
  expect(h[10].total).toBe(0)

  // several days -> days, empty days included so the axis is continuous
  const many = addEntry({ ...s, entries: one }, plassen, '', 100, at(11))[0].entries
  expect(autoView(many).level).toBe('day')
  const d = bars(many, autoView(many))
  expect(d.map((x) => x.label)).toEqual(['8 nov', '9 nov', '10 nov', '11 nov'])
  expect(d.map((x) => x.total)).toEqual([350, 0, 0, 100])

  // drill: day bar -> that day's hours; month view -> days of that month
  expect(bars(many, { level: 'hour', anchor: d[3].from })[8].total).toBe(100)
  const far = addEntry({ ...s, entries: one }, plassen, '', 50, at(8, 8, 0, 2))[0].entries // 8 mar .. 8 nov
  expect(autoView(far).level).toBe('month')
  const m = bars(far, autoView(far))
  expect(m.length).toBe(9)
  expect(m[0].label).toBe('mrt 26')
  expect(m[8].total).toBe(350)
  expect(bars(far, { level: 'day', anchor: m[8].from }).length).toBe(30)

  // entries without ml are ignored by the chart
  const poepen = { ...plassen, id: 'p', name: 'Poepen', unit: '', opts: [] }
  expect(bars(addEntry(s, poepen, '', undefined, at(8))[0].entries, { level: 'hour', anchor: at(8) }).every((x) => x.total === 0)).toBe(true)

  expect(niceScale(0)).toEqual({ max: 1, step: 1 })
  expect(niceScale(350)).toEqual({ max: 400, step: 100 })
  expect(niceScale(1234)).toEqual({ max: 1500, step: 500 })
  expect(niceScale(8)).toEqual({ max: 8, step: 2 })
})

test('dates + exports', () => {
  expect(dayKey(new Date(2026, 0, 5).getTime())).toBe('2026-01-05')
  expect(isoLocal(new Date(2026, 0, 5, 9, 3, 7).getTime())).toMatch(/^2026-01-05T09:03:07[+-]\d\d:\d\d$/)
  expect(setServer(load(null), ' 10.0.0.5:8000/ ').server).toBe('http://10.0.0.5:8000')

  const s = load(null)
  const [drinken, plassen] = s.cats
  const z = addEntry(addEntry(s, plassen, '', 150, at(8))[0], drinken, 'Drankje', 300, at(8, 9, 5))[0]
  const now = at(8, 20, 0)
  expect(toTxt(z.entries, 'today', now)).toContain(
    '2026-11-08\n  08:15  Plassen - 150 ml\n  09:05  Drinken - Drankje - 300 ml\n  Totaal: Plassen 1× · 150 ml, Drinken 1× · 300 ml',
  )
  const json = JSON.parse(toJson(z.entries, 'today', now))
  expect(json.entries[0]).toMatchObject({ date: '2026-11-08', clock: '08:15', category: 'Plassen', label: null, value: 150, unit: 'ml' })
  expect(json.entries[1]).toMatchObject({ category: 'Drinken', label: 'Drankje', value: 300 })
  expect(toHtml(z.entries, 'today', now)).toContain('<td>Drinken · Drankje</td><td align="right">300 ml</td>')
})
