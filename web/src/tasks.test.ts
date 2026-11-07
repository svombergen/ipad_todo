import { expect, test } from 'vitest'
import { activeKid, addKid, addTask, allDone, dayKey, doneCount, load, removeKid, removeTask, renameKid, resetStars, toggle } from './tasks'

test('tasks logic', () => {
  expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')

  // empty / corrupt -> defaults
  const s = load(null, '2026-01-05')
  expect(s.tasks.length).toBe(8)
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
  expect(addTask(s, '🐶', '  ').tasks.length).toBe(8)
  expect(addTask(s, '🐶', ' Hond voeren ').tasks[8].title).toBe('Hond voeren')
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

  expect(resetStars(a).kids[0].stars).toBe(0)
})
