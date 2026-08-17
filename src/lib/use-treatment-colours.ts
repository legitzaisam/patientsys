import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTreatmentColours } from "@/lib/clinic.functions";

/** Manager-defined treatment colour overrides (lane number or custom hex), keyed by lowercase treatment name. */
export function useTreatmentColours() {
  const fetchColours = useServerFn(listTreatmentColours);
  const { data } = useQuery({
    queryKey: ["treatment-colours"],
    queryFn: () => fetchColours(),
    staleTime: 60_000,
  });
  return (data ?? {}) as Record<string, number | string>;
}
