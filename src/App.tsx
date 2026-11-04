import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { Activity, Bell, CircleAlert, CircleCheck, Folder, LayoutDashboard, Link2, Menu, Moon, Search, Settings, ShieldCheck, Sun } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getMe, getNotifications } from './api'
import logo from './assets/logo.svg'
import { AppContext, useData } from './context'
import type { DialogRequest } from './context'
import { CreateFileDialog, CreateLinkDialog } from './dialogs'
import { initials } from './format'
import { EventList, StatusMessage } from './ui'

const NAV_ITEMS = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/arquivos', label: 'Meus arquivos', icon: Folder },
  { to: '/links', label: 'Links compartilhados', icon: Link2 },
  { to: '/atividade', label: 'Atividade', icon: Activity },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function Sidebar() {
  const { pathname } = useLocation()
  const sidebar = useRef<HTMLElement>(null)
  const activeIndex = NAV_ITEMS.findIndex((item) => item.to === pathname)

  const closeDrawer = () => {
    if (sidebar.current?.matches(':popover-open')) sidebar.current.hidePopover()
  }

  return (
    <aside id="sidebar" className="sidebar" popover="auto" ref={sidebar}>
      <Link to="/" className="brand" onClick={closeDrawer}>
        <img src={logo} alt="" width={32} height={32} />
        <span className="brand-text">
          <span className="brand-name">VaultShare</span>
          <span className="brand-tagline">ARQUIVOS SOB CONTROLE</span>
        </span>
      </Link>
      <nav className="nav" aria-label="Principal">
        {activeIndex >= 0 && <span className="nav-indicator" style={{ '--active': activeIndex } as React.CSSProperties} aria-hidden="true" />}
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="nav-item" onClick={closeDrawer}>
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="privacy">
        <p className="privacy-title">
          <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
          Privacidade ativa
        </p>
        <p className="privacy-text">Seus arquivos são protegidos antes do compartilhamento</p>
      </div>
    </aside>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme)
  const next = theme === 'dark' ? 'light' : 'dark'

  const applyTheme = () => {
    flushSync(() => setTheme(next))
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Without storage the choice only lasts for this visit.
    }
  }

  // The new theme grows out of the button as a circle. Browsers without view transitions swap instantly.
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    if (!document.startViewTransition || prefersReducedMotion()) {
      applyTheme()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    document
      .startViewTransition(applyTheme)
      .ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 550, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
        )
      })
      .catch(() => {})
  }

  return (
    <button type="button" className="icon-button theme-toggle" data-theme-icon={theme} onClick={toggle} aria-label={next === 'dark' ? 'Ativar tema escuro' : 'Ativar tema claro'}>
      <Sun className="theme-sun" size={17} strokeWidth={1.75} aria-hidden="true" />
      <Moon className="theme-moon" size={17} strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}

function Notifications() {
  const notifications = useData(getNotifications)

  return (
    <>
      <button type="button" className="icon-button bell-button" popoverTarget="notifications" aria-label="Notificações">
        <Bell size={17} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <section id="notifications" className="notifications" popover="auto" aria-labelledby="notifications-title">
        <h2 id="notifications-title" className="card-title">Notificações</h2>
        {notifications.data ? (
          <EventList events={notifications.data} empty="Nenhuma notificação por aqui." />
        ) : (
          <StatusMessage error={notifications.error} />
        )}
      </section>
    </>
  )
}

function Header() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: user } = useData(getMe)
  const searchInput = useRef<HTMLInputElement>(null)
  const query = params.get('q') ?? ''
  const shortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
        searchInput.current?.select()
      }
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q')).trim()
    if (q) navigate(`/buscar?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="header">
      <button type="button" className="icon-button menu-button" popoverTarget="sidebar" aria-label="Abrir menu">
        <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <form className="search" role="search" onSubmit={onSearch}>
        <Search size={16} strokeWidth={1.75} aria-hidden="true" />
        <input ref={searchInput} key={query} type="search" name="q" defaultValue={query} placeholder="Buscar arquivos, links ou pessoas" aria-label="Buscar arquivos, links ou pessoas" aria-keyshortcuts="Meta+K Control+K" />
        <kbd className="search-shortcut" aria-hidden="true">{shortcut}</kbd>
      </form>
      <ThemeToggle />
      <Notifications />
      {user && (
        <div className="user">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <span className="user-meta">
            <span className="user-name">{user.name}</span>
            <span className="user-plan">{user.plan}</span>
          </span>
          <span className="sr-only user-sr-name">{user.name}</span>
        </div>
      )}
    </header>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)
  const toastTimer = useRef<number>(undefined)
  const [revision, setRevision] = useState(0)
  const [toast, setToast] = useState({ message: '', tone: 'ok', visible: false })
  const [dialog, setDialog] = useState<DialogRequest | null>(null)

  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  // The text stays through the exit transition and is cleared afterwards, so a repeated message is announced again.
  const notify = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ message, tone, visible: true })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setToast((current) => ({ ...current, visible: false }))
      toastTimer.current = window.setTimeout(() => setToast((current) => ({ ...current, message: '' })), 250)
    }, 4500)
  }, [])

  const context = useMemo(() => ({ revision, refresh, notify, openDialog: setDialog }), [revision, refresh, notify])

  // Moves focus to the new page so keyboard and screen reader users start at its content.
  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
  }, [pathname])

  const closeDialog = () => setDialog(null)

  return (
    <AppContext.Provider value={context}>
      <a className="skip-link" href="#main">Pular para o conteúdo</a>
      <div className="shell">
        <Sidebar />
        <div className="content">
          <Header />
          <main id="main" className="body" ref={main} tabIndex={-1}>
            <div key={pathname} className="page">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      {dialog?.kind === 'file' && <CreateFileDialog onClose={closeDialog} />}
      {dialog?.kind === 'link' && <CreateLinkDialog fileId={dialog.fileId} onClose={closeDialog} />}
      <div className={toast.visible ? `toast toast-${toast.tone} toast-visible` : `toast toast-${toast.tone}`} role="status">
        {toast.message && (toast.tone === 'error' ? <CircleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />)}
        {toast.message}
      </div>
    </AppContext.Provider>
  )
}
