// file save karwane ka chota sa jugaar
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// strength 100% se kam ho to original aur graded ko canvas pe mix karo, full size pe
export async function savePrintAtStrength(original: File, resultUrl: string, strength: number, name: string) {
  const resultBlob = await fetch(resultUrl).then((r) => {
    if (!r.ok) throw new Error('Could not fetch the full size print.')
    return r.blob()
  })
  if (strength >= 0.999) {
    saveBlob(resultBlob, name)
    return
  }
  const graded = await createImageBitmap(resultBlob)
  const base = await createImageBitmap(original, { imageOrientation: 'from-image' })
  const canvas = document.createElement('canvas')
  canvas.width = graded.width
  canvas.height = graded.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.drawImage(base, 0, 0, graded.width, graded.height)
  ctx.globalAlpha = strength
  ctx.drawImage(graded, 0, 0)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not encode the print.')
  saveBlob(blob, name)
}
