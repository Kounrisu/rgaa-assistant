export interface ImageElementInfo {
  id: number
  tag: string
  alt: string | null
  ariaLabel: string | null
  nearbyText: string | null
  isInsideLink: boolean
  deterministic: Record<string, boolean>
}
