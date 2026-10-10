/**
 * Colour picker: a screenshot of the page under a magnifier that follows the cursor. Imported by the content script
 * only (inlined in its bundle).
 */
import { OVERLAY_ID } from './dom-utils'

/* Colour picker: a screenshot of the page under a magnifier that follows the cursor and shows the colour's hex. */
let pickLayer: HTMLElement | null = null
let pickDone: ((r: Record<string, unknown>) => void) | null = null
let pickToken = 0

const overlayRoots = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`[id^="${OVERLAY_ID}"]`)).filter((el) => el.id !== `${OVERLAY_ID}-pick`)
const setOverlaysHidden = (hidden: boolean): void => overlayRoots().forEach((el) => (el.style.visibility = hidden ? 'hidden' : ''))

export function endPick(result: Record<string, unknown>): void {
  pickToken++
  window.removeEventListener('keydown', onPickKey, true)
  pickLayer?.remove()
  pickLayer = null
  setOverlaysHidden(false)
  pickDone?.(result)
  pickDone = null
}

function onPickKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.preventDefault()
  e.stopPropagation()
  endPick({ cancelled: true })
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

export async function startPick(respond: (r: Record<string, unknown>) => void): Promise<void> {
  endPick({ cancelled: true })
  pickDone = respond
  const token = ++pickToken
  // the boxes and tints would change the colours under the cursor: photograph the page without them
  setOverlaysHidden(true)
  await nextFrame()
  await nextFrame()
  const cap = await chrome.runtime.sendMessage({ type: 'RGAA_CAPTURE' }).catch(() => null)
  if (token !== pickToken) return
  if (!cap?.dataUrl) return endPick({ error: cap?.error ?? 'no screenshot' })
  const img = new Image()
  await new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = cap.dataUrl
  })
  if (token !== pickToken) return
  if (!img.naturalWidth) return endPick({ error: 'bad screenshot' })

  const k = img.naturalWidth / window.innerWidth
  const N = 15 // pixels of the page shown in the magnifier
  const Z = 9 // magnification
  const SIZE = N * Z
  const layer = document.createElement('div')
  layer.id = `${OVERLAY_ID}-pick`
  layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:transparent;'
  const loupe = document.createElement('div')
  loupe.style.cssText = `position:fixed;left:0;top:0;width:${SIZE}px;pointer-events:none;border:2px solid #fff;border-radius:6px;box-shadow:0 0 0 1px #000,0 4px 14px rgba(0,0,0,.45);background:#fff;overflow:hidden;font:600 13px/1.2 ui-monospace,monospace;display:none;`
  const view = document.createElement('canvas')
  view.width = view.height = SIZE
  view.style.cssText = `display:block;width:${SIZE}px;height:${SIZE}px;image-rendering:pixelated;`
  const ring = document.createElement('div')
  ring.style.cssText = `position:absolute;left:${Math.floor(N / 2) * Z}px;top:${Math.floor(N / 2) * Z}px;width:${Z}px;height:${Z}px;box-sizing:border-box;border:1px solid #000;outline:1px solid #fff;`
  const label = document.createElement('div')
  label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 7px;color:#111;background:#fff;'
  const chip = document.createElement('span')
  chip.style.cssText = 'width:14px;height:14px;border:1px solid #000;flex:none;'
  const text = document.createElement('span')
  label.append(chip, text)
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:relative;'
  wrap.append(view, ring)
  loupe.append(wrap, label)

  const sample = document.createElement('canvas')
  sample.width = sample.height = N
  const sctx = sample.getContext('2d', { willReadFrequently: true })!
  const vctx = view.getContext('2d')!
  vctx.imageSmoothingEnabled = false
  let current = ''
  const read = (x: number, y: number): string => {
    const half = Math.floor(N / 2)
    sctx.clearRect(0, 0, N, N)
    sctx.drawImage(img, Math.round(x * k) - half, Math.round(y * k) - half, N, N, 0, 0, N, N)
    vctx.clearRect(0, 0, SIZE, SIZE)
    vctx.drawImage(sample, 0, 0, SIZE, SIZE)
    const [r, g, b] = sctx.getImageData(half, half, 1, 1).data
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
  }
  const move = (e: MouseEvent) => {
    current = read(e.clientX, e.clientY)
    chip.style.background = current
    text.textContent = current
    loupe.style.display = ''
    const w = SIZE + 4
    const hgt = SIZE + 40
    loupe.style.left = `${e.clientX + 24 + w > window.innerWidth ? e.clientX - 24 - w : e.clientX + 24}px`
    loupe.style.top = `${e.clientY + 24 + hgt > window.innerHeight ? e.clientY - 24 - hgt : e.clientY + 24}px`
  }
  layer.addEventListener('mousemove', move, true)
  layer.addEventListener(
    'click',
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      endPick({ hex: read(e.clientX, e.clientY) })
    },
    true,
  )
  layer.append(loupe)
  document.documentElement.appendChild(layer)
  pickLayer = layer
  window.addEventListener('keydown', onPickKey, true)
}
