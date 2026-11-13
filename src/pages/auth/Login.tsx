import { ArrowRight, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { AuthLayout, Notice, PasswordField, TextField } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { AUTH_MESSAGES, AuthError, linkErrorFromUrl, resendVerification, signIn, signInWithPassword, useAuth, appUrl, type AuthErrorCode } from '@/lib/auth'

/** Destino seguro tras entrar: solo rutas internas (evita redirecciones abiertas). */
export function useNext() {
  const [q] = useSearchParams()
  const n = q.get('next') ?? ''
  return n.startsWith('/') && !n.startsWith('//') ? n : '/plan/nuevo'
}
export const withNext = (path: string, next: string) => (next && next !== '/plan/nuevo' ? `${path}?next=${encodeURIComponent(next)}` : path)

export default function Login() {
  const { user, ready } = useAuth()
  const next = useNext()
  const [q] = useSearchParams()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AuthErrorCode | null>(() => linkErrorFromUrl())
  const [info, setInfo] = useState<string | null>(null)
  const [mode, setMode] = useState<'password' | 'link'>('password')

  useEffect(() => { if (q.get('verificado')) setInfo('¡Email verificado! Ya puedes usar Planazo.') }, [q])

  if (ready && user) return <Navigate to={next} replace state={(location.state as { from?: { state?: unknown } } | null)?.from?.state} />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setInfo(null)
    try {
      if (mode === 'link') { await signIn(email, appUrl(next.replace(/^\//, ''))); setInfo(`Te he enviado un enlace de acceso a ${email.trim()}. Ábrelo y entrarás directamente.`) }
      else await signInWithPassword(email, password)
    } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown') } finally { setBusy(false) }
  }
  const resend = async () => {
    setBusy(true)
    try { await resendVerification(email); setErr(null); setInfo(`Te he reenviado el email de verificación a ${email.trim()}.`) } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown') } finally { setBusy(false) }
  }

  return (
    <AuthLayout eyebrow="Planazo" title="Hola de nuevo" subtitle="Entra para crear, guardar y compartir tus planes por Madrid."
      footer={<>¿Aún no tienes cuenta? <Link to={withNext('/registro', next)} className="font-bold text-white underline underline-offset-4">Crea una gratis</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        {info && <Notice tone="ok">{info}</Notice>}
        {err && (
          <Notice tone="error">
            {AUTH_MESSAGES[err]}
            {err === 'email_not_confirmed' && <button type="button" onClick={resend} disabled={busy || !email} className="ml-1 font-bold underline underline-offset-2">Reenviar email</button>}
          </Notice>
        )}
        <TextField label="Email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        {mode === 'password' && (
          <div>
            <PasswordField label="Contraseña" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Link to="/recuperar" state={{ email }} className="mt-2 inline-block text-sm font-semibold text-noche underline underline-offset-2">¿Has olvidado tu contraseña?</Link>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !ready}>
          {busy ? 'Un momento…' : mode === 'password' ? <>Entrar <ArrowRight className="h-5 w-5" aria-hidden /></> : 'Enviarme el enlace'}
        </Button>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-noche-600"><span className="h-px flex-1 bg-noche/10" />o<span className="h-px flex-1 bg-noche/10" /></div>
        <Button type="button" variant="outline" className="w-full" onClick={() => { setMode(mode === 'password' ? 'link' : 'password'); setErr(null); setInfo(null) }}>
          {mode === 'password' ? <><Mail className="h-4 w-4" aria-hidden /> Entrar con un enlace por email</> : 'Entrar con contraseña'}
        </Button>
      </form>
    </AuthLayout>
  )
}
