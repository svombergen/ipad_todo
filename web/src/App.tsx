import { useEffect, useRef, useState } from 'react'
import {
  State, activeKid, addKid, addList, addTask, allDone, dayKey, doneCount, isDone, listTasks, load,
  removeKid, removeList, removeTask, renameKid, renameList, resetStars, rollover, setList, setServer, toggle,
} from './tasks'

declare const __BUILD__: string
const w = window as any
const KEY = 'kids-todo'
const EMOJIS = ['⭐', '🦷', '🛏️', '👕', '🥣', '🎒', '📚', '🧸', '🛁', '🐶', '🐱', '🌱', '🎹', '⚽', '🎨', '🧹', '🍎', '💧', '🚽', '🧦', '🙏', '😴', '🍽️', '✏️']
const AVATARS = ['🦁', '🐼', '🦊', '🐸', '🐵', '🐯', '🐨', '🐰', '🦄', '🐶', '🐱', '🐻', '🐧', '🐙', '🦖', '🐝']
const CHEERS = ['🎉', '⭐', '🌟', '🎈', '🥳', '🏆', '💖', '🦄']

// Native app injects saved state (window.__SAVED__) and stores via message handler; browser dev falls back to localStorage.
function persist(s: State) {
  const json = JSON.stringify(s)
  const h = w.webkit?.messageHandlers?.save
  h ? h.postMessage(json) : localStorage.setItem(KEY, json)
}

