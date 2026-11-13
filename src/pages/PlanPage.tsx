import { Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ItineraryView } from '@/components/ItineraryView'
import { EmptyState } from '@/components/EmptyState'
import { mockItinerary } from '@/lib/mock'
import { getDraft } from '@/lib/store'

export default function PlanPage() {
  const { id = '' } = useParams()
  const it = id === 'demo' ? mockItinerary() : getDraft(id)
  if (!it) return <EmptyState title="No encontramos este plan" text="Puede que se creara en otro navegador. Crea uno nuevo en un minuto." cta={{ to: '/plan/nuevo', label: 'Crear un plan' }} />
  if (!it.slots.length) return <EmptyState title="No he encontrado un plan con esas condiciones" text={it.agent_message ?? 'Prueba a subir el presupuesto o a cambiar el día.'} cta={{ to: '/plan/nuevo', label: 'Cambiar preferencias' }} />
  const toolbar = it.agent_message ? (
    <div className="mb-3 flex gap-2 rounded-card bg-white p-3 text-[15px] shadow-soft">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral text-xs font-extrabold text-noche" aria-hidden>P</span>
      <div>
        <p>{it.agent_message}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs font-semibold text-noche-600">
          <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" aria-hidden />{it.source === 'ia' ? 'Generado con IA' : 'Planificador local (modo demo)'}</span>
          <Link to="/plan/nuevo" className="underline underline-offset-2">Empezar de nuevo</Link>
        </p>
      </div>
    </div>
  ) : null
  return <ItineraryView it={it} toolbar={toolbar} />
}
