import { cn } from '@/lib/utils'

export function Chip({ selected, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'min-h-11 rounded-full border-2 px-4 py-2 text-[15px] font-semibold transition-all active:scale-95',
        selected ? 'border-noche bg-noche text-white' : 'border-noche/15 bg-white text-noche hover:border-noche/40',
        className,
      )}
      {...props}
    />
  )
}
