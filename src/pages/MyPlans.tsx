import { motion } from 'framer-motion'
import { CalendarDays, Plus, Trash2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { LoginForm } from '@/components/LoginForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getPlace } from '@/lib/places'
import { placePhoto } from '@/lib/photos'
import { totalCost } from '@/lib/planner'
import { deleteSaved, FREE_LIMIT, listSaved, useUser } from '@/lib/store'
import type { Itinerary } from '@/lib/types'
import { DAY_LABEL, euros } from '@/lib/utils'

export default function MyPlans() {
  const user = useUser()
  const [plans, setPlans] = useState<Itinerary[] | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  useEffect(() => { if (!user) return; let live = true; listSaved().then((p) => live && setPlans(p)).catch(() => live && setPlans([])); return () => { live = false } }, [user])

  if (!user) return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Mis planes</h1>
      <p className="mt-2 text-noche-600">Entra para guardar tus planes y tenerlos a mano el fin de semana.</p>
      <div className="mt-6"><LoginForm /></div>
    </main>
  )
  if (!plans) return <main className="mx-auto max-w-6xl space-y-3 px-4 py-8"><Skeleton className="h-9 w-48" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div></main>
  if (!plans.length) return <EmptyState title="Aún no has guardado planes" text="Crea uno en un minuto y pulsa Guardar para tenerlo aquí." cta={{ to: '/plan/nuevo', label: 'Crear mi plan' }} />

  const free = user.plan_tier === 'free'
  const remove = async (id: string) => { await deleteSaved(id); setPlans((p) => p?.filter((x) => x.id !== id) ?? []); setConfirm(null) }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Mis planes</h1>
          {free && <p className="mt-1 text-sm font-semibold text-noche-600">{plans.length} de {FREE_LIMIT} planes en la cuenta gratuita</p>}
        </div>
        <Button asChild><Link to="/plan/nuevo"><Plus className="h-5 w-5" aria-hidden /> Nuevo plan</Link></Button>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p, i) => {
          const first = p.slots.map((s) => getPlace(s.place_id)).find((pl) => pl && placePhoto(pl.name))
          const ph = first ? placePhoto(first.name) : null
          return (
            <motion.li key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="overflow-hidden rounded-card bg-white shadow-soft">
              <Link to={`/plan/${p.id}`} className="block">
                <div className="relative h-36 bg-noche-600">
                  {ph && <img src={ph.src} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  {p.is_public && <Badge className="absolute left-3 top-3 bg-white text-noche">Compartido</Badge>}
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-extrabold leading-snug">{p.title}</h2>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-noche-600">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{DAY_LABEL[p.prefs.day]}</span>
                    <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" aria-hidden />{euros(totalCost(p))}</span>
                    <span>{p.slots.length} paradas</span>
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm">{p.slots.map((s) => getPlace(s.place_id)?.name).join(' · ')}</p>
                </div>
              </Link>
              <div className="flex justify-end border-t border-noche/5 px-2 py-1.5">
                {confirm === p.id ? (
                  <span className="flex items-center gap-1">
                    <span className="text-sm font-semibold">¿Borrar este plan?</span>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>No</Button>
                    <Button size="sm" variant="secondary" onClick={() => remove(p.id)}>Sí, borrar</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(p.id)}><Trash2 className="h-4 w-4" aria-hidden /> Borrar</Button>
                )}
              </div>
            </motion.li>
          )
        })}
      </ul>
    </main>
  )
}
