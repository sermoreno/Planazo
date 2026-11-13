import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Compass, Footprints, MessageCircle, Sparkles, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PhotoBackdrop } from '@/components/PhotoBackdrop'
import { Button } from '@/components/ui/button'
import { PLACES } from '@/lib/places'
import { heroPhotos, placePhoto } from '@/lib/photos'
import { euros } from '@/lib/utils'

const FEELINGS = ['desconectar', 'inspirarte', 'llenarte de energía', 'reír con amigos', 'enamorarte de Madrid']
const MOODS = [
  { label: 'Desconectar', mood: 'Quiero desconectar y bajar el ritmo' },
  { label: 'Inspirarme', mood: 'Quiero inspirarme con arte y cultura' },
  { label: 'Con energía', mood: 'Quiero moverme y aprovechar el día' },
  { label: 'Algo especial', mood: 'Quiero un plan especial en pareja' },
  { label: 'Con los peques', mood: 'Quiero un plan con los niños para pasarlo en familia' },
]
const FEATURED = ['Templo de Debod', 'Palacio de Cristal', 'Mercado de San Miguel', 'Museo del Prado', 'Azotea del Círculo de Bellas Artes', 'Barcas del Estanque del Retiro', 'Matadero Madrid', 'Plaza Mayor', 'Café Central', 'Parque El Capricho', 'Parque del Retiro']

export default function Landing() {
  const navigate = useNavigate()
  const photos = heroPhotos()
  const reduce = useReducedMotion()
  const [w, setW] = useState(0)
  useEffect(() => { if (reduce) return; const t = setInterval(() => setW((x) => (x + 1) % FEELINGS.length), 2600); return () => clearInterval(t) }, [reduce])
  const go = (mood?: string) => navigate('/plan/nuevo', { state: mood ? { mood } : undefined })

  return (
    <main>
      {/* HERO: fotos reales de Madrid con movimiento lento */}
      <section className="relative -mt-14 flex min-h-[100svh] flex-col justify-end overflow-hidden pb-14 pt-24 text-white sm:pb-20">
        <PhotoBackdrop photos={photos} />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-semibold backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-coral" /> Ciudad piloto · Madrid
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 max-w-4xl text-[44px] font-extrabold leading-[0.98] tracking-[-0.035em] [text-wrap:balance] sm:text-7xl lg:text-[88px]">
            Este finde, quiero
            <span className="relative block h-[1.05em] overflow-hidden text-coral">
              {FEELINGS.map((f, i) => (
                <motion.span
                  key={f}
                  className="absolute left-0 top-0 whitespace-nowrap"
                  initial={false}
                  animate={{ y: i === w ? '0%' : i === (w + FEELINGS.length - 1) % FEELINGS.length ? '-110%' : '110%', opacity: i === w ? 1 : 0 }}
                  transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  {f}.
                </motion.span>
              ))}
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="mt-5 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl">
            Dime cómo quieres sentirte y Planazo te propone qué hacer, dónde ir y cómo encajarlo en tu tiempo y presupuesto.
          </motion.p>

          {/* Arranque rápido por estado de ánimo */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-7 max-w-2xl rounded-[22px] border border-white/15 bg-white/10 p-3 backdrop-blur-xl sm:p-4">
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70">¿Cómo te quieres sentir?</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button key={m.label} onClick={() => go(m.mood)} className="min-h-11 rounded-full border border-white/25 bg-white/10 px-4 text-[15px] font-semibold text-white transition hover:bg-white hover:text-noche active:scale-95">
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button size="lg" className="sm:flex-1" onClick={() => go()}>Crear mi plan <ArrowRight className="h-5 w-5" aria-hidden /></Button>
              <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10" asChild><Link to="/plan/demo">Ver un plan de ejemplo</Link></Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-coral-700">Cómo funciona</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight [text-wrap:balance] sm:text-5xl">Del "no sé qué hacer" a un plan listo en un minuto.</h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            { I: MessageCircle, t: 'Cuéntame', d: 'Fecha, compañía, presupuesto y cómo quieres sentirte. Lo que falte, te lo pregunto.' },
            { I: Sparkles, t: 'Te propongo', d: 'Un plan por franjas horarias, con el porqué de cada parada y el coste estimado.' },
            { I: Footprints, t: 'Ajusta y sal', d: 'Ruta a pie en el mapa, cambios en un toque y un enlace para compartir.' },
          ].map(({ I, t, d }, i) => (
            <li key={t} className="relative border-t-2 border-noche pt-5">
              <span className="text-sm font-extrabold tabular-nums text-coral-700">0{i + 1}</span>
              <I className="absolute right-0 top-5 h-6 w-6 text-noche/40" aria-hidden />
              <h3 className="mt-1 text-2xl font-extrabold">{t}</h3>
              <p className="mt-2 text-noche-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* GALERÍA DE LUGARES */}
      <section className="bg-noche py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-coral">Madrid, en planes</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">{PLACES.length} lugares elegidos a mano</h2>
          </div>
          <Link to="/explorar" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/30 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"><Compass className="h-4 w-4" aria-hidden /> Explorar el mapa</Link>
        </div>
        <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:px-[max(16px,calc((100vw-72rem)/2+16px))]">
          {FEATURED.map((name) => PLACES.find((p) => p.name === name)!).filter((p) => placePhoto(p.name)).map((p) => {
            const ph = placePhoto(p.name)
            return (
              <article key={p.id} className="group relative h-80 w-[240px] shrink-0 snap-start overflow-hidden rounded-[20px] bg-noche-600 sm:w-[280px]">
                {ph && <img src={ph.src} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(14,20,38,.92)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/75">{p.neighborhood} · {p.category}</p>
                  <h3 className="mt-1 text-xl font-extrabold leading-tight">{p.name}</h3>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur"><Wallet className="h-3 w-3" aria-hidden />{euros(p.avg_cost_eur)}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* CIERRE */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight [text-wrap:balance] sm:text-5xl">Tu próximo planazo empieza con una frase.</h2>
        <Button size="lg" className="mt-8" onClick={() => go()}>Crear mi plan <ArrowRight className="h-5 w-5" aria-hidden /></Button>
        <p className="mx-auto mt-10 max-w-xl text-sm text-noche-600">
          Planazo recomienda y organiza: no reserva ni compra. Horarios y precios son estimaciones.{' '}
          <Link to="/creditos" className="font-semibold underline underline-offset-2">Créditos de las fotos</Link>
        </p>
      </section>
    </main>
  )
}
