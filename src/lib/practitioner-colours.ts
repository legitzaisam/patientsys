import type { CSSProperties } from "react";

/** Stable per-practitioner accent lanes drawn from the clinic palette. */
export type LaneTone = {
  text: string;
  border: string;
  bg: string;
  bgHover: string;
  edge: string;
  ring: string;
  dot: string;
  softBg: string;
  /** Left-edge accent for diary events. */
  rail: string;
  /** Present for custom (colour-wheel) colours — spread onto the element. */
  style?: CSSProperties;
};

const LANES: LaneTone[] = [
  {
    text: "text-lane-1-ink",
    border: "border-lane-1/60",
    bg: "bg-lane-1/25",
    bgHover: "hover:bg-lane-1/40",
    edge: "bg-lane-1",
    ring: "ring-lane-1/30",
    dot: "bg-lane-1",
    rail: "border-l-lane-1",
    softBg: "bg-lane-1/30",
  },
  {
    text: "text-lane-2-ink",
    border: "border-lane-2/60",
    bg: "bg-lane-2/25",
    bgHover: "hover:bg-lane-2/40",
    edge: "bg-lane-2",
    ring: "ring-lane-2/30",
    dot: "bg-lane-2",
    rail: "border-l-lane-2",
    softBg: "bg-lane-2/30",
  },
  {
    text: "text-lane-3-ink",
    border: "border-lane-3/60",
    bg: "bg-lane-3/25",
    bgHover: "hover:bg-lane-3/40",
    edge: "bg-lane-3",
    ring: "ring-lane-3/30",
    dot: "bg-lane-3",
    rail: "border-l-lane-3",
    softBg: "bg-lane-3/30",
  },
  {
    text: "text-lane-4-ink",
    border: "border-lane-4/60",
    bg: "bg-lane-4/25",
    bgHover: "hover:bg-lane-4/40",
    edge: "bg-lane-4",
    ring: "ring-lane-4/30",
    dot: "bg-lane-4",
    rail: "border-l-lane-4",
    softBg: "bg-lane-4/30",
  },
  {
    text: "text-lane-5-ink",
    border: "border-lane-5/60",
    bg: "bg-lane-5/25",
    bgHover: "hover:bg-lane-5/40",
    edge: "bg-lane-5",
    ring: "ring-lane-5/30",
    dot: "bg-lane-5",
    rail: "border-l-lane-5",
    softBg: "bg-lane-5/30",
  },
  {
    text: "text-lane-6-ink",
    border: "border-lane-6/60",
    bg: "bg-lane-6/25",
    bgHover: "hover:bg-lane-6/40",
    edge: "bg-lane-6",
    ring: "ring-lane-6/30",
    dot: "bg-lane-6",
    rail: "border-l-lane-6",
    softBg: "bg-lane-6/30",
  },
  {
    text: "text-lane-7-ink",
    border: "border-lane-7/60",
    bg: "bg-lane-7/25",
    bgHover: "hover:bg-lane-7/40",
    edge: "bg-lane-7",
    ring: "ring-lane-7/30",
    dot: "bg-lane-7",
    rail: "border-l-lane-7",
    softBg: "bg-lane-7/30",
  },
  {
    text: "text-lane-8-ink",
    border: "border-lane-8/60",
    bg: "bg-lane-8/25",
    bgHover: "hover:bg-lane-8/40",
    edge: "bg-lane-8",
    ring: "ring-lane-8/30",
    dot: "bg-lane-8",
    rail: "border-l-lane-8",
    softBg: "bg-lane-8/30",
  },
];

/** Human-readable names for each lane, used in the colour picker and legend. */
export const LANE_OPTIONS = [
  { lane: 1, label: "Teal" },
  { lane: 2, label: "Green" },
  { lane: 3, label: "Amber" },
  { lane: 4, label: "Blue" },
  { lane: 5, label: "Magenta" },
  { lane: 6, label: "Coral" },
  { lane: 7, label: "Violet" },
  { lane: 8, label: "Olive" },
] as const;

export function laneTone(lane: number): LaneTone {
  return LANES[(lane - 1 + LANES.length) % LANES.length]!;
}

export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Tone built from an arbitrary hex colour chosen with the colour wheel. */
export function customTone(hex: string): LaneTone {
  const mix = (pct: number) => `color-mix(in srgb, ${hex} ${pct}%, transparent)`;
  return {
    text: "text-[var(--tc-ink)]",
    border: "border-[var(--tc-border)]",
    bg: "bg-[var(--tc-bg)]",
    bgHover: "hover:bg-[var(--tc-bg-hover)]",
    edge: "bg-[var(--tc)]",
    ring: "ring-[var(--tc-ring)]",
    dot: "bg-[var(--tc)]",
    rail: "border-l-[var(--tc)]",
    softBg: "bg-[var(--tc-soft)]",
    style: {
      ["--tc" as any]: hex,
      ["--tc-ink" as any]: `color-mix(in srgb, ${hex} 65%, #2f3f66)`,
      ["--tc-border" as any]: mix(60),
      ["--tc-bg" as any]: mix(25),
      ["--tc-bg-hover" as any]: mix(40),
      ["--tc-ring" as any]: mix(45),
      ["--tc-soft" as any]: mix(30),
    } as CSSProperties,
  };
}

export function treatmentKey(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase();
}

/** Lane number (1-based) a treatment falls back to when no override is stored. */
export function defaultLaneFor(name: string | null | undefined) {
  const key = treatmentKey(name);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return (hash % LANES.length) + 1;
}

/** Deterministic lane for an id so colours stay stable between renders. */
export function laneFor(id: string | null | undefined): LaneTone {
  const key = id ?? "unassigned";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return LANES[hash % LANES.length]!;
}

/** Tone for a treatment name — a manager override wins, otherwise a stable default. */
export function toneForTreatment(
  name: string | null | undefined,
  overrides?: Record<string, number | string>,
): LaneTone {
  const override = overrides?.[treatmentKey(name)];
  if (isHexColour(override)) return customTone(override);
  return laneTone(typeof override === "number" ? override : defaultLaneFor(name));
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}