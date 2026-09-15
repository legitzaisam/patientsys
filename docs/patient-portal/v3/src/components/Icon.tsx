/** Small stroke-icon set shared by all six directions (same paths as the v2 decks). */
export const IC = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
  cal: "M4 5h16v16H4zM4 9.5h16M8 3v4M16 3v4",
  plan: "M4 4h16v4H4zM4 12h10v8H4zM18 12h2v8h-2",
  task: "M5 4h14v16H5zM8.5 9.5h7M8.5 13h7M8.5 16.5h4",
  photo: "M4 5h16v14H4zM8 12l2.5 3 3-4 4.5 6",
  msg: "M4 5h16v11H8l-4 4z",
  bill: "M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21zM9 8h6M9 12h6",
  gear: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M4.2 6.5l2.2 1.7M17.6 15.8l2.2 1.7M2 12h3M19 12h3M4.2 17.5l2.2-1.7M17.6 8.2l2.2-1.7",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  flag: "M6 3v18M6 4h11l-2.5 4L17 12H6",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  check: "M5 12.5 10 17.5 19 7",
  up: "M12 16V5M7 9.5 12 5l5 4.5M5 19h14",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4.5l3 2",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l1.6 2.4H4.4zM10.5 21a2 2 0 0 0 3 0",
  users: "M9 11a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 9 11zM3 20c.8-3.2 3-4.8 6-4.8s5.2 1.6 6 4.8M16.5 10.6a3 3 0 1 0-1.7-5.6M17 15.4c2 .5 3.4 1.9 4 4.6",
  chart: "M4 18V9M9.3 18V5M14.6 18v-7M20 18V8",
  trend: "M4 17l5-5 4 3 7-8M4 20h16",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  heart: "M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z",
  shield: "M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6zM9 12l2.2 2.2L15.5 10",
  link: "M9 14l6-6M8 16a4 4 0 0 1 0-6l2-2M16 8a4 4 0 0 1 0 6l-2 2",
  person: "M12 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 11zM6 19.5c1-2.9 3.2-4.3 6-4.3s5 1.4 6 4.3",
  sun: "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  warn: "M12 4 21 19H3zM12 10v4M12 16.6v.4",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
} as const;

export type IconName = keyof typeof IC;

export function Icon({
  d,
  size = 18,
  stroke,
  className,
  style,
}: {
  d: IconName | string;
  size?: number;
  stroke?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const path = (IC as Record<string, string>)[d] ?? d;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={stroke ?? "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
