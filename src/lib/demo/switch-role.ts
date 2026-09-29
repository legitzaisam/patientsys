/**
 * Demo-only persona switching. The `demo_role` cookie picks who the demo
 * server treats as signed in; changing it needs a full reload.
 */

/** Where a full reload should land so the new persona is not left on a page they cannot open. */
function destinationFor(next: string) {
  const path = window.location.pathname;
  const here = `${path}${window.location.search}${window.location.hash}`;
  if (next === "patient" && !path.startsWith("/my-record")) return "/my-record";
  const leavingPortal = path === "/my-record" || path.startsWith("/my-record/");
  const leavingAccess = path === "/access" && next !== "owner" && next !== "admin";
  if (next !== "patient" && (leavingPortal || leavingAccess)) return "/dashboard";
  return here;
}

/** Set the demo persona cookie and reload where that persona can land. */
export function switchDemoRole(next: string) {
  document.cookie = `demo_role=${next}; path=/; max-age=86400; samesite=lax`;
  const destination = destinationFor(next);
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (destination === here) window.location.reload();
  else window.location.assign(destination);
}
