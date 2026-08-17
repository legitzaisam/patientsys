import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shadow-inset-hi transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-accent-soft text-accent-ink",
        secondary: "bg-glass-2 text-muted-foreground border-edge",
        destructive: "bg-destructive-bg text-destructive",
        outline: "border-edge bg-glass-2 text-foreground",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning-ink",
        sky: "bg-sky-bg text-sky-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
