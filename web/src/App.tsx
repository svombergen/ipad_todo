import { useEffect, useRef, useState } from 'react'
import {
  State, activeKid, addKid, addTask, allDone, dayKey, doneCount, isDone, load,
  removeKid, removeTask, renameKid, resetStars, rollover, toggle,
} from './tasks'

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
  const holdTimer = useRef<number>()
  const pressedWhileEditing = useRef(false)

  useEffect(() => persist(s), [s])

  // Kiosk runs overnight: clear ticks at midnight.
  useEffect(() => {
    const t = setInterval(() => setS((s) => rollover(s, dayKey())), 30_000)
    return () => clearInterval(t)
  }, [])

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

  const done = doneCount(s, kid)
  const pct = s.tasks.length ? (done / s.tasks.length) * 100 : 0

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
        {/* One button: hold 🔒 to open, tap ✅ to close. The release after the hold must not count as a tap on ✅. */}
        <button
          className={editing ? 'pill' : 'lock' + (holding ? ' holding' : '')}
          aria-label={editing ? 'Klaar' : 'Oudermodus (vasthouden)'}
          onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
          onClick={() => { if (pressedWhileEditing.current) { setEditing(false); setPick(null); setS(resetStars(s)) } }} // scores reset after every parent visit
        >{editing ? '✅ Klaar' : '🔒'}</button>
      </header>

      <div className="progress"><div style={{ width: pct + '%' }} /><span>{done} / {s.tasks.length}</span></div>

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
            <button className="pill warn" type="button" onClick={() => confirm('Alle sterren op 0 zetten?') && setS(resetStars(s))}>⭐ op 0</button>
          </form>
          {pick === 'avatar' && (
            <div className="emojis">
              {AVATARS.map((a) => (
                <button key={a} className={a === avatar ? 'on' : ''} onClick={() => { setAvatar(a); setPick(null) }}>{a}</button>
              ))}
            </div>
          )}
          <p className="hint">Tik op een kind om de naam te wijzigen.</p>
        </div>
      )}

      <main>
        {s.tasks.map((t) => (
          <button key={t.id} className={'card' + (isDone(kid, t.id) ? ' done' : '')} onClick={() => tap(t.id)}>
            <span className="emoji">{t.emoji}</span>
            <span className="title">{t.title}</span>
            {isDone(kid, t.id) && <span className="check">✅</span>}
            {editing && (
              <span className="del" role="button" aria-label={t.title + ' verwijderen'} onClick={(e) => { e.stopPropagation(); setS(removeTask(s, t.id)) }}>✖</span>
            )}
          </button>
        ))}
        {!s.tasks.length && <p className="empty">Nog geen taken. Houd 🔒 ingedrukt om taken toe te voegen!</p>}
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
