import { CheckCircle2, Crown, History, MailWarning, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Notice } from '@/components/auth/AuthLayout'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listAudit, listUsers, setPlan, setRole, type AdminUser, type AuditEntry } from '@/lib/admin'
import { AUTH_MESSAGES, AuthError, isAdmin, ROLE_LABEL, useUser, type AuthErrorCode, type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const box = 'rounded-card bg-white p-4 shadow-soft sm:p-5'
const date = (d: string | null) => d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'nunca'
const ago = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  if (m < 60 * 24) return `hace ${Math.round(m / 60)} h`
  return date(d)
}
const TIER: Record<User['plan_tier'], string> = { free: 'Gratis', premium: 'Premium' }

/** Panel de administración (solo admins). Los permisos los comprueba la base de datos en cada acción. */
export default function Admin() {
  const me = useUser()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [err, setErr] = useState<AuthErrorCode | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setErr(null)
    try { const [u, a] = await Promise.all([listUsers(), listAudit()]); setUsers(u); setAudit(a) } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown'); setUsers([]) }
  }, [])
  useEffect(() => { if (me && isAdmin(me) && supabase) load() }, [me?.id, me?.role, load]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (users ?? []).filter((u) => !t || u.email.toLowerCase().includes(t) || (u.display_name ?? '').toLowerCase().includes(t))
  }, [users, q])

  if (!me) return null
  if (!isAdmin(me)) return <EmptyState title="Esta zona es solo para admins" text="Tu cuenta no tiene permisos de administración." cta={{ to: '/cuenta', label: 'Volver a mi cuenta' }} />
  if (!supabase) return <EmptyState title="Panel de administración" text="Necesita la base de datos de Supabase: en modo demo no hay otras cuentas." />

  const stats = users && [
    { label: 'Cuentas', value: users.length },
    { label: 'Verificadas', value: users.filter((u) => u.email_confirmed).length },
    { label: 'Premium', value: users.filter((u) => u.plan_tier === 'premium').length },
    { label: 'Planes guardados', value: users.reduce((a, u) => a + u.saved_plans, 0) },
  ]
  const byId = new Map((users ?? []).map((u) => [u.id, u]))
  const who = (id: string | null) => (id && byId.get(id)?.email) || (id ? 'cuenta borrada' : 'el sistema')

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.1em] text-coral-700"><ShieldCheck className="h-4 w-4" aria-hidden /> {ROLE_LABEL[me.role]}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Panel de administración</h1>
          <p className="mt-1 text-noche-600">Cuentas y planes. No se ve el contenido de los planes privados de nadie.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setUsers(null); load() }}><RefreshCw className="h-4 w-4" aria-hidden /> Actualizar</Button>
      </div>

      {err && <div className="mt-6"><Notice tone="error">{err === 'forbidden' ? 'La base de datos no te reconoce como admin. Si acabas de recibir el rol, cierra sesión y vuelve a entrar.' : AUTH_MESSAGES[err]}</Notice></div>}

      <section aria-label="Resumen" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats ? stats.map((s) => (
          <div key={s.label} className={box}>
            <p className="text-sm font-bold text-noche-600">{s.label}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{s.value}</p>
          </div>
        )) : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </section>

      <section aria-labelledby="cuentas" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cuentas" className="flex items-center gap-2 text-xl font-extrabold"><Users className="h-5 w-5" aria-hidden /> Cuentas</h2>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Buscar por email o nombre</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-noche-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email o nombre" className="h-11 w-full rounded-xl border-2 border-noche/15 bg-white pl-10 pr-4 text-[15px] outline-none focus:border-noche" />
          </label>
        </div>
        <ul className="mt-4 space-y-3">
          {!users ? [0, 1, 2].map((i) => <li key={i}><Skeleton className="h-28" /></li>) :
            shown.length ? shown.map((u) => <UserRow key={u.id} u={u} me={me} onChanged={load} />) :
            <li className={box + ' text-noche-600'}>{q ? 'Ninguna cuenta coincide con la búsqueda.' : 'Aún no hay cuentas.'}</li>}
        </ul>
      </section>

      <section aria-labelledby="registro" className="mt-10">
        <h2 id="registro" className="flex items-center gap-2 text-xl font-extrabold"><History className="h-5 w-5" aria-hidden /> Últimos cambios</h2>
        <p className="mt-1 text-sm text-noche-600">Cada cambio de plan o de rol queda registrado y no se puede borrar desde la app.</p>
        <ul className={box + ' mt-3 divide-y divide-noche/5 py-1 sm:py-1'}>
          {audit.length ? audit.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 text-[15px]">
              <span>{a.action === 'principal_admin' ? <><b className="break-all">{who(a.target_id)}</b> pasa a ser admin principal</> :
                <><b className="break-all">{who(a.actor_id)}</b> {a.action === 'set_plan' ? 'cambió el plan de' : 'cambió el rol de'} <b className="break-all">{who(a.target_id)}</b>: {label(a)}</>}</span>
              <span className="text-sm text-noche-600">{ago(a.created_at)}</span>
            </li>
          )) : <li className="py-2.5 text-noche-600">Todavía no hay cambios.</li>}
        </ul>
      </section>
    </main>
  )
}

