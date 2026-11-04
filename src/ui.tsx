import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Check,
  Clock,
  Copy,
  Eye,
  File,
  FileArchive,
  FilePlus2,
  FileText,
  Globe,
  Image,
  KeyRound,
  Link2,
  Lock,
  Share2,
  TimerOff,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActivityEvent, EventType, ShareLink, VaultFile } from './api'
import { useApp, usePageTitle } from './context'
import { eventText, formatBytes, fileMeta, linkRules, relativeTime } from './format'
import type { LinkRuleKind } from './format'

interface PageTitleProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageTitle({ title, subtitle, action }: PageTitleProps) {
  usePageTitle(title)

  return (
    <div className="title-row">
      <div className="titles">
        <h1>{title}</h1>
        {subtitle !== undefined && <p className="subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatusMessage({ error, lines = 3 }: { error?: boolean; lines?: number }) {
  const { refresh } = useApp()

  if (error) {
    return (
      <div className="status" role="alert">
        <p>Não foi possível carregar os dados.</p>
        <button type="button" className="text-button" onClick={refresh}>Tentar novamente</button>
      </div>
    )
  }
  return (
    <div className="skeleton-group" role="status">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="skeleton" aria-hidden="true" style={{ '--i': index } as CSSProperties} />
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
      <p>{title}</p>
      {action}
    </div>
  )
}

const FILE_TILES: Record<string, { icon: LucideIcon; tone: string }> = {
  PDF: { icon: FileText, tone: 'rose' },
  PNG: { icon: Image, tone: 'violet' },
  JPG: { icon: Image, tone: 'violet' },
  JPEG: { icon: Image, tone: 'violet' },
  DOCX: { icon: FileText, tone: 'blue' },
  DOC: { icon: FileText, tone: 'blue' },
  ZIP: { icon: FileArchive, tone: 'amber' },
}

export function FileTile({ type }: { type: string }) {
  const { icon: Icon, tone } = FILE_TILES[type.toUpperCase()] ?? { icon: File, tone: 'slate' }
  return (
    <span className={`tile tone-${tone}`}>
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    </span>
  )
}

const EVENT_ICONS: Record<EventType, { icon: LucideIcon; tone: string }> = {
  file_accessed: { icon: Eye, tone: 'blue' },
  link_created: { icon: Link2, tone: 'violet' },
  password_added: { icon: KeyRound, tone: 'green' },
  access_requested: { icon: UserPlus, tone: 'amber' },
  file_created: { icon: FilePlus2, tone: 'blue' },
  file_uploaded: { icon: Upload, tone: 'blue' },
}

export function EventList({ events, empty }: { events: ActivityEvent[]; empty: string }) {
  if (events.length === 0) return <EmptyState icon={Clock} title={empty} />

  return (
    <ul className="events">
      {events.map((event, index) => {
        const { icon: Icon, tone } = EVENT_ICONS[event.type]
        return (
          <li key={event.id} className="event enter" style={{ '--i': index } as CSSProperties}>
            <span className={`event-icon tone-${tone}`}>
              <Icon size={14} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="event-text">{eventText(event)}</span>
            <time className="event-time" dateTime={event.createdAt}>{relativeTime(event.createdAt)}</time>
          </li>
        )
      })}
    </ul>
  )
}

export function FileList({ files }: { files: VaultFile[] }) {
  const { openDialog } = useApp()

  return (
    <ul className="file-list">
      {files.map((file, index) => (
        <li key={file.id} className="file-row enter" style={{ '--i': index } as CSSProperties}>
          <FileTile type={file.type} />
          <div className="file-meta">
            <p className="file-name">{file.name}</p>
            <p className="file-details">{fileMeta(file)}</p>
          </div>
          <span className="file-column file-size">{formatBytes(file.sizeBytes)}</span>
          <span className="file-column file-when">{relativeTime(file.createdAt, { ago: true })}</span>
          <button
            type="button"
            className="text-button share-button"
            aria-label={`Compartilhar ${file.name}`}
            onClick={() => openDialog({ kind: 'link', fileId: file.id })}
          >
            <Share2 size={14} strokeWidth={2} aria-hidden="true" />
            Compartilhar
          </button>
        </li>
      ))}
    </ul>
  )
}

const RULE_ICONS: Record<LinkRuleKind, LucideIcon> = {
  expiry: Clock,
  expired: TimerOff,
  password: Lock,
  readonly: Eye,
  accesses: Users,
  open: Globe,
}

function LinkCard({ link, index }: { link: ShareLink; index: number }) {
  const { notify } = useApp()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(undefined)
  const rules = linkRules(link)
  const expired = rules.some((rule) => rule.kind === 'expired')
  const type = link.fileName.includes('.') ? link.fileName.split('.').pop()! : ''

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${link.url}`)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
      notify(`Link de ${link.fileName} copiado.`)
    } catch {
      notify('Não foi possível copiar o link. Copie o endereço manualmente.', 'error')
    }
  }

  return (
    <li className={expired ? 'link-card enter link-expired' : 'link-card enter'} style={{ '--i': index } as CSSProperties}>
      <FileTile type={type} />
      <div className="link-info">
        <h2 className="link-name">{link.fileName}</h2>
        <ul className="rules">
          {rules.map(({ kind, label }) => {
            const Icon = RULE_ICONS[kind]
            return (
              <li key={kind} className={`rule rule-${kind}`}>
                <Icon size={12} strokeWidth={2.25} aria-hidden="true" />
                {label}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="link-address">
        <span className="link-url">{link.url}</span>
        <button type="button" className={copied ? 'copy-button copy-done' : 'copy-button'} aria-label={`Copiar link de ${link.fileName}`} onClick={copy}>
          <span className="copy-icons" aria-hidden="true">
            <Copy className="copy-idle" size={14} strokeWidth={2} />
            <Check className="copy-check" size={14} strokeWidth={2.5} />
          </span>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </li>
  )
}

export function LinkList({ links }: { links: ShareLink[] }) {
  return (
    <ul className="link-list">
      {links.map((link, index) => (
        <LinkCard key={link.id} link={link} index={index} />
      ))}
    </ul>
  )
}
