// Build config for the public demo (APP_MODE=preview). Lives in launch-plan so
// the app's own vite.config.ts stays untouched.
//
// It loads the app's config as-is and adds one build option:
// strictExecutionOrder. Without it the server bundle has a circular chunk and
// crashes at startup with "createCsrfMiddleware is not a function".
//
// Used by start-demo.sh with NITRO_PRESET=node-server, so the result runs
// with plain `node .output/server/index.mjs` (no Wrangler).
import { mergeConfig, type ConfigEnv } from "vite";
import appConfig from "../../vite.config.ts";

const strictOrder = { output: { strictExecutionOrder: true } };

export default async (env: ConfigEnv) =>
  mergeConfig(await appConfig(env), {
    build: { rolldownOptions: strictOrder },
    environments: { ssr: { build: { rolldownOptions: strictOrder } } },
  });
