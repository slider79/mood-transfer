import { useEffect, useState } from 'react'
import { applyMood, listMoods, moodFile, type Mood } from './api'
import { saveBlob } from './download'
import { DownloadIcon, ExposeIcon } from './Icons'
import Slot from './Slot'
import { useObjectUrl } from './useJob'

// saved moods: kisi bhi nayi photo pe dobara laga do, optimisation ke baghair
export default function LibraryView({ refreshKey }: { refreshKey: number }) {
  const [moods, setMoods] = useState<Mood[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Mood | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const photoUrl = useObjectUrl(photo)
  const resultUrl = useObjectUrl(result)

  useEffect(() => {
    listMoods()
      .then((m) => {
        setMoods(m)
        setLoadError(null)
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load the library.'))
  }, [refreshKey])

  const apply = async () => {
    if (!picked || !photo) return
    setBusy(true)
    setApplyError(null)
    try {
      setResult(await applyMood(picked.id, photo))
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Could not apply the mood.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="library">
      <section className="lib-grid-wrap" aria-label="Saved moods">
        <h2 className="col-title">Saved moods</h2>
        {loadError && <p className="error">{loadError} Is the backend running on port 8000?</p>}
        {moods && moods.length === 0 && (
          <p className="side-empty">No moods yet. Every finished print saves its mood here, so you can reuse it on other photos in about a second.</p>
        )}
        <ul className="lib-grid">
          {moods?.map((m) => (
            <li key={m.id}>
              <button
                className={'lib-cell' + (picked?.id === m.id ? ' is-picked' : '')}
                aria-pressed={picked?.id === m.id}
                onClick={() => {
                  setPicked(m)
                  setResult(null)
                }}
              >
                <img src={moodFile(m.id, 'mood.jpg')} alt="" />
                <span className="lib-swatch" aria-hidden="true">
                  {m.swatch.map((c) => (
                    <span key={c} style={{ background: c }} />
                  ))}
                </span>
                <span className="lib-code num">{m.code}</span>
                <span className="lib-name">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="lib-apply" aria-label="Apply a saved mood">
        <h2 className="col-title">{picked ? `Print with ${picked.code}` : 'Pick a mood'}</h2>
        {!picked ? (
          <p className="side-empty">Choose a saved mood on the left, then load any photo to print it in that mood.</p>
        ) : (
          <>
            <Slot label="Photo" hint="Drop a photo to print in this mood" file={photo} onFile={(f) => { setPhoto(f); setResult(null) }} disabled={busy} />
            <button className="expose" disabled={!photo || busy} onClick={apply}>
              <ExposeIcon /> {busy ? 'Printing' : 'Print with this mood'}
            </button>
            {applyError && <p className="error" role="alert">{applyError}</p>}
            <a className="dl" href={moodFile(picked.id, 'lut.cube')} download>
              <DownloadIcon size={16} />
              <span>Mood LUT</span>
              <small>.cube, colour grade only</small>
            </a>
          </>
        )}
      </section>

      <section className="lib-result" aria-label="Result">
        {resultUrl ? (
          <>
            <div className="lib-pair">
              <figure>
                <img src={photoUrl ?? ''} alt="Your photo before" />
                <figcaption>Before</figcaption>
              </figure>
              <figure>
                <img src={resultUrl} alt={`Your photo in mood ${picked?.code}`} />
                <figcaption>After, {picked?.code}</figcaption>
              </figure>
            </div>
            <button className="ghost-btn" onClick={() => result && saveBlob(result, `${picked?.code}_${photo?.name.replace(/\.[^.]+$/, '')}.png`)}>
              <DownloadIcon size={16} /> Save print
            </button>
          </>
        ) : (
          <div className="print-mat lib-mat">
            <div className="print-empty">
              <p className="empty-title">Nothing printed yet</p>
              <p>Saved moods are applied straight from the learned LUT and light grid, no VGG-19 run needed.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
