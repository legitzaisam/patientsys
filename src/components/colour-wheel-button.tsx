import { useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";

/** Native colour wheel/eyedropper picker rendered as a swatch button. */
export function ColourWheelButton({
  value,
  active,
  label,
  disabled,
  onPick,
}: {
  value: string;
  active: boolean;
  label: string;
  disabled?: boolean | undefined;
  onPick: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (hex: string) => {
    setDraft(hex);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (hex.toLowerCase() !== value.toLowerCase()) onPick(hex);
    }, 450);
  };
  return (
    <label
      title="Custom colour"
      aria-label={label}
      className={`relative inline-flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full transition-all hover:scale-110 ${
        active
          ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
          : "opacity-90 hover:opacity-100"
      }`}
      style={{
        background: active
          ? value
          : "conic-gradient(#ef9bc4,#f4cebe,#eed488,#cfe3a0,#a6dccd,#8fc7ea,#b9a6e8,#e3a6d8,#ef9bc4)",
      }}
    >
      {!active && <Pipette className="h-3 w-3 text-foreground/70" aria-hidden />}
      <input
        type="color"
        disabled={disabled}
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => draft.toLowerCase() !== value.toLowerCase() && onPick(draft)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
