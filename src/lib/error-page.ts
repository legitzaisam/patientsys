export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 "Space Grotesk", system-ui, -apple-system, sans-serif; color: #2f3f66; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; background: radial-gradient(900px 560px at 8% -10%, rgba(246,228,166,.5), transparent 68%), radial-gradient(820px 520px at 96% 2%, rgba(244,206,190,.34), transparent 66%), #f6f7f8; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; border-radius: 22px; background: rgba(255,255,255,.52); border: 1px solid rgba(255,255,255,.78); backdrop-filter: blur(26px) saturate(1.5); box-shadow: 0 18px 44px -24px rgba(200,175,105,.3); }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; letter-spacing: -.016em; }
      p { color: rgba(47,63,102,.72); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 999px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: linear-gradient(140deg, #faedc2, #eed488 75%); color: #332d18; box-shadow: 0 8px 20px -10px rgba(200,175,105,.6); }
      .secondary { background: rgba(255,255,255,.34); color: #2f3f66; border-color: rgba(255,255,255,.78); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
