import { useRef, useState } from 'react'
import { UploadIcon } from './Icons'
import { useObjectUrl } from './useJob'

type Props = {
  label: string
  hint: string
  file: File | null
  onFile: (f: File) => void
  disabled?: boolean
}

function prettySize(bytes: number) {
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return Math.round(bytes / 1e3) + ' KB'
}

// ek "negative" slot: click karo ya file gira do
export default function Slot({ label, hint, file, onFile, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [bad, setBad] = useState(false)
  const url = useObjectUrl(file)

  const take = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setBad(true)
      return
    }
    setBad(false)
    onFile(f)
  }

  return (
    <div className="slot">
      <div className="slot-head">
        <span className="slot-label">{label}</span>
        {file && (
          <button className="link-btn" disabled={disabled} onClick={() => input.current?.click()}>
            Replace
          </button>
        )}
      </div>
      <button
        className={'slot-drop' + (over ? ' is-over' : '') + (file ? ' has-file' : '')}
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!disabled) take(e.dataTransfer.files[0])
        }}
      >
        {url ? (
          <img src={url} alt={`${label} photo`} />
        ) : (
          <span className="slot-empty">
            <UploadIcon />
            <span>{hint}</span>
          </span>
        )}
      </button>
      {file && (
        <p className="slot-meta">
          <span className="slot-name">{file.name}</span>
          <span className="num">{prettySize(file.size)}</span>
        </p>
      )}
      {bad && <p className="slot-error">That file is not an image. Try a JPG or PNG.</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          take(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
