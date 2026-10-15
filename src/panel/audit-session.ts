/**
 * The audit that is open in the panel and everything that touches its storage: the save state machine
 * (revisions, retry), and the lifecycle of audits (open, new, duplicate, rename, delete, import, export).
 * Extracted from panel.ts; the panel passes in what it owns (the current audit, the dialogs, the redraw callbacks).
 */
import { auditFromFile, auditToFile, checkImportSize, copyOf, emptyAudit, listAudits, loadActiveAudit, loadAuditById, setActiveId, AuditFormatError } from '../lib/audit-store'
import { t } from '../lib/i18n'
import type { DeleteMessage, SaveMessage, SaveResponse } from '../lib/messages'
import { createPersistence } from '../lib/persistence'
import { SnapshotError } from '../lib/snapshot'
import type { Audit, AuditSummary } from '../lib/types'

export type SaveState = 'saved' | 'saving' | 'error'

/** How a save or a delete reaches the persistence authority (the background page in the extension). */
export interface Transport {
  save(audit: Audit, revision: number): Promise<SaveResponse>
  remove(id: string): Promise<SaveResponse>
}

/** Messages to the background page; in a plain page (no extension runtime) a local queue plays that part. */
export function createTransport(): Transport {
  const viaRuntime = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id) && typeof chrome.runtime.sendMessage === 'function'
  const local = createPersistence()
  const send = async (message: SaveMessage | DeleteMessage): Promise<SaveResponse> => {
    try {
      const response = (await chrome.runtime.sendMessage(message)) as SaveResponse | undefined
      if (response && typeof response.ok === 'boolean') return response
      return { ok: false, code: 'unreachable', error: 'no answer from the background page' }
    } catch (err) {
      return { ok: false, code: 'unreachable', error: err instanceof Error ? err.message : String(err) }
    }
  }
  return {
    save: (audit, revision) => (viaRuntime ? send({ type: 'RGAA_SAVE', audit, revision }) : local.save({ audit, revision })),
    remove: (id) => (viaRuntime ? send({ type: 'RGAA_DELETE', id }) : local.remove({ id })),
  }
}

export interface Choice {
  id: string
  label: string
  primary?: boolean
}

/** What the panel provides. */
export interface SessionDeps {
  getAudit(): Audit
  setAudit(audit: Audit): void
  /** The audit was replaced: reset what belongs to the old one (boxes, selection, current page…) and redraw. */
  onActivated(): void
  /** The save state changed: redraw the audit bar. */
  onState(): void
  /** The list of audits changed: redraw it if it is shown. */
  onListChanged(): void
  say(message: string): void
  askText(title: string, label: string, initial?: string, okLabel?: string): Promise<string | null>
  askConfirm(title: string, text: string, okLabel?: string): Promise<boolean>
  /** Buttons to choose from; null when the dialog is dismissed. */
  askChoice(title: string, text: string, choices: Choice[]): Promise<string | null>
  /** Gives the user a file (the panel's download helper). */
  download(text: string, mime: string, fileName: string): void
  fileNameOf(audit: Audit): string
  transport?: Transport
  /** Debounce before a change is written (ms). */
  delayMs?: number
}

const clone = <T>(value: T): T => (typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T))
const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** A short, translated sentence for an error raised while reading an audit (file or storage). */
export function describeAuditError(err: unknown): string {
  if (err instanceof SnapshotError) return t('The audit contains a page snapshot that is too large ({where}).', { where: err.code })
  if (!(err instanceof AuditFormatError)) return t('Could not read the audit: {error}', { error: message(err) })
  const where = err.path || '—'
  switch (err.code) {
    case 'not-json':
      return t('This file is not valid JSON.')
    case 'not-audit':
      return t('This file is not an RGAA Assistant audit.')
    case 'unsupported-version':
      return t('This audit was saved in a format ({version}) that this version of RGAA Assistant cannot read. Update the extension.', { version: err.detail || '?' })
    case 'too-large':
      return err.path ? t('The audit contains a page snapshot that is too large ({where}).', { where }) : t('This file is too large to import.')
    case 'storage-corrupt':
      return t('A saved audit in the browser cannot be read ({where}). It was left untouched.', { where })
    default:
      return t('This file is damaged or incomplete ({where}).', { where })
  }
}

