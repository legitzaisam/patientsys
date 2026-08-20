/** Strip dangerous tags/attrs from TipTap HTML before persistence. */
export function sanitizeNoteHtml(html: string) {
  let out = String(html ?? "").slice(0, 50_000);
  out = out.replace(/<\/?(script|iframe|object|embed|form|link|meta|style|base)[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/javascript:/gi, "");
  out = out.replace(/data:text\/html/gi, "");
  return out;
}
