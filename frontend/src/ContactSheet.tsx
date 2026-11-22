import type { LossRow } from './api'

export type Frame = { step: number; url: string }

// har 10 iterations ka ek frame, contact sheet ki tarah
export function ContactSheet({ frames, total, done }: { frames: Frame[]; total: number; done: boolean }) {
  if (!frames.length) {
    return <p className="side-empty">Frames appear here while the print develops, one every 10 iterations.</p>
  }
  const last = frames.length - 1
  return (
    <ol className="sheet">
      {frames.map((f, i) => (
        <li key={f.step} className={'frame' + (done && i === last ? ' is-final' : '')}>
          <img src={f.url} alt={`Iteration ${f.step} of ${total}`} />
          <span className="frame-no num">{String(f.step).padStart(3, '0')}</span>
          {done && i === last && (
            <svg className="grease" viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true">
              <path d="M16 16c24-10 66-12 88-2 12 6 10 42 0 50-18 12-72 12-92 2C2 60 6 24 20 12c6-4 12-5 18-6" />
            </svg>
          )}
        </li>
      ))}
    </ol>
  )
}

// total loss ki line, aur aakhri values neeche
export function LossChart({ history }: { history: LossRow[] }) {
  if (history.length < 2) {
    return <p className="side-empty">The loss curve draws itself once the optimiser starts.</p>
  }
  const w = 280
  const h = 96
  const maxStep = history[history.length - 1].step
  const values = history.map((r) => r.total)
  const top = Math.max(...values)
  const bottom = Math.min(...values)
  const span = top - bottom || 1
  const pts = history
    .map((r) => `${((r.step - 1) / Math.max(1, maxStep - 1)) * w},${h - 6 - ((r.total - bottom) / span) * (h - 12)}`)
    .join(' ')
  const lastRow = history[history.length - 1]

  return (
    <figure className="loss">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Total loss fell from ${values[0].toFixed(3)} to ${lastRow.total.toFixed(3)}`}>
        <line x1="0" y1={h - 1} x2={w} y2={h - 1} className="loss-axis" />
        <polyline points={pts} className="loss-line" />
      </svg>
      <dl className="loss-rows">
        <div>
          <dt>Style</dt>
          <dd className="num">{lastRow.style.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Colour</dt>
          <dd className="num">{lastRow.colour.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Content</dt>
          <dd className="num">{lastRow.content.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd className="num">{lastRow.total.toFixed(3)}</dd>
        </div>
      </dl>
    </figure>
  )
}
