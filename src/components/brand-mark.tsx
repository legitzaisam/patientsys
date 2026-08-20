import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "md",
  variant = "gold",
}: {
  className?: string;
  size?: "sm" | "md";
  variant?: "gold" | "on-gold";
}) {
  const dim = size === "sm" ? "h-[28px] w-[28px] text-[12px]" : "h-[30px] w-[30px] text-[13px]";
  return (
    <span
      className={cn(
        "inline-grid place-items-center rounded-[9px] font-bold leading-none",
        dim,
        variant === "gold"
          ? "bg-[linear-gradient(140deg,var(--accent-hi),var(--accent)_70%)] text-accent-foreground shadow-bloom"
          : "border border-edge bg-glass text-accent-foreground shadow-inset-hi",
        className,
      )}
      aria-hidden
    >
      Æ
    </span>
  );
}

export function BrandLockup({
  to = "/",
  size = "md",
  variant = "gold",
  className,
  light,
}: {
  to?: "/" | "/dashboard" | "/my-record";
  size?: "sm" | "md";
  variant?: "gold" | "on-gold";
  className?: string;
  light?: boolean;
}) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={size} variant={variant} />
      <span
        className={cn(
          "text-base font-semibold tracking-[-0.016em]",
          light ? "text-accent-foreground" : "text-foreground",
        )}
      >
        Aetheria
      </span>
    </Link>
  );
}
