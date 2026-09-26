// Hero concept B, "the serum drop", in plain WebGL (no three.js, ~6 KB).
//
// A glass droplet falls onto the headline. Its ripple refracts the words into
// place, then a small lens bead stays behind and follows the pointer, bending
// the headline and the page like light through a drop of serum.
//
// The real <h1> stays in the DOM for screen readers and selection; while the
// canvas runs it is drawn transparent and painted into a texture instead.
// Falls back to the SVG journey thread when WebGL, motion or power is limited.

type Rect = { x: number; y: number; w: number; h: number };

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;       // canvas size in device px
uniform float uDpr;
uniform float uTime;
uniform sampler2D uText;
uniform vec4 uDrop;      // x, y, rx, ry (device px); rx <= 0 means none
uniform vec3 uImpact;    // x, y, t0 (s); t0 < 0 means none yet
uniform vec3 uBead;      // x, y, r (device px)
uniform float uForceReveal;

const vec3 INK = vec3(0.184, 0.247, 0.4);
const vec3 BUTTER = vec3(0.933, 0.831, 0.533);

vec3 background(vec2 p) {
  vec2 uv = p / uRes;
  vec2 a = uv * vec2(uRes.x / uRes.y, 1.0);
  float ar = uRes.x / uRes.y;
  vec3 c = vec3(0.965, 0.969, 0.973);
  c = mix(c, vec3(0.985, 0.85, 0.77), 0.5 * smoothstep(0.95, 0.0, distance(a, vec2(0.05 * ar, -0.05))));
  c = mix(c, vec3(0.975, 0.9, 0.64), 0.45 * smoothstep(0.85, 0.0, distance(a, vec2(0.98 * ar, 0.02))));
  vec2 q = vec2((0.5 + 0.22 * sin(uTime * 0.07)) * ar, 0.82 + 0.06 * cos(uTime * 0.05));
  c = mix(c, vec3(1.0, 0.95, 0.83), 0.4 * smoothstep(0.6, 0.0, distance(a, q)));
  float rule = step(mod(p.y, 14.0 * uDpr), 1.0 * uDpr);
  return mix(c, INK, rule * 0.035);
}

vec2 rippleOffset(vec2 p) {
  if (uImpact.z < 0.0) return vec2(0.0);
  float age = uTime - uImpact.z;
  if (age < 0.0 || age > 6.0) return vec2(0.0);
  vec2 d = p - uImpact.xy;
  float r = length(d);
  float front = age * 820.0 * uDpr;
  float x = r - front;
  float wave = sin(x * 0.045 / uDpr) * exp(-abs(x) / (110.0 * uDpr)) * exp(-age * 0.9);
  return (r > 0.0 ? d / r : vec2(0.0)) * wave * 18.0 * uDpr;
}

float reveal(vec2 p) {
  if (uForceReveal > 0.5) return 1.0;
  if (uImpact.z < 0.0) return 0.0;
  float age = uTime - uImpact.z;
  float front = age * 820.0 * uDpr;
  return smoothstep(front + 30.0 * uDpr, front - 160.0 * uDpr, distance(p, uImpact.xy));
}

vec3 scene(vec2 p) {
  vec2 q = p + rippleOffset(p);
  vec3 c = background(q);
  vec4 t = texture2D(uText, clamp(q / uRes, 0.0, 1.0));
  return mix(c, t.rgb, t.a * reveal(p));
}

// A glass ball lens: magnifies the middle, compresses the rim, adds a rim
// light, a specular glint and a faint butter tint.
vec3 lens(vec2 p, vec2 center, vec2 radii, vec3 under, out float alpha) {
  vec2 n2 = (p - center) / radii;
  float e = length(n2);
  float rmin = min(radii.x, radii.y);
  alpha = 1.0 - smoothstep(1.0 - 1.5 / rmin, 1.0, e);
  if (alpha <= 0.0) return under;
  float nz = sqrt(max(0.0, 1.0 - e * e));
  vec2 sp = center + (p - center) * (0.42 + 0.4 * e * e);
  vec3 c = scene(sp);
  c *= vec3(1.015, 1.0, 0.94);
  c *= 1.0 - smoothstep(0.78, 1.0, e) * 0.22;
  float fres = pow(1.0 - nz, 2.5);
  c += vec3(1.0, 0.98, 0.92) * fres * 0.28;
  vec3 n = normalize(vec3(n2, nz));
  float spec = pow(max(dot(n, normalize(vec3(-0.45, -0.6, 0.66))), 0.0), 70.0);
  c += spec * 0.95;
  float spec2 = pow(max(dot(n, normalize(vec3(0.5, 0.55, 0.67))), 0.0), 30.0);
  c += BUTTER * spec2 * 0.25;
  return c;
}

