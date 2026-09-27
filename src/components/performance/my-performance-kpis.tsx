import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { getMyEarnings } from "@/lib/clinic.functions";
import { CURRENT_MONTH, periodRange } from "@/components/period-picker";
import { moneyWhole } from "@/lib/format";
import { Card } from "@/components/ui/card";

/**
 * A one-line summary of this month for the profile page. The full figures,
 * every period and the export live on My earnings; this only points there.
 */
export function MyPerformanceKpis() {
  const fetchEarnings = useServerFn(getMyEarnings);
  const range = useMemo(() => periodRange(CURRENT_MONTH), []);

  const { data } = useQuery({
    queryKey: ["my-earnings", range.from, range.to],
    queryFn: () => fetchEarnings({ data: range }),
  });

  return (
    <Card
      className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4"
      data-qc="profile-earnings-summary"
    >
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">Your share, last month</p>
        {!data ? (
          <p className="mt-1 text-sm text-muted-foreground">Loading your figures…</p>
        ) : (
          <p className="mt-1 text-sm text-foreground">
            <span className="text-[22px] font-semibold tabular-nums tracking-[-0.016em]">
              {moneyWhole(data.earnedShare)}
            </span>
            <span className="text-muted-foreground">
              {" · "}
              {data.treatments} treatment{data.treatments === 1 ? "" : "s"} · {data.patients}{" "}
              patient
              {data.patients === 1 ? "" : "s"} · {data.retention}% retention
            </span>
          </p>
        )}
      </div>
      <Link
        to="/earnings"
        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-edge bg-glass-2 px-3.5 text-xs font-semibold text-foreground shadow-inset-hi transition-colors hover:bg-accent-wash"
        data-qc="see-my-earnings"
      >
        See my earnings
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </Card>
  );
}
