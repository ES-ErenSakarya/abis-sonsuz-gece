import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const CREATIVE_EMAIL = "erensakarya@abis.gece";
export const CREATIVE_NAME = "erensakarya";

type Pose = { x: number; y: number; z: number; yaw: number };

function asPoseMap(raw: unknown): Record<string, Pose> {
  const out: Record<string, Pose> = {};
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!obj || typeof obj !== "object") return out;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || key.length > 64) continue;
    const row = value as Record<string, unknown>;
    const num = (name: string) => (typeof row[name] === "number" && Number.isFinite(row[name] as number) ? (row[name] as number) : 0);
    out[key] = { x: num("x"), y: num("y"), z: num("z"), yaw: num("yaw") };
  }
  return out;
}

export const getWorldLayout = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ poses: unknown }>`select poses from world_layout where id = 'main'`;
    if (!rows[0]) return { poses: null as Record<string, Pose> | null };
    return { poses: asPoseMap(rows[0].poses) };
  } catch {
    return { poses: null as Record<string, Pose> | null };
  }
});

export const saveWorldLayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => asPoseMap(data))
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const users = await sql<{ email: string; name: string }>`select email, name from "user" where id = ${context.userId}`;
    const email = (users[0]?.email ?? "").toLowerCase();
    const name = (users[0]?.name ?? "").toLowerCase();
    if (email !== CREATIVE_EMAIL && name !== CREATIVE_NAME) return { ok: false as const };
    const payload = JSON.stringify(data);
    await sql`
      insert into world_layout (id, poses, updated_at)
      values ('main', ${payload}::jsonb, now())
      on conflict (id) do update set poses = excluded.poses, updated_at = now()
    `;
    return { ok: true as const };
  });
