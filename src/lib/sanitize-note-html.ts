/** Strip dangerous tags/attrs from TipTap HTML before persistence. */
export function sanitizeNoteHtml(html: string) {
  let out = String(html ?? "").slice(0, 50_000);
  out = out.replace(/<\/?(script|iframe|object|embed|form|link|meta|style|base)[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/javascript:/gi, "");
  out = out.replace(/data:text\/html/gi, "");
  return out;
}

/** Visit notes are a textarea — persist and show plain text, never markup. */
export function plainVisitNote(raw: string | null | undefined): string {
  let s = String(raw ?? "");
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\s*\/p\s*>/gi, "\n");
  s = s.replace(/<\s*p[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/&amp;/gi, "&");
  s = s.replace(/&lt;/gi, "<");
  s = s.replace(/&gt;/gi, ">");
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
