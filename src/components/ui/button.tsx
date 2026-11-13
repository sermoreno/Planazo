import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

// Contraste AA: el coral (#FF6B4A) se combina con texto azul noche (5,1:1), nunca con blanco.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-coral text-noche hover:bg-[#ff5a35] shadow-soft',
        secondary: 'bg-noche text-white hover:bg-noche-600',
        outline: 'border-2 border-noche/15 bg-white text-noche hover:border-noche/40',
        ghost: 'text-noche hover:bg-noche/5',
      },
      size: { default: 'h-11 px-5 text-[15px]', sm: 'h-9 px-3.5 text-sm', lg: 'h-14 px-7 text-base', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
})
Button.displayName = 'Button'
