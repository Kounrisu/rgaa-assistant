/** What the extension may navigate to or embed. Audit files can be edited by anyone: never trust their strings. */

/** An address the inspected tab may be sent to: http(s) or file. Never javascript:, data:, blob:, chrome:… */
export const isNavigableUrl = (url: unknown): url is string => typeof url === 'string' && /^(https?|file):\/\//i.test(url.trim())

/** A small image kept in an audit (a preview or a screenshot): only a base64 image data URL, nothing that loads from the network. */
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i
export const dataImage = (src: unknown): string | null => (typeof src === 'string' && src.length < 200_000 && DATA_IMAGE.test(src) ? src : null)

/** What to show as the preview of an image element: its picture of the page when it has one, else its thumbnail. */
export const previewOf = (el: { shot?: string | null; thumb: string | null }): string | null => dataImage(el.shot) ?? el.thumb
