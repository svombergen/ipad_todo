import { useEffect, useRef, useState } from 'react'
import {
  Cat, PERIOD_LABEL, Period, State, addEntry, byDay, clock, entryName, filename, fmtTotal, fmtValue, inPeriod,
  load, newId, nextColor, removeCat, removeEntry, saveCat, setServer, toHtml, toJson, toTxt, optText,
} from './log'
import { ITEM_ICONS, Icon } from './icons'
import Chart from './Chart'

declare const __BUILD__: string
const w = window as any
const KEY = 'dagboek'
const PERIODS: Period[] = ['today', 'week', 'all']
type Draft = { id: string; name: string; icon: string; color: string; unit: string; opts: { id: string; label: string; value: string }[] }
const draftOf = (c?: Cat, color = ''): Draft =>
  c
    ? { ...c, opts: c.opts.map((o) => ({ id: o.id, label: o.label, value: o.value != null ? String(o.value) : '' })) }
    : { id: '', name: '', icon: 'star', color, unit: '', opts: [] }

// Native app injects saved state (window.__SAVED__) and stores via message handler; browser dev falls back to localStorage.
function persist(s: State) {
  const json = JSON.stringify(s)
  const h = w.webkit?.messageHandlers?.save
  h ? h.postMessage(json) : localStorage.setItem(KEY, json)
}

/** Native: share sheet (save to Files, Mail, AirDrop…); `html` becomes a PDF. Browser dev: plain download. */
function share(name: string, text: string, html?: string) {
  const h = w.webkit?.messageHandlers?.share
  if (h) return h.postMessage(html ? { name, html } : { name, text })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([html ?? text]))
  a.download = html ? name.replace(/\.pdf$/, '.html') : name
  a.click()
}

