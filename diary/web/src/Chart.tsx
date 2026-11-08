import { useState } from 'react'
import { Bar, Entry, View, autoView, bars, isMl, niceScale } from './log'
import { Icon } from './icons'

const W = 1000, H = 420, L = 74, R = 16, T = 26, B = 52

const title = (v: View) =>
  v.level === 'hour'
    ? new Date(v.anchor!).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
    : v.level === 'day' && v.anchor != null
      ? new Date(v.anchor).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
      : v.level === 'day' ? 'Per dag' : 'Per maand'

/** Stacked bars (one color per category) of the ml amounts. Starts at a sensible zoom, tap a bar to drill down. */
export default function Chart({ es }: { es: Entry[] }) {
  const [stack, setStack] = useState<View[]>([]) // drilled views on top of the automatic one
  const ml = es.filter(isMl)
  if (!ml.length) return <p className="empty">Geen hoeveelheden (ml) in deze periode.</p>

  const view = stack[stack.length - 1] ?? autoView(ml)
  const bs = bars(ml, view)
  const legend = [...new Map(ml.map((e) => [e.catId, { name: e.cat, color: e.color }])).entries()]
  const { max, step } = niceScale(Math.max(...bs.map((b) => b.total)))
  const pw = W - L - R, ph = H - T - B, slot = pw / bs.length, bw = Math.min(slot * 0.72, 90)
  const y = (v: number) => T + ph - (v / max) * ph
  const every = Math.ceil(bs.length / 12) // label every n-th bar so they never overlap
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v)
  const drill = (b: Bar) =>
    b.total > 0 && view.level !== 'hour' && setStack([...stack, { level: view.level === 'month' ? 'day' : 'hour', anchor: b.from }])

  return (
    <div className="chart">
      <div className="crumb">
        {stack.length > 0 && (
          <button className="chip" onClick={() => setStack(stack.slice(0, -1))}><Icon name="back" size={18} /> Terug</button>
        )}
        <b>{title(view)}</b>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chartsvg">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e5e7eb" />
            <text x={L - 10} y={y(v) + 7} textAnchor="end">{v}</text>
          </g>
        ))}
        <text x={L - 10} y={16} textAnchor="end" className="unit">ml</text>
        {bs.map((b, i) => {
          const x = L + slot * i + (slot - bw) / 2
          let acc = 0
          return (
            <g key={b.from}>
              {legend.map(([id, c]) => {
                const v = b.sums[id]
                if (!v) return null
                const top = y(acc + v), h = y(acc) - top
                acc += v
                return <rect key={id} x={x} y={top} width={bw} height={h} fill={c.color} rx={2} />
              })}
              {bs.length <= 16 && b.total > 0 && <text x={x + bw / 2} y={y(b.total) - 8} textAnchor="middle" className="val">{Math.round(b.total)}</text>}
              {i % every === 0 && <text x={x + bw / 2} y={H - B + 30} textAnchor="middle">{view.level === 'hour' ? b.label + 'u' : b.label}</text>}
              <rect x={L + slot * i} y={T} width={slot} height={ph} fill="transparent" onClick={() => drill(b)} />
            </g>
          )
        })}
      </svg>
      <div className="legend">
        {legend.map(([id, c]) => <span key={id}><i style={{ background: c.color }} />{c.name}</span>)}
      </div>
      {view.level !== 'hour' && <p className="hint">Tik op een balk om in te zoomen.</p>}
    </div>
  )
}
