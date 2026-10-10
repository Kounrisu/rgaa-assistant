export interface Thumb {
  png: Uint8Array
  width: number
  height: number
}

const MAX = 64

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = window.setTimeout(() => reject(new Error('timeout')), 6000)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('load failed'))
    }
    img.src = src
  })
}

/**
 * Resizes an image (URL or data: URL) to a small PNG for the Excel export.
 * The bytes are fetched first (the extension has host access) and shown from a blob URL,
 * so the canvas is never tainted by a cross-origin image.
 */
export async function makeThumb(source: string): Promise<Thumb | null> {
  let objectUrl: string | null = null
  try {
    let src = source
    if (!source.startsWith('data:image/svg')) {
      const response = await fetch(source)
      if (!response.ok) return null
      objectUrl = URL.createObjectURL(await response.blob())
      src = objectUrl
    }
    const img = await loadImage(src)
    const naturalW = img.naturalWidth || MAX
    const naturalH = img.naturalHeight || MAX
    const scale = Math.min(1, MAX / Math.max(naturalW, naturalH))
    const width = Math.max(1, Math.round(naturalW * scale))
    const height = Math.max(1, Math.round(naturalH * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return null
    return { png: new Uint8Array(await blob.arrayBuffer()), width, height }
  } catch {
    return null
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

/** Thumbnails for many images, a few at a time. Missing ones are simply left out. */
export async function makeThumbs(items: { id: number; source: string | null }[]): Promise<Map<number, Thumb>> {
  const result = new Map<number, Thumb>()
  const queue = items.filter((i): i is { id: number; source: string } => Boolean(i.source))
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const thumb = await makeThumb(item.source)
      if (thumb) result.set(item.id, thumb)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return result
}
