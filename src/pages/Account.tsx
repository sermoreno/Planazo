import { Download, KeyRound, LogOut, Mail, MonitorSmartphone, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Notice, PasswordField, PasswordRules, TextField } from '@/components/auth/AuthLayout'
import { PremiumNotice } from '@/components/PremiumNotice'
import { Button } from '@/components/ui/button'
import { AUTH_MESSAGES, AuthError, deleteAccount, exportMyData, isAdmin, passwordIssues, ROLE_LABEL, signOut, updateDisplayName, updateEmail, updatePassword, useUser, type AuthErrorCode } from '@/lib/auth'
import { FREE_LIMIT, listSaved } from '@/lib/store'
import { supabase } from '@/lib/supabase'

const box = 'rounded-card bg-white p-4 shadow-soft sm:p-5'

/** Cuenta (ruta privada): datos, nombre, contraseña, cerrar sesión y borrar la cuenta. */
export default function Account() {
  const user = useUser()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => { if (user) listSaved().then((p) => setCount(p.length)).catch(() => setCount(null)) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null // la ruta es privada; solo pasa un instante al cerrar sesión
  const admin = isAdmin(user)
  const out = async (everywhere: boolean) => { await signOut(everywhere); navigate('/', { replace: true }) }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Tu cuenta</h1>
      <p className="mt-1 text-noche-600">Hola, {user.display_name}.</p>
      {params.get('email') && <div className="mt-4"><Notice tone="ok">Enlace confirmado. Si te pedimos confirmar también en tu otro email, ábrelo allí; cuando estén los dos, verás aquí el email nuevo.</Notice></div>}

      {admin && (
        <Link to="/admin" className="mt-6 flex items-center gap-3 rounded-card bg-noche p-4 text-white shadow-soft transition hover:bg-noche-600 sm:p-5">
          <ShieldCheck className="h-6 w-6 shrink-0 text-coral" aria-hidden />
          <span><span className="block text-lg font-extrabold">Panel de administración</span><span className="text-[15px] text-white/80">Eres {ROLE_LABEL[user.role]}: gestiona cuentas y planes.</span></span>
        </Link>
      )}

      <section className={box + ' mt-6'} aria-labelledby="datos">
        <h2 id="datos" className="sr-only">Tus datos</h2>
        <p className="text-sm font-bold text-noche-600">Email</p>
        <p className="break-all text-lg font-semibold">{user.email}</p>
        <p className="mt-3 text-sm font-bold text-noche-600">Plan</p>
        <p className="text-lg font-semibold">{user.plan_tier === 'premium' ? 'Premium' : 'Gratuito'}{user.plan_tier === 'free' && (admin ? <span className="text-base font-normal text-noche-600"> · sin límite por ser admin</span> : count !== null && <span className="text-base font-normal text-noche-600"> · {count} de {FREE_LIMIT} planes guardados</span>)}</p>
        <p className="mt-3 text-sm font-bold text-noche-600">Rol</p>
        <p className="text-lg font-semibold">{ROLE_LABEL[user.role]}</p>
        <p className="mt-3 text-sm font-bold text-noche-600">Ciudad</p>
        <p className="text-lg font-semibold">Madrid</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to="/mis-planes">Mis planes</Link></Button>
          <Button variant="ghost" onClick={() => out(false)}><LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión</Button>
        </div>
        {!supabase && <p className="mt-3 text-xs text-noche-600">Modo demo: la cuenta vive solo en este navegador.</p>}
      </section>

      <NameForm current={user.display_name} />
      <EmailForm current={user.email} />
      <PasswordForm />

      <section className={box + ' mt-4 space-y-3'} aria-labelledby="sesiones">
        <h2 id="sesiones" className="flex items-center gap-2 text-lg font-extrabold"><MonitorSmartphone className="h-5 w-5" aria-hidden /> Sesiones y datos</h2>
        <p className="text-[15px] text-noche-600">¿Has entrado en un ordenador que no es tuyo o has perdido el móvil? Cierra la sesión en todos los dispositivos a la vez.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => out(true)}><LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión en todos</Button>
          <Button variant="ghost" onClick={async () => exportMyData(await listSaved().catch(() => []))}><Download className="h-4 w-4" aria-hidden /> Descargar mis datos</Button>
        </div>
      </section>

      {user.plan_tier === 'free' && !admin && <div className="mt-8"><h2 className="mb-2 text-xl font-extrabold">¿Quieres más?</h2><PremiumNotice /></div>}

      <DeleteAccount owner={user.role === 'owner'} onDone={() => navigate('/', { replace: true })} />
    </main>
  )
}

