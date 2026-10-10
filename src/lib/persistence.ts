import { deleteAuditById, parseAudit, saveAudit } from './audit-store'
import { AuditFormatError } from './audit-validate'
import type { DeleteMessage, SaveMessage, SaveResponse } from './messages'
import type { Audit } from './types'

/** The raw writes the authority performs (injected in tests). */
export interface AuditWriter {
  save(audit: Audit): Promise<void>
  remove(id: string): Promise<void>
}

const defaultWriter: AuditWriter = { save: saveAudit, remove: deleteAuditById }

/**
 * The one place that writes audits. Every write (audit + its line in the index) runs inside a queue, one at a time,
 * so two DevTools panels saving at once cannot overwrite each other's index entries.
 * It lives in the background page; the panel only sends RGAA_SAVE / RGAA_DELETE messages.
 */
export function createPersistence(writer: AuditWriter = defaultWriter) {
  let tail: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task)
    tail = run.catch(() => undefined)
    return run
  }

  const failure = (err: unknown): SaveResponse => ({ ok: false, code: 'storage', error: err instanceof Error ? err.message : String(err) })

  return {
    /** Validates then writes. The audit is validated (and cloned by the message channel) before it can reach the storage. */
    save(message: Pick<SaveMessage, 'audit' | 'revision'>): Promise<SaveResponse> {
      let audit: Audit
      try {
        audit = parseAudit(message.audit)
      } catch (err) {
        const detail = err instanceof AuditFormatError ? err.message : String(err)
        return Promise.resolve({ ok: false, code: 'invalid', error: detail })
      }
      return enqueue(async (): Promise<SaveResponse> => {
        await writer.save(audit)
        return { ok: true, revision: message.revision }
      }).catch(failure)
    },
    remove(message: Pick<DeleteMessage, 'id'>): Promise<SaveResponse> {
      return enqueue(async (): Promise<SaveResponse> => {
        await writer.remove(message.id)
        return { ok: true, revision: 0 }
      }).catch(failure)
    },
    /** Resolves when every write queued so far is done. */
    idle: (): Promise<void> => tail.then(() => undefined),
  }
}

export type Persistence = ReturnType<typeof createPersistence>
