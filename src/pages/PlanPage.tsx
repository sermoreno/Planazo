import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, BookmarkCheck, CloudRain, Copy, Feather, MapPinned, PiggyBank, Share2, Sparkles, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { ItineraryView, type EditHandlers } from '@/components/ItineraryView'
import { LoginForm } from '@/components/LoginForm'
import { Modal } from '@/components/Modal'
import { PremiumNotice } from '@/components/PremiumNotice'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { mockItinerary } from '@/lib/mock'
import { getPlace } from '@/lib/places'
import { adjustGlobal, alternativesFor, removeSlot, replaceSlot, totalCost, type GlobalAdjust } from '@/lib/planner'
import { FreeLimitError, getDraft, getSaved, putDraft, saveItinerary, sharePlan, shareUrl, useUser } from '@/lib/store'
import type { Itinerary } from '@/lib/types'
import { cn, euros, uid } from '@/lib/utils'

const ADJUSTS: { k: GlobalAdjust; label: string; I: typeof PiggyBank }[] = [
  { k: 'cheaper', label: 'Más barato', I: PiggyBank },
  { k: 'calmer', label: 'Más tranquilo', I: Feather },
  { k: 'zone', label: 'Otra zona', I: MapPinned },
  { k: 'rain', label: 'Plan B si llueve', I: CloudRain },
]

type Pending = 'save' | 'share' | null
const clearPending = () => { try { localStorage.removeItem('pz_pending'); sessionStorage.removeItem('pz_pending') } catch { /* nada */ } }

