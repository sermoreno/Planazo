import { LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoginForm } from '@/components/LoginForm'
import { PremiumNotice } from '@/components/PremiumNotice'
import { Button } from '@/components/ui/button'
import { FREE_LIMIT, listSaved, signOut, useUser } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export default function Account() {
  const user = useUser()
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => { if (user) listSaved().then((p) => setCount(p.length)).catch(() => setCount(null)) }, [user])

  if (!user) return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Entrar</h1>
      <p className="mt-2 text-noche-600">Para guardar y compartir tus planes. Crear planes no necesita cuenta.</p>
      <div className="mt-6"><LoginForm /></div>
    </main>
  )
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Tu cuenta</h1>
      <div className="mt-6 rounded-card bg-white p-4 shadow-soft">
        <p className="text-sm font-bold text-noche-600">Email</p>
        <p className="break-all text-lg font-semibold">{user.email}</p>
        <p className="mt-3 text-sm font-bold text-noche-600">Plan</p>
        <p className="text-lg font-semibold">{user.plan_tier === 'premium' ? 'Premium' : 'Gratuito'}{user.plan_tier === 'free' && count !== null && <span className="text-base font-normal text-noche-600"> · {count} de {FREE_LIMIT} planes guardados</span>}</p>
        <p className="mt-3 text-sm font-bold text-noche-600">Ciudad</p>
        <p className="text-lg font-semibold">Madrid</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to="/mis-planes">Mis planes</Link></Button>
          <Button variant="ghost" onClick={() => signOut()}><LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión</Button>
        </div>
        {!supabase && <p className="mt-3 text-xs text-noche-600">Modo demo: la cuenta vive solo en este navegador.</p>}
      </div>
      {user.plan_tier === 'free' && <div className="mt-8"><h2 className="mb-2 text-xl font-extrabold">¿Quieres más?</h2><PremiumNotice /></div>}
    </main>
  )
}
