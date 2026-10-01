/**
 * Drag-to-reschedule for diary cards, for mouse, pen and touch.
 *
 * Framework-free so it can be exercised in a plain page; the day planner in
 * src/routes/_authenticated/schedule.tsx wires it to React state.
 *
 * Behaviour:
 *  - Mouse/pen: the drag starts once the pointer has moved a few pixels, so a
 *    click never moves a card.
 *  - Touch: the drag starts after a short press-and-hold. Moving the finger
 *    before that is treated as scrolling and abandons the drag, so a swipe
 *    through the diary never moves an appointment.
 *  - The card keeps the offset at which it was grabbed: it moves with the
 *    pointer instead of snapping its start time to the finger.
 *  - Listeners live on window for the whole gesture, and pointercancel (the
 *    browser taking the gesture over) puts the card back. A drop is only
 *    reported on pointerup, and only if the time or practitioner changed.
 *  - While a drag is live, page scrolling, text selection and the touch
 *    context menu are suppressed.
 */
export const DIARY_LONG_PRESS_MS = 260;
const TOUCH_SLOP_PX = 10;
const MOUSE_SLOP_PX = 4;
const DRAGGING_CLASS = "diary-dragging";
export function createDiaryDrag(getOptions) {
    let state = null;
    const preview = (s) => ({
        id: s.item.id,
        duration: s.item.duration,
        minute: s.minute,
        colId: s.colId,
        originMinute: s.item.startMinute,
        originColId: s.item.colId,
        moved: s.minute !== s.item.startMinute || s.colId !== s.item.colId,
    });
    const block = (event) => {
        if (state)
            event.preventDefault();
    };
    const blockWhileActive = (event) => {
        if (state?.active && event.cancelable)
            event.preventDefault();
    };
    function listen(on) {
        const method = on ? "addEventListener" : "removeEventListener";
        window[method]("pointermove", onMove, true);
        window[method]("pointerup", onUp, true);
        window[method]("pointercancel", onCancel, true);
        // Non-passive so a live drag can stop the page from scrolling.
        window[method]("touchmove", blockWhileActive, { capture: true, passive: false });
        document[method]("selectstart", block, true);
        window[method]("contextmenu", block, true);
    }
    function finish() {
        const s = state;
        if (!s)
            return;
        if (s.timer)
            clearTimeout(s.timer);
        state = null;
        listen(false);
        document.documentElement.classList.remove(DRAGGING_CLASS);
        if (s.active)
            getOptions().onPreview(null);
    }
    function activate() {
        const s = state;
        if (!s || s.active)
            return;
        s.active = true;
        if (s.timer)
            clearTimeout(s.timer);
        s.timer = null;
        document.documentElement.classList.add(DRAGGING_CLASS);
        window.getSelection?.()?.removeAllRanges();
        getOptions().onPreview(preview(s));
    }
    function onMove(event) {
        const s = state;
        if (!s || event.pointerId !== s.pointerId)
            return;
        if (!s.active) {
            const distance = Math.hypot(event.clientX - s.startX, event.clientY - s.startY);
            if (s.touch) {
                // Moving before the hold completes is a scroll, not a drag.
                if (distance > TOUCH_SLOP_PX)
                    finish();
                return;
            }
            if (distance <= MOUSE_SLOP_PX)
                return;
            activate();
        }
        if (event.cancelable)
            event.preventDefault();
        const opts = getOptions();
        const minute = opts.clampMinute(opts.minuteAt(event.clientY) - s.grabOffset, s.item.duration);
        const colId = opts.columnAt(event.clientX) ?? s.colId;
        if (minute === s.minute && colId === s.colId)
            return;
        s.minute = minute;
        s.colId = colId;
        opts.onPreview(preview(s));
    }
    function onUp(event) {
        const s = state;
        if (!s || event.pointerId !== s.pointerId)
            return;
        const result = s.active ? preview(s) : null;
        if (s.active)
            suppressNextClick();
        finish();
        if (result?.moved)
            getOptions().onDrop(result);
    }
    function onCancel(event) {
        if (!state || event.pointerId !== state.pointerId)
            return;
        finish();
    }
    /** A drag that ends over a link or button must not also click it. */
    function suppressNextClick() {
        const swallow = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, true), 350);
    }
    return {
        /** Call from the card's pointerdown. Returns true if a drag is pending. */
        start(event, item) {
            const ev = "nativeEvent" in event ? event.nativeEvent : event;
            if (ev.button !== 0 || !ev.isPrimary)
                return false;
            finish();
            const touch = ev.pointerType === "touch";
            const opts = getOptions();
            state = {
                item,
                pointerId: ev.pointerId,
                touch,
                startX: ev.clientX,
                startY: ev.clientY,
                grabOffset: opts.minuteAt(ev.clientY) - item.startMinute,
                active: false,
                minute: item.startMinute,
                colId: item.colId,
                timer: null,
            };
            // Mouse: stop the press from starting a text selection.
            if (!touch)
                ev.preventDefault();
            // Touch: the browser holds pointer capture on the card; release it so
            // the column under the finger can be found while dragging.
            const target = ev.target;
            if (touch && target?.hasPointerCapture?.(ev.pointerId))
                target.releasePointerCapture(ev.pointerId);
            if (touch)
                state.timer = setTimeout(activate, DIARY_LONG_PRESS_MS);
            listen(true);
            return true;
        },
        /**
         * Register the planner element once on mount. iOS Safari only lets a page
         * stop scrolling from touchmove listeners that existed when the finger
         * went down, so this one is permanent and only acts during a live drag.
         */
        attach(element) {
            const opts = { passive: false };
            element.addEventListener("touchmove", blockWhileActive, opts);
            return () => element.removeEventListener("touchmove", blockWhileActive, opts);
        },
        /** Abandon any drag and put the card back. */
        cancel: finish,
        isActive: () => Boolean(state?.active),
        dispose: finish,
    };
}
