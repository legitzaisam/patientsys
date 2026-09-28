import * as React from "react";
import { CalendarDays } from "lucide-react";
import { enGB } from "date-fns/locale";
import { dateToDayKey, dayKeyToDate, formatDayInput, parseDayInput } from "@/lib/field-parse";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

/**
 * A calendar day as text ("13/11/2027") with a month calendar. Typing takes
 * UK, ISO and "13 Nov 2027" forms and settles on blur or Enter; the calendar
 * is Monday-first in the app's theme and closes once a day is picked.
 * Stores "YYYY-MM-DD" or null.
 */
export function DateField({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "DD/MM/YYYY",
  className,
  "aria-label": ariaLabel,
  ...qc
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Earliest pickable day, YYYY-MM-DD. */
  min?: string | undefined;
  /** Latest pickable day, YYYY-MM-DD. */
  max?: string | undefined;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "data-qc"?: string;
}) {
  const [text, setText] = React.useState(formatDayInput(value));
  const [open, setOpen] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    setText(formatDayInput(value));
    setInvalid(false);
  }, [value]);

  const commit = (raw: string) => {
    if (!raw.trim()) {
      setInvalid(false);
      setText("");
      onChange(null);
      return;
    }
    const key = parseDayInput(raw);
    if (!key || (min && key < min) || (max && key > max)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatDayInput(key));
    if (key !== value) onChange(key);
  };

  const selected = dayKeyToDate(value);
  const minDate = dayKeyToDate(min);
  const maxDate = dayKeyToDate(max);
  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)} data-qc-field="date">
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
            aria-label={open ? "Close calendar" : "Pick a date"}
            aria-expanded={open}
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            data-qc={qc["data-qc"] ? `${qc["data-qc"]}-open` : undefined}
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-auto rounded-[20px] bg-glass-2 p-2 shadow-inset-hi"
        data-qc="date-picker"
      >
        <Calendar
          mode="single"
          locale={enGB}
          weekStartsOn={1}
          showOutsideDays
          selected={selected}
          defaultMonth={selected ?? minDate ?? new Date()}
          disabled={disabledDays}
          onSelect={(day) => {
            if (!day) return;
            const key = dateToDayKey(day);
            setText(formatDayInput(key));
            setInvalid(false);
            onChange(key);
            setOpen(false);
          }}
          className="bg-transparent p-1 [--cell-size:2.25rem]"
          classNames={{
            month_caption: "flex h-9 w-full items-center justify-center px-9",
            caption_label: "select-none text-sm font-semibold text-foreground",
            button_previous:
              "absolute left-1 top-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground aria-disabled:opacity-40",
            button_next:
              "absolute right-1 top-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground aria-disabled:opacity-40",
            weekday:
              "flex-1 select-none pb-1 text-center text-2xs font-semibold text-muted-foreground",
            day: "group/day relative h-9 w-9 p-0 text-center",
            today: "rounded-xl ring-1 ring-foreground/40",
            outside: "text-ink-3 aria-selected:text-ink-3",
            disabled: "text-ink-3 opacity-40",
          }}
          components={{
            DayButton: ({ className, day, modifiers, ...props }) => (
              <button
                type="button"
                data-day={dateToDayKey(day.date)}
                className={cn(
                  "h-9 w-9 cursor-pointer rounded-xl text-sm tabular-nums transition-colors",
                  modifiers["selected"]
                    ? "bg-foreground font-bold text-background"
                    : "text-foreground hover:bg-[rgba(47,63,102,0.08)]",
                  modifiers["outside"] && !modifiers["selected"] && "text-ink-3",
                  modifiers["disabled"] && "cursor-not-allowed",
                  className,
                )}
                {...props}
              />
            ),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
