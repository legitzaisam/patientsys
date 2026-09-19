/** Same prefixes as the patient Title field. */
export const STAFF_TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mx", "Dr", "Prof"] as const;

export function splitStaffName(fullName: string): { title: string; name: string } {
  const trimmed = fullName.trim();
  for (const title of STAFF_TITLES) {
    const dotted = `${title}. `;
    const plain = `${title} `;
    if (trimmed.startsWith(dotted)) return { title, name: trimmed.slice(dotted.length).trim() };
    if (trimmed.startsWith(plain)) return { title, name: trimmed.slice(plain.length).trim() };
  }
  return { title: "", name: trimmed };
}

export function joinStaffName(title: string, name: string): string {
  return [title.trim(), name.trim()].filter(Boolean).join(" ");
}