export default function App() {
  const [s, setS] = useState(() => load(w.__SAVED__ ?? localStorage.getItem(KEY), dayKey()))
  const [editing, setEditing] = useState(false)
  const [party, setParty] = useState(false)
  const [holding, setHolding] = useState(false)
  const [pick, setPick] = useState<'emoji' | 'avatar' | null>(null) // which icon grid is open
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [kidName, setKidName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [newBuild, setNewBuild] = useState(false)
  const holdTimer = useRef<number>()
  const pressedWhileEditing = useRef(false)

  useEffect(() => persist(s), [s])

  // Kiosk runs overnight: clear ticks at midnight.
  useEffect(() => {
    const t = setInterval(() => setS((s) => rollover(s, dayKey())), 30_000)
    return () => clearInterval(t)
  }, [])

  // Ask the ship.ps1 server (same wifi) for a newer build on launch and whenever the app comes back to the foreground.
  useEffect(() => {
    const check = () =>
      fetch(s.server + '/version.json?t=' + Date.now(), { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => setNewBuild(Number(j.build) > Number(__BUILD__)))
        .catch(() => {}) // server off / other wifi: stay quiet
    const onShow = () => document.visibilityState === 'visible' && check()
    check()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [s.server])

  const kid = activeKid(s)

  const tap = (taskId: string) => {
    if (editing) return
    const next = toggle(s, kid.id, taskId)
    setS(next)
    if (allDone(next, activeKid(next))) setParty(true)
  }

  const tapKid = (id: string, name: string) => {
    if (!editing) return setS({ ...s, active: id })
    const n = prompt('Nieuwe naam:', name)
    if (n) setS(renameKid(s, id, n.slice(0, 12)))
  }

  // Parent mode: hold the lock 2 s so kids don't wander in.
  const holdStart = () => {
    pressedWhileEditing.current = editing
    if (editing) return
    setHolding(true)
    holdTimer.current = window.setTimeout(() => { setHolding(false); setEditing(true) }, 2000)
  }
  const holdEnd = () => { setHolding(false); clearTimeout(holdTimer.current) }

  const tasks = listTasks(s)
  const done = doneCount(s, kid)
  const pct = tasks.length ? (done / tasks.length) * 100 : 0

  return (
    <div className="app">
      <header>
        <div className="hello">
          <h1>Hoi {kid.name}! ☀️</h1>
          <div className="date">{new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <nav className="kids">
          {s.kids.map((k) => (
            <button key={k.id} className={'kid' + (k.id === kid.id ? ' on' : '')} onClick={() => tapKid(k.id, k.name)}>
              <span className="avatar">{k.avatar}</span>
              <span className="name">{k.name}</span>
              <span className="kstars">⭐ {k.stars}</span>
              {editing && s.kids.length > 1 && (
                <span className="del" role="button" aria-label={k.name + ' verwijderen'}
                  onClick={(e) => { e.stopPropagation(); confirm(k.name + ' verwijderen?') && setS(removeKid(s, k.id)) }}>✖</span>
              )}
            </button>
          ))}
        </nav>
        {newBuild && (
          <button className="update" onClick={() => { location.href = 'apple-magnifier://install?url=' + s.server + '/KidsTodo.ipa' }}>⬆️ Update</button>
        )}
        {/* One button: hold 🔒 to open, tap ✅ to close. The release after the hold must not count as a tap on ✅. */}
        <button
          className={editing ? 'pill' : 'lock' + (holding ? ' holding' : '')}
          aria-label={editing ? 'Klaar' : 'Oudermodus (vasthouden)'}
          onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
          onClick={() => { if (pressedWhileEditing.current) { setEditing(false); setPick(null); setS(resetStars(s)) } }} // scores reset after every parent visit
        >{editing ? '✅ Klaar' : '🔒'}</button>
      </header>

      <nav className="lists">
        {s.lists.map((l) => (
          <button key={l.id} className={'list' + (l.id === s.list ? ' on' : '')}
            onClick={() => {
              if (editing && l.id === s.list) { const n = prompt('Nieuwe naam:', l.name); n && setS(renameList(s, l.id, n.slice(0, 14))) }
              else setS(setList(s, l.id))
            }}>
            {l.name}
            {editing && s.lists.length > 1 && (
              <span className="del" role="button" aria-label={l.name + ' verwijderen'}
                onClick={(e) => { e.stopPropagation(); confirm(l.name + ' en alle taken erin verwijderen?') && setS(removeList(s, l.id)) }}>✖</span>
            )}
          </button>
        ))}
        {editing && <button className="list add" onClick={() => { const n = prompt('Naam nieuwe lijst:'); n && setS(addList(s, n.slice(0, 14))) }}>➕ Lijst</button>}
      </nav>

      <div className="progress"><div style={{ width: pct + '%' }} /><span>{done} / {tasks.length}</span></div>

      {editing && (
        <div className="editor">
          <form className="row" onSubmit={(e) => { e.preventDefault(); setS(addTask(s, emoji, title)); setTitle('') }}>
            <button className="pill" type="button" onClick={() => setPick(pick === 'emoji' ? null : 'emoji')}>{emoji} ▾</button>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nieuwe taak…" maxLength={30} />
            <button className="pill" type="submit">➕ Taak</button>
          </form>
          {pick === 'emoji' && (
            <div className="emojis">
              {EMOJIS.map((e) => (
                <button key={e} className={e === emoji ? 'on' : ''} onClick={() => { setEmoji(e); setPick(null) }}>{e}</button>
              ))}
            </div>
          )}
          <form className="row" onSubmit={(e) => { e.preventDefault(); setS(addKid(s, avatar, kidName)); setKidName('') }}>
            <button className="pill" type="button" onClick={() => setPick(pick === 'avatar' ? null : 'avatar')}>{avatar} ▾</button>
            <input value={kidName} onChange={(e) => setKidName(e.target.value)} placeholder="Naam kind…" maxLength={12} />
            <button className="pill" type="submit">➕ Kind</button>
            <button className="pill" type="button" onClick={() => { const v = prompt('Adres van de update-server:', s.server); v && setS(setServer(s, v)) }}>🔄 Server</button>
            <button className="pill warn" type="button" onClick={() => confirm('Alle sterren op 0 zetten?') && setS(resetStars(s))}>⭐ op 0</button>
          </form>
          {pick === 'avatar' && (
            <div className="emojis">
              {AVATARS.map((a) => (
                <button key={a} className={a === avatar ? 'on' : ''} onClick={() => { setAvatar(a); setPick(null) }}>{a}</button>
              ))}
            </div>
          )}
          <p className="hint">Tik op een kind of de gekozen lijst om de naam te wijzigen. Nieuwe taken komen in de gekozen lijst. Versie {__BUILD__}.</p>
        </div>
      )}

      <main>
        {tasks.map((t) => (
          <button key={t.id} className={'card' + (isDone(kid, t.id) ? ' done' : '')} onClick={() => tap(t.id)}>
            <span className="emoji">{t.emoji}</span>
            <span className="title">{t.title}</span>
            {isDone(kid, t.id) && <span className="check">✅</span>}
            {editing && (
              <span className="del" role="button" aria-label={t.title + ' verwijderen'} onClick={(e) => { e.stopPropagation(); setS(removeTask(s, t.id)) }}>✖</span>
            )}
          </button>
        ))}
        {!tasks.length && <p className="empty">Nog geen taken. Houd 🔒 ingedrukt om taken toe te voegen!</p>}
      </main>

      {party && (
        <div className="party" onClick={() => setParty(false)}>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="fall" style={{ left: ((i * 4.1) % 100) + '%', animationDelay: (i % 8) * 0.25 + 's' }}>{CHEERS[i % CHEERS.length]}</span>
          ))}
          <div className="banner">{kid.avatar}🏆<br />Alles klaar,<br />{kid.name}!<br /><small>Tik om te sluiten</small></div>
        </div>
      )}
    </div>
  )
}
