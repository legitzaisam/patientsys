// Where sign-in and demo buttons point. Defaults target the launch gateway's
// /demo/enter entry points; set PUBLIC_* variables when real hosts exist
// (clinic.<domain>/auth and my.<domain>/portal).
//
// PUBLIC_PREVIEW_MODE=true builds a website-only preview (no demo app behind
// it): every demo link opens a short note instead of a dead page.
const env = import.meta.env;
export const previewMode = env.PUBLIC_PREVIEW_MODE === "true";
const demo = (url: string) => (previewMode ? "#demo-note" : url);

export const links = {
  clinic: demo(env.PUBLIC_CLINIC_SIGNIN_URL || "/demo/enter?role=owner"),
  patient: demo(env.PUBLIC_PATIENT_SIGNIN_URL || "/demo/enter?role=patient"),
  practitioner: demo("/demo/enter?role=practitioner"),
  frontDesk: demo("/demo/enter?role=front_desk"),
  showPersonas: (env.PUBLIC_DEMO_PERSONAS ?? "true") !== "false",
  contactEmail: env.PUBLIC_CONTACT_EMAIL || "",
};
