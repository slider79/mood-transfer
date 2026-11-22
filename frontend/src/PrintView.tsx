import { useEffect, useRef, useState } from 'react'
import { cancelJob, jobFile, startJob } from './api'
import { ContactSheet, LossChart, type Frame } from './ContactSheet'
import { savePrintAtStrength } from './download'
import { DownloadIcon, ExposeIcon, StopIcon, SwapIcon } from './Icons'
import Print, { type ViewMode } from './Print'
import { sampleFile, sampleUrl, samples } from './samples'
import Slot from './Slot'
import TestStrip from './TestStrip'
import { useJob, useObjectUrl } from './useJob'

const qualities = [
  { value: 60, label: 'Quick, 60 steps, 20 to 45 s' },
  { value: 120, label: 'Standard, 120 steps, 40 to 90 s' },
  { value: 200, label: 'Fine, 200 steps, 70 to 150 s' },
]

const modes: { value: ViewMode; label: string }[] = [
  { value: 'graded', label: 'Graded' },
  { value: 'baseline', label: 'Reinhard baseline' },
  { value: 'original', label: 'Original' },
  { value: 'split', label: 'Split' },
]

const stem = (name: string) => name.replace(/\.[^.]+$/, '')

export default function PrintView({ onSaved }: { onSaved: () => void }) {
  const [content, setContent] = useState<File | null>(null)
  const [moodPhoto, setMoodPhoto] = useState<File | null>(null)
  const [iterations, setIterations] = useState(120)
  const [lightGrid, setLightGrid] = useState(true)
  const [jobId, setJobId] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [frames, setFrames] = useState<Frame[]>([])
  const [strength, setStrength] = useState(1)
  const [mode, setMode] = useState<ViewMode>('graded')
  const [localAspect, setLocalAspect] = useState<number | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingSample, setLoadingSample] = useState<string | null>(null)
  const { job, error: pollError } = useJob(jobId)
  const contentUrl = useObjectUrl(content)
  const framesRef = useRef<Frame[]>([])

  const running = job ? ['queued', 'running', 'grading'].includes(job.status) : Boolean(jobId)
  const done = job?.status === 'done'

  // content ka aspect pata karo taake print sahi shape mein bane
  useEffect(() => {
    if (!contentUrl) return setLocalAspect(null)
    const img = new Image()
    img.onload = () => setLocalAspect(img.naturalWidth / img.naturalHeight)
    img.src = contentUrl
  }, [contentUrl])

  // naya preview aaya to contact sheet mein frame daal do
  useEffect(() => {
    if (!job || !job.previewVersion) return
    let alive = true
    fetch(`${jobFile(job.id, 'preview.jpg')}?v=${job.previewVersion}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!alive || !b) return
        const step = job.previewVersion * 10
        if (framesRef.current.some((f) => f.step === step)) return
        const next = [...framesRef.current, { step: Math.min(step, job.total), url: URL.createObjectURL(b) }]
        framesRef.current = next
        setFrames(next)
      })
    return () => {
      alive = false
    }
  }, [job?.previewVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done) onSaved()
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearFrames = () => {
    framesRef.current.forEach((f) => URL.revokeObjectURL(f.url))
    framesRef.current = []
    setFrames([])
  }

  const pickContent = (f: File) => {
    setContent(f)
    setJobId(null)
    clearFrames()
  }
  const pickMood = (f: File) => {
    setMoodPhoto(f)
    setJobId(null)
    clearFrames()
  }

  const loadSample = async (id: string) => {
    const s = samples.find((x) => x.id === id)
    if (!s) return
    setLoadingSample(id)
    setStartError(null)
    try {
      const [c, m] = await Promise.all([sampleFile(s.content), sampleFile(s.mood)])
      setContent(c)
      setMoodPhoto(m)
      setJobId(null)
      clearFrames()
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not load the sample.')
    } finally {
      setLoadingSample(null)
    }
  }

  const expose = async () => {
    if (!content || !moodPhoto) return
    setStartError(null)
    clearFrames()
    setStrength(1)
    setMode('graded')
    try {
      const j = await startJob(content, moodPhoto, iterations, lightGrid ? 8 : 0)
      setJobId(j.id)
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not reach the server.')
    }
  }

  const stop = async () => {
    if (jobId) await cancelJob(jobId).catch(() => undefined)
  }

  const savePrint = async () => {
    if (!job || !content) return
    setSaving('print')
    try {
      await savePrintAtStrength(content, jobFile(job.id, 'result.png'), strength, `${stem(content.name)}_mood_${Math.round(strength * 100)}.png`)
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not save the print.')
    } finally {
      setSaving(null)
    }
  }

  const aspect = job?.size ? job.size[0] / job.size[1] : localAspect
  const originalUrl = done && job ? jobFile(job.id, 'content.jpg') : contentUrl
  const gradedUrl = done && job ? jobFile(job.id, 'result.jpg') : null
  const baselineUrl = done && job ? jobFile(job.id, 'baseline.jpg') : null
  const developingUrl = running && frames.length ? frames[frames.length - 1].url : null
  const failed = job?.status === 'failed'
  const problem = startError || (failed ? job?.error || 'The run failed.' : null)

  let status = ''
  if (job?.status === 'queued') status = 'Waiting for the enlarger'
  else if (job?.status === 'running') status = job.step ? `Developing ${job.step}/${job.total}` : 'Loading VGG-19'
  else if (job?.status === 'grading') status = 'Printing full size'
  else if (job?.status === 'cancelled') status = 'Stopped'

  return (
    <div className="print-view">
      <aside className="col col-left" aria-label="Negatives and settings">
        <h2 className="col-heading">Negatives</h2>
        <div className="samples">
          <p className="samples-label">Try a sample pair</p>
          <div className="samples-row">
            {samples.map((s) => (
              <button key={s.id} className="sample" disabled={running || loadingSample !== null} onClick={() => loadSample(s.id)} aria-label={`Load sample pair: ${s.label}`} title={s.label}>
                <img src={sampleUrl(s.content)} alt="" />
                <img src={sampleUrl(s.mood)} alt="" />
              </button>
            ))}
          </div>
        </div>
        <Slot label="Content photo" tag="NEG 01 / content" hint="Click or drop the photo to re-grade" file={content} onFile={pickContent} disabled={running} />
        <button
          className="swap-btn"
          disabled={running || !content || !moodPhoto}
          onClick={() => {
            const c = content
            setContent(moodPhoto)
            setMoodPhoto(c)
            setJobId(null)
            clearFrames()
          }}
        >
          <SwapIcon size={16} /> Swap photos
        </button>
        <Slot label="Mood photo" tag="NEG 02 / mood" hint="Click or drop the photo whose look you want" file={moodPhoto} onFile={pickMood} disabled={running} />

        <div className="settings">
          <label className="field">
            <span>Quality</span>
            <select value={iterations} disabled={running} onChange={(e) => setIterations(Number(e.target.value))}>
              {qualities.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={lightGrid} disabled={running} onChange={(e) => setLightGrid(e.target.checked)} />
            <span>
              Light falloff grid
              <small>Lets the grade add vignettes and glows.</small>
            </span>
          </label>
        </div>

        {running ? (
          <div className="expose-row">
            <div className="expose is-running" aria-live="polite">
              <span className="safelight-dot" aria-hidden="true" />
              {status}
            </div>
            <button className="ghost-btn" onClick={stop} aria-label="Stop the run">
              <StopIcon size={16} /> Stop
            </button>
          </div>
        ) : (
          <button className="expose" disabled={!content || !moodPhoto} onClick={expose}>
            <ExposeIcon /> Expose
          </button>
        )}
        {!content || !moodPhoto ? <p className="hint">Load both photos to expose a print.</p> : null}
        {problem && (
          <p className="error" role="alert">
            {problem} Check the photos and press Expose to try again.
          </p>
        )}
        {pollError && running && <p className="error">{pollError} Retrying.</p>}
      </aside>

      <main className="col col-centre">
        <div className="print-bar">
          <div className="segmented" role="radiogroup" aria-label="What the print shows">
            {modes.map((m) => (
              <button key={m.value} role="radio" aria-checked={mode === m.value} className={mode === m.value ? 'is-on' : ''} disabled={!done} onClick={() => setMode(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
          {job?.size && (
            <span className="print-meta num">
              {job.size[0]} x {job.size[1]}
              {done ? ` · ${job.elapsed.toFixed(0)} s` : job.eta ? ` · ${Math.ceil(job.eta)} s left` : ''}
            </span>
          )}
        </div>
        <Print
          aspect={aspect}
          originalUrl={originalUrl}
          gradedUrl={gradedUrl}
          baselineUrl={baselineUrl}
          developingUrl={developingUrl}
          strength={mode === 'original' ? 0 : strength}
          mode={mode}
          overlay={running ? <span className="plate-tag">{status}</span> : null}
          empty={
            <>
              <p className="empty-title">No print yet</p>
              <p>Load a content photo and a mood photo on the left, then press Expose. The mood is learned at low resolution and printed on your full size photo.</p>
            </>
          }
        />
        <TestStrip originalUrl={originalUrl} gradedUrl={gradedUrl} strength={strength} onChange={setStrength} />
      </main>

      <aside className="col col-right" aria-label="Contact sheet, loss and downloads">
        <section>
          <h2 className="col-title">Contact sheet</h2>
          <ContactSheet frames={frames} total={job?.total ?? iterations} done={done} />
        </section>
        <section>
          <h2 className="col-title">Loss</h2>
          <LossChart history={job?.history ?? []} />
        </section>
        <section>
          <h2 className="col-title">Downloads</h2>
          <div className="downloads">
            <button className="dl" disabled={!done || saving !== null} onClick={savePrint}>
              <DownloadIcon size={16} />
              <span>{saving === 'print' ? 'Preparing print' : `Print at ${Math.round(strength * 100)}%`}</span>
              <small>PNG, full size</small>
            </button>
            <a className={'dl' + (done ? '' : ' is-off')} href={done && job ? jobFile(job.id, 'lut.cube') : undefined} download aria-disabled={!done}>
              <DownloadIcon size={16} />
              <span>Mood LUT</span>
              <small>.cube, works in Photoshop, Premiere, DaVinci</small>
            </a>
            <a className={'dl' + (done ? '' : ' is-off')} href={done && job ? jobFile(job.id, 'baseline.png') : undefined} download aria-disabled={!done}>
              <DownloadIcon size={16} />
              <span>Reinhard baseline</span>
              <small>PNG, for comparison</small>
            </a>
          </div>
        </section>
      </aside>
    </div>
  )
}
