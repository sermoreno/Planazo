import { Link } from 'react-router-dom'
import { Button } from './ui/button'

/** Misma respuesta para una ruta que no existe y para una zona sin permiso (no se revela que existe). */
export const NotFound = () => <EmptyState title="Página no encontrada" text="Vuelve al inicio y crea tu plan." cta={{ to: '/', label: 'Ir al inicio' }} />

export function EmptyState({ title, text, cta }: { title: string; text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <svg viewBox="0 0 160 120" className="h-32 w-44" aria-hidden>
        <ellipse cx="80" cy="108" rx="60" ry="8" fill="#1E2A4A" opacity=".06" />
        <path d="M30 95 L60 40 L80 70 L100 30 L130 95 Z" fill="#FFE0D6" />
        <circle cx="118" cy="28" r="12" fill="#FF6B4A" />
        <path d="M78 22c-9 0-16 7-16 16 0 12 16 28 16 28s16-16 16-28c0-9-7-16-16-16z" fill="#1E2A4A" />
        <circle cx="78" cy="38" r="6" fill="#FFF8F2" />
      </svg>
      <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-noche-600">{text}</p>
      {cta && <Button className="mt-6" asChild><Link to={cta.to}>{cta.label}</Link></Button>}
    </div>
  )
}
