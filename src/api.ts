// In-memory mock of the API described in BACKEND.md. Each function names the
// endpoint it stands in for and resolves with the same shape the endpoint returns.
// State resets on page reload.

export type FileType = string

export interface User {
  id: string
  name: string
  email: string
  plan: string
}

export interface UserSettings {
  requirePassword: boolean
  notifyAccess: boolean
  allowAccessRequests: boolean
}

export interface VaultFile {
  id: string
  name: string
  type: FileType
  sizeBytes: number
  createdAt: string
}

export interface ShareLink {
  id: string
  fileId: string
  fileName: string
  url: string
  expiresAt: string | null
  hasPassword: boolean
  readOnly: boolean
  accessCount: number
  createdAt: string
}

export type EventType =
  | 'file_accessed'
  | 'link_created'
  | 'password_added'
  | 'access_requested'
  | 'file_created'
  | 'file_uploaded'

export interface ActivityEvent {
  id: string
  type: EventType
  actor: string | null
  fileName: string | null
  createdAt: string
}

export interface OverviewStats {
  storageUsedBytes: number
  storageQuotaBytes: number
  protectedFiles: number
  activeLinks: number
  recentAccesses: number
}

export interface Person {
  id: string
  name: string
  email: string
}

export interface SearchResults {
  files: VaultFile[]
  links: ShareLink[]
  people: Person[]
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

let user: User = { id: 'u1', name: 'Marina Costa', email: 'marina@empresa.com', plan: 'Pro Secure' }

let settings: UserSettings = { requirePassword: true, notifyAccess: true, allowAccessRequests: false }

const files: VaultFile[] = [
  { id: 'f1', name: 'Planejamento_2026.pdf', type: 'PDF', sizeBytes: 2_400_000, createdAt: ago(12 * MINUTE) },
  { id: 'f2', name: 'Apresentação produto.png', type: 'PNG', sizeBytes: 1_100_000, createdAt: ago(2 * HOUR) },
  { id: 'f3', name: 'Contrato_fornecedores.pdf', type: 'PDF', sizeBytes: 840_000, createdAt: ago(26 * HOUR) },
  { id: 'f4', name: 'Notas da reunião.docx', type: 'DOCX', sizeBytes: 126_000, createdAt: ago(3 * DAY) },
  { id: 'f5', name: 'Backup_fotos.zip', type: 'ZIP', sizeBytes: 48_000_000, createdAt: ago(8 * DAY) },
]

const links: ShareLink[] = [
  {
    id: 'l1',
    fileId: 'f2',
    fileName: 'Apresentação produto.png',
    url: 'vaultshare.app/s/a8k2',
    expiresAt: fromNow(7 * DAY),
    hasPassword: true,
    readOnly: false,
    accessCount: 0,
    createdAt: ago(2 * HOUR),
  },
  {
    id: 'l2',
    fileId: 'f1',
    fileName: 'Planejamento_2026.pdf',
    url: 'vaultshare.app/s/p1n6',
    expiresAt: null,
    hasPassword: false,
    readOnly: true,
    accessCount: 3,
    createdAt: ago(3 * DAY),
  },
]

const events: ActivityEvent[] = [
  { id: 'e1', type: 'file_accessed', actor: 'financeiro@empresa.com', fileName: 'Planejamento_2026.pdf', createdAt: ago(12 * MINUTE) },
  { id: 'e2', type: 'link_created', actor: null, fileName: 'Apresentação produto.png', createdAt: ago(2 * HOUR) },
  { id: 'e3', type: 'password_added', actor: null, fileName: 'Contrato_fornecedores.pdf', createdAt: ago(26 * HOUR) },
  { id: 'e4', type: 'access_requested', actor: 'Lucas Almeida', fileName: null, createdAt: ago(27 * HOUR) },
]

const people: Person[] = [
  { id: 'p1', name: 'Lucas Almeida', email: 'lucas@empresa.com' },
  { id: 'p2', name: 'Financeiro', email: 'financeiro@empresa.com' },
]

const stats = { storageUsedBytes: 18_400_000_000, storageQuotaBytes: 30_000_000_000, protectedFiles: 24, recentAccesses: 12 }

const respond = <T,>(data: T) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(data)), 250))
const newId = () => crypto.randomUUID()

function logEvent(type: EventType, fileName: string) {
  events.unshift({ id: newId(), type, actor: null, fileName, createdAt: new Date().toISOString() })
}

function addFile(name: string, type: FileType, sizeBytes: number) {
  const file: VaultFile = { id: newId(), name, type, sizeBytes, createdAt: new Date().toISOString() }
  files.unshift(file)
  stats.protectedFiles += 1
  stats.storageUsedBytes += sizeBytes
  return file
}

// GET /me
export const getMe = () => respond(user)

// PATCH /me
export function updateMe(patch: Pick<User, 'name' | 'email'>) {
  user = { ...user, ...patch }
  return respond(user)
}

// GET /me/settings
export const getSettings = () => respond(settings)

// PUT /me/settings
export function updateSettings(next: UserSettings) {
  settings = next
  return respond(settings)
}

// GET /overview
export const getOverview = () => respond<OverviewStats>({ ...stats, activeLinks: links.length })

// GET /activity?limit=
export const getActivity = (limit?: number) => respond(events.slice(0, limit))

// GET /notifications
export const getNotifications = () => respond(events.slice(0, 5))

// GET /files
export const getFiles = () => respond(files)

// POST /files
export function createFile(input: { name: string; type: FileType }) {
  const extension = `.${input.type.toLowerCase()}`
  const name = input.name.toLowerCase().endsWith(extension) ? input.name : input.name + extension
  const file = addFile(name, input.type, 0)
  logEvent('file_created', file.name)
  return respond(file)
}

// POST /files/upload (multipart/form-data)
export function uploadFile(upload: File) {
  const type = upload.name.includes('.') ? upload.name.split('.').pop()!.toUpperCase() : 'ARQUIVO'
  const file = addFile(upload.name, type, upload.size)
  logEvent('file_uploaded', file.name)
  return respond(file)
}

// GET /links
export const getLinks = () => respond(links)

// POST /links
export function createLink(input: { fileId: string; expiresInDays: number | null; password: string | null }) {
  const file = files.find((f) => f.id === input.fileId)
  if (!file) return Promise.reject(new Error('Arquivo não encontrado.'))
  const link: ShareLink = {
    id: newId(),
    fileId: file.id,
    fileName: file.name,
    url: `vaultshare.app/s/${newId().slice(0, 4)}`,
    expiresAt: input.expiresInDays === null ? null : fromNow(input.expiresInDays * DAY),
    hasPassword: Boolean(input.password),
    readOnly: false,
    accessCount: 0,
    createdAt: new Date().toISOString(),
  }
  links.unshift(link)
  logEvent('link_created', file.name)
  return respond(link)
}

// GET /search?q=
export function search(query: string) {
  const q = query.trim().toLowerCase()
  const matches = (text: string) => text.toLowerCase().includes(q)
  return respond<SearchResults>({
    files: files.filter((f) => matches(f.name)),
    links: links.filter((l) => matches(l.fileName) || matches(l.url)),
    people: people.filter((p) => matches(p.name) || matches(p.email)),
  })
}
