/** Demo persona chosen by the staff sign-in email. The pill can still change it afterwards. */
const DEMO_ROLE_BY_EMAIL: Record<string, string> = {
  "amara.osei@sqinos.com": "owner",
  "maya.chen@sqinos.com": "manager",
  "nadia.rahman@sqinos.com": "practitioner",
  "tom.whitfield@sqinos.com": "practitioner",
  "sofia.marchetti@sqinos.com": "front_desk",
  "olivia.bennett@example.com": "patient",
  "developer@sqinos.com": "admin",
  // Previous demo domain — still maps so an old sign-in email lands on the same persona.
  "amara.osei@aetheria.clinic": "owner",
  "maya.chen@aetheria.clinic": "manager",
  "nadia.rahman@aetheria.clinic": "practitioner",
  "tom.whitfield@aetheria.clinic": "practitioner",
  "sofia.marchetti@aetheria.clinic": "front_desk",
  "developer@aetheria.clinic": "admin",
};

/** Point the demo at this account before the next identity request. Returns the role, or null. */
export function applyDemoRoleForEmail(email: string | null | undefined) {
  const role = DEMO_ROLE_BY_EMAIL[email?.trim().toLowerCase() ?? ""] ?? null;
  if (!role || typeof document === "undefined") return role;
  document.cookie = `demo_role=${role}; path=/; max-age=86400; samesite=lax`;
  return role;
}
