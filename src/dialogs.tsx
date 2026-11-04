import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, MouseEvent, ReactNode, SyntheticEvent } from 'react'
import { FilePlus2, Link2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createFile, createLink, getFiles, getSettings } from './api'
import { useApp, useData } from './context'
import { StatusMessage } from './ui'

const EXIT_MS = 140

export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  )
}

interface SegmentedProps {
  legend: string
  name: string
  options: { value: string; label: string }[]
  defaultValue: string
}

function Segmented({ legend, name, options, defaultValue }: SegmentedProps) {
  return (
    <fieldset className="segmented">
      <legend>{legend}</legend>
      <div className="segmented-track">
        {options.map((option) => (
          <label key={option.value} className="segment">
            <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface DialogProps {
  title: string
  icon: LucideIcon
  submitLabel: string
  canSubmit?: boolean
  onClose: () => void
  onSubmit: (form: FormData) => Promise<void>
  children: ReactNode
}

// Native modal <dialog>: the browser traps focus and returns it to the opener on close().
function Dialog({ title, icon: Icon, submitLabel, canSubmit = true, onClose, onSubmit, children }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  const titleId = useId()
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  // Plays the exit transition, then closes natively before the parent unmounts the dialog.
  const close = () => {
    if (closing.current) return
    closing.current = true
    setLeaving(true)
    window.setTimeout(() => {
      dialog.current?.close()
      onClose()
    }, EXIT_MS)
  }

  const cancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    close()
  }

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialog.current) close()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(new FormData(event.currentTarget))
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.')
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialog} className={leaving ? 'dialog dialog-leaving' : 'dialog'} aria-labelledby={titleId} onCancel={cancel} onClose={onClose} onClick={closeOnBackdrop}>
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-heading">
          <span className="tile tone-blue"><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 id={titleId} className="dialog-title">{title}</h2>
        </div>
        {children}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-ghost" onClick={close}>Cancelar</button>
          <button type="submit" className="button button-primary" disabled={busy || !canSubmit}>{submitLabel}</button>
        </div>
      </form>
    </dialog>
  )
}

const FILE_TYPES = ['PDF', 'PNG', 'DOCX', 'ZIP'].map((type) => ({ value: type, label: type }))

export function CreateFileDialog({ onClose }: { onClose: () => void }) {
  const { refresh, notify } = useApp()
  const navigate = useNavigate()

  const submit = async (form: FormData) => {
    const file = await createFile({ name: String(form.get('name')).trim(), type: String(form.get('type')) })
    refresh()
    notify(`${file.name} criado.`)
    navigate('/arquivos')
  }

  return (
    <Dialog title="Criar arquivo" icon={FilePlus2} submitLabel="Criar" onClose={onClose} onSubmit={submit}>
      <Field label="Nome do arquivo">
        {(id) => <input id={id} name="name" className="input" placeholder="Relatorio_agosto.pdf" required maxLength={255} autoComplete="off" />}
      </Field>
      <Segmented legend="Tipo" name="type" options={FILE_TYPES} defaultValue="PDF" />
    </Dialog>
  )
}

const VALIDITY_OPTIONS = [
  { value: '1', label: '24 horas' },
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: 'never', label: 'Sem limite' },
]

export function CreateLinkDialog({ fileId, onClose }: { fileId?: string; onClose: () => void }) {
  const { refresh, notify } = useApp()
  const navigate = useNavigate()
  const files = useData(getFiles)
  const settings = useData(getSettings)
  const ready = Boolean(files.data?.length && settings.data)
  const passwordRequired = settings.data?.requirePassword ?? true

  const submit = async (form: FormData) => {
    const validity = String(form.get('validity'))
    const link = await createLink({
      fileId: String(form.get('fileId')),
      expiresInDays: validity === 'never' ? null : Number(validity),
      password: String(form.get('password')) || null,
    })
    refresh()
    notify(`Link criado: ${link.url}`)
    navigate('/links')
  }

  return (
    <Dialog title="Gerar link de compartilhamento" icon={Link2} submitLabel="Gerar link" canSubmit={ready} onClose={onClose} onSubmit={submit}>
      {files.data?.length === 0 && <p className="status">Crie um arquivo antes de gerar um link.</p>}
      {!ready && files.data?.length !== 0 && <StatusMessage error={files.error || settings.error} />}
      {ready && (
        <>
          <Field label="Arquivo">
            {(id) => (
              <select id={id} name="fileId" className="input" defaultValue={fileId}>
                {files.data?.map((file) => (
                  <option key={file.id} value={file.id}>{file.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Segmented legend="Validade" name="validity" options={VALIDITY_OPTIONS} defaultValue="7" />
          <Field label={passwordRequired ? 'Senha' : 'Senha (opcional)'}>
            {(id) => <input id={id} name="password" type="password" className="input" required={passwordRequired} minLength={8} autoComplete="new-password" />}
          </Field>
        </>
      )}
    </Dialog>
  )
}
