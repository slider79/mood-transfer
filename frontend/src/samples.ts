// demo ke liye teen ready made pairs, sab CC0 (credits public/samples/CREDITS.md mein)
export type Sample = { id: string; label: string; content: string; mood: string }

export const samples: Sample[] = [
  { id: 'window', label: 'Window tabby, sunrise clouds', content: 'window-tabby.jpg', mood: 'sunrise-clouds.jpg' },
  { id: 'aurora', label: 'Cat portrait, magenta aurora', content: 'cat-portrait.jpg', mood: 'magenta-aurora.jpg' },
  { id: 'bluehour', label: 'Garden tabby, blue hour', content: 'garden-tabby.jpg', mood: 'blue-hour.jpg' },
]

export const sampleUrl = (name: string) => `/samples/${name}`

export async function sampleFile(name: string) {
  const res = await fetch(sampleUrl(name))
  if (!res.ok) throw new Error(`Sample ${name} is missing.`)
  const blob = await res.blob()
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}
