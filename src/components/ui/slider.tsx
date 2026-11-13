import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex h-8 w-full touch-none select-none items-center', className)} {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-noche/10">
        <SliderPrimitive.Range className="absolute h-full bg-coral" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-4 border-white bg-noche shadow-soft" aria-label="Presupuesto por persona" />
    </SliderPrimitive.Root>
  )
}
