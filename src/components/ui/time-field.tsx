import * as React from "react";
import { Clock } from "lucide-react";
import { normaliseClock } from "@/lib/field-parse";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

const MINUTES = ["00", "15", "30", "45"];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A clock time as text ("09:30") with a picker. Typing is forgiving
 * ("930", "9.30", "5pm" all settle to HH:MM on blur or Enter); the picker is
 * two glass columns, hours then minutes, and closes once a minute is picked.
 * Stores "HH:MM" or null.
 */
export function TimeField({
  id,
  value,
  onChange,
  minHour = 6,
  maxHour = 22,
  disabled,
  placeholder = "09:00",
  className,
  "aria-label": ariaLabel,
  ...qc
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** First hour offered in the picker (default 6). */
  minHour?: number;
  /** Last hour offered in the picker (default 22). */
  maxHour?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "data-qc"?: string;
}) {
  const [text, setText] = React.useState(value ?? "");
  const [open, setOpen] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const hoursRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setText(value ?? "");
    setInvalid(false);
  }, [value]);

  const commit = React.useCallback(
    (raw: string) => {
      if (!raw.trim()) {
        setInvalid(false);
        setText("");
        onChange(null);
        return;
      }
      const clock = normaliseClock(raw);
      if (!clock) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      setText(clock);
      if (clock !== value) onChange(clock);
    },
    [onChange, value],
  );

  const [selHour, selMinute] = (value ?? "").split(":");
  const hours = React.useMemo(() => {
    const out: string[] = [];
    for (let h = minHour; h <= maxHour; h++) out.push(pad(h));
    return out;
  }, [minHour, maxHour]);

  React.useEffect(() => {
    if (!open) return;
    const el = hoursRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ block: "center" });
  }, [open]);

  const pickHour = (h: string) => {
    const next = `${h}:${selMinute && MINUTES.includes(selMinute) ? selMinute : "00"}`;
    setText(next);
    setInvalid(false);
    onChange(next);
  };
  const pickMinute = (m: string) => {
    const h = selHour && /^\d{2}$/.test(selHour) ? selHour : pad(minHour);
    const next = `${h}:${m}`;
    setText(next);
    setInvalid(false);
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)} data-qc-field="time">
          <Input
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit((e.target as HTMLInputElement).value);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            className={cn(
              "pr-10 tabular-nums",
              invalid && "border-destructive focus-visible:border-destructive",
            )}
            data-qc={qc["data-qc"]}
          />
          <button
            type="button"
            aria-label={open ? "Close time picker" : "Pick a time"}
            aria-expanded={open}
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            data-qc={qc["data-qc"] ? `${qc["data-qc"]}-open` : undefined}
          >
            <Clock className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[calc(calc(100*var(--app-vw))-2rem)] rounded-[20px] border-edge-2 bg-card p-2 sm:w-auto"
        data-qc="time-picker"
      >
        <div className="flex gap-1.5 rounded-2xl bg-glass-2 p-1 shadow-inset-hi">
          <div
            ref={hoursRef}
            className="scroll-y-plain flex max-h-[232px] flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5 sm:w-[68px] sm:flex-none"
            role="listbox"
            aria-label="Hour"
          >
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                role="option"
                aria-selected={selHour === h}
                aria-pressed={selHour === h}
                onClick={() => pickHour(h)}
                className={cn(
                  "h-9 shrink-0 cursor-pointer rounded-xl text-sm tabular-nums transition-colors",
                  selHour === h
                    ? "bg-foreground font-bold text-background"
                    : "text-foreground hover:bg-[rgba(47,63,102,0.08)]",
                )}
                data-qc={`time-hour-${h}`}
              >
                {h}
              </button>
            ))}
          </div>
          <div
            className="flex flex-1 flex-col gap-0.5 sm:w-[68px] sm:flex-none"
            role="listbox"
            aria-label="Minutes"
          >
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={selMinute === m}
                onClick={() => pickMinute(m)}
                className={cn(
                  "h-9 cursor-pointer rounded-xl text-sm tabular-nums transition-colors",
                  selMinute === m
                    ? "bg-foreground font-bold text-background"
                    : "text-foreground hover:bg-[rgba(47,63,102,0.08)]",
                )}
                data-qc={`time-minute-${m}`}
              >
                :{m}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
