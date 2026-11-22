// backend se baat cheet yahan hoti hai

export type LossRow = { step: number; style: number; content: number; colour: number; total: number }

export type Job = {
  id: string
  status: 'queued' | 'running' | 'grading' | 'done' | 'failed' | 'cancelled'
  step: number
  total: number
  losses: LossRow | null
  history: LossRow[]
  elapsed: number
  eta: number | null
  error: string | null
  moodId: string | null
  contentName: string
  moodName: string
  previewVersion: number
  size: [number, number] | null
}

export type Mood = {
  id: string
  code: string
  name: string
  createdAt: number
  swatch: string[]
  lutSize: number
  fromJob: string
  lut?: number[]
}

async function check<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Server said ${res.status}`
    try {
      const body = await res.json()
      if (body.detail) msg = body.detail
    } catch {
      // body json nahi tha, koi baat nahi
    }
    throw new Error(msg)
  }
  return res.json()
}

export async function startJob(content: File, mood: File, iterations: number, lightGrid: number) {
  const form = new FormData()
  form.append('content', content)
  form.append('mood', mood)
  form.append('iterations', String(iterations))
  form.append('lightGrid', String(lightGrid))
  return check<Job>(await fetch('/api/jobs', { method: 'POST', body: form }))
}

export async function getJob(id: string) {
  return check<Job>(await fetch(`/api/jobs/${id}`))
}

export async function cancelJob(id: string) {
  return check<Job>(await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' }))
}

export async function listMoods() {
  return check<Mood[]>(await fetch('/api/moods'))
}

export async function getMood(id: string) {
  return check<Mood>(await fetch(`/api/moods/${id}`))
}

export async function applyMood(id: string, image: File) {
  const form = new FormData()
  form.append('image', image)
  const res = await fetch(`/api/moods/${id}/apply`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Could not apply this mood (${res.status})`)
  return res.blob()
}

export const jobFile = (id: string, name: string) => `/api/jobs/${id}/${name}`
export const moodFile = (id: string, name: string) => `/api/moods/${id}/${name}`
