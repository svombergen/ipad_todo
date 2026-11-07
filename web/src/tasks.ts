export type Task = { id: string; emoji: string; title: string }
/** Each kid has their own ticks (task ids) and stars; the task list is shared. */
export type Kid = { id: string; name: string; avatar: string; stars: number; done: string[] }
export type State = { tasks: Task[]; kids: Kid[]; active: string; day: string }

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ponytail: no crypto.randomUUID, custom app:// scheme isn't a secure context.
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const DEFAULT_TASKS: [string, string][] = [
  ['🦷', 'Tanden poetsen'],
  ['🛏️', 'Bed opmaken'],
  ['👕', 'Aankleden'],
  ['🥣', 'Ontbijten'],
  ['🎒', 'Schooltas inpakken'],
  ['📚', 'Boek lezen'],
  ['🧸', 'Speelgoed opruimen'],
  ['🛁', 'In bad'],
]
const DEFAULT_KIDS: [string, string][] = [
  ['🦁', 'Kind 1'],
  ['🐼', 'Kind 2'],
]

const mkTask = (emoji: string, title: string): Task => ({ id: newId(), emoji, title })
const mkKid = (avatar: string, name: string): Kid => ({ id: newId(), name, avatar, stars: 0, done: [] })

/** New day: clear everyone's ticks, keep stars. */
export const rollover = (s: State, day: string): State =>
  s.day === day ? s : { ...s, day, kids: s.kids.map((k) => ({ ...k, done: [] })) }

export function load(raw: string | null | undefined, day: string): State {
  let p: any = null
  try {
    p = JSON.parse(raw || '')
  } catch {
    // corrupt or empty -> defaults
  }
  const tasks: Task[] = Array.isArray(p?.tasks)
    ? p.tasks
        .filter((t: any) => t && typeof t.title === 'string')
        .map((t: any) => ({ id: String(t.id || newId()), emoji: String(t.emoji || '⭐'), title: t.title }))
    : DEFAULT_TASKS.map(([e, t]) => mkTask(e, t))
  let kids: Kid[] = Array.isArray(p?.kids)
    ? p.kids
        .filter((k: any) => k && typeof k.name === 'string')
        .map((k: any) => ({
          id: String(k.id || newId()),
          name: k.name,
          avatar: String(k.avatar || '🙂'),
          stars: Math.max(0, Number(k.stars) || 0),
          done: Array.isArray(k.done) ? k.done.map(String) : [],
        }))
    : []
  if (!kids.length) kids = DEFAULT_KIDS.map(([a, n]) => mkKid(a, n))
  const active = kids.some((k) => k.id === p?.active) ? p.active : kids[0].id
  return rollover({ tasks, kids, active, day: String(p?.day) }, day)
}

export const activeKid = (s: State) => s.kids.find((k) => k.id === s.active) ?? s.kids[0]

const mapKid = (s: State, id: string, f: (k: Kid) => Kid): State => ({
  ...s,
  kids: s.kids.map((k) => (k.id === id ? f(k) : k)),
})

/** Tick = +1 star, untick = -1 (no farming). */
export function toggle(s: State, kidId: string, taskId: string): State {
  if (!s.tasks.some((t) => t.id === taskId)) return s
  return mapKid(s, kidId, (k) =>
    k.done.includes(taskId)
      ? { ...k, stars: Math.max(0, k.stars - 1), done: k.done.filter((d) => d !== taskId) }
      : { ...k, stars: k.stars + 1, done: [...k.done, taskId] },
  )
}

export const isDone = (k: Kid, taskId: string) => k.done.includes(taskId)
export const doneCount = (s: State, k: Kid) => s.tasks.filter((t) => isDone(k, t.id)).length
export const allDone = (s: State, k: Kid) => s.tasks.length > 0 && doneCount(s, k) === s.tasks.length

export const addTask = (s: State, emoji: string, title: string): State =>
  title.trim() ? { ...s, tasks: [...s.tasks, mkTask(emoji, title.trim())] } : s

export const removeTask = (s: State, id: string): State => ({
  ...s,
  tasks: s.tasks.filter((t) => t.id !== id),
  kids: s.kids.map((k) => ({ ...k, done: k.done.filter((d) => d !== id) })),
})

export const addKid = (s: State, avatar: string, name: string): State =>
  name.trim() ? { ...s, kids: [...s.kids, mkKid(avatar, name.trim())] } : s

/** Always keep at least one kid. */
export function removeKid(s: State, id: string): State {
  if (s.kids.length <= 1) return s
  const kids = s.kids.filter((k) => k.id !== id)
  return { ...s, kids, active: s.active === id ? kids[0].id : s.active }
}

export const renameKid = (s: State, id: string, name: string): State =>
  name.trim() ? mapKid(s, id, (k) => ({ ...k, name: name.trim() })) : s

export const resetStars = (s: State): State => ({ ...s, kids: s.kids.map((k) => ({ ...k, stars: 0 })) })
