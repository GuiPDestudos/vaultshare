import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import {
  ArrowRight,
  Bell,
  Compass,
  FilePlus2,
  FolderOpen,
  KeyRound,
  Link2,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  SearchX,
  SlidersHorizontal,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getActivity,
  getFiles,
  getLinks,
  getMe,
  getOverview,
  getSettings,
  search,
  updateMe,
  updateSettings,
  uploadFile,
} from './api'
import type { OverviewStats, User, UserSettings } from './api'
import { useApp, useData, usePageTitle } from './context'
import { Field } from './dialogs'
import { formatBytes, initials, plural } from './format'
import { EmptyState, EventList, FileList, LinkList, PageTitle, StatusMessage } from './ui'

const DIAL_TICKS = 60
const DIAL_ANGLES = Array.from({ length: DIAL_TICKS }, (_, index) => index)

// Animates a number toward its target. Runs instantly under reduced motion or in a hidden tab, where frames don't fire.
function useTween(target: number, duration = 900) {
  const [value, setValue] = useState(target)
  const current = useRef(target)
  const frame = useRef(0)
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden

  useEffect(() => {
    if (instant) {
      current.current = target
      return
    }
    const from = current.current
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const next = from + (target - from) * (1 - (1 - progress) ** 4)
      current.current = next
      setValue(next)
      if (progress < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, instant])

  return instant ? target : value
}

// A combination-lock dial: the bezel turns into place and the ticks light up clockwise up to the storage used.
function VaultDial({ stats }: { stats?: OverviewStats }) {
  const used = useTween(stats?.storageUsedBytes ?? 0)
  const ratio = stats ? Math.min(stats.storageUsedBytes / stats.storageQuotaBytes, 1) : 0
  const lit = Math.round(ratio * DIAL_TICKS)
  const level = ratio >= 0.9 ? 'dial dial-full' : 'dial'

  return (
    <div className={level}>
      <svg className="dial-art" viewBox="0 0 260 260" aria-hidden="true">
        <g className="dial-bezel">
          <circle className="dial-knurl" cx="130" cy="130" r="124" />
          <path className="dial-notch" d="M130 2 l5 9 h-10 Z" />
        </g>
        {DIAL_ANGLES.map((index) => (
          <line
            key={index}
            className={index < lit ? 'dial-tick dial-tick-on' : 'dial-tick'}
            x1="130"
            y1="20"
            x2="130"
            y2={index % 5 === 0 ? 38 : 32}
            transform={`rotate(${index * 6} 130 130)`}
            style={{ '--i': index } as CSSProperties}
          />
        ))}
        <circle className="dial-face" cx="130" cy="130" r="86" />
      </svg>
      <dl className="dial-readout">
        <dt>Armazenamento utilizado</dt>
        <dd className="dial-value">{stats ? formatBytes(used) : '–'}</dd>
        <dd className="dial-hint">{stats ? `de ${formatBytes(stats.storageQuotaBytes)} protegidos` : ' '}</dd>
      </dl>
    </div>
  )
}

function Metric({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: string; label: string; value?: number; hint: string }) {
  return (
    <li className="metric">
      <span className={`tile tone-${tone}`}><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></span>
      <dl className="metric-text">
        <dt>{label}</dt>
        <dd className="metric-value">{value ?? '–'}</dd>
        <dd className="metric-hint">{hint}</dd>
      </dl>
    </li>
  )
}

export function Overview() {
  const { refresh, notify, openDialog } = useApp()
  const overview = useData(getOverview)
  const activity = useData(() => getActivity(4))
  const fileInput = useRef<HTMLInputElement>(null)
  const stats = overview.data
  usePageTitle('Tudo protegido, tudo sob controle.')

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const uploaded = await uploadFile(file)
      refresh()
      notify(`${uploaded.name} enviado.`)
    } catch {
      notify('Não foi possível enviar o arquivo.', 'error')
    }
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title" className="hero-title">Tudo protegido, tudo sob controle.</h1>
          <p className="hero-status"><span className="pulse" aria-hidden="true" />Centro de segurança ativo</p>
          <input ref={fileInput} type="file" hidden onChange={upload} />
          <button type="button" className="button button-primary button-large" onClick={() => fileInput.current?.click()}>
            <Upload size={16} strokeWidth={2} aria-hidden="true" />
            Enviar arquivo
          </button>
        </div>
        <VaultDial stats={stats} />
      </section>
      {overview.error && <StatusMessage error />}
      <ul className="metrics">
        <Metric icon={Lock} tone="green" label="Arquivos protegidos" value={stats?.protectedFiles} hint="Criptografia ativa" />
        <Metric icon={Link2} tone="violet" label="Links ativos" value={stats?.activeLinks} hint="Com regras de acesso" />
        <Metric icon={Users} tone="amber" label="Acessos recentes" value={stats?.recentAccesses} hint="Nos últimos 7 dias" />
      </ul>
      <div className="overview-bottom">
        <section className="card" aria-labelledby="recent-activity">
          <div className="card-heading">
            <h2 id="recent-activity" className="card-title">Atividade recente</h2>
            <Link to="/atividade" className="more-link">Ver tudo<ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          {activity.data ? <EventList events={activity.data} empty="Nenhuma atividade recente." /> : <StatusMessage error={activity.error} lines={4} />}
        </section>
        <section className="card" aria-labelledby="quick-actions">
          <h2 id="quick-actions" className="card-title">Ações rápidas</h2>
          <button type="button" className="quick-action" onClick={() => openDialog({ kind: 'file' })}>
            <FilePlus2 size={18} strokeWidth={1.75} aria-hidden="true" />
            Criar arquivo
            <ArrowRight className="quick-arrow" size={16} aria-hidden="true" />
          </button>
          <button type="button" className="quick-action" onClick={() => openDialog({ kind: 'link' })}>
            <Link2 size={18} strokeWidth={1.75} aria-hidden="true" />
            Gerar link de compartilhamento
            <ArrowRight className="quick-arrow" size={16} aria-hidden="true" />
          </button>
          <Link to="/configuracoes" className="quick-action">
            <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
            Ajustar configurações
            <ArrowRight className="quick-arrow" size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </>
  )
}

