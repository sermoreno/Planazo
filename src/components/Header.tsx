import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useUser } from '@/lib/store'
import { cn } from '@/lib/utils'

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2 text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-noche', className)} aria-label="Planazo, inicio">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-coral text-noche">P</span>
      Planazo
    </Link>
  )
}

export function Header() {
  const user = useUser()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [pathname])
  const overPhoto = ['/', '/plan/nuevo', '/entrar', '/registro', '/recuperar', '/restablecer'].includes(pathname) && !scrolled
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-semibold transition sm:px-3 sm:text-sm', overPhoto ? 'text-white/90 hover:bg-white/10 hover:text-white' : isActive ? 'bg-noche/5 text-noche' : 'text-noche-600 hover:text-noche')
  return (
    <header className={cn('sticky top-0 z-[1000] transition-colors duration-300', overPhoto ? 'bg-transparent' : 'border-b border-noche/5 bg-crema/90 backdrop-blur')}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo light={overPhoto} />
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <NavLink to="/explorar" className={link}>Explorar</NavLink>
          <NavLink to="/mis-planes" className={link}>Mis planes</NavLink>
          {user ? <NavLink to="/cuenta" className={link}>Cuenta</NavLink> : <NavLink to="/entrar" className={link}>Entrar</NavLink>}
        </nav>
      </div>
    </header>
  )
}
