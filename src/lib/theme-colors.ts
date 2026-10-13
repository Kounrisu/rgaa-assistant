/**
 * One highlight colour per RGAA theme, used for the boxes on the page and for the panel.
 * Kept tiny and dependency-free: the content script imports it too.
 */
export const THEME_COLOR: Record<number, string> = {
  1: '#e11d48', // Images — rose
  2: '#2563eb', // Frames — blue
  3: '#7c3aed', // Colours — violet
  4: '#0e7490', // Multimedia — cyan
  5: '#15803d', // Tables — green
  6: '#c2410c', // Links — orange
  7: '#db2777', // Scripts — pink
  8: '#4b5563', // Mandatory elements — slate
  9: '#0f766e', // Structure — teal
  10: '#a16207', // Presentation — amber
  11: '#4f46e5', // Forms — indigo
  12: '#4d7c0f', // Navigation — lime
  13: '#9333ea', // Consultation — purple
}

export const colorOf = (theme: number): string => THEME_COLOR[theme] ?? THEME_COLOR[1]

/** "#e11d48" → "rgba(225, 29, 72, 0.12)" */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
