import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth'

/** Rutas privadas: sin sesión, se va a /entrar y, al entrar, se vuelve a la página pedida (con su estado). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-8" aria-busy="true" aria-label="Comprobando tu sesión">
      <Skeleton className="h-8 w-1/2" /><Skeleton className="h-40" /><Skeleton className="h-40" />
    </div>
  )
  if (!user) {
    const next = location.pathname + location.search + location.hash
    return <Navigate to={`/entrar?next=${encodeURIComponent(next)}`} replace state={{ from: location }} />
  }
  return <>{children}</>
}

/** Si se abre un enlace de recuperación y Supabase vuelve a otra página, se lleva a elegir la contraseña nueva. */
export function AuthEvents() {
  const { recovery } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => { if (recovery && pathname !== '/restablecer') navigate('/restablecer', { replace: true }) }, [recovery, pathname, navigate])
  return null
}
