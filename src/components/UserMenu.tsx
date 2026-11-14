import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, LogOut, Map as MapIcon, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isAdmin, ROLE_LABEL, signOut, type User } from '@/lib/auth'
import { cn } from '@/lib/utils'

/** Nombre que se enseña: el del perfil o, si no hay, la parte del email antes de la @. */
export const shownName = (u: Pick<User, 'display_name' | 'email'>) => u.display_name?.trim() || u.email.split('@')[0]
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

export function Avatar({ name, light, className }: { name: string; light?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-noche text-[13px] font-extrabold tracking-tight text-white', light && 'ring-2 ring-white/70', className)}>
      {initials(name)}
    </span>
  )
}

/** Cabecera con sesión: avatar con iniciales + nombre del perfil, y un menú con Cuenta, Mis planes, Admin y Cerrar sesión. */
export function UserMenu({ user, light }: { user: User; light?: boolean }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const name = shownName(user)
  const first = name.split(/\s+/)[0]

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const away = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); e.preventDefault()
      }
    }
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key) }
  }, [open])

  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-noche outline-none transition hover:bg-noche/5 focus-visible:bg-noche/5'
  return (
    <div className="relative">
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Menú de ${name}`} onClick={() => setOpen((o) => !o)}
        className={cn('flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 transition sm:gap-2 sm:pr-2.5', light ? 'text-white hover:bg-white/10' : 'text-noche hover:bg-noche/5', open && (light ? 'bg-white/10' : 'bg-noche/5'))}>
        <Avatar name={name} light={light} />
        <span className="max-w-[4.5rem] truncate text-[13px] font-bold max-[359px]:max-w-[3rem] sm:max-w-[9rem] sm:text-sm">{first}</span>
        <ChevronDown className={cn('hidden h-4 w-4 transition sm:block', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div ref={menu} role="menu" aria-label="Tu cuenta" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-[20px] bg-white p-2 shadow-[0_16px_40px_rgba(30,42,74,.18)] ring-1 ring-noche/5">
            <div className="flex items-center gap-3 px-3 pb-3 pt-2">
              <Avatar name={name} className="h-11 w-11 text-base" />
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-noche">{name}</p>
                <p className="truncate text-[13px] text-noche-600">{user.email}</p>
                <p className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.08em] text-coral-700">{user.plan_tier === 'premium' ? 'Premium' : 'Plan gratuito'}{user.role !== 'user' && ` · ${ROLE_LABEL[user.role]}`}</p>
              </div>
            </div>
            <div className="border-t border-noche/5 pt-1">
              <Link role="menuitem" to="/cuenta" className={item}><UserRound className="h-5 w-5 text-noche-600" aria-hidden /> Mi cuenta</Link>
              <Link role="menuitem" to="/mis-planes" className={item}><MapIcon className="h-5 w-5 text-noche-600" aria-hidden /> Mis planes</Link>
              {isAdmin(user) && <Link role="menuitem" to="/admin" className={item}><ShieldCheck className="h-5 w-5 text-noche-600" aria-hidden /> Panel de administración</Link>}
            </div>
            <div className="mt-1 border-t border-noche/5 pt-1">
              <button role="menuitem" type="button" className={item} onClick={async () => { setOpen(false); await signOut(); navigate('/', { replace: true }) }}>
                <LogOut className="h-5 w-5 text-noche-600" aria-hidden /> Cerrar sesión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