export function Files() {
  const { openDialog } = useApp()
  const files = useData(getFiles)
  const [filter, setFilter] = useState('all')
  const all = files.data ?? []
  const types = [...new Set(all.map((file) => file.type))]
  const visible = filter === 'all' ? all : all.filter((file) => file.type === filter)
  const totalBytes = all.reduce((sum, file) => sum + file.sizeBytes, 0)
  const subtitle = files.data ? `${plural(all.length, 'arquivo', 'arquivos')} · ${formatBytes(totalBytes)}` : ''
  const newFile = (
    <button type="button" className="button button-primary" onClick={() => openDialog({ kind: 'file' })}>
      <FilePlus2 size={16} strokeWidth={2} aria-hidden="true" />
      Novo arquivo
    </button>
  )

  return (
    <>
      <PageTitle title="Documentos armazenados" subtitle={subtitle} action={newFile} />
      {types.length > 1 && (
        <div className="chips" role="group" aria-label="Filtrar por tipo">
          {['all', ...types].map((type) => (
            <button key={type} type="button" className="chip" aria-pressed={filter === type} onClick={() => setFilter(type)}>
              {type === 'all' ? 'Todos' : type}
            </button>
          ))}
        </div>
      )}
      {!files.data && <StatusMessage error={files.error} lines={5} />}
      {files.data?.length === 0 && <EmptyState icon={FolderOpen} title="Você ainda não tem arquivos." />}
      {files.data && <FileList files={visible} />}
    </>
  )
}

export function Links() {
  const { openDialog } = useApp()
  const links = useData(getLinks)
  const subtitle = links.data ? plural(links.data.length, 'link compartilhado', 'links compartilhados') : ''
  const newLink = (
    <button type="button" className="button button-primary" onClick={() => openDialog({ kind: 'link' })}>
      <Link2 size={16} strokeWidth={2} aria-hidden="true" />
      Gerar link
    </button>
  )

  return (
    <>
      <PageTitle title="Acesso com regras definidas" subtitle={subtitle} action={newLink} />
      {!links.data && <StatusMessage error={links.error} />}
      {links.data?.length === 0 && <EmptyState icon={Link2} title="Você ainda não gerou links." />}
      {links.data && <LinkList links={links.data} />}
    </>
  )
}

export function Activity() {
  const activity = useData(() => getActivity())

  return (
    <>
      <PageTitle title="Histórico da sua conta" subtitle="Acessos, links e arquivos, do mais recente ao mais antigo." />
      <section className="card" aria-label="Histórico de atividades">
        {activity.data ? <EventList events={activity.data} empty="Nenhuma atividade registrada." /> : <StatusMessage error={activity.error} lines={5} />}
      </section>
    </>
  )
}

