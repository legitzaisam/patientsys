/** Registry of the 15 designed screens, used by the DeckSwitcher. */
export interface ScreenDef {
  path: string;
  portal: "patient" | "clinic";
  dir: string;
  title: string;
}

export const SCREENS: ScreenDef[] = [
  { path: "/patient/lumina", portal: "patient", dir: "Lumina", title: "Skin Plan & Journey" },
  { path: "/patient/vivara", portal: "patient", dir: "Vivara", title: "Skin Plan & Journey" },
  { path: "/patient/radiant", portal: "patient", dir: "Radiant", title: "Glow Garden View" },
  { path: "/clinic/pastel/overview", portal: "clinic", dir: "Pastel", title: "Clinic overview" },
  { path: "/clinic/pastel/diary", portal: "clinic", dir: "Pastel", title: "Clinic diary" },
  { path: "/clinic/pastel/patients", portal: "clinic", dir: "Pastel", title: "Patients" },
  { path: "/clinic/pastel/patients/grace-adeyemi", portal: "clinic", dir: "Pastel", title: "Patient record" },
  { path: "/clinic/pastel/performance", portal: "clinic", dir: "Pastel", title: "Performance" },
  { path: "/clinic/journey/overview", portal: "clinic", dir: "Journey", title: "Clinic overview" },
  { path: "/clinic/journey/patients/grace-adeyemi", portal: "clinic", dir: "Journey", title: "Patient skin journey" },
  { path: "/clinic/journey/retention", portal: "clinic", dir: "Journey", title: "Retention & outcomes" },
  { path: "/clinic/advanced/overview", portal: "clinic", dir: "Advanced", title: "Clinic Overview" },
  { path: "/clinic/advanced/diary", portal: "clinic", dir: "Advanced", title: "Clinic Diary" },
  { path: "/clinic/advanced/patients/grace-adeyemi", portal: "clinic", dir: "Advanced", title: "Patient record" },
  { path: "/clinic/advanced/board", portal: "clinic", dir: "Advanced", title: "Journey Board" },
];

export const DIRECTIONS = [
  { id: "Lumina", portal: "patient", first: "/patient/lumina", blurb: "Sidebar · deep green · roadmap + drawer" },
  { id: "Vivara", portal: "patient", first: "/patient/vivara", blurb: "Top nav · tabs · today-first" },
  { id: "Radiant", portal: "patient", first: "/patient/radiant", blurb: "Glow Garden journey view" },
  { id: "Pastel", portal: "clinic", first: "/clinic/pastel/overview", blurb: "Sidebar · pastel · ops-first" },
  { id: "Journey", portal: "clinic", first: "/clinic/journey/overview", blurb: "Sidebar · green · journey-led" },
  { id: "Advanced", portal: "clinic", first: "/clinic/advanced/overview", blurb: "Top nav · serif · 16:9" },
] as const;