export default function PlanPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useUser()
  const [it, setIt] = useState<Itinerary | null | undefined>(undefined)
  const [history, setHistory] = useState<Itinerary[]>([])
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [modal, setModal] = useState<'login' | 'premium' | 'share' | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Carga: ejemplo, borrador de este navegador o plan guardado en la cuenta.
  useEffect(() => {
    if (id === 'demo') return setIt(mockItinerary())
    const d = getDraft(id)
    if (d) return setIt(d)
    let live = true
    getSaved(id).then((s) => live && setIt(s)).catch(() => live && setIt(null))
    return () => { live = false }
  }, [id, user?.id])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t) }, [toast])

  /** Aplica un cambio sin recargar. El plan de ejemplo se copia a un borrador propio en el primer cambio. */
  const commit = useCallback((next: Itinerary, msg?: string) => {
    if (!it) return
    setHistory((h) => [...h.slice(-9), it])
    let n = next
    if (n.id === 'demo') { n = { ...n, id: uid(), source: 'local', status: 'draft' }; navigate(`/plan/${n.id}`, { replace: true }) }
    putDraft(n)
    setIt(n)
    setDirty(true)
    if (msg) setToast(msg)
  }, [it, navigate])

  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev || !it) return
    const back = { ...prev, id: it.id }
    setHistory((h) => h.slice(0, -1)); putDraft(back); setIt(back); setToast('Cambio deshecho')
  }

  const doSave = async (kind: Exclude<Pending, null>) => {
    if (!it) return
    setBusy(true)
    try {
      const base = it.id === 'demo' ? { ...it, id: uid(), source: 'local' as const } : it
      const r = kind === 'share' ? await sharePlan(base) : await saveItinerary(base)
      setIt(r); setDirty(false)
      if (r.id !== id) navigate(`/plan/${r.id}`, { replace: true })
      if (kind === 'share') { setCopied(false); setModal('share') } else { setModal(null); setToast('Plan guardado en Mis planes') }
    } catch (e) {
      if (e instanceof FreeLimitError) setModal('premium')
      else setToast('No se pudo guardar. Inténtalo de nuevo.')
    } finally { setBusy(false); setPending(null) }
  }
  const request = (kind: Exclude<Pending, null>) => {
    if (!user) {
      setPending(kind); setModal('login')
      // Con magic link se vuelve a esta página desde el email: recordamos qué se quería hacer.
      try { sessionStorage.setItem('pz_pending', JSON.stringify({ id, kind })); localStorage.setItem('pz_pending', JSON.stringify({ id, kind })) } catch { /* sin almacenamiento */ }
      return
    }
    if (kind === 'share' && it?.is_public && it.share_slug && !dirty) { setCopied(false); setModal('share'); return }
    void doSave(kind)
  }
  // Al iniciar sesión desde el diálogo, se completa la acción que se pidió.
  useEffect(() => { if (user && pending && modal === 'login') { clearPending(); void doSave(pending) } /* eslint-disable-line react-hooks/exhaustive-deps */ }, [user])
  useEffect(() => {
    if (!user || !it) return
    let p: { id: string; kind: Exclude<Pending, null> } | null = null
    try { p = JSON.parse(localStorage.getItem('pz_pending') ?? 'null') } catch { /* nada */ }
    if (p && p.id === id) { clearPending(); void doSave(p.kind) }
  }, [user, it?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (it === undefined) return <div className="mx-auto max-w-6xl space-y-3 px-4 py-6"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
  if (!it) return <EmptyState title="No encontramos este plan" text={user ? 'Puede que se borrara o que esté en otra cuenta.' : 'Si lo guardaste, entra en tu cuenta para verlo. Si no, crea uno nuevo en un minuto.'} cta={user ? { to: '/plan/nuevo', label: 'Crear un plan' } : { to: '/cuenta', label: 'Entrar' }} />
  if (!it.slots.length) return <EmptyState title="No he encontrado un plan con esas condiciones" text={it.agent_message ?? 'Prueba a subir el presupuesto o a cambiar el día.'} cta={{ to: '/plan/nuevo', label: 'Cambiar preferencias' }} />

  const edit: EditHandlers = {
    alternatives: (sid) => alternativesFor(it, sid),
    onReplace: (sid, pid) => {
      const old = getPlace(it.slots.find((s) => s.id === sid)!.place_id)!
      commit(replaceSlot(it, sid, pid), `${old.name} → ${getPlace(pid)!.name}`)
    },
    onRemove: (sid) => commit(removeSlot(it, sid), `Quitada: ${getPlace(it.slots.find((s) => s.id === sid)!.place_id)!.name}`),
  }
  const adjust = (k: GlobalAdjust) => {
    // "Más barato" prueba varias combinaciones y se queda con la más económica; solo cambia si de verdad ahorra.
    const tries = k === 'cheaper' ? [0, 1, 2, 3, 4, 5].map((i) => adjustGlobal(it, k, Date.now() + i * 101)) : [adjustGlobal(it, k)]
    const next = tries.filter((t) => t.slots.length).sort((a, b) => totalCost(a) - totalCost(b))[0] ?? tries[0]
    if (k === 'cheaper' && next.slots.length && totalCost(next) >= totalCost(it)) return setToast('Tu plan ya es de lo más económico')
    if (!next.slots.length) return setToast('No encuentro alternativas con ese ajuste. Prueba otro.')
    if (next.slots.map((s) => s.place_id).join() === it.slots.map((s) => s.place_id).join()) return setToast('Tu plan ya cumple ese ajuste')
    const before = totalCost(it), after = totalCost(next)
    const msg = k === 'cheaper' ? `Más barato: ${euros(before)} → ${euros(after)}` : k === 'rain' ? 'Plan B: priorizo sitios a cubierto' : k === 'zone' ? 'Te propongo otros barrios' : 'Ritmo más tranquilo, con menos paradas'
    commit(next, msg)
  }

  const saved = it.status === 'saved' && !dirty
  const toolbar = (
    <div className="mb-4 space-y-3">
      {it.agent_message && (
        <div className="flex gap-2 rounded-card bg-white p-3 text-[15px] shadow-soft">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral text-xs font-extrabold text-noche" aria-hidden>P</span>
          <div>
            <p>{it.agent_message}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs font-semibold text-noche-600">
              <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" aria-hidden />{it.source === 'ia' ? 'Generado con IA' : 'Planificador local (modo demo)'}</span>
              <Link to="/plan/nuevo" className="underline underline-offset-2">Empezar de nuevo</Link>
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => request('save')} disabled={busy || saved} variant={saved ? 'outline' : 'default'} className="flex-1 sm:flex-none">
          {saved ? <><BookmarkCheck className="h-5 w-5" aria-hidden /> Guardado</> : <><Bookmark className="h-5 w-5" aria-hidden /> {it.status === 'saved' ? 'Guardar cambios' : 'Guardar'}</>}
        </Button>
        <Button variant="secondary" onClick={() => request('share')} disabled={busy} className="flex-1 sm:flex-none"><Share2 className="h-5 w-5" aria-hidden /> Compartir</Button>
        {history.length > 0 && <Button variant="ghost" onClick={undo}><Undo2 className="h-5 w-5" aria-hidden /> Deshacer</Button>}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-noche-600">Ajustar todo el plan</p>
        <div className="-mx-4 mt-1.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
          {ADJUSTS.map(({ k, label, I }) => (
            <button key={k} onClick={() => adjust(k)} className={cn('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 border-noche/15 bg-white px-3.5 text-sm font-semibold transition hover:border-noche/40 active:scale-95')}>
              <I className="h-4 w-4" aria-hidden />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const url = it.share_slug ? shareUrl(it) : ''
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setCopied(false) } }
  const nativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <>
      <ItineraryView it={it} edit={edit} toolbar={toolbar} onRain={() => adjust('rain')} />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[1500] flex justify-center px-4 lg:bottom-6">
        <AnimatePresence>
          {toast && (
            <motion.p key={toast} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="rounded-full bg-noche px-4 py-2.5 text-sm font-semibold text-white shadow-soft">
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <Modal open={modal === 'login'} onClose={() => { setModal(null); setPending(null); clearPending() }} title={pending === 'share' ? 'Entra para compartir tu plan' : 'Entra para guardar tu plan'}>
        <LoginForm note="Así lo tendrás en Mis planes desde cualquier momento." />
      </Modal>
      <Modal open={modal === 'premium'} onClose={() => setModal(null)} title="Has llegado al límite gratuito">
        <PremiumNotice onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'share'} onClose={() => setModal(null)} title="Comparte tu plan">
        <p className="text-noche-600">Cualquiera con el enlace podrá verlo, sin poder editarlo.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-noche/15 bg-white p-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm" title={url}>{url}</span>
          <Button size="sm" onClick={copy}><Copy className="h-4 w-4" aria-hidden />{copied ? 'Copiado' : 'Copiar'}</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {nativeShare && <Button variant="secondary" onClick={() => navigator.share({ title: it.title, text: `Mi plan en Madrid: ${it.title}`, url }).catch(() => {})}><Share2 className="h-4 w-4" aria-hidden /> Enviar</Button>}
          <Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(`${it.title} ${url}`)}`} target="_blank" rel="noreferrer">WhatsApp</a></Button>
          <Button variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer">Ver como invitado</a></Button>
        </div>
      </Modal>
    </>
  )
}
