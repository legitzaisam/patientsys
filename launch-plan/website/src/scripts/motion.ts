// Site-wide motion: smooth scroll, reveals, cursor light, magnetic buttons,
// liquid-fill origin and the global "Pause motion" switch.
// Everything is skipped or simplified under prefers-reduced-motion.
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
export { gsap, ScrollTrigger };

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

const PAUSE_KEY = "aetheria:motion-paused";
function storedPause(): boolean {
  try {
    return localStorage.getItem(PAUSE_KEY) === "1";
  } catch {
    return false;
  }
}
export const motionPaused = () => document.documentElement.classList.contains("motion-paused");

function setPaused(paused: boolean) {
  document.documentElement.classList.toggle("motion-paused", paused);
  try {
    localStorage.setItem(PAUSE_KEY, paused ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  document.querySelectorAll<HTMLButtonElement>("[data-motion-toggle]").forEach((b) => {
    b.setAttribute("aria-pressed", String(paused));
    b.textContent = paused ? "Play motion" : "Pause motion";
  });
  dispatchEvent(new CustomEvent("aetheria:motion", { detail: { paused } }));
}

function smoothScroll() {
  if (reducedMotion()) return;
  lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Same-page anchors glide instead of jumping.
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/#"], a[href^="#"]');
    if (!a || location.pathname !== "/") return;
    const id = a.getAttribute("href")!.split("#")[1];
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    lenis?.scrollTo(target, { offset: -70 });
    history.replaceState(null, "", `#${id}`);
  });
}

function reveals() {
  const els = document.querySelectorAll<HTMLElement>(
    "[data-reveal], [data-lines], [data-footer], [data-inview]",
  );
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );
  els.forEach((el) => io.observe(el));
}

function cursorLight() {
  if (!finePointer()) return;
  document.addEventListener(
    "pointermove",
    (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-light]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
    { passive: true },
  );
}

function buttons() {
  // Liquid fill grows from where the pointer entered.
  document.addEventListener("pointerover", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".btn");
    if (!b || b.contains(e.relatedTarget as Node)) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty("--bx", `${e.clientX - r.left}px`);
    b.style.setProperty("--by", `${e.clientY - r.top}px`);
  });
  if (!finePointer() || reducedMotion()) return;
  // Magnetic pull on primary calls to action.
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 0.28;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      gsap.to(el, { x, y, duration: 0.5, ease: "power3.out" });
    });
    el.addEventListener("pointerleave", () =>
      gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.45)" }),
    );
  });
}

function pauseSwitch() {
  setPaused(storedPause());
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-motion-toggle]");
    if (b) setPaused(!motionPaused());
  });
}

let started = false;
export function initMotion() {
  if (started) return;
  started = true;
  pauseSwitch();
  smoothScroll();
  reveals();
  cursorLight();
  buttons();
}
