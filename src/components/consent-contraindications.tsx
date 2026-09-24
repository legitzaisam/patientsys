import { CONTRAINDICATIONS } from "@/lib/visit-stage";
import { cn } from "@/lib/utils";

export type ContraindicationAnswer = "yes" | "no" | "na";

export function contraindicationsComplete(value: Record<string, ContraindicationAnswer | undefined>) {
  return CONTRAINDICATIONS.every((c) => value[c.key]);
}

/** The contraindication questions on the consent form, before treatment or on arrival. */
export function ConsentContraindications({
  value,
  onChange,
}: {
  value: Record<string, ContraindicationAnswer | undefined>;
  onChange: (key: string, answer: ContraindicationAnswer) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-[0.02em] text-foreground">Contraindications</p>
      <ul className="space-y-2">
        {CONTRAINDICATIONS.map((c) => (
          <li key={c.key} className="rounded-xl bg-glass-2 px-3 py-2.5" data-qc={`contraindication-${c.key}`}>
            <p className="text-xs text-foreground">{c.label}</p>
            <p className="text-2xs text-muted-foreground">{c.hint}</p>
            <div className="mt-2 flex gap-1" role="radiogroup" aria-label={c.label}>
              {(["yes", "no", "na"] as const).map((answer) => (
                <button
                  key={answer}
                  type="button"
                  role="radio"
                  aria-checked={value[c.key] === answer}
                  onClick={() => onChange(c.key, answer)}
                  className={cn(
                    "h-7 cursor-pointer rounded-full px-3 text-xs font-semibold transition-colors",
                    value[c.key] === answer
                      ? answer === "yes"
                        ? "bg-destructive-bg text-destructive-ink shadow-[inset_0_0_0_1px_var(--edge)]"
                        : "bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                      : "bg-glass-hi text-ink-2 hover:bg-[rgba(47,63,102,0.08)]",
                  )}
                >
                  {answer === "yes" ? "Yes" : answer === "no" ? "No" : "N/A"}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
