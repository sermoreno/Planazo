import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId } from 'react'

/** Diálogo accesible: bottom sheet en móvil, centrado en escritorio. Cierra con Esc o tocando fuera. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[2000] flex items-end justify-center bg-noche/50 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby={id}
            className="relative w-full max-w-md rounded-t-[24px] bg-crema p-5 pb-8 shadow-soft sm:rounded-card sm:pb-5"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full hover:bg-noche/5" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            <h2 id={id} className="pr-10 text-xl font-extrabold">{title}</h2>
            <div className="mt-3">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
