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
  manager: demo("/demo/enter?role=manager"),
  practitioner: demo("/demo/enter?role=practitioner"),
  frontDesk: demo("/demo/enter?role=front_desk"),
  showPersonas: (env.PUBLIC_DEMO_PERSONAS ?? "true") !== "false",
  // Sqinos's contact address; override per deployment with PUBLIC_CONTACT_EMAIL.
  contactEmail: env.PUBLIC_CONTACT_EMAIL || "contact.sqinos@gmail.com",
  // /contact posts to a form service (Web3Forms by default). Without a key the
  // form falls back to a prefilled email to contactEmail.
  contactFormKey: env.PUBLIC_CONTACT_FORM_KEY || "",
  contactFormEndpoint: env.PUBLIC_CONTACT_FORM_ENDPOINT || "https://api.web3forms.com/submit",
};