function NameForm({ current }: { current: string }) {
  const [name, setName] = useState(current)
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | AuthErrorCode>('idle')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setState('busy')
    try { await updateDisplayName(name); setState('ok') } catch (x) { setState(x instanceof AuthError ? x.code : 'unknown') }
  }
  return (
    <form onSubmit={submit} className={box + ' mt-4 space-y-3'}>
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><UserRound className="h-5 w-5" aria-hidden /> Tu nombre</h2>
      <TextField label="Nombre" maxLength={60} value={name} onChange={(e) => { setName(e.target.value); setState('idle') }} autoComplete="given-name" />
      {state === 'ok' && <Notice tone="ok">Nombre guardado.</Notice>}
      {state !== 'idle' && state !== 'busy' && state !== 'ok' && <Notice tone="error">{AUTH_MESSAGES[state]}</Notice>}
      <Button type="submit" variant="outline" disabled={state === 'busy' || name.trim() === current}>Guardar nombre</Button>
    </form>
  )
}

function EmailForm({ current }: { current: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'confirm' | 'done' | AuthErrorCode>('idle')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setState('busy')
    try { setState(await updateEmail(email)); setEmail('') } catch (x) { setState(x instanceof AuthError ? x.code : 'unknown') }
  }
  return (
    <form onSubmit={submit} className={box + ' mt-4 space-y-3'}>
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Mail className="h-5 w-5" aria-hidden /> Cambiar email</h2>
      <TextField label="Email nuevo" type="email" required autoComplete="email" inputMode="email" value={email} placeholder={current} onChange={(e) => { setEmail(e.target.value); if (state !== 'busy') setState('idle') }} />
      {state === 'confirm' && <Notice tone="ok">Te hemos enviado un enlace para confirmar el cambio. Por seguridad, puede que también tengas que confirmarlo desde tu email actual. Hasta entonces sigues entrando con {current}.</Notice>}
      {state === 'done' && <Notice tone="ok">Email cambiado.</Notice>}
      {state !== 'idle' && state !== 'busy' && state !== 'confirm' && state !== 'done' && <Notice tone="error">{AUTH_MESSAGES[state]}</Notice>}
      <Button type="submit" variant="outline" disabled={state === 'busy' || !email.trim()}>{state === 'busy' ? 'Enviando…' : 'Cambiar email'}</Button>
    </form>
  )
}

function PasswordForm() {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [touched, setTouched] = useState(false)
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | AuthErrorCode>('idle')
  const issues = passwordIssues(password)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true)
    if (issues.length || password !== repeat) return
    setState('busy')
    try { await updatePassword(password); setState('ok'); setPassword(''); setRepeat(''); setTouched(false) } catch (x) { setState(x instanceof AuthError ? x.code : 'unknown') }
  }
  return (
    <form onSubmit={submit} className={box + ' mt-4 space-y-3'}>
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><KeyRound className="h-5 w-5" aria-hidden /> Cambiar contraseña</h2>
      <PasswordField label="Nueva contraseña" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setState('idle') }}
        error={touched && issues.length ? `Le falta: ${issues.join(', ')}.` : undefined} hint={<PasswordRules value={password} />} />
      <PasswordField label="Repite la contraseña" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={touched && repeat !== password ? 'Las contraseñas no coinciden.' : undefined} />
      {state === 'ok' && <Notice tone="ok">Contraseña actualizada.</Notice>}
      {state !== 'idle' && state !== 'busy' && state !== 'ok' && <Notice tone="error">{AUTH_MESSAGES[state]}</Notice>}
      <Button type="submit" variant="outline" disabled={state === 'busy' || !password}>Cambiar contraseña</Button>
    </form>
  )
}

function DeleteAccount({ owner, onDone }: { owner: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | AuthErrorCode>('idle')
  const go = async () => {
    setState('busy')
    try { await deleteAccount(); onDone() } catch (x) { setState(x instanceof AuthError ? x.code : 'unknown') }
  }
  return (
    <section className="mt-10 rounded-card border-2 border-coral-700/30 p-4 sm:p-5" aria-labelledby="borrar">
      <h2 id="borrar" className="flex items-center gap-2 text-lg font-extrabold text-coral-700"><Trash2 className="h-5 w-5" aria-hidden /> Borrar mi cuenta</h2>
      <p className="mt-1 text-[15px] text-noche-600">Se borran tu cuenta, tus planes guardados y los enlaces que hayas compartido. No se puede deshacer.</p>
      {owner ? (
        <p className="mt-3 text-[15px] font-semibold">Eres el admin principal: tu cuenta está protegida y no se puede borrar desde aquí.</p>
      ) : !open ? (
        <Button variant="ghost" className="mt-3 text-coral-700" onClick={() => setOpen(true)}>Quiero borrar mi cuenta</Button>
      ) : (
        <div className="mt-3 space-y-3">
          <TextField label='Escribe BORRAR para confirmar' value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          {state !== 'idle' && state !== 'busy' && <Notice tone="error">{AUTH_MESSAGES[state]}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={text.trim().toUpperCase() !== 'BORRAR' || state === 'busy'} onClick={go}>{state === 'busy' ? 'Borrando…' : 'Borrar definitivamente'}</Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setText('') }}>Cancelar</Button>
          </div>
        </div>
      )}
    </section>
  )
}
