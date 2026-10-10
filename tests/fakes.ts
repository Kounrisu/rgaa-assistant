import { createPage, emptyAudit } from '../src/lib/audit-store'
import type { Audit } from '../src/lib/types'

/** A fake chrome.storage.local: async like the real one, with a delay and failures that tests can switch on. */
export class FakeStorage {
  data: Record<string, unknown> = {}
  failSet = false
  failGet = false
  /** Milliseconds each call takes (to make concurrent calls overlap). */
  latency = 0
  sets = 0

  private wait = () => (this.latency ? new Promise<void>((resolve) => setTimeout(resolve, this.latency)) : Promise.resolve())

  async get(key: string): Promise<Record<string, unknown>> {
    await this.wait()
    if (this.failGet) throw new Error('storage read failed')
    return key in this.data ? { [key]: structuredClone(this.data[key]) } : {}
  }
  async set(values: Record<string, unknown>): Promise<void> {
    await this.wait()
    if (this.failSet) throw new Error('QUOTA_BYTES quota exceeded')
    this.sets++
    for (const [k, v] of Object.entries(values)) this.data[k] = structuredClone(v)
  }
  async remove(keys: string[]): Promise<void> {
    await this.wait()
    for (const k of keys) delete this.data[k]
  }
}

export function installChrome(storage: FakeStorage, extra: Record<string, unknown> = {}): void {
  ;(globalThis as unknown as { chrome: unknown }).chrome = { storage: { local: storage }, ...extra }
}

/** A complete valid audit with one page, one image, one answer, one finding, one checklist answer. */
export function sampleAudit(name = 'Sample'): Audit {
  const audit = emptyAudit(name)
  audit.meta.site = 'example.org'
  const page = createPage(audit, 'https://example.org/', 'Home')
  page.items.push({
    id: 1, key: 'img-1', present: true, scan: 1, tag: 'img', type: 'img', src: 'https://example.org/a.png', thumb: null, alt: 'A', ariaLabel: null,
    labelledByText: null, title: null, svgTitle: null, accessibleName: 'A', ignoredBy: null, role: null, ariaHidden: false, inDialog: false,
    nearbyText: null, isInsideLink: false, linkHref: null, linkText: null, figcaption: null, naturalWidth: 10, naturalHeight: 10,
    html: '<img alt="A">', contextHtml: '<img alt="A">', deterministic: { a: true },
  })
  page.reviews['img-1'] = { kind: 'informative', answers: { '1.1': 'c', '1.2': 'na' }, note: 'ok' }
  page.checklist['2.1'] = { verdict: 'nc', note: 'x', autoResults: { axe: { result: 'fail', rules: ['frame-title'] } } }
  page.findings.push({ type: 'iframe', id: 1, label: 'iframe', summary: 's', facts: { src: null }, html: '', contextHtml: '', count: 1, data: {}, theme: 2, key: 'f-1', present: true, scan: 1 })
  page.manualChecks = { keyboard: { state: 'ok', note: '' } }
  audit.current = page.id
  return audit
}

/** Resolves later, when the test says so. */
export function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
