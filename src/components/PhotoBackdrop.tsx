import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { credit, type Photo } from '@/lib/photos'
import { cn } from '@/lib/utils'

/**
 * Fondo de fotos reales animado: fundido encadenado + efecto Ken Burns (zoom y desplazamiento lentos).
 * Respeta "reducir movimiento": entonces muestra una foto fija.
 */
const MOVES = [
  { from: 'scale(1.02) translate(0,0)', to: 'scale(1.16) translate(-2%,-1.5%)' },
  { from: 'scale(1.15) translate(2%,1%)', to: 'scale(1.03) translate(0,0)' },
  { from: 'scale(1.04) translate(-1.5%,1%)', to: 'scale(1.17) translate(1.5%,-1%)' },
]

export function PhotoBackdrop({ photos, interval = 7000, className, overlay = 'hero', showCredit = true, onIndex }: {
  photos: { key: string; label: string; photo: Photo }[]; interval?: number; className?: string; overlay?: 'hero' | 'dim' | 'band'; showCredit?: boolean; onIndex?: (i: number) => void
}) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduce || photos.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % photos.length), interval)
    return () => clearInterval(t)
  }, [photos.length, interval, reduce])
  useEffect(() => { onIndex?.(i) }, [i, onIndex])
  // Precarga la siguiente
  useEffect(() => { const n = photos[(i + 1) % photos.length]; if (n) { const im = new Image(); im.src = n.photo.src } }, [i, photos])

  const cur = photos[i]
  const move = MOVES[i % MOVES.length]
  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-noche', className)} aria-hidden={!showCredit}>
      <AnimatePresence initial={false}>
        {cur && (
          <motion.img
            key={cur.key}
            src={cur.photo.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            initial={{ opacity: 0, transform: reduce ? 'none' : move.from }}
            animate={{ opacity: 1, transform: reduce ? 'none' : move.to }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.6, ease: 'easeInOut' }, transform: { duration: (interval + 2000) / 1000, ease: 'linear' } }}
          />
        )}
      </AnimatePresence>
      <div
        className={cn('absolute inset-0', {
          hero: 'bg-[linear-gradient(180deg,rgba(14,20,38,.55)_0%,rgba(14,20,38,.3)_30%,rgba(14,20,38,.62)_60%,rgba(14,20,38,.94)_100%)]',
          dim: 'bg-[rgba(14,20,38,.62)]',
          band: 'bg-[linear-gradient(180deg,rgba(14,20,38,.35)_0%,rgba(14,20,38,.75)_100%)]',
        }[overlay])}
      />
      {showCredit && cur && (
        <a
          href={cur.photo.page}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 right-4 z-10 max-w-[70%] truncate rounded-full bg-black/35 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur hover:text-white"
        >
          {cur.label} · {credit(cur.photo)}
        </a>
      )}
    </div>
  )
}
