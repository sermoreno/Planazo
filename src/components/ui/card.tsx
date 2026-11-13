import { cn } from '@/lib/utils'
export const Card = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('rounded-card bg-white shadow-soft', className)} {...p} />
