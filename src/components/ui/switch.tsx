import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * The visible track stays 20×36; the button around it is 24px tall (WCAG
 * 2.5.8 minimum) with a negative vertical margin so rows do not grow.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group peer -my-0.5 inline-flex h-6 w-9 shrink-0 cursor-pointer items-center focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <span className="inline-flex h-5 w-9 items-center rounded-full border border-edge shadow-inset-hi transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background group-data-[state=checked]:border-transparent group-data-[state=checked]:bg-gradient-to-br group-data-[state=checked]:from-accent-hi group-data-[state=checked]:to-accent group-data-[state=checked]:to-75% group-data-[state=unchecked]:bg-bar">
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </span>
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
