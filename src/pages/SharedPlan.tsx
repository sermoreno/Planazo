import { Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { ItineraryView } from '@/components/ItineraryView'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getShared } from '@/lib/store'
import type { Itinerary } from '@/lib/types'

/** Vista pública de solo lectura: /p/:share_slug */
export default function SharedPlan() {
  const { share_slug = '' } = useParams()
  const { hash } = useLocation()
  const [it, setIt] = useState<Itinerary | null | undefined>(undefined)
  useEffect(() => { let live = true; getShared(share_slug, hash.slice(1)).then((p) => live && setIt(p)).catch(() => live && setIt(null)); return () => { live = false } }, [share_slug, hash])

  if (it === undefined) return <div className="mx-auto max-w-6xl space-y-3 px-4 py-6"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40" /></div>
  if (!it) return <EmptyState title="Este plan ya no está disponible" text="Puede que su autor lo haya dejado de compartir. Crea el tuyo en un minuto." cta={{ to: '/plan/nuevo', label: 'Crear mi plan' }} />

  const toolbar = (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card bg-white p-3 shadow-soft">
      <p className="flex flex-1 items-center gap-2 text-[15px]"><Eye className="h-4 w-4 shrink-0 text-noche-600" aria-hidden /> Te han compartido este plan. Es de solo lectura.</p>
      <Button size="sm" asChild><Link to="/plan/nuevo">Crear el mío</Link></Button>
    </div>
  )
  return <ItineraryView it={it} toolbar={toolbar} />
}
