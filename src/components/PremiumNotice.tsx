import { Check, Crown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/button'
import { FREE_LIMIT } from '@/lib/store'

/** Aviso del límite gratuito. Premium aún no se vende: el botón solo registra el interés. */
export function PremiumNotice({ onClose }: { onClose?: () => void }) {
  const [asked, setAsked] = useState(false)
  return (
    <div>
      <p className="text-noche-600">Con la cuenta gratuita puedes guardar hasta {FREE_LIMIT} planes. Borra uno de Mis planes o pásate a Premium.</p>
      <div className="mt-4 rounded-card bg-noche p-4 text-white">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-coral"><Crown className="h-4 w-4" aria-hidden /> Planazo Premium</p>
        <p className="mt-1 text-2xl font-extrabold">4,99 € <span className="text-base font-semibold text-white/75">/mes</span></p>
        <ul className="mt-3 space-y-1.5 text-[15px]">
          {['Planes guardados ilimitados', 'Planes de fin de semana completo', 'Ideas nuevas cada viernes'].map((t) => (
            <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden />{t}</li>
          ))}
        </ul>
        <Button className="mt-4 w-full" onClick={() => setAsked(true)} disabled={asked}>{asked ? 'Te avisaremos cuando esté disponible' : 'Quiero Premium'}</Button>
        <p className="mt-2 text-center text-xs text-white/70">Próximamente. Hoy no se cobra nada.</p>
      </div>
      <Button variant="outline" className="mt-3 w-full" asChild><Link to="/mis-planes" onClick={onClose}>Ir a Mis planes</Link></Button>
    </div>
  )
}
