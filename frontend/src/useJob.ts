import { useEffect, useRef, useState } from 'react'
import { getJob, type Job } from './api'

const finished = new Set(['done', 'failed', 'cancelled'])

// job ko har second poll karo jab tak khatam na ho jaye
export function useJob(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setJob(null)
    setError(null)
    if (!jobId) return
    let alive = true

    const tick = async () => {
      try {
        const next = await getJob(jobId)
        if (!alive) return
        setError(null)
        setJob(next)
        if (!finished.has(next.status)) timer.current = window.setTimeout(tick, 900)
      } catch (e) {
        if (!alive) return
        const msg = e instanceof Error ? e.message : 'Lost contact with the server.'
        // server restart ho gaya to job memory se ud gayi, retry ka koi faida nahi
        if (msg === 'No such job.') {
          setError(null)
          setJob((prev) => ({
            ...(prev ?? { id: jobId, step: 0, total: 0, losses: null, history: [], elapsed: 0, eta: null, moodId: null, contentName: '', moodName: '', previewVersion: 0, size: null }),
            status: 'failed',
            error: 'This run was lost because the server restarted.',
          }))
          return
        }
        setError(msg)
        timer.current = window.setTimeout(tick, 2500)
      }
    }
    tick()
    return () => {
      alive = false
      window.clearTimeout(timer.current)
    }
  }, [jobId])

  return { job, error }
}

// file ka preview url, aur purana url free karna mat bhoolo
export function useObjectUrl(file: File | Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}
