import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthLayout, Notice, PasswordField, PasswordRules, TextField } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { AUTH_MESSAGES, AuthError, passwordIssues, resendVerification, signUp, useAuth, type AuthErrorCode } from '@/lib/auth'
import { useNext, withNext } from './Login'

export default function Register() {
  const { user, ready } = useAuth()
  const next = useNext()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AuthErrorCode | null>(null)
  const [sent, setSent] = useState(false)
  const [resent, setResent] = useState(false)

  if (ready && user && !sent) return <Navigate to={next} replace />

  const issues = passwordIssues(password)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setErr(null)
    if (issues.length) return
    setBusy(true)
    try { const r = await signUp(email, password, name); if (r === 'verify') setSent(true) } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown') } finally { setBusy(false) }
  }
  const resend = async () => {
    setBusy(true); setErr(null)
    try { await resendVerification(email); setResent(true) } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown') } finally { setBusy(false) }
  }

  if (sent) return (
    <AuthLayout eyebrow="Último paso" title="Verifica tu email" footer={<Link to={withNext('/entrar', next)} className="font-bold text-white underline underline-offset-4">Ya lo he verificado, quiero entrar</Link>}>
      <div className="space-y-4">
        <p className="flex items-start gap-3 text-[17px]"><MailCheck className="mt-0.5 h-6 w-6 shrink-0 text-coral-700" aria-hidden /><span>Te he enviado un enlace a <b className="break-all">{email.trim()}</b>. Ábrelo para activar tu cuenta; entrarás directamente.</span></p>
        <p className="text-sm text-noche-600">¿No te llega? Mira en spam o promociones. El enlace caduca en 24 horas.</p>
        {err && <Notice tone="error">{AUTH_MESSAGES[err]}</Notice>}
        {resent && <Notice tone="ok">Te lo he vuelto a enviar.</Notice>}
        <Button variant="outline" className="w-full" onClick={resend} disabled={busy || resent}>Reenviar el email</Button>
      </div>
    </AuthLayout>
  )

  return (
    <AuthLayout eyebrow="Gratis" title="Crea tu cuenta" subtitle="Guarda hasta 3 planes, compártelos y retómalos desde cualquier dispositivo."
      footer={<>¿Ya tienes cuenta? <Link to={withNext('/entrar', next)} className="font-bold text-white underline underline-offset-4">Entra</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        {err && <Notice tone="error">{AUTH_MESSAGES[err]}</Notice>}
        <TextField label="Nombre" autoComplete="given-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo quieres que te llamemos" hint="Opcional" />
        <TextField label="Email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        <PasswordField label="Contraseña" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => password && setTouched(true)}
          error={touched && issues.length ? `Le falta: ${issues.join(', ')}.` : undefined} hint={<PasswordRules value={password} />} />
        <Button type="submit" size="lg" className="w-full" disabled={busy || !ready}>{busy ? 'Creando tu cuenta…' : 'Crear cuenta'}</Button>
        <p className="text-xs text-noche-600">Al crear la cuenta aceptas que guardemos tu email y tus planes para darte el servicio. Puedes borrar tu cuenta cuando quieras desde Cuenta.</p>
      </form>
    </AuthLayout>
  )
}
