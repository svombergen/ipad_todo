export type Task = { id: string; emoji: string; title: string; list: string }
/** Task lists (e.g. Ochtend / Avond). A task belongs to one list; kids keep one tick set across all lists. */
export type List = { id: string; name: string }
/** Each kid has their own ticks (task ids) and stars; the task list is shared. */
export type Kid = { id: string; name: string; avatar: string; stars: number; done: string[] }
export type State = { tasks: Task[]; kids: Kid[]; lists: List[]; list: string; active: string; day: string; server: string }

/** Where `ship.ps1` serves the IPA + version.json; editable in parent mode. */
export const DEFAULT_SERVER = 'http://192.168.2.9:8000'

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ponytail: no crypto.randomUUID, custom app:// scheme isn't a secure context.
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const DEFAULT_LISTS = ['Ochtend', 'Avond']
const DEFAULT_TASKS: [number, string, string][] = [
  [0, '🛏️', 'Bed opmaken'],
  [0, '👕', 'Aankleden'],
  [0, '🥣', 'Ontbijten'],
  [0, '🦷', 'Tanden poetsen'],
  [0, '🎒', 'Schooltas inpakken'],
  [1, '🧸', 'Speelgoed opruimen'],
  [1, '🛁', 'In bad'],
  [1, '🦷', 'Tanden poetsen'],
  [1, '📚', 'Boek lezen'],
]
const DEFAULT_KIDS: [string, string][] = [
  ['🦁', 'Kind 1'],
  ['🐼', 'Kind 2'],
]

const mkTask = (emoji: string, title: string, list: string): Task => ({ id: newId(), emoji, title, list })
const mkList = (name: string): List => ({ id: newId(), name })
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
  let lists: List[] = Array.isArray(p?.lists)
    ? p.lists.filter((l: any) => l && typeof l.name === 'string').map((l: any) => ({ id: String(l.id || newId()), name: l.name }))
    : []
  if (!lists.length) lists = DEFAULT_LISTS.map(mkList)
  // Old saves (no lists yet) land in the first list.
  const tasks: Task[] = Array.isArray(p?.tasks)
    ? p.tasks
        .filter((t: any) => t && typeof t.title === 'string')
        .map((t: any) => ({
          id: String(t.id || newId()),
          emoji: String(t.emoji || '⭐'),
          title: t.title,
          list: lists.some((l) => l.id === t.list) ? t.list : lists[0].id,
        }))
    : DEFAULT_TASKS.map(([l, e, t]) => mkTask(e, t, lists[l].id))
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
  const list = lists.some((l) => l.id === p?.list) ? p.list : lists[0].id
  const server = typeof p?.server === 'string' && p.server ? p.server : DEFAULT_SERVER
  return rollover({ tasks, kids, lists, list, active, day: String(p?.day), server }, day)
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
/** Tasks of the list currently shown. */
export const listTasks = (s: State) => s.tasks.filter((t) => t.list === s.list)
export const doneCount = (s: State, k: Kid) => listTasks(s).filter((t) => isDone(k, t.id)).length
export const allDone = (s: State, k: Kid) => listTasks(s).length > 0 && doneCount(s, k) === listTasks(s).length

export const addTask = (s: State, emoji: string, title: string): State =>
  title.trim() ? { ...s, tasks: [...s.tasks, mkTask(emoji, title.trim(), s.list)] } : s

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

export const setList = (s: State, id: string): State => (s.lists.some((l) => l.id === id) ? { ...s, list: id } : s)

export function addList(s: State, name: string): State {
  if (!name.trim()) return s
  const l = mkList(name.trim())
  return { ...s, lists: [...s.lists, l], list: l.id }
}

export const renameList = (s: State, id: string, name: string): State =>
  name.trim() ? { ...s, lists: s.lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)) } : s

/** Always keep at least one list; its tasks (and their ticks) go with it. */
export function removeList(s: State, id: string): State {
  if (s.lists.length <= 1) return s
  const gone = new Set(s.tasks.filter((t) => t.list === id).map((t) => t.id))
  const lists = s.lists.filter((l) => l.id !== id)
  return {
    ...s,
    lists,
    list: s.list === id ? lists[0].id : s.list,
    tasks: s.tasks.filter((t) => t.list !== id),
    kids: s.kids.map((k) => ({ ...k, done: k.done.filter((d) => !gone.has(d)) })),
  }
}

export const setServer = (s: State, server: string): State => {
  const v = server.trim().replace(/\/+$/, '')
  return v ? { ...s, server: /^https?:\/\//.test(v) ? v : 'http://' + v } : s
}

export const resetTicks = (s: State): State => ({ ...s, kids: s.kids.map((k) => ({ ...k, done: [] })) })
