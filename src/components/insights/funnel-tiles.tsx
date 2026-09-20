import { Card } from "@/components/ui/card";
import type { InsightsResult } from "@/lib/insights.server";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function FunnelTiles({ funnel }: { funnel: InsightsResult["funnel"] | undefined }) {
  const empty = funnel != null && funnel.signUps === 0;
  const tiles = [
    {
      label: "Sign-ups",
      value: funnel?.signUps ?? "—",
      hint: empty ? "No new enquiries in this window" : "Website leads and website-sourced records",
    },
    {
      label: "Booked",
      value: funnel?.bookedCount ?? "—",
      hint: funnel && !empty ? `${pct(funnel.bookedRate)} of sign-ups` : "At least one appointment",
    },
    {
      label: "Consulted",
      value: funnel?.consulted ?? "—",
      hint:
        funnel && !empty
          ? `${pct(funnel.consultRate)} of ${funnel.bookedCount ? "booked" : "sign-ups"}`
          : "Consultation visit on file",
    },
    {
      label: "Treated",
      value: funnel?.converted ?? "—",
      hint: funnel && !empty ? `${pct(funnel.convertRate)} of consulted` : "At least one treatment",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="p-[18px]">
          <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
          <p className="mt-2.5 text-[27px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {tile.value}
          </p>
          <p className="mt-2 text-2xs text-muted-foreground">{tile.hint}</p>
        </Card>
      ))}
    </div>
  );
}