function label(a: AuditEntry) {
  const f = (v?: string) => (a.action === 'set_plan' ? TIER[v as User['plan_tier']] : ROLE_LABEL[v as keyof typeof ROLE_LABEL]) ?? v ?? '—'
  return `${f(a.detail.from)} → ${f(a.detail.to)}`
}

function UserRow({ u, me, onChanged }: { u: AdminUser; me: User; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AuthErrorCode | null>(null)
  const [confirmRole, setConfirmRole] = useState(false)
  const self = u.id === me.id
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null)
    try { await fn(); setConfirmRole(false); await onChanged() } catch (x) { setErr(x instanceof AuthError ? x.code : 'unknown') } finally { setBusy(false) }
  }
  const canRole = me.role === 'owner' && !self && u.role !== 'owner'
  const nextRole = u.role === 'admin' ? 'user' : 'admin'

  return (
    <li className={box}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
            {u.display_name || u.email.split('@')[0]}
            {u.role !== 'user' && <Badge className={u.role === 'owner' ? 'bg-noche text-white' : ''}>{u.role === 'owner' ? <Crown className="h-3.5 w-3.5" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}{ROLE_LABEL[u.role]}</Badge>}
            {self && <span className="text-sm font-semibold text-noche-600">(tú)</span>}
          </p>
          <p className="break-all text-[15px] text-noche-600">{u.email}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-noche-600">
            {u.email_confirmed ? <span className="inline-flex items-center gap-1 text-[#145A2E]"><CheckCircle2 className="h-4 w-4" aria-hidden /> Email verificado</span> : <span className="inline-flex items-center gap-1 text-coral-700"><MailWarning className="h-4 w-4" aria-hidden /> Sin verificar</span>}
            <span>Alta: {date(u.created_at)}</span>
            <span>Último acceso: {date(u.last_sign_in_at)}</span>
            <span>{u.saved_plans} {u.saved_plans === 1 ? 'plan' : 'planes'} · {u.shared_plans} compartido{u.shared_plans === 1 ? '' : 's'}</span>
          </p>
        </div>
        <div role="group" aria-label={`Plan de ${u.email}`} className="flex shrink-0 rounded-full bg-noche/5 p-1">
          {(['free', 'premium'] as const).map((t) => (
            <button key={t} type="button" disabled={busy} aria-pressed={u.plan_tier === t} onClick={() => u.plan_tier !== t && act(() => setPlan(u.id, t))}
              className={cn('h-9 rounded-full px-4 text-sm font-bold transition disabled:opacity-60', u.plan_tier === t ? 'bg-white text-noche shadow-soft' : 'text-noche-600 hover:text-noche')}>
              {TIER[t]}
            </button>
          ))}
        </div>
      </div>
      {canRole && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-noche/5 pt-3">
          {!confirmRole ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRole(true)}>{nextRole === 'admin' ? 'Hacer admin' : 'Quitar admin'}</Button>
          ) : (
            <>
              <span className="text-[15px] font-semibold">{nextRole === 'admin' ? `¿Dar permisos de admin a ${u.email}? Podrá ver todas las cuentas y cambiar planes.` : `¿Quitar los permisos de admin a ${u.email}?`}</span>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => act(() => setRole(u.id, nextRole))}>{busy ? 'Guardando…' : 'Sí, confirmar'}</Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRole(false)}>Cancelar</Button>
            </>
          )}
        </div>
      )}
      {err && <div className="mt-3"><Notice tone="error">{err === 'email_not_confirmed' ? 'Solo se puede hacer admin a una cuenta con el email verificado.' : AUTH_MESSAGES[err]}</Notice></div>}
    </li>
  )
}