export function createAuditSession(deps: SessionDeps) {
  const transport = deps.transport ?? createTransport()
  const delay = deps.delayMs ?? 400
  const write = async (audit: Audit, revision: number): Promise<SaveResponse> => {
    const result = await transport.save(audit, revision)
    if (result.ok && result.storageToken) audit.storageToken = result.storageToken
    return result
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let state: SaveState = 'saved'
  let savedAt = 0
  let lastError = ''
  let conflict = false
  /** Edit counter of the open audit; savedRevision is the last one the authority confirmed. */
  let revision = 0
  let savedRevision = 0
  let flight: Promise<boolean> | null = null
  /** The saved audit could not be read: the open one is a placeholder and must never be written. */
  let blocked = false

  const setState = (next: SaveState): void => {
    state = next
    deps.onState()
  }
  const clearTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const unsaved = (): boolean => !blocked && (savedRevision < revision || flight !== null)

  function resetCounters(): void {
    clearTimer()
    revision = 0
    savedRevision = 0
    lastError = ''
    conflict = false
    state = 'saved'
    savedAt = deps.getAudit().updatedAt
  }

  /** The open audit changed: write it soon. */
  function markDirty(): void {
    if (blocked) {
      setState('error')
      return
    }
    revision++
    setState('saving')
    clearTimer()
    timer = setTimeout(() => void saveNow(), delay)
  }

  async function runSaves(): Promise<boolean> {
    // Loop: an edit made while a write is in flight leaves savedRevision behind, so another write follows at once.
    while (savedRevision < revision) {
      const rev = revision
      const snapshot = clone(deps.getAudit())
      let result: SaveResponse
      try {
        result = await write(snapshot, rev)
      } catch (err) {
        result = { ok: false, code: 'unreachable', error: message(err) }
      }
      if (!result.ok) {
        conflict = result.code === 'conflict'
        lastError = conflict ? t('This audit was changed or deleted in another panel. Save your changes as a copy or reload the saved audit.') : result.error
        setState('error')
        return false
      }
      if (result.storageToken) deps.getAudit().storageToken = result.storageToken
      conflict = false
      savedRevision = Math.max(savedRevision, rev)
      savedAt = Date.now()
    }
    lastError = ''
    setState('saved')
    return true
  }

  /** Writes the open audit now. Resolves true when everything up to the latest edit is stored. */
  function saveNow(): Promise<boolean> {
    clearTimer()
    if (blocked) return Promise.resolve(false)
    if (!flight) {
      state = savedRevision < revision ? 'saving' : state
      flight = runSaves().finally(() => {
        flight = null
      })
    }
    return flight
  }

  /** Writes only if something is waiting (panel hidden or closed, list of audits opened). */
  const flush = async (): Promise<boolean> => (unsaved() ? saveNow() : true)

  function downloadAudit(audit: Audit): string {
    const file = deps.fileNameOf(audit)
    deps.download(auditToFile(audit), 'application/json', file)
    return file
  }

  /**
   * Makes sure the open audit is stored before it is left. When the write fails the user chooses: retry, save to a file,
   * discard (explicitly) or stay. Resolves false to stay on the audit.
   */
  async function settle(): Promise<boolean> {
    if (!unsaved()) return true
    for (;;) {
      if (await saveNow()) return true
      if (conflict) return resolveConflict()
      const choice = await deps.askChoice(
        t('Your changes could not be saved'),
        t('The browser storage refused the last changes ({error}). Retry, save the audit to a file, or discard these changes.', { error: lastError || '—' }),
        [
          { id: 'retry', label: t('Retry'), primary: true },
          { id: 'file', label: t('Save to a file') },
          { id: 'discard', label: t('Discard changes') },
          { id: 'stay', label: t('Stay on this audit') },
        ],
      )
      if (choice === 'retry') continue
      if (choice === 'file') {
        downloadAudit(deps.getAudit())
        return true
      }
      if (choice === 'discard') return true
      return false
    }
  }

  /** Puts `next` in the panel (it is already stored). */
  async function switchTo(next: Audit): Promise<void> {
    deps.setAudit(next)
    blocked = false
    resetCounters()
    await setActiveId(next.id).catch(() => undefined)
    deps.onActivated()
    deps.onState()
  }

  /** The saved audit cannot be read: show an empty placeholder that is never written, and say why. */
  function enterBlocked(error: unknown): void {
    deps.setAudit(emptyAudit(t('Untitled audit')))
    blocked = true
    clearTimer()
    revision = 0
    savedRevision = 0
    lastError = describeAuditError(error)
    state = 'error'
    deps.onActivated()
    deps.onState()
    deps.say(lastError)
  }

  /** At start: the last audit used. A failed read is reported and nothing is created over the real audit. */
  async function loadInitial(): Promise<boolean> {
    const result = await loadActiveAudit(t('Untitled audit'), async (audit) => {
      const response = await write(audit, 0)
      if (!response.ok) throw new Error(response.error)
    })
    if (result.status === 'failed') {
      enterBlocked(result.error)
      return false
    }
    deps.setAudit(result.audit)
    blocked = false
    resetCounters()
    if (result.created && !result.saved) markDirty()
    deps.onState()
    return true
  }

  async function activate(next: Audit): Promise<boolean> {
    if (!(await settle())) return false
    await switchTo(next)
    return true
  }

  /** A stored audit by id, or an explained failure. */
  async function fetchAudit(id: string): Promise<Audit | null> {
    const result = await loadAuditById(id)
    if (result.status === 'found') return result.audit
    deps.say(result.status === 'absent' ? t('This audit no longer exists.') : describeAuditError(result.error))
    if (result.status === 'absent') deps.onListChanged()
    return null
  }

  const failedWrite = (response: SaveResponse): void => deps.say(t('Could not save the audit: {error}', { error: response.ok ? '' : response.error }))

  async function newAudit(): Promise<boolean> {
    const name = await deps.askText(t('New audit'), t('Name of the audit'), '', t('Create'))
    if (name === null) return false
    if (!(await settle())) return false
    const fresh = emptyAudit(name)
    const response = await write(fresh, 0)
    if (!response.ok) {
      deps.say(t('Could not create the audit: browser storage is full or unavailable.'))
      return false
    }
    await switchTo(fresh)
    deps.say(t('Audit “{name}” created. Add the first page of your sample to start.', { name }))
    return true
  }

  async function openAuditById(id: string): Promise<boolean> {
    if (id === deps.getAudit().id && !blocked) return true
    const next = await fetchAudit(id)
    if (!next) return false
    if (!(await activate(next))) return false
    deps.say(t('Audit “{name}” opened: {n} page(s).', { name: next.name || t('Untitled audit'), n: next.pages.length }))
    return true
  }

  async function duplicateAuditById(id: string): Promise<void> {
    const open = deps.getAudit()
    const source = id === open.id && !blocked ? clone(open) : await fetchAudit(id)
    if (!source) return
    const name = await deps.askText(t('Duplicate this audit'), t('Name of the copy'), t('{name} (copy)', { name: source.name || t('Untitled audit') }), t('Duplicate'))
    if (name === null) return
    const copy = copyOf(source, name)
    const response = await write(copy, 0)
    if (!response.ok) return void deps.say(t('Could not create the audit: browser storage is full or unavailable.'))
    deps.say(t('Copy “{name}” created. It is in the list; open it when you want.', { name }))
    deps.onListChanged()
  }

  /** Renames the open audit (the caller then calls markDirty()) or a stored one. Resolves the new name or null. */
  async function renameAuditById(id: string): Promise<string | null> {
    const open = deps.getAudit()
    if (id === open.id && !blocked) {
      const name = await deps.askText(t('Rename this audit'), t('Name of the audit'), open.name)
      if (name === null || name === open.name) return null
      open.name = name
      open.updatedAt = Date.now() // a rename is a change: the file / browser comparison and “changed since the file” rely on this date
      markDirty()
      deps.say(t('Audit renamed “{name}”.', { name }))
      return name
    }
    const other = await fetchAudit(id)
    if (!other) return null
    const name = await deps.askText(t('Rename this audit'), t('Name of the audit'), other.name)
    if (name === null) return null
    other.name = name
    other.updatedAt = Date.now()
    const response = await write(other, 0)
    if (!response.ok) failedWrite(response)
    deps.onListChanged()
    return name
  }

  async function deleteAuditFlow(id: string): Promise<boolean> {
    const open = deps.getAudit()
    const isOpen = id === open.id && !blocked
    let target: AuditSummary | { name: string; pages: number } | undefined
    if (isOpen) target = { name: open.name, pages: open.pages.length }
    else {
      const stored = await loadAuditById(id)
      if (stored.status === 'found') target = { name: stored.audit.name, pages: stored.audit.pages.length }
      else if (stored.status === 'absent') {
        deps.say(t('This audit no longer exists.'))
        deps.onListChanged()
        return false
      } else {
        // unreadable: it can still be deleted, by the name of its line in the list
        const line = (await listAudits().catch(() => [])).find((a) => a.id === id)
        target = { name: line?.name ?? '', pages: line?.pages ?? 0 }
      }
    }
    const title = target.name || t('Untitled audit')
    const ok = await deps.askConfirm(
      t('Delete the audit “{name}”?', { name: title }),
      t('This deletes its {n} page(s), scans, answers and notes from the browser. A file you saved stays where it is. It cannot be undone.', { n: target.pages }),
      t('Delete'),
    )
    if (!ok) return false
    if (isOpen) {
      clearTimer()
      await flight // a write in flight must not bring the audit back after the delete
    }
    const response = await transport.remove(id)
    if (!response.ok) {
      deps.say(t('Could not delete the audit: {error}', { error: response.error }))
      return false
    }
    if (isOpen) {
      let rest: AuditSummary | undefined
      try {
        rest = (await listAudits()).sort((a, b) => b.updatedAt - a.updatedAt)[0]
      } catch (err) {
        enterBlocked(err)
        return true
      }
      if (rest) {
        const loaded = await loadAuditById(rest.id)
        if (loaded.status === 'failed') {
          enterBlocked(loaded.error)
          return true
        }
        if (loaded.status === 'found') await switchTo(loaded.audit)
        else rest = undefined
      }
      if (!rest) {
        const fresh = emptyAudit(t('Untitled audit'))
        await switchTo(fresh)
        markDirty()
      }
    } else deps.onListChanged()
    deps.say(t('Audit “{name}” deleted.', { name: title }))
    return true
  }

  /** Downloads an audit as a .rgaa.json file and records it as saved to a file. */
  async function saveAuditToFile(id?: string): Promise<void> {
    const open = deps.getAudit()
    const isOpen = id === undefined || (id === open.id && !blocked)
    const target = isOpen ? open : await fetchAudit(id)
    if (!target) return
    target.exportedAt = target.updatedAt
    const file = downloadAudit(target)
    if (isOpen) {
      if (!blocked) {
        markDirty()
        await saveNow()
      }
    } else {
      const response = await write(target, 0)
      if (!response.ok) failedWrite(response)
    }
    deps.onState()
    deps.onListChanged()
    deps.say(t('Audit saved as {file} (in your Downloads folder). Reopen it any time with “Open from a file”.', { file }))
  }

  /** Reads, validates and opens an audit file. The open audit is left alone unless the whole file is good. */
  async function importAuditFile(file: File): Promise<boolean> {
    let incoming: Audit
    try {
      checkImportSize(file.size)
      incoming = auditFromFile(await file.text())
    } catch (err) {
      deps.say(describeAuditError(err))
      return false
    }
    delete incoming.storageToken // A file has no authority over the browser storage revision.
    let existing: AuditSummary | undefined
    try {
      existing = (await listAudits()).find((a) => a.id === incoming.id)
    } catch (err) {
      deps.say(describeAuditError(err))
      return false
    }
    if (existing) {
      if (!(await settle())) return false
      const stored = await fetchAudit(incoming.id)
      if (!stored) return false
      incoming.storageToken = stored.storageToken
      const replace = await deps.askConfirm(
        t('This audit is already in the browser'),
        [
          t('“{name}” is already in this browser (same identifier as the file).', { name: existing.name }),
          t('In the browser: changed {date}. In the file: changed {fileDate}.', { date: new Date(existing.updatedAt).toLocaleString(), fileDate: new Date(incoming.updatedAt).toLocaleString() }),
          incoming.updatedAt > existing.updatedAt
            ? t('The file is more recent.')
            : incoming.updatedAt < existing.updatedAt
              ? t('Warning: the file is OLDER than the audit in the browser. Replacing it loses the changes made since.')
              : t('Both have the same date.'),
          t('Replacing overwrites the whole audit in the browser with the file. Cancel to choose another option (import as a copy).'),
        ].join(' '),
        t('Replace it'),
      )
      if (!replace) {
        const asCopy = await deps.askConfirm(t('Import as a copy?'), t('The file is imported as a new audit and the one in the browser is kept.'), t('Import as a copy'))
        if (!asCopy) {
          deps.say(t('Import cancelled.'))
          return false
        }
        incoming = copyOf(incoming, t('{name} (imported)', { name: incoming.name || t('Untitled audit') }))
      }
    }
    if (!(await settle())) {
      deps.say(t('Import cancelled.'))
      return false
    }
    const response = await write(incoming, 0)
    if (!response.ok) {
      deps.say(t('Could not import the audit: browser storage is full or unavailable.'))
      return false
    }
    await switchTo(incoming)
    deps.say(t('Audit “{name}” reopened from the file: {n} page(s). You can carry on.', { name: incoming.name || t('Untitled audit'), n: incoming.pages.length }))
    return true
  }

  async function resolveConflict(): Promise<boolean> {
    const choice = await deps.askChoice(t('Save conflict'), lastError, [
      { id: 'copy', label: t('Save my changes as a copy'), primary: true },
      { id: 'reload', label: t('Reload saved audit') },
      { id: 'stay', label: t('Stay on this audit') },
    ])
    if (choice === 'copy') {
      const copy = copyOf(deps.getAudit(), t('{name} (copy)', { name: deps.getAudit().name }))
      const result = await write(copy, 0)
      if (!result.ok) { failedWrite(result); return false }
      await switchTo(copy)
      deps.onListChanged()
      return true
    }
    if (choice === 'reload') {
      const latest = await fetchAudit(deps.getAudit().id)
      if (!latest) return false
      await switchTo(latest)
      return true
    }
    return false
  }

  /** The Retry button of the audit bar: writes again, or tries to read the saved audit again. */
  async function retry(): Promise<boolean> {
    if (blocked) return loadInitial()
    return conflict ? resolveConflict() : saveNow()
  }

  return {
    get saveState() {
      return state
    },
    get savedAt() {
      return savedAt
    },
    get lastError() {
      return lastError
    },
    get blocked() {
      return blocked
    },
    get revision() {
      return revision
    },
    get savedRevision() {
      return savedRevision
    },
    hasPending: unsaved,
    markDirty,
    saveNow,
    flush,
    retry,
    settle,
    loadInitial,
    activate,
    newAudit,
    openAuditById,
    duplicateAuditById,
    renameAuditById,
    deleteAuditFlow,
    saveAuditToFile,
    importAuditFile,
  }
}

export type AuditSession = ReturnType<typeof createAuditSession>
