import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 box-border whitespace-nowrap rounded-full text-[12.5px] font-semibold leading-none cursor-pointer transition-[background-color,border-color,color,box-shadow,filter,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-edge bg-[linear-gradient(140deg,var(--accent-hi),var(--accent)_75%)] text-accent-foreground shadow-bloom hover:brightness-[1.05] active:brightness-[0.92]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-edge bg-glass-2 font-semibold text-foreground shadow-inset-hi hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:shadow-lift active:bg-[rgba(47,63,102,0.14)]",
        /** Selected choice in dialogs / popovers — navy brand fill. */
        selected:
          "border border-foreground bg-foreground font-semibold text-white shadow-lift hover:border-foreground hover:bg-foreground/90 hover:text-white active:bg-foreground/80",
        secondary:
          "border border-edge bg-glass-2 font-semibold text-secondary-foreground shadow-inset-hi hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:shadow-lift active:bg-[rgba(47,63,102,0.14)]",
        ghost:
          "font-semibold hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
        link: "font-semibold text-accent-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-0",
        sm: "h-8 px-3 py-0 text-xs",
        xs: "h-7 gap-1 px-2.5 py-0 text-2xs [&_svg]:size-3",
        lg: "h-10 px-4 py-0",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Enter in the open dialog / panel runs this button’s click handler. */
  enterSubmit?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, enterSubmit = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...(enterSubmit && !asChild ? { "data-enter-submit": "" } : {})}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
