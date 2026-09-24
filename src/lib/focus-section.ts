/**
 * Scroll a section into view and flash a soft accent ring around it, so a
 * click on a summary card visibly lands on the detail it summarises.
 * The ring is `.focus-flash` in styles.css and removes itself when it ends.
 */
export function focusSection(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("focus-flash");
    // Reading a layout property restarts the animation on a repeat click.
    void el.offsetWidth;
    el.classList.add("focus-flash");
    el.addEventListener("animationend", () => el.classList.remove("focus-flash"), { once: true });
  });
}
