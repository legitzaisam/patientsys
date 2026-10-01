import { compile } from "@tailwindcss/node";
import fs from "node:fs";
const css = fs.readFileSync("src/styles.css","utf8");
const c = await compile(css, { base: process.cwd()+"/src", onDependency(){} });
const cands = ["h-app-screen","min-h-app-screen","max-h-[calc(calc(100*var(--app-dvh))-2rem)]","max-h-[min(calc(90*var(--app-dvh)),720px)]","w-[calc(calc(100*var(--app-vw))-2rem)]","w-[min(calc(100*var(--app-vw))-12px,420px)]","pt-[calc(12*var(--app-vh))]","max-h-[min(calc(90*var(--app-dvh)),var(--radix-popover-content-available-height))]"];
const out = c.build(cands);
for (const k of cands) { const sel = "."+k.replace(/[[\]()*,%.\-]/g, m=>"\\"+m); }
const m = out.match(/\.(min-h-app-screen|h-app-screen|max-h-\\\[|w-\\\[|pt-\\\[)[^{]*\{[^}]*\}/g);
console.log(m.join("\n"));
console.log(out.match(/@media \(width >= 1024px\)[^@]*?zoom[^}]*\}[^}]*\}/s)?.[0] ?? out.match(/zoom:[^;]*;/g));
console.log((out.match(/--app-[a-z]+:[^;]*;/g)||[]).join("\n"));
