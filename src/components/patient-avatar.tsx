import { useState } from "react";

import { initialsOf } from "@/lib/practitioner-colours";
import { cn } from "@/lib/utils";

/**
 * Photo avatar for patients, shown on every patient card.
 *
 * Uses the AI-generated headshot pool in /public/patient-avatars, mapped
 * deterministically from the patient id so a patient always gets the same
 * face across the portal. A real uploaded photo can take over later via
 * `photoUrl` without touching call sites; when neither is available (or the
 * image fails to load) it falls back to an initials disc.
 */

const POOL = [
  "avatar-emma",
  "avatar-alex",
  "avatar-grace",
  "avatar-priya",
  "avatar-leila",
  "avatar-theo",
  "avatar-p1",
  "avatar-p2",
  "avatar-p3",
  "avatar-p4",
  "avatar-p5",
  "avatar-p6",
] as const;

/** FNV-1a — stable across sessions, cheap, good spread for uuid inputs. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SIZES = { xs: 24, sm: 28, md: 34, lg: 56 } as const;

export type PatientAvatarSize = keyof typeof SIZES | number;

export function patientAvatarUrl(patientId: string): string {
  return `/patient-avatars/${POOL[hashId(patientId) % POOL.length]}.png`;
}

export function PatientAvatar({
  patientId,
  name,
  size = "md",
  photoUrl,
  className,
}: {
  patientId: string | null | undefined;
  name: string;
  /** xs 24 (table rows) · sm 28 · md 34 (cards) · lg 56 (record header), or px. */
  size?: PatientAvatarSize;
  /** Real patient photo once upload exists; overrides the generated pool. */
  photoUrl?: string | null | undefined;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const px = typeof size === "number" ? size : SIZES[size];
  const src = photoUrl ?? (patientId ? patientAvatarUrl(patientId) : null);

  if (!src || broken) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink shadow-inset-hi",
          className,
        )}
        style={{ width: px, height: px, fontSize: Math.max(9, Math.round(px * 0.34)) }}
      >
        {initialsOf(name) || "?"}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      title={name}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn("inline-block shrink-0 rounded-full object-cover ring-1 ring-edge", className)}
      style={{ width: px, height: px }}
    />
  );
}
