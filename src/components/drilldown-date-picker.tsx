import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Date picker that drills down: year -> month -> day. Time is never handled here. */
export function DrilldownDatePicker({
  value,
  onChange,
  className,
  id,
}: {
  /** yyyy-MM-dd */
  value: string;
  onChange: (next: string) => void;
  className?: string;
  id?: string;
}) {
  const selected = value ? new Date(`${value}T00:00:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"year" | "month" | "day">("day");
  const [year, setYear] = useState(selected.getFullYear());
  const [month, setMonth] = useState(selected.getMonth());

  const decadeStart = Math.floor(year / 12) * 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first

  const pick = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(`${year}-${pad(month + 1)}-${pad(day)}`);
    setOpen(false);
    setStep("day");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setYear(selected.getFullYear());
          setMonth(selected.getMonth());
          setStep("year");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-tab-field=""
          className={cn(
            "relative h-9 w-full justify-start pl-[34px] pr-3 text-xs font-normal",
            className,
          )}
        >
          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          {value ? fmt(selected) : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="pointer-events-auto w-64 rounded-2xl p-3">
        {step === "year" && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-7 w-7 " onClick={() => setYear(decadeStart - 12)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold">
                {decadeStart} – {decadeStart + 11}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 " onClick={() => setYear(decadeStart + 12)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((y) => (
                <Button
                  key={y}
                  variant={y === selected.getFullYear() ? "default" : "ghost"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setYear(y);
                    setStep("month");
                  }}
                >
                  {y}
                </Button>
              ))}
            </div>
          </>
        )}

        {step === "month" && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setStep("year")}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> {year}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m, i) => (
                <Button
                  key={m}
                  variant={i === month && year === selected.getFullYear() ? "default" : "ghost"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setMonth(i);
                    setStep("day");
                  }}
                >
                  {m}
                </Button>
              ))}
            </div>
          </>
        )}

        {step === "day" && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setStep("month")}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> {MONTHS[month]} {year}
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-2xs text-muted-foreground">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="py-1">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }, (_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isSel =
                  value &&
                  selected.getFullYear() === year &&
                  selected.getMonth() === month &&
                  selected.getDate() === day;
                return (
                  <Button
                    key={day}
                    variant={isSel ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => pick(day)}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}