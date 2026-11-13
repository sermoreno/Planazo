import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthLayout, Notice, TextField } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { AUTH_MESSAGES, AuthError, requestPasswordReset, type AuthErrorCode } from '@/lib/auth'

export default function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AuthErrorCode | null>(null)
  const [sent, setSent] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { await requestPasswordReset(email); setSent(true) } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown') } finally { setBusy(false) }
  }
  return (
    <AuthLayout eyebrow="Recuperar acceso" title="¿Olvidaste tu contraseña?" subtitle="Te enviamos un enlace para crear una nueva."
      footer={<Link to="/entrar" className="font-bold text-white underline underline-offset-4">Volver a entrar</Link>}>
      {sent ? (
        <div className="space-y-4">
          <Notice tone="ok">Si hay una cuenta con <b className="break-all">{email.trim()}</b>, te llegará un email con un enlace para cambiar la contraseña.</Notice>
          <p className="text-sm text-noche-600">Ábrelo en este dispositivo o en otro: te traerá aquí para elegir la nueva. Si no llega en unos minutos, mira en spam.</p>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>Probar con otro email</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {err && <Notice tone="error">{AUTH_MESSAGES[err]}</Notice>}
          <TextField label="Email de tu cuenta" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Enviando…' : 'Enviarme el enlace'}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
