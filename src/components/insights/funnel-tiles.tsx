import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { focusSection } from "@/lib/focus-section";
import type { InsightsResult } from "@/lib/insights.server";

/** Where each tile's detail lives on the page (ids set in insights.tsx). */
export const FUNNEL_SECTION = {
  signUps: "insights-by-month",
  booked: "insights-waiting",
  consulted: "insights-consulted",
  treated: "insights-sold",
} as const;

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function FunnelTiles({ funnel }: { funnel: InsightsResult["funnel"] | undefined }) {
  const empty = funnel != null && funnel.signUps === 0;
  const tiles = [
    {
      label: "Sign-ups",
      target: FUNNEL_SECTION.signUps,
      value: funnel?.signUps ?? "—",
      hint: empty ? "No new enquiries in this window" : "Website leads and website-sourced records",
    },
    {
      label: "Booked",
      target: FUNNEL_SECTION.booked,
      value: funnel?.bookedCount ?? "—",
      hint: funnel && !empty ? `${pct(funnel.bookedRate)} of sign-ups` : "At least one appointment",
    },
    {
      label: "Consulted",
      target: FUNNEL_SECTION.consulted,
      value: funnel?.consulted ?? "—",
      hint:
        funnel && !empty
          ? `${pct(funnel.consultRate)} of ${funnel.bookedCount ? "booked" : "sign-ups"}`
          : "Consultation visit on file",
    },
    {
      label: "Treated",
      target: FUNNEL_SECTION.treated,
      value: funnel?.converted ?? "—",
      hint: funnel && !empty ? `${pct(funnel.convertRate)} of consulted` : "At least one treatment",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          role="button"
          tabIndex={0}
          aria-label={`${tile.label}: show details`}
          onClick={() => focusSection(tile.target)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              focusSection(tile.target);
            }
          }}
          className="group cursor-pointer p-[18px] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
            <ArrowRight
              className="h-4 w-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden
            />
          </div>
          <p className="mt-2.5 text-[27px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {tile.value}
          </p>
          <p className="mt-2 text-2xs text-muted-foreground">{tile.hint}</p>
        </Card>
      ))}
    </div>
  );
}