const PRIVACY_SWITCHES: { key: keyof UserSettings; icon: LucideIcon; label: string; hint: string }[] = [
  { key: 'requirePassword', icon: KeyRound, label: 'Exigir senha em novos links', hint: 'Todo link novo só abre com senha.' },
  { key: 'notifyAccess', icon: Bell, label: 'Notificar acessos aos arquivos', hint: 'Avisamos quando alguém abrir um arquivo seu.' },
  { key: 'allowAccessRequests', icon: UserPlus, label: 'Permitir pedidos de acesso', hint: 'Quem não tem acesso pode pedir permissão.' },
]

function SettingsForm({ user, settings }: { user: User; settings: UserSettings }) {
  const { refresh, notify } = useApp()
  const [toggles, setToggles] = useState(settings)
  const [name, setName] = useState(user.name)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      await Promise.all([
        updateMe({ name: name.trim(), email: String(form.get('email')).trim() }),
        updateSettings(toggles),
      ])
      refresh()
      notify('Alterações salvas.')
    } catch {
      notify('Não foi possível salvar as alterações.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="settings" onSubmit={submit}>
      <section className="card settings-panel" aria-labelledby="settings-account">
        <h2 id="settings-account" className="card-title">Conta</h2>
        <div className="profile">
          <span className="avatar avatar-large" aria-hidden="true">{initials(name)}</span>
          <div>
            <p className="profile-name">{name.trim() || 'Sem nome'}</p>
            <p className="profile-plan">{user.plan}</p>
          </div>
        </div>
        <Field label="Nome">
          {(id) => <input id={id} name="name" className="input" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />}
        </Field>
        <Field label="E-mail">
          {(id) => <input id={id} name="email" type="email" className="input" defaultValue={user.email} required autoComplete="email" />}
        </Field>
      </section>
      <section className="card settings-panel" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy" className="card-title">Privacidade</h2>
        {PRIVACY_SWITCHES.map(({ key, icon: Icon, label, hint }) => (
          <label key={key} className="switch-row">
            <span className="tile tone-blue"><Icon size={16} strokeWidth={1.75} aria-hidden="true" /></span>
            <span className="switch-text">
              <span className="switch-label">{label}</span>
              <span className="switch-hint">{hint}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={toggles[key]}
              onChange={(event) => setToggles({ ...toggles, [key]: event.target.checked })}
            />
          </label>
        ))}
      </section>
      <div className="settings-actions">
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
          Salvar alterações
        </button>
      </div>
    </form>
  )
}

export function Settings() {
  const user = useData(getMe)
  const settings = useData(getSettings)

  return (
    <>
      <PageTitle title="Ajustes da conta e da privacidade" />
      {user.data && settings.data ? (
        <SettingsForm user={user.data} settings={settings.data} />
      ) : (
        <StatusMessage error={user.error || settings.error} lines={4} />
      )}
    </>
  )
}

export function Search() {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const results = useData(() => search(query), query)
  const data = results.data
  const total = data ? data.files.length + data.links.length + data.people.length : 0
  const subtitle = data ? plural(total, 'resultado', 'resultados') : ''

  return (
    <>
      <PageTitle title={`Resultados para “${query}”`} subtitle={subtitle} />
      {!data && <StatusMessage error={results.error} />}
      {data && total === 0 && <EmptyState icon={SearchX} title="Nada encontrado. Tente outro termo." />}
      {data && data.files.length > 0 && (
        <section className="result-group" aria-labelledby="result-files">
          <h2 id="result-files" className="card-title">Arquivos</h2>
          <FileList files={data.files} />
        </section>
      )}
      {data && data.links.length > 0 && (
        <section className="result-group" aria-labelledby="result-links">
          <h2 id="result-links" className="card-title">Links</h2>
          <LinkList links={data.links} />
        </section>
      )}
      {data && data.people.length > 0 && (
        <section className="result-group" aria-labelledby="result-people">
          <h2 id="result-people" className="card-title">Pessoas</h2>
          <ul className="file-list">
            {data.people.map((person) => (
              <li key={person.id} className="file-row person-row">
                <span className="avatar" aria-hidden="true">{initials(person.name)}</span>
                <div className="file-meta">
                  <p className="file-name">{person.name}</p>
                  <p className="person-email">{person.email}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

export function NotFound() {
  return (
    <>
      <PageTitle title="Página não encontrada" />
      <EmptyState
        icon={Compass}
        title="Este endereço não existe ou mudou de lugar."
        action={<Link to="/" className="button button-ghost"><LayoutDashboard size={16} aria-hidden="true" />Voltar para a visão geral</Link>}
      />
    </>
  )
}
