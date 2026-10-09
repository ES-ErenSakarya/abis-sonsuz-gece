import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@electric-sql/pglite/dist");
const to = join(root, ".vercel/output/functions/__server.func/_libs");
if (!existsSync(to)) process.exit(0);
try {
  for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    const src = join(from, name);
    if (!existsSync(src)) {
      console.error(`[pglite] missing ${src} — skipping copy`);
      continue;
    }
    copyFileSync(src, join(to, name));
  }
} catch (err) {
  // Production uses Neon when DATABASE_URL is set. A wasm copy miss must not
  // fail `npm run build` and freeze the last published package.
  console.error("[pglite] copy failed:", err?.message || err);
  process.exit(0);
}