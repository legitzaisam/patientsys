import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The visible box stays 16px; the button around it is 24px (WCAG 2.5.8
 * minimum) with a negative margin so it takes the same room in a row.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group peer -m-1 grid h-6 w-6 shrink-0 cursor-pointer place-content-center focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="grid h-4 w-4 place-content-center rounded-[5px] border border-edge-2 bg-glass-2 shadow-inset-hi group-focus-visible:ring-1 group-focus-visible:ring-ring group-data-[state=checked]:border-transparent group-data-[state=checked]:bg-gradient-to-br group-data-[state=checked]:from-accent-hi group-data-[state=checked]:to-accent group-data-[state=checked]:text-accent-ink">
      <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
