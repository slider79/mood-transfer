import { useRef, useState, type CSSProperties, type ReactNode } from 'react'

export type ViewMode = 'graded' | 'baseline' | 'original' | 'split'

type Props = {
  aspect: number | null
  originalUrl: string | null
  gradedUrl: string | null
  baselineUrl: string | null
  developingUrl: string | null
  strength: number
  mode: ViewMode
  overlay?: ReactNode
  empty?: ReactNode
}

export default function Print(props: Props) {
  const { aspect, originalUrl, gradedUrl, baselineUrl, developingUrl, strength, mode, overlay, empty } = props
  const [split, setSplit] = useState(0.5)
  const dragging = useRef(false)
  const plate = useRef<HTMLDivElement>(null)

  const moveSplit = (clientX: number) => {
    const rect = plate.current?.getBoundingClientRect()
    if (!rect) return
    setSplit(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)))
  }

  const top = developingUrl ?? (mode === 'baseline' ? baselineUrl : mode === 'original' ? null : gradedUrl)
  const topOpacity = developingUrl ? 1 : strength

  return (
    <div className="print-mat">
      <div className="print-box">
        {!aspect || !originalUrl ? (
          <div className="print-empty">{empty}</div>
        ) : (
          <div
            className="plate"
            ref={plate}
            style={{ '--aspect': aspect } as CSSProperties}
            onPointerMove={(e) => dragging.current && moveSplit(e.clientX)}
            onPointerUp={() => (dragging.current = false)}
            onPointerLeave={() => (dragging.current = false)}
          >
            <img src={originalUrl} alt="Original content photo" draggable={false} />
            {top && (
              <img
                src={top}
                alt={developingUrl ? 'Print developing' : mode === 'baseline' ? 'Reinhard baseline' : 'Graded print'}
                draggable={false}
                style={{
                  opacity: topOpacity,
                  clipPath: mode === 'split' && !developingUrl ? `inset(0 ${(1 - split) * 100}% 0 0)` : undefined,
                }}
              />
            )}
            {mode === 'split' && !developingUrl && gradedUrl && (
              <div
                className="split-handle"
                style={{ left: `${split * 100}%` }}
                role="slider"
                tabIndex={0}
                aria-label="Split position, graded on the left, original on the right"
                aria-valuenow={Math.round(split * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                onPointerDown={(e) => {
                  dragging.current = true
                  e.currentTarget.setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => dragging.current && moveSplit(e.clientX)}
                onPointerUp={() => (dragging.current = false)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - 0.05))
                  if (e.key === 'ArrowRight') setSplit((s) => Math.min(1, s + 0.05))
                }}
              >
                <span className="split-tag split-left">Graded</span>
                <span className="split-tag split-right">Original</span>
              </div>
            )}
            {overlay}
          </div>
        )}
      </div>
    </div>
  )
}
