import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'
import { PhotoBackdrop } from '@/components/PhotoBackdrop'
import { heroPhotos } from '@/lib/photos'
import { cn } from '@/lib/utils'

/** Pantallas de acceso: foto real de Madrid de fondo y tarjeta crema centrada (misma identidad que la portada). */
export function AuthLayout({ eyebrow, title, subtitle, children, footer }: { eyebrow?: string; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="relative -mt-14 flex min-h-[100svh] items-center justify-center overflow-hidden px-4 pb-12 pt-24">
      <PhotoBackdrop photos={heroPhotos()} overlay="dim" interval={9000} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md">
        {eyebrow && <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-coral">{eyebrow}</p>}
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.05] tracking-tight text-white [text-wrap:balance] sm:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[17px] leading-relaxed text-white/85">{subtitle}</p>}
        <div className="mt-6 rounded-[24px] bg-crema p-5 shadow-soft sm:p-6">{children}</div>
        {footer && <div className="mt-4 text-center text-[15px] text-white/90">{footer}</div>}
      </motion.div>
    </main>
  )
}

const inputCls = 'mt-1 h-12 w-full rounded-xl border-2 border-noche/15 bg-white px-4 text-base outline-none transition focus:border-noche aria-[invalid=true]:border-coral-700'

export function TextField({ label, hint, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <label className="block" htmlFor={id}>
      <span className="text-sm font-bold">{label}</span>
      <input id={id} aria-invalid={!!error} aria-describedby={error || hint ? id + '-d' : undefined} className={inputCls} {...props} />
      {(error || hint) && <span id={id + '-d'} className={cn('mt-1 block text-[13px]', error ? 'font-semibold text-coral-700' : 'text-noche-600')}>{error || hint}</span>}
    </label>
  )
}

export function PasswordField({ label, hint, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode; error?: string }) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} aria-invalid={!!error} aria-describedby={error || hint ? id + '-d' : undefined} className={cn(inputCls, 'pr-12')} {...props} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1 grid h-12 w-11 place-items-center rounded-xl text-noche-600 hover:text-noche" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show}>
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {(error || hint) && <div id={id + '-d'} className={cn('mt-1 text-[13px]', error ? 'font-semibold text-coral-700' : 'text-noche-600')}>{error || hint}</div>}
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: React.ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl px-3.5 py-3 text-[15px]', tone === 'error' ? 'bg-coral-50 text-coral-700' : tone === 'ok' ? 'bg-[#E7F6EC] text-[#145A2E]' : 'bg-noche/5 text-noche')}>
      {children}
    </div>
  )
}

/** Lista de requisitos de la contraseña, en vivo. */
export function PasswordRules({ value }: { value: string }) {
  const rules = [
    { ok: value.length >= 8, t: '8 caracteres o más' },
    { ok: /[a-záéíóúñü]/i.test(value), t: 'una letra' },
    { ok: /\d/.test(value), t: 'un número' },
  ]
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {rules.map((r) => (
        <li key={r.t} className={cn('inline-flex items-center gap-1', r.ok ? 'font-semibold text-[#145A2E]' : 'text-noche-600')}>
          <span aria-hidden>{r.ok ? '✓' : '·'}</span>{r.t}<span className="sr-only">{r.ok ? ' (cumplido)' : ' (pendiente)'}</span>
        </li>
      ))}
    </ul>
  )
}
