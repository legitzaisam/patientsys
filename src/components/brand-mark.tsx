import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * The Sqinos mark: a navy ring with a gold drop at its foot. Drawn inline so
 * it takes the theme's foreground for the ring (light on gold surfaces) and
 * the butter gradient for the drop. The source files live in public/
 * (sqinos-mark.svg, sqinos-mark-inverse.svg, favicon.svg).
 */
export function BrandMark({
  className,
  size = "md",
  variant = "gold",
}: {
  className?: string;
  size?: "sm" | "md";
  variant?: "gold" | "on-gold";
}) {
  const dim = size === "sm" ? "h-[28px] w-[28px]" : "h-[30px] w-[30px]";
  const ring = variant === "gold" ? "var(--foreground)" : "#f6f7f8";
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("inline-block shrink-0", dim, className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="sqinos-drop" cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.5" stopColor="#eed488" />
          <stop offset="1" stopColor="#c9a64a" />
        </radialGradient>
      </defs>
      <circle cx="46" cy="46" r="32" fill="none" stroke={ring} strokeWidth="10" />
      <path
        d="M78 62C78 62 62 76 62 84a12 12 0 0 0 24 0C86 76 78 62 78 62Z"
        fill="url(#sqinos-drop)"
        transform="rotate(-38 74 80)"
      />
    </svg>
  );
}

export function BrandLockup({
  to = "/",
  size = "md",
  variant = "gold",
  className,
  light,
}: {
  to?: "/" | "/dashboard" | "/my-record" | "/access";
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
          "min-w-0 truncate text-base font-semibold tracking-[0.06em]",
          light ? "text-accent-foreground" : "text-foreground",
        )}
      >
        SQINOS
      </span>
    </Link>
  );
}
