import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout, Notice, PasswordField, PasswordRules } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AUTH_MESSAGES, AuthError, linkErrorFromUrl, passwordIssues, updatePassword, useAuth, type AuthErrorCode } from '@/lib/auth'

/** Llega desde el email de recuperación: Supabase abre una sesión temporal y aquí se elige la nueva contraseña. */
export default function ResetPassword() {
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AuthErrorCode | null>(() => linkErrorFromUrl())
  const [done, setDone] = useState(false)

  const issues = passwordIssues(password)
  const mismatch = repeat.length > 0 && repeat !== password
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setErr(null)
    if (issues.length || repeat !== password) return
    setBusy(true)
    try { await updatePassword(password); setDone(true); setTimeout(() => navigate('/plan/nuevo', { replace: true }), 1800) } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown') } finally { setBusy(false) }
  }

  if (!ready) return <AuthLayout title="Comprobando el enlace…"><Skeleton className="h-12" /></AuthLayout>
  if (!user) return (
    <AuthLayout eyebrow="Recuperar acceso" title="Este enlace no es válido" footer={<Link to="/entrar" className="font-bold text-white underline underline-offset-4">Volver a entrar</Link>}>
      <div className="space-y-4">
        <Notice tone="error">{AUTH_MESSAGES[err ?? 'expired']}</Notice>
        <Button asChild className="w-full"><Link to="/recuperar">Pedir un enlace nuevo</Link></Button>
      </div>
    </AuthLayout>
  )
  return (
    <AuthLayout eyebrow="Recuperar acceso" title="Elige una contraseña nueva" subtitle={`Para ${user.email}`}>
      {done ? <Notice tone="ok">Contraseña cambiada. Te llevo a crear un plan…</Notice> : (
        <form onSubmit={submit} className="space-y-4">
          {err && <Notice tone="error">{AUTH_MESSAGES[err]}</Notice>}
          <PasswordField label="Nueva contraseña" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
            error={touched && issues.length ? `Le falta: ${issues.join(', ')}.` : undefined} hint={<PasswordRules value={password} />} />
          <PasswordField label="Repite la contraseña" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={(touched || mismatch) && repeat !== password ? 'Las contraseñas no coinciden.' : undefined} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
