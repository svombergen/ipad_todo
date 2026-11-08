import { expect, test } from 'vitest'
import { activeKid, addKid, addList, addTask, allDone, dayKey, doneCount, load, listTasks, removeKid, removeList, removeTask, renameKid, renameList, resetStars, resetTicks, setList, setServer, toggle } from './tasks'

test('tasks logic', () => {
  expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')

  // empty / corrupt -> defaults
  const s = load(null, '2026-01-05')
  expect(s.tasks.length).toBe(9)
  expect(s.lists.map((l) => l.name)).toEqual(['Ochtend', 'Avond'])
  expect(listTasks(s).length).toBe(5)
  expect(s.kids.length).toBe(2)
  expect(s.active).toBe(s.kids[0].id)
  expect(load('{garbage', 'd').kids.length).toBe(2)

  // kids tick the same task independently
  const [k1, k2] = s.kids
  const t = s.tasks[0].id
  const a = toggle(s, k1.id, t)
  expect(a.kids[0].stars).toBe(1)
  expect(doneCount(a, a.kids[0])).toBe(1)
  expect(doneCount(a, a.kids[1])).toBe(0)
  expect(toggle(a, k1.id, t).kids[0].stars).toBe(0) // untick takes star back
  expect(toggle(s, k1.id, 'nope')).toBe(s)

  // round-trip same day keeps ticks + active kid; new day clears ticks, keeps stars
  const b = { ...a, active: k2.id }
  expect(load(JSON.stringify(b), '2026-01-05').kids[0].done).toEqual([t])
  expect(activeKid(load(JSON.stringify(b), '2026-01-05')).id).toBe(k2.id)
  const next = load(JSON.stringify(b), '2026-01-06')
  expect(next.kids[0].done).toEqual([])
  expect(next.kids[0].stars).toBe(1)

  // tasks: add trims/ignores blank; remove drops ticks too
  expect(addTask(s, '🐶', '  ').tasks.length).toBe(9)
  expect(addTask(s, '🐶', ' Hond voeren ').tasks[9].title).toBe('Hond voeren')
  expect(removeTask(a, t).kids[0].done).toEqual([])

  // allDone is per kid
  const one = { ...s, tasks: [s.tasks[0]] }
  expect(allDone(toggle(one, k1.id, t), toggle(one, k1.id, t).kids[0])).toBe(true)
  expect(allDone(toggle(one, k1.id, t), toggle(one, k1.id, t).kids[1])).toBe(false)
  expect(allDone({ ...one, tasks: [] }, one.kids[0])).toBe(false)

  // kids: add, rename, remove (never the last one, active moves)
  const c = addKid(s, '🦊', ' Sam ')
  expect(c.kids[2].name).toBe('Sam')
  expect(addKid(s, '🦊', ' ').kids.length).toBe(2)
  expect(renameKid(s, k1.id, 'Noor').kids[0].name).toBe('Noor')
  expect(renameKid(s, k1.id, ' ').kids[0].name).toBe('Kind 1')
  const d = removeKid(s, k1.id)
  expect(d.kids.length).toBe(1)
  expect(d.active).toBe(k2.id)
  expect(removeKid(d, k2.id).kids.length).toBe(1)

  // lists: switch, add/rename, remove takes tasks + ticks along, never the last, old saves migrate
  const [morning, evening] = s.lists
  const e = setList(s, evening.id)
  expect(listTasks(e).length).toBe(4)
  expect(setList(s, 'nope')).toBe(s)
  expect(addTask(e, '🐶', 'Hond').tasks[9].list).toBe(evening.id)
  expect(addList(s, ' Middag ').list).not.toBe(s.list)
  expect(addList(s, ' ').lists.length).toBe(2)
  expect(renameList(s, morning.id, 'Vroeg').lists[0].name).toBe('Vroeg')
  const ticked = toggle(s, k1.id, t)
  const r = removeList(ticked, morning.id)
  expect(r.tasks.length).toBe(4)
  expect(r.kids[0].done).toEqual([])
  expect(r.list).toBe(evening.id)
  expect(removeList(r, evening.id).lists.length).toBe(1)
  const old = load(JSON.stringify({ tasks: [{ id: 'x', emoji: '⭐', title: 'Oud' }] }), 'd')
  expect(listTasks(old).map((t) => t.title)).toEqual(['Oud'])

  // server: default, normalised, persisted
  expect(s.server).toBe('http://192.168.2.9:8000')
  expect(setServer(s, ' 10.0.0.5:8000/ ').server).toBe('http://10.0.0.5:8000')
  expect(setServer(s, ' ')).toBe(s)
  expect(load(JSON.stringify(setServer(s, 'http://x:1')), 'd').server).toBe('http://x:1')

  expect(resetStars(a).kids[0].stars).toBe(0)
  expect(resetTicks(a).kids[0].done).toEqual([])
  expect(resetTicks(a).kids[0].stars).toBe(1)
})