vec3 shadow(vec2 p, vec2 center, vec2 radii, vec3 c) {
  float r = max(radii.x, radii.y);
  float s = smoothstep(1.35, 0.15, length((p - center - vec2(0.12, 0.42) * r) / (radii * 1.15)));
  c *= 1.0 - s * 0.08;
  float caustic = smoothstep(0.55, 0.0, length((p - center - vec2(0.08, 0.3) * r) / (r * 0.5)));
  return c + BUTTER * caustic * 0.14;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 col = scene(p);
  float a;
  if (uBead.z > 0.5) {
    col = shadow(p, uBead.xy, vec2(uBead.z), col);
    vec3 l = lens(p, uBead.xy, vec2(uBead.z), col, a);
    col = mix(col, l, a);
  }
  if (uDrop.z > 0.5) {
    col = shadow(p, uDrop.xy, uDrop.zw, col);
    vec3 l = lens(p, uDrop.xy, uDrop.zw, col, a);
    col = mix(col, l, a);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

/** Paint the headline's text nodes into a 2D canvas at their exact positions. */
function paintHeadline(
  title: HTMLElement,
  canvasRect: DOMRect,
  scale: number,
  w: number,
  h: number,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent || "";
    if (!text.trim()) continue;
    const parent = node.parentElement!;
    const cs = getComputedStyle(parent);
    const color = parent.dataset.glColor || cs.getPropertyValue("--gl-color").trim() || "#2f3f66";
    const fontPx = parseFloat(cs.fontSize) * scale;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontPx}px ${cs.fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    const ascent = ctx.measureText("Hg").fontBoundingBoxAscent;
    // One rect per word keeps wrapping and kerning faithful to the browser.
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (!r) continue;
      ctx.fillText(
        m[0],
        (r.left - canvasRect.left) * scale,
        (r.top - canvasRect.top) * scale + ascent,
      );
    }
  }
  return c;
}

export function canRunHeroGL(): boolean {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return false;
  if ((nav.deviceMemory ?? 8) < 4 && (nav.hardwareConcurrency ?? 8) < 4) return false;
  return true;
}

export function startHeroGL(opts: {
  canvas: HTMLCanvasElement;
  hero: HTMLElement;
  title: HTMLElement;
  onLanded: () => void;
  isPaused: () => boolean;
}): boolean {
  const { canvas, hero, title, onLanded, isPaused } = opts;
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) return false;

  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch {
    return false;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = u("uRes"),
    uDpr = u("uDpr"),
    uTime = u("uTime"),
    uDrop = u("uDrop");
  const uImpact = u("uImpact"),
    uBead = u("uBead"),
    uForce = u("uForceReveal"),
    uText = u("uText");

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(uText, 0);

  let scale = 1;
  let titleRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  function resize() {
    const r = canvas.getBoundingClientRect();
    scale = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 1.75);
    canvas.width = Math.max(1, Math.round(r.width * scale));
    canvas.height = Math.max(1, Math.round(r.height * scale));
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(uRes, canvas.width, canvas.height);
    gl!.uniform1f(uDpr, scale);
    const t = title.getBoundingClientRect();
    titleRect = {
      x: (t.left - r.left) * scale,
      y: (t.top - r.top) * scale,
      w: t.width * scale,
      h: t.height * scale,
    };
    const img = paintHeadline(title, r, scale, canvas.width, canvas.height);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
  }
  resize();
  hero.classList.add("gl-on");

  // Pointer (device px, relative to canvas). Null on touch or when outside.
  let pointer: { x: number; y: number } | null = null;
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = canvas.getBoundingClientRect();
    pointer = { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
  });
  hero.addEventListener("pointerleave", () => (pointer = null));

  const FALL_START = 0.2,
    FALL = 0.95,
    SQUASH = 0.28;
  const t0 = performance.now();
  let impact: { x: number; y: number; t: number } | null = null;
  let landed = false;
  const bead = { x: 0, y: 0, r: 0 };
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);

  let rt = 0;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = window.setTimeout(resize, 120);
  });

  function frame(now: number) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const time = (now - t0) / 1000;
    if (landed && isPaused()) return; // hold the last frame
    const R = 34 * scale;
    const cx = titleRect.x + titleRect.w * 0.52;
    const cy = titleRect.y + titleRect.h * 0.5;

    // Falling drop, stretched by speed, then squashed on impact.
    let drop: [number, number, number, number] = [0, 0, 0, 0];
    const tf = time - FALL_START;
    if (tf < 0) {
      drop = [cx, -R * 2, R, R];
    } else if (tf < FALL) {
      const k = tf / FALL;
      const y = -R * 2 + (cy + R * 2) * k * k;
      const speed = k;
      drop = [cx, y, R * (1 - 0.14 * speed), R * (1 + 0.42 * speed)];
    } else if (tf < FALL + SQUASH) {
      if (!impact) impact = { x: cx, y: cy, t: time };
      const k = (tf - FALL) / SQUASH;
      const s = 1 - k;
      drop = [cx, cy + R * 0.3 * k, R * (1 + 0.9 * k) * s, R * (1 - 0.7 * k) * s];
    }
    // Safety net for slow devices: never leave the headline hidden for long.
    if (!landed && time > 4.5) {
      landed = true;
      onLanded();
    }
    if (impact && !landed && time > impact.t + 0.35) {
      landed = true;
      onLanded();
    }

    // The bead forms after the splash and follows the pointer (or idles).
    if (impact && time > impact.t + 1.1) {
      const target = pointer ?? {
        x: cx + Math.sin(time * 0.35) * titleRect.w * 0.34,
        y: cy + Math.sin(time * 0.53) * titleRect.h * 0.28,
      };
      if (bead.r === 0) {
        bead.x = cx;
        bead.y = cy;
      }
      const ease = pointer ? 0.12 : 0.03;
      bead.x += (target.x - bead.x) * ease;
      bead.y += (target.y - bead.y) * ease;
      const want = (innerWidth < 700 ? 34 : 52) * scale;
      bead.r += (want - bead.r) * 0.06;
    }

    gl!.uniform1f(uTime, time);
    gl!.uniform4f(uDrop, drop[0], drop[1], drop[2], drop[3]);
    gl!.uniform3f(uImpact, impact?.x ?? 0, impact?.y ?? 0, impact ? impact.t : -1);
    gl!.uniform3f(uBead, bead.x, bead.y, bead.r);
    gl!.uniform1f(uForce, (impact && time > impact.t + 2.5) || time > 4.5 ? 1 : 0);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }
  requestAnimationFrame(frame);
  return true;
}