export default function App() {
  const [s, setS] = useState(() => load(w.__SAVED__ ?? localStorage.getItem(KEY)))
  const [tab, setTab] = useState<'log' | 'overview' | 'cats'>('log')
  const [open, setOpen] = useState<Cat | null>(null) // category whose options are showing
  const [other, setOther] = useState(false)
  const [amount, setAmount] = useState('')
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null)
  const [mode, setMode] = useState<'chart' | 'list'>('chart')
  const [period, setPeriod] = useState<Period>('week')
  const [form, setForm] = useState<Draft | null>(null)
  const [pickIcon, setPickIcon] = useState(false)
  const [newBuild, setNewBuild] = useState(false)
  const toastTimer = useRef<number>()

  useEffect(() => persist(s), [s])

  // Ask the ship.ps1 server (same wifi) for a newer build on launch and whenever the app comes back to the foreground.
  useEffect(() => {
    const check = () =>
      fetch(s.server + '/diary/version.json?t=' + Date.now(), { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => setNewBuild(Number(j.build) > Number(__BUILD__)))
        .catch(() => {}) // server off / other wifi: stay quiet
    const onShow = () => document.visibilityState === 'visible' && check()
    check()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [s.server])

  const record = (c: Cat, label = '', value?: number) => {
    const [next, e] = addEntry(s, c, label, value)
    setS(next)
    setOpen(null)
    setOther(false)
    setAmount('')
    setToast({ id: e.id, text: [entryName(e), fmtValue(e), clock(e.ts)].filter(Boolean).join(' · ') })
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 6000)
  }
  const undo = () => { if (toast) { setS(removeEntry(s, toast.id)); setToast(null) } }
  // Shortest route: a category without options or unit saves on the first tap, otherwise it shows its options.
  const tapCat = (c: Cat) => (c.opts.length || c.unit ? (setOpen(c), setOther(false), setAmount('')) : record(c))

  const submitForm = () => {
    if (!form || !form.name.trim()) return
    const unit = form.unit.trim()
    const opts = form.opts
      .map((o) => ({ id: o.id, label: o.label.trim(), value: Number(o.value.replace(',', '.')) }))
      .filter((o) => (unit ? o.label || o.value > 0 : o.label))
      .map((o) => ({ id: o.id, label: o.label, ...(unit && o.value > 0 ? { value: o.value } : {}) }))
    setS(saveCat(s, { id: form.id || newId(), name: form.name.trim(), icon: form.icon, color: form.color, unit, opts }))
    setForm(null)
  }
  const editOpt = (i: number, patch: Partial<Draft['opts'][0]>) =>
    form && setForm({ ...form, opts: form.opts.map((o, j) => (j === i ? { ...o, ...patch } : o)) })

  const shown = inPeriod(s.entries, period)
  const exportAs = (kind: 'pdf' | 'txt' | 'json') => {
    const now = Date.now()
    if (kind === 'pdf') share(filename('pdf', now), '', toHtml(shown, period, now))
    else if (kind === 'txt') share(filename('txt', now), toTxt(shown, period, now))
    else share(filename('json', now), toJson(shown, period, now))
  }

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  const style = (c: string) => ({ ['--c' as any]: c })

  return (
    <div className="app">
      <header>
        <h1>{{ log: 'Registreren', overview: 'Overzicht', cats: 'Lijsten' }[tab]}</h1>
        <div className="date">{today}</div>
      </header>

      <main>
        {tab === 'log' && !open && (
          <>
            {!s.cats.length && <p className="empty">Nog geen categorieën. Maak ze aan onder <b>Lijsten</b>.</p>}
            <div className="grid">
              {s.cats.map((c) => (
                <button key={c.id} className="big" style={style(c.color)} onClick={() => tapCat(c)}>
                  <Icon name={c.icon} size={64} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'log' && open && (
          <>
            <button className="chip back" onClick={() => setOpen(null)}><Icon name="back" size={20} /> Terug</button>
            <h2 className="cathead" style={style(open.color)}><Icon name={open.icon} size={36} /> {open.name}</h2>
            <div className="grid">
              {open.opts.map((o) => (
                <button key={o.id} className="big opt" style={style(open.color)} onClick={() => record(open, o.label, o.value)}>
                  {o.label && <span>{o.label}</span>}
                  {o.value != null && <b>{o.value} <small>{open.unit}</small></b>}
                </button>
              ))}
              {open.unit && (
                <button className="big opt ghost" style={style(open.color)} onClick={() => setOther(true)}>
                  <b>Anders…</b>
                </button>
              )}
            </div>
            {other && (
              <form className="inline other" onSubmit={(e) => { e.preventDefault(); const v = Number(amount.replace(',', '.')); if (v > 0) record(open, '', v) }}>
                <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Aantal ${open.unit}`} />
                <button className="primary" type="submit">Opslaan</button>
              </form>
            )}
          </>
        )}

        {tab === 'overview' && (
          <>
            <div className="bar">
              {(['chart', 'list'] as const).map((m) => (
                <button key={m} className={'chip' + (m === mode ? ' on' : '')} onClick={() => setMode(m)}>{{ chart: 'Grafiek', list: 'Lijst' }[m]}</button>
              ))}
              <span className="sep" />
              {PERIODS.map((p) => (
                <button key={p} className={'chip' + (p === period ? ' on' : '')} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>
              ))}
            </div>

            {mode === 'chart' && <Chart key={period} es={shown} />}

            {mode === 'list' && (
              <>
                <div className="bar">
                  {(['pdf', 'txt', 'json'] as const).map((k) => (
                    <button key={k} className="chip export" disabled={!shown.length} onClick={() => exportAs(k)}>
                      <Icon name="up" size={18} /> {{ pdf: 'PDF', txt: 'Tekst', json: 'JSON' }[k]}
                    </button>
                  ))}
                  <span className="hint">Opslaan of mailen via het deelmenu</span>
                </div>
                {!shown.length && <p className="empty">Niets geregistreerd in deze periode.</p>}
                {byDay(shown).map((d) => (
                  <section key={d.day} className="day">
                    <h2>{new Date(d.ts).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                    <div className="totals">{d.totals.map(fmtTotal).join('  ·  ')}</div>
                    {d.entries.map((e) => (
                      <div key={e.id} className="row">
                        <span className="time">{clock(e.ts)}</span>
                        <span className="dotc" style={{ background: e.color }} />
                        <span className="grow">{entryName(e)}</span>
                        <b>{fmtValue(e)}</b>
                        <button className="x" aria-label="Verwijderen" onClick={() => confirm(`${entryName(e)} van ${clock(e.ts)} verwijderen?`) && setS(removeEntry(s, e.id))}>
                          <Icon name="close" size={22} />
                        </button>
                      </div>
                    ))}
                  </section>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'cats' && (
          <>
            {s.cats.map((c) => (
              <button key={c.id} className="row item" onClick={() => { setForm(draftOf(c)); setPickIcon(false) }}>
                <span className="ico" style={{ color: c.color }}><Icon name={c.icon} size={34} /></span>
                <span className="grow">{c.name}<small>{c.opts.length ? c.opts.map((o) => optText(c.unit, o)).join(' · ') : c.unit ? c.unit : 'één tik'}</small></span>
              </button>
            ))}
            <button className="primary wide" onClick={() => { setForm(draftOf(undefined, nextColor(s.cats))); setPickIcon(false) }}><Icon name="plus" size={26} /> Nieuwe categorie</button>

            <div className="update-box">
              {newBuild ? (
                <button className="primary wide" onClick={() => { location.href = 'apple-magnifier://install?url=' + s.server + '/diary/Diary.ipa' }}>
                  <Icon name="up" size={24} /> Nieuwe versie installeren
                </button>
              ) : (
                <span className="hint">Versie {__BUILD__} · up-to-date</span>
              )}
              <button className="link" onClick={() => { const v = prompt('Adres van de update-server:', s.server); v && setS(setServer(s, v)) }}>Update-server</button>
            </div>
          </>
        )}
      </main>

      <nav className="tabs">
        {([['log', 'plus', 'Registreer'], ['overview', 'chart', 'Overzicht'], ['cats', 'sliders', 'Lijsten']] as const).map(([k, ic, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setOpen(null) }}>
            <span className="tabicon"><Icon name={ic} size={30} />{k === 'cats' && newBuild && <i className="badge" />}</span>
            {label}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast">
          <Icon name="check" size={24} /> <span>{toast.text}</span>
          <button onClick={undo}>Ongedaan</button>
        </div>
      )}

      {form && (
        <div className="backdrop" onClick={() => setForm(null)}>
          <form className="sheet form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submitForm() }}>
            <h2>{form.id ? 'Categorie wijzigen' : 'Nieuwe categorie'}</h2>
            <label>Naam<input value={form.name} maxLength={20} placeholder="bijv. Drinken" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Eenheid <small>(leeg = geen hoeveelheid)</small><input value={form.unit} maxLength={8} placeholder="bijv. ml" onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
            <button type="button" className="chip icon-btn" onClick={() => setPickIcon(!pickIcon)}>
              <Icon name={form.icon} size={28} /> Icoon <Icon name="down" size={18} />
            </button>
            {pickIcon && (
              <div className="icons">
                {ITEM_ICONS.map((n) => (
                  <button key={n} type="button" className={n === form.icon ? 'on' : ''} onClick={() => { setForm({ ...form, icon: n }); setPickIcon(false) }}><Icon name={n} size={30} /></button>
                ))}
              </div>
            )}
            <div className="optlist">
              <b>Opties</b>
              {form.opts.map((o, i) => (
                <div key={o.id} className="inline">
                  <input value={o.label} maxLength={24} placeholder="Naam (optioneel)" onChange={(e) => editOpt(i, { label: e.target.value })} />
                  {form.unit.trim() && (
                    <input className="num" inputMode="decimal" value={o.value} placeholder={form.unit.trim()} onChange={(e) => editOpt(i, { value: e.target.value })} />
                  )}
                  <button type="button" className="x" aria-label="Optie verwijderen" onClick={() => setForm({ ...form, opts: form.opts.filter((_, j) => j !== i) })}><Icon name="close" size={22} /></button>
                </div>
              ))}
              <button type="button" className="chip" onClick={() => setForm({ ...form, opts: [...form.opts, { id: newId(), label: '', value: '' }] })}><Icon name="plus" size={18} /> Optie</button>
            </div>
            <div className="inline">
              <button className="primary" type="submit" disabled={!form.name.trim()}>Opslaan</button>
              {form.id && (
                <button className="danger" type="button" onClick={() => { if (confirm(form.name + ' verwijderen? Eerdere registraties blijven bewaard.')) { setS(removeCat(s, form.id)); setForm(null) } }}>Verwijder</button>
              )}
              <button className="link" type="button" onClick={() => setForm(null)}>Annuleer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
