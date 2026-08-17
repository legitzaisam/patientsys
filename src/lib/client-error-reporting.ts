import { reportLovableError } from "./lovable-error-reporting";

let installed = false;

/** Forwards uncaught client errors and rejected promises to error reporting. */
export function installClientErrorReporting() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const onError = (event: ErrorEvent) => {
    reportLovableError(event.error ?? new Error(event.message), {
      mechanism: "onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    reportLovableError(event.reason ?? new Error("Unhandled promise rejection"), {
      mechanism: "unhandledrejection",
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
