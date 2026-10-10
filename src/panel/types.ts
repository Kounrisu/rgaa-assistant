import type { AuditItem, Detected } from '../lib/types'

export type Item = AuditItem

export type Filter = 'all' | Detected | 'dialog' | 'gone' | 'review' | 'prefilled'

export type Child = Node | string | null | undefined | false

export type Status = 'todo' | 'progress' | 'c' | 'nc'

export type View = 'review' | 'page' | 'audit' | 'sample' | 'audits' | 'checks'

export type FStatus = 'todo' | 'progress' | 'c' | 'nc'

export type FindingFilter = 'all' | 'hidden' | 'link-skip' | 'field-nolabel' | 'field-placeholder' | 'table-nohead' | 'table-layout' | 'review' | 'contrast-fail' | 'contrast-unknown' | 'link-empty' | 'link-generic' | 'headings' | 'landmarks'
