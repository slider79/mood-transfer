const steps = [0, 0.25, 0.5, 0.75, 1]

type Props = {
  originalUrl: string | null
  gradedUrl: string | null
  strength: number
  onChange: (s: number) => void
}

// darkroom wali test strip: ek hi print, paanch exposure bands
export default function TestStrip({ originalUrl, gradedUrl, strength, onChange }: Props) {
  const ready = Boolean(originalUrl && gradedUrl)
  const picked = steps.findIndex((s) => Math.abs(s - strength) < 0.001)

  return (
    <section className="strip" aria-label="Mood strength">
      <div className="strip-head">
        <h2>Strength test strip</h2>
        <span className="num strip-value">{Math.round(strength * 100)}%</span>
      </div>
      <div className="strip-bands" role="radiogroup" aria-label="Pick a strength band">
        {steps.map((s, i) => (
          <button
            key={s}
            role="radio"
            aria-checked={picked === i}
            className={'band' + (picked === i ? ' is-picked' : '')}
            disabled={!ready}
            onClick={() => onChange(s)}
            style={{ backgroundPositionX: `${i * 25}%`, backgroundImage: ready ? `url(${originalUrl})` : undefined }}
          >
            {ready && (
              <span
                className="band-graded"
                style={{ backgroundPositionX: `${i * 25}%`, backgroundImage: `url(${gradedUrl})`, opacity: s }}
              />
            )}
            <span className="band-label num">{s * 100}</span>
            {ready && picked === i && (
              <svg className="grease" viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true">
                <path d="M14 18c22-12 70-14 92-4 12 6 10 40 2 50-16 14-74 14-94 4C2 62 4 28 18 14c4-4 10-6 16-7" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <label className="strip-fine">
        <span>Fine</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={!ready}
          value={Math.round(strength * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label="Mood strength in percent"
        />
      </label>
    </section>
  )
}
