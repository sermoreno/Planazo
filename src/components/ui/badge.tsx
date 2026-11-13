import { cn } from '@/lib/utils'
export const Badge = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full bg-coral-50 px-2.5 py-1 text-xs font-semibold text-coral-700', className)} {...p} />
)
