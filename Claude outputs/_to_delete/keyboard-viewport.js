import { getAppZoom } from "./app-zoom.js";
/**
 * Keeps popups clear of the on-screen keyboard (iPad / iPhone).
 *
 * iOS Safari does not shrink the page when the keyboard opens: it only
 * shrinks the *visual* viewport. A dialog centred on the page therefore sits
 * half under the keyboard. While the keyboard is up this publishes the
 * visible area as CSS variables and sets html[data-keyboard="open"]; the rule
 * in src/styles.css then centres dialogs in what is actually visible and caps
 * their height to fit, so the dialog's own body scrolls instead.
 *
 * Nothing changes on desktop: there is no on-screen keyboard, so the
 * attribute is never set.
 */
const KEYBOARD_MIN_PX = 120;
export function installKeyboardViewport() {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv)
        return () => { };
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
        frame = 0;
        const open = window.innerHeight - vv.height > KEYBOARD_MIN_PX;
        if (!open) {
            if (root.dataset["keyboard"]) {
                delete root.dataset["keyboard"];
                root.style.removeProperty("--vv-top");
                root.style.removeProperty("--vv-height");
            }
            return;
        }
        // Lengths on fixed elements are scaled by the app zoom; undo it.
        const zoom = getAppZoom();
        root.style.setProperty("--vv-top", `${vv.offsetTop / zoom}px`);
        root.style.setProperty("--vv-height", `${vv.height / zoom}px`);
        if (root.dataset["keyboard"] !== "open") {
            root.dataset["keyboard"] = "open";
            // Once the dialog has moved, bring the field being typed in into view.
            requestAnimationFrame(() => {
                const field = document.activeElement;
                if (field?.closest('[role="dialog"]'))
                    field.scrollIntoView({ block: "nearest" });
            });
        }
    };
    const schedule = () => {
        if (!frame)
            frame = requestAnimationFrame(update);
    };
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    update();
    return () => {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
        if (frame)
            cancelAnimationFrame(frame);
    };
}
