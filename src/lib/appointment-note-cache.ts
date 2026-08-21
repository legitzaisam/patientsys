import type { QueryClient } from "@tanstack/react-query";

export type AppointmentNoteData = {
  body: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export function appointmentNoteQueryKey(appointmentId: string) {
  return ["appointment-note", appointmentId] as const;
}

/** Normalize `appointment_notes` embed from Supabase (object or 1-row array). */
export function noteFromAppointmentEmbed(appointment: {
  appointment_notes?:
    | { body?: string | null; updated_at?: string | null; updated_by_label?: string | null }
    | { body?: string | null; updated_at?: string | null; updated_by_label?: string | null }[]
    | null;
}): AppointmentNoteData {
  const raw = appointment.appointment_notes;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) {
    return { body: "", updatedAt: null, updatedBy: null };
  }
  return {
    body: (row.body as string) ?? "",
    updatedAt: (row.updated_at as string) ?? null,
    updatedBy: (row.updated_by_label as string) ?? null,
  };
}

/**
 * Seed per-appointment note queries from diary/list payloads so every card
 * chip lights up without waiting on N individual fetches. Prefers a non-empty
 * cached body over an empty list embed (avoids clobbering a just-saved note).
 */
export function seedAppointmentNoteQueries(
  queryClient: QueryClient,
  appointments: { id?: string; appointment_notes?: unknown }[] | null | undefined,
) {
  if (!appointments?.length) return;
  for (const a of appointments) {
    if (!a?.id) continue;
    const fromList = noteFromAppointmentEmbed(a as Parameters<typeof noteFromAppointmentEmbed>[0]);
    const key = appointmentNoteQueryKey(a.id);
    queryClient.setQueryData(key, (prev: AppointmentNoteData | undefined) => {
      if (!prev) return fromList;
      const prevHas = (prev.body ?? "").trim().length > 0;
      const listHas = fromList.body.trim().length > 0;
      if (prevHas && !listHas) return prev;
      return fromList;
    });
  }
}
