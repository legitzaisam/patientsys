import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-[12.5px] font-semibold leading-none cursor-pointer transition-[background-color,border-color,color,box-shadow,filter,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-edge bg-[linear-gradient(140deg,var(--accent-hi),var(--accent)_75%)] text-accent-foreground shadow-bloom hover:brightness-[1.05] active:brightness-[0.92]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-edge bg-glass-2 font-medium text-foreground shadow-inset-hi hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:shadow-lift active:bg-[rgba(47,63,102,0.14)]",
        secondary:
          "border border-edge bg-glass-2 font-medium text-secondary-foreground shadow-inset-hi hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:shadow-lift active:bg-[rgba(47,63,102,0.14)]",
        ghost:
          "font-medium hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
        link: "font-medium text-accent-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[34px] px-[15px]",
        sm: "h-[28px] px-3 text-xs",
        lg: "h-10 px-7",
        icon: "h-[34px] w-[34px]",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
