import { getAppZoom } from "./app-zoom.js";
const DRAGGING_CLASS = "app-dragging";
export function startPointerDrag(input, handlers) {
    const event = "nativeEvent" in input ? input.nativeEvent : input;
    const handle = ("nativeEvent" in input ? input.currentTarget : event.currentTarget);
    if (event.button !== 0 || !event.isPrimary)
        return false;
    event.preventDefault();
    const { pointerId } = event;
    const startX = event.clientX;
    const startY = event.clientY;
    const zoom = getAppZoom();
    let done = false;
    try {
        handle?.setPointerCapture?.(pointerId);
    }
    catch {
        /* capture is best-effort */
    }
    const move = (e) => {
        if (e.pointerId !== pointerId)
            return;
        if (e.cancelable)
            e.preventDefault();
        handlers.onMove((e.clientX - startX) / zoom, (e.clientY - startY) / zoom, e);
    };
    const up = (e) => {
        if (e.pointerId === pointerId)
            end(false);
    };
    const cancel = (e) => {
        if (e.pointerId === pointerId)
            end(true);
    };
    const block = (e) => {
        if (e.cancelable)
            e.preventDefault();
    };
    const passiveFalse = { capture: true, passive: false };
    function end(cancelled) {
        if (done)
            return;
        done = true;
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", up, true);
        window.removeEventListener("pointercancel", cancel, true);
        window.removeEventListener("touchmove", block, passiveFalse);
        document.removeEventListener("selectstart", block, true);
        window.removeEventListener("contextmenu", block, true);
        handle?.removeEventListener("lostpointercapture", lost);
        document.documentElement.classList.remove(DRAGGING_CLASS);
        try {
            if (handle?.hasPointerCapture?.(pointerId))
                handle.releasePointerCapture(pointerId);
        }
        catch {
            /* already released */
        }
        handlers.onEnd?.(cancelled);
    }
    // Capture lost without a pointerup (element removed, browser took over).
    const lost = () => setTimeout(() => end(true), 0);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("touchmove", block, passiveFalse);
    document.addEventListener("selectstart", block, true);
    window.addEventListener("contextmenu", block, true);
    handle?.addEventListener("lostpointercapture", lost);
    document.documentElement.classList.add(DRAGGING_CLASS);
    window.getSelection?.()?.removeAllRanges();
    return true;
}
