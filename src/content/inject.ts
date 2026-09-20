import type { ImageElementInfo } from '../lib/types'

const OVERLAY_ID = 'rgaa-assistant-overlay'

function clearOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove()
}

function nearbyTextFor(img: HTMLImageElement): string | null {
  const figcaption = img.closest('figure')?.querySelector('figcaption')
  if (figcaption?.textContent?.trim()) return figcaption.textContent.trim()

  const describedBy = img.getAttribute('aria-describedby')
  if (describedBy) {
    const text = describedBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }

  const parentText = img.parentElement?.textContent?.trim()
  return parentText ? parentText.slice(0, 200) : null
}

function altMatchesFilenamePattern(alt: string | null, src: string): boolean {
  if (!alt) return false
  const filename = src.split('/').pop()?.split('?')[0] ?? ''
  if (!filename) return false
  const normalizedAlt = alt.trim().toLowerCase()
  const normalizedFilename = filename.toLowerCase()
  return (
    normalizedAlt === normalizedFilename ||
    normalizedAlt === normalizedFilename.replace(/\.[a-z0-9]+$/, '') ||
    /\.(png|jpe?g|gif|svg|webp)$/i.test(normalizedAlt)
  )
}

function deterministicChecksFor(img: HTMLImageElement): Record<string, boolean> {
  const alt = img.getAttribute('alt')
  return {
    altMissing: alt === null,
    altEmpty: alt === '',
    altMatchesFilenamePattern: altMatchesFilenamePattern(alt, img.currentSrc || img.src),
    ariaHidden: img.getAttribute('aria-hidden') === 'true',
  }
}

function drawBox(container: HTMLElement, id: number, rect: DOMRect): void {
  const box = document.createElement('div')
  box.style.cssText = `
    position: absolute;
    left: ${rect.left + window.scrollX}px;
    top: ${rect.top + window.scrollY}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid #e11d48;
    box-sizing: border-box;
    pointer-events: none;
  `
  const label = document.createElement('span')
  label.textContent = String(id)
  label.style.cssText = `
    position: absolute;
    top: -1px;
    left: -1px;
    transform: translateY(-100%);
    background: #e11d48;
    color: #fff;
    font: bold 12px/1.4 sans-serif;
    padding: 1px 5px;
    border-radius: 2px 2px 0 0;
  `
  box.appendChild(label)
  container.appendChild(box)
}

function highlightImages(): ImageElementInfo[] {
  clearOverlay()

  const container = document.createElement('div')
  container.id = OVERLAY_ID
  container.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 2147483647; pointer-events: none;'
  document.body.appendChild(container)

  const images = Array.from(document.querySelectorAll<HTMLImageElement>('img'))
  const elements: ImageElementInfo[] = []

  images.forEach((img, index) => {
    const rect = img.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const id = index + 1
    drawBox(container, id, rect)

    elements.push({
      id,
      tag: 'img',
      alt: img.getAttribute('alt'),
      ariaLabel: img.getAttribute('aria-label'),
      nearbyText: nearbyTextFor(img),
      isInsideLink: img.closest('a') !== null,
      deterministic: deterministicChecksFor(img),
    })
  })

  return elements
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'RGAA_HIGHLIGHT_IMAGES') {
    sendResponse({ elements: highlightImages() })
    return true
  }
  if (message?.type === 'RGAA_CLEAR_HIGHLIGHTS') {
    clearOverlay()
    sendResponse({ ok: true })
    return true
  }
  return undefined
})
