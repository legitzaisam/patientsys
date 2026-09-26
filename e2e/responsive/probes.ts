/**
 * In-page probes. `runProbes` is serialised into the page by Playwright, so
 * it must be self-contained: no imports, no closures over module scope.
 */

export type Severity = "blocker" | "major" | "minor" | "info";

export type Finding = {
  probe: string;
  severity: Severity;
  message: string;
  count?: number;
  samples?: string[];
};

export type ProbeOptions = {
  /** Touch device: tap-target sizes apply. */
  touch: boolean;
  /** Phone-class viewport: type floor and iOS input zoom apply. */
  phone: boolean;
  /** WebKit engine: iOS-specific checks. */
  webkit: boolean;
};

export type ProbeResult = {
  viewport: { width: number; height: number };
  document: { scrollWidth: number; clientWidth: number; scrollHeight: number };
  main: {
    present: boolean;
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
  } | null;
  findings: Finding[];
};

export function runProbes(opts: ProbeOptions): ProbeResult {
  const findings: Finding[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const main = document.getElementById("app-main-scroll");

  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const qc = el.getAttribute("data-qc");
    const id = el.id ? `#${el.id}` : "";
    const aria = el.getAttribute("aria-label");
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    return `${tag}${id}${qc ? `[data-qc=${qc}]` : ""}${aria ? `[aria-label=${aria.slice(0, 30)}]` : ""}${cls ? `.${cls}` : ""}${text ? ` "${text}"` : ""}`;
  }

  function visible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0")
      return false;
    if (el.closest('[aria-hidden="true"], .sr-only, [data-state="closed"][role="dialog"]'))
      return false;
    return true;
  }

  function insideIntentionalScroller(el: Element): boolean {
    let node: Element | null = el.parentElement;
    while (node && node !== document.body) {
      if (node === main) return false;
      const style = getComputedStyle(node);
      if (style.overflowX === "auto" || style.overflowX === "scroll") return true;
      if (
        node.hasAttribute("data-diary-slide") ||
        node.classList.contains("diary-carousel-scroller")
      )
        return true;
      node = node.parentElement;
    }
    return false;
  }

  function isFixed(el: Element) {
    const pos = getComputedStyle(el).position;
    return pos === "fixed" || pos === "sticky";
  }

  const all = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter(
    (el) =>
      ![
        "SCRIPT",
        "STYLE",
        "SVG",
        "PATH",
        "LINE",
        "CIRCLE",
        "RECT",
        "G",
        "DEFS",
        "USE",
        "POLYLINE",
      ].includes(el.tagName),
  );

  /* ---------------------------------------------------------------- */
  /* 1. Horizontal overflow                                            */
  /* ---------------------------------------------------------------- */
  const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (docOverflow > 1) {
    findings.push({
      probe: "overflow.document",
      severity: "blocker",
      message: `The page is ${docOverflow}px wider than the viewport (horizontal scroll on the document).`,
    });
  }
  if (main) {
    const mainOverflow = main.scrollWidth - main.clientWidth;
    if (mainOverflow > 1) {
      findings.push({
        probe: "overflow.main",
        severity: "blocker",
        message: `The content area is ${mainOverflow}px wider than its box (#app-main-scroll scrolls sideways).`,
      });
    }
  }
  {
    const offenders: string[] = [];
    let count = 0;
    for (const el of all) {
      if (!visible(el)) continue;
      if (isFixed(el)) continue;
      if (insideIntentionalScroller(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4) continue;
      if (rect.right > vw + 1 || rect.left < -1) {
        count += 1;
        if (offenders.length < 6)
          offenders.push(
            `${describe(el)} → left ${Math.round(rect.left)}, right ${Math.round(rect.right)} (viewport ${vw})`,
          );
      }
    }
    if (count > 0) {
      findings.push({
        probe: "overflow.elements",
        severity: "blocker",
        message: `${count} visible element${count === 1 ? "" : "s"} extend past the viewport edge outside any horizontal scroller.`,
        count,
        samples: offenders,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 2. Reachability of the last content                               */
  /* ---------------------------------------------------------------- */
  {
    const region = main ?? document.body;
    const leaves = Array.from(region.querySelectorAll<HTMLElement>("*")).filter(
      (el) =>
        visible(el) &&
        !isFixed(el) &&
        el.children.length === 0 &&
        (el.textContent ?? "").trim().length > 0,
    );
    const last = leaves[leaves.length - 1];
    if (last) {
      // scrollIntoView scrolls every scrollable ancestor (including
      // overflow:hidden boxes, which scroll programmatically) sideways as
      // well as down. Remember and restore all of them so the screenshot
      // shows the page as the user left it.
      const saved: { el: Element; left: number; top: number }[] = [];
      for (let node: Element | null = last; node; node = node.parentElement) {
        saved.push({ el: node, left: node.scrollLeft, top: node.scrollTop });
      }
      const win = { x: window.scrollX, y: window.scrollY };
      last.scrollIntoView({ block: "end", inline: "nearest" });
      const rect = last.getBoundingClientRect();
      const reachable =
        rect.bottom <= vh + 1 && rect.top >= -1 && rect.left >= -1 && rect.right <= vw + 1;
      for (const s of saved) {
        if (s.el.scrollLeft !== s.left) s.el.scrollLeft = s.left;
        if (s.el.scrollTop !== s.top) s.el.scrollTop = s.top;
      }
      window.scrollTo(win.x, win.y);
      if (!reachable) {
        findings.push({
          probe: "reachability.last",
          severity: "blocker",
          message: `The last piece of content cannot be scrolled fully into view: ${describe(last)} at top ${Math.round(rect.top)}, bottom ${Math.round(rect.bottom)}, right ${Math.round(rect.right)}.`,
        });
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* 3. Clipped text                                                   */
  /* ---------------------------------------------------------------- */
  {
    const samples: string[] = [];
    let count = 0;
    for (const el of all) {
      if (!visible(el)) continue;
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("")
        .trim();
      if (!ownText) continue;
      const style = getComputedStyle(el);
      const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
      if (!clipsX) continue;
      if (style.textOverflow === "ellipsis") continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        count += 1;
        if (samples.length < 6)
          samples.push(`${describe(el)} (${el.scrollWidth} in ${el.clientWidth}px)`);
      }
    }
    if (count > 0) {
      findings.push({
        probe: "text.clipped",
        severity: "major",
        message: `${count} text element${count === 1 ? "" : "s"} are cut off by overflow:hidden with no ellipsis.`,
        count,
        samples,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 4. Fixed overlays                                                 */
  /* ---------------------------------------------------------------- */
  {
    const overlays = all.filter((el) => {
      if (!visible(el)) return false;
      const style = getComputedStyle(el);
      if (style.position !== "fixed") return false;
      if (style.pointerEvents === "none" && el.children.length === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width >= 24 && rect.height >= 24 && rect.width < vw * 0.98;
    });
    // Keep only outermost fixed elements (a fixed child of a fixed parent is the same overlay).
    const outer = overlays.filter(
      (el) => !overlays.some((other) => other !== el && other.contains(el)),
    );
    const pairs: string[] = [];
    for (let i = 0; i < outer.length; i += 1) {
      for (let j = i + 1; j < outer.length; j += 1) {
        const a = outer[i]!.getBoundingClientRect();
        const b = outer[j]!.getBoundingClientRect();
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // Dialog scrims legitimately cover everything.
        if (
          outer[i]!.closest('[role="dialog"], [data-radix-popper-content-wrapper]') ||
          outer[j]!.closest('[role="dialog"], [data-radix-popper-content-wrapper]')
        )
          continue;
        if (overlap > 8 && overlapY > 8) {
          pairs.push(
            `${describe(outer[i]!)} ∩ ${describe(outer[j]!)} (${Math.round(overlap)}×${Math.round(overlapY)}px)`,
          );
        }
      }
    }
    if (pairs.length > 0) {
      findings.push({
        probe: "overlay.overlap",
        severity: "major",
        message: `${pairs.length} pair${pairs.length === 1 ? "" : "s"} of fixed overlays overlap each other.`,
        count: pairs.length,
        samples: pairs.slice(0, 6),
      });
    }
    // Overlays sitting on top of interactive content in the main area.
    if (main && outer.length > 0) {
      const covered: string[] = [];
      let count = 0;
      const actions = Array.from(
        main.querySelectorAll<HTMLElement>(
          'button, a[href], [role="tab"], [role="switch"], input, select',
        ),
      );
      for (const action of actions) {
        if (!visible(action)) continue;
        const r = action.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        for (const overlay of outer) {
          if (overlay.contains(action) || overlay.closest('[role="dialog"]')) continue;
          const o = overlay.getBoundingClientRect();
          const ox = Math.min(r.right, o.right) - Math.max(r.left, o.left);
          const oy = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top);
          if (ox > Math.min(12, r.width / 2) && oy > Math.min(12, r.height / 2)) {
            count += 1;
            if (covered.length < 6) covered.push(`${describe(action)} under ${describe(overlay)}`);
            break;
          }
        }
      }
      if (count > 0) {
        findings.push({
          probe: "overlay.covers-action",
          severity: "major",
          message: `${count} control${count === 1 ? " is" : "s are"} covered by a floating overlay at the current scroll position.`,
          count,
          samples: covered,
        });
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* 5. Tap targets (touch devices)                                    */
  /* ---------------------------------------------------------------- */
  if (opts.touch) {
    const controls = all.filter((el) =>
      el.matches(
        'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role="menuitem"], [role="slider"], [role="option"], summary',
      ),
    );
    const fails: string[] = [];
    const linkFails: string[] = [];
    const warns: string[] = [];
    let failCount = 0;
    let linkFailCount = 0;
    let warnCount = 0;
    for (const el of controls) {
      if (!visible(el)) continue;
      const style = getComputedStyle(el);
      // Inline text links are exempt (WCAG 2.5.8).
      if (el.tagName === "A" && style.display === "inline") continue;
      if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "range") continue;
      const rect = el.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      // A text-only link or link-styled button is a weaker case than an icon
      // control: the words give a wider target than the box suggests.
      const textOnly =
        (el.tagName === "A" || style.backgroundColor === "rgba(0, 0, 0, 0)") &&
        !el.querySelector("svg, img") &&
        (el.textContent ?? "").trim().length > 0 &&
        rect.width >= 44;
      if (size < 24) {
        if (textOnly) {
          linkFailCount += 1;
          if (linkFails.length < 4)
            linkFails.push(`${describe(el)} ${Math.round(rect.width)}×${Math.round(rect.height)}`);
        } else {
          failCount += 1;
          if (fails.length < 6)
            fails.push(`${describe(el)} ${Math.round(rect.width)}×${Math.round(rect.height)}`);
        }
      } else if (size < 44) {
        warnCount += 1;
        if (warns.length < 4)
          warns.push(`${describe(el)} ${Math.round(rect.width)}×${Math.round(rect.height)}`);
      }
    }
    if (failCount > 0) {
      findings.push({
        probe: "tap.small",
        severity: "major",
        message: `${failCount} tap target${failCount === 1 ? "" : "s"} smaller than 24×24px.`,
        count: failCount,
        samples: fails,
      });
    }
    if (linkFailCount > 0) {
      findings.push({
        probe: "tap.small-link",
        severity: "minor",
        message: `${linkFailCount} text link${linkFailCount === 1 ? "" : "s"} shorter than 24px (wide enough to hit, but thin).`,
        count: linkFailCount,
        samples: linkFails,
      });
    }
    if (warnCount > 0) {
      findings.push({
        probe: "tap.under-44",
        severity: "minor",
        message: `${warnCount} tap target${warnCount === 1 ? "" : "s"} between 24 and 43px (Apple HIG recommends 44).`,
        count: warnCount,
        samples: warns,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 6. Type floor and iOS input zoom                                  */
  /* ---------------------------------------------------------------- */
  {
    const tiny: string[] = [];
    const small: string[] = [];
    let tinyCount = 0;
    let smallCount = 0;
    for (const el of all) {
      if (!visible(el)) continue;
      const ownText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
      );
      if (!ownText) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 10) {
        tinyCount += 1;
        if (tiny.length < 5) tiny.push(`${describe(el)} ${size.toFixed(1)}px`);
      } else if (opts.phone && size < 11) {
        smallCount += 1;
        if (small.length < 4) small.push(`${describe(el)} ${size.toFixed(1)}px`);
      }
    }
    if (tinyCount > 0) {
      findings.push({
        probe: "type.tiny",
        severity: "major",
        message: `${tinyCount} text element${tinyCount === 1 ? "" : "s"} below 10px.`,
        count: tinyCount,
        samples: tiny,
      });
    }
    if (smallCount > 0) {
      findings.push({
        probe: "type.small",
        severity: "minor",
        message: `${smallCount} text element${smallCount === 1 ? "" : "s"} between 10 and 11px on a phone.`,
        count: smallCount,
        samples: small,
      });
    }
    if (opts.phone && opts.webkit) {
      const zoomers: string[] = [];
      let count = 0;
      for (const el of Array.from(
        document.querySelectorAll<HTMLElement>(
          "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea",
        ),
      )) {
        if (!visible(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 16) {
          count += 1;
          if (zoomers.length < 5) zoomers.push(`${describe(el)} ${size.toFixed(1)}px`);
        }
      }
      if (count > 0) {
        findings.push({
          probe: "ios.input-zoom",
          severity: "minor",
          message: `${count} form field${count === 1 ? "" : "s"} under 16px: Safari zooms the page when they gain focus.`,
          count,
          samples: zoomers,
        });
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* 7. Dialog and sheet fit                                           */
  /* ---------------------------------------------------------------- */
  {
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"][data-state="open"], [role="dialog"]:not([data-state])',
      ),
    ).filter(visible);
    for (const dialog of dialogs) {
      const rect = dialog.getBoundingClientRect();
      const outOfBounds =
        rect.left < -1 || rect.top < -1 || rect.right > vw + 1 || rect.bottom > vh + 1;
      if (outOfBounds) {
        findings.push({
          probe: "dialog.out-of-viewport",
          severity: "blocker",
          message: `${describe(dialog)} sits outside the viewport (left ${Math.round(rect.left)}, top ${Math.round(rect.top)}, right ${Math.round(rect.right)}, bottom ${Math.round(rect.bottom)} in ${vw}×${vh}).`,
        });
      }
      // Content taller than the box needs a scroller somewhere inside.
      const tallest = Math.max(
        dialog.scrollHeight,
        ...Array.from(dialog.children).map((c) => (c as HTMLElement).scrollHeight),
      );
      if (tallest > dialog.clientHeight + 4) {
        const scrollers = Array.from(dialog.querySelectorAll<HTMLElement>("*")).filter((el) => {
          const s = getComputedStyle(el);
          return (
            (s.overflowY === "auto" || s.overflowY === "scroll") &&
            el.scrollHeight > el.clientHeight + 1
          );
        });
        const selfScrolls =
          ["auto", "scroll"].includes(getComputedStyle(dialog).overflowY) &&
          dialog.scrollHeight > dialog.clientHeight + 1;
        if (!selfScrolls && scrollers.length === 0) {
          findings.push({
            probe: "dialog.unscrollable",
            severity: "blocker",
            message: `${describe(dialog)} has ${tallest - dialog.clientHeight}px more content than height and nothing inside it scrolls.`,
          });
        }
      }
      const close = dialog.querySelector<HTMLElement>(
        'button[aria-label*="lose" i], [data-qc*="close"], button:has(> svg.lucide-x), button:has(> svg.lucide-x + span)',
      );
      const closeRect = close?.getBoundingClientRect();
      if (
        close &&
        closeRect &&
        (closeRect.bottom > vh + 1 ||
          closeRect.top < -1 ||
          closeRect.right > vw + 1 ||
          closeRect.left < -1)
      ) {
        findings.push({
          probe: "dialog.close-unreachable",
          severity: "major",
          message: `The close control of ${describe(dialog)} is outside the viewport.`,
        });
      }
      // Floating chrome (dock, demo switcher, toasts) drawn above the dialog
      // and sitting on one of its buttons: the user cannot press it.
      {
        const fixedOutside = all.filter((el) => {
          if (el === dialog || dialog.contains(el) || el.contains(dialog)) return false;
          if (!visible(el)) return false;
          const s = getComputedStyle(el);
          if (s.position !== "fixed") return false;
          if (el.closest('[role="dialog"], [data-radix-popper-content-wrapper]')) return false;
          const r = el.getBoundingClientRect();
          return r.width >= 24 && r.height >= 24 && r.width < vw * 0.98;
        });
        const outerFixed = fixedOutside.filter(
          (el) => !fixedOutside.some((o) => o !== el && o.contains(el)),
        );
        const dialogZ = (() => {
          let node: Element | null = dialog;
          while (node && node !== document.body) {
            const z = parseInt(getComputedStyle(node).zIndex, 10);
            if (!Number.isNaN(z)) return z;
            node = node.parentElement;
          }
          return 0;
        })();
        const covered: string[] = [];
        for (const action of Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, a[href], [role="tab"], [role="switch"], input, select, textarea',
          ),
        )) {
          if (!visible(action)) continue;
          const r = action.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh) continue;
          for (const overlay of outerFixed) {
            const oz = parseInt(getComputedStyle(overlay).zIndex, 10);
            if (!Number.isNaN(oz) && oz < dialogZ) continue;
            const o = overlay.getBoundingClientRect();
            const ox = Math.min(r.right, o.right) - Math.max(r.left, o.left);
            const oy = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top);
            if (ox > Math.min(12, r.width / 2) && oy > Math.min(12, r.height / 2)) {
              if (covered.length < 5)
                covered.push(`${describe(action)} under ${describe(overlay)}`);
              break;
            }
          }
        }
        if (covered.length > 0) {
          findings.push({
            probe: "overlay.covers-dialog-action",
            severity: "blocker",
            message: `${covered.length} control${covered.length === 1 ? "" : "s"} inside ${describe(dialog)} sit under floating chrome drawn above the dialog.`,
            count: covered.length,
            samples: covered,
          });
        }
      }
      const narrow = rect.width < Math.min(vw, 360) - 40 && vw < 640;
      if (narrow && rect.width < vw * 0.8) {
        findings.push({
          probe: "dialog.narrow",
          severity: "major",
          message: `${describe(dialog)} is only ${Math.round(rect.width)}px wide on a ${vw}px screen.`,
        });
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* 8. Page header rule                                               */
  /* ---------------------------------------------------------------- */
  {
    const header = document.querySelector<HTMLElement>(".page-header");
    if (header && header.children.length >= 2) {
      const first = header.children[0] as HTMLElement;
      const last = header.children[header.children.length - 1] as HTMLElement;
      const title = first.querySelector<HTMLElement>(".page-title") ?? first;
      const t = title.getBoundingClientRect();
      const c = last.getBoundingClientRect();
      if (c.width > 0) {
        if (vw >= 640) {
          const sameRow = Math.abs(c.top - t.top) <= 12;
          if (!sameRow) {
            findings.push({
              probe: "header.control-dropped",
              severity: "minor",
              message: `The page-header control sits ${Math.round(c.top - t.top)}px below the title line at ${vw}px; the rule is same-row from 640px.`,
            });
          }
        }
        if (c.right > vw + 1) {
          findings.push({
            probe: "header.control-overflow",
            severity: "major",
            message: `The page-header control runs ${Math.round(c.right - vw)}px past the viewport edge.`,
          });
        }
      }
    }
  }

  return {
    viewport: { width: vw, height: vh },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
    },
    main: main
      ? {
          present: true,
          scrollWidth: main.scrollWidth,
          clientWidth: main.clientWidth,
          scrollHeight: main.scrollHeight,
          clientHeight: main.clientHeight,
        }
      : null,
    findings,
  };
}
