import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { Item } from "@/game/rpg";

let stallTableReady = false;

async function sqlOf() {
  const sql = await getSql();
  if (!stallTableReady) {
    await sql`
      create table if not exists stalls (
        character_id text primary key,
        user_id text not null,
        nick text not null,
        x double precision not null default 0,
        z double precision not null default 0,
        items jsonb not null default '[]',
        bank integer not null default 0,
        updated_at timestamptz not null default now()
      )
    `;
    await sql`create index if not exists stalls_user_idx on stalls (user_id)`;
    stallTableReady = true;
  }
  return sql;
}

export type StallRow = { uid: string; price: number; item: Item };

function asItems(raw: unknown): StallRow[] {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(value)) return [];
  const out: StallRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const entry = row as { uid?: unknown; price?: unknown; item?: Item };
    const item = entry.item;
    if (!item || typeof item.id !== "string" || typeof item.uid !== "string" || typeof item.name !== "string") continue;
    out.push({
      uid: typeof entry.uid === "string" ? entry.uid : item.uid,
      price: Math.max(1, Math.floor(Number(entry.price) || 1)),
      item,
    });
  }
  return out.slice(0, 12);
}

async function owns(characterId: string, userId: string) {
  const sql = await sqlOf();
  const rows = await sql<{ id: string }>`
    select id from characters where id = ${characterId} and user_id = ${userId}
  `;
  return rows.length > 0;
}

export const pushStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; nick: string; x: number; z: number; items?: StallRow[] }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    if (!id || !(await owns(id, context.userId))) return { ok: false as const };
    const sql = await sqlOf();
    const nick = String(data.nick || "Oyuncu").slice(0, 16);
    const x = Number(data.x) || 0;
    const z = Number(data.z) || 0;
    await sql`
      update stalls set nick = ${nick}, x = ${x}, z = ${z}, updated_at = now()
      where character_id = ${id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const offerStallItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; nick: string; x: number; z: number; price: number; item: Item }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    if (!id || !(await owns(id, context.userId))) return { ok: false as const, reason: "own" as const, listed: false };
    const price = Math.max(1, Math.floor(Number(data.price) || 0));
    const packed = asItems([{ uid: data.item?.uid || "", price, item: data.item }]);
    if (!packed.length) return { ok: false as const, reason: "bad" as const, listed: false };
    const row = { ...packed[0], uid: packed[0].item.uid };
    const sql = await sqlOf();
    const nick = String(data.nick || "Oyuncu").slice(0, 16);
    const x = Number(data.x) || 0;
    const z = Number(data.z) || 0;
    const payload = JSON.stringify([row]);
    await sql`
      insert into stalls (character_id, user_id, nick, x, z, items)
      values (${id}, ${context.userId}, ${nick}, ${x}, ${z}, '[]'::jsonb)
      on conflict (character_id) do update set
        nick = excluded.nick,
        x = excluded.x,
        z = excluded.z,
        updated_at = now()
      where stalls.user_id = ${context.userId}
    `;
    const rows = await sql.query<{ items: unknown }>(
      `update stalls
       set items = case
             when exists (select 1 from jsonb_array_elements(items) elem where elem->>'uid' = $3) then items
             when jsonb_array_length(items) >= 12 then items
             else coalesce(items, '[]'::jsonb) || $4::jsonb
           end,
           updated_at = now()
       where character_id = $1 and user_id = $2
       returning items`,
      [id, context.userId, row.uid, payload],
    );
    const items = asItems(rows[0]?.items);
    const listed = items.some((entry) => entry.uid === row.uid);
    return { ok: true as const, listed, reason: listed ? "ok" as const : "full" as const, items };
  });

export const takeOwnStallItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; uid: string }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    const uid = String(data.uid || "");
    if (!id || !uid || !(await owns(id, context.userId))) return { ok: false as const, item: null };
    const sql = await sqlOf();
    const rows = await sql.query<{ item: unknown }>(
      `with src as (
         select (select elem from jsonb_array_elements(items) elem where elem->>'uid' = $2 limit 1) as sold
         from stalls where character_id = $1 and user_id = $3
       ),
       upd as (
         update stalls s
         set items = coalesce((
               select jsonb_agg(elem) from jsonb_array_elements(s.items) elem
               where elem->>'uid' <> $2
             ), '[]'::jsonb),
             updated_at = now()
         from src
         where s.character_id = $1 and s.user_id = $3 and src.sold is not null
         returning s.character_id
       )
       select src.sold as item from src
       where src.sold is not null and exists (select 1 from upd)`,
      [id, uid, context.userId],
    );
    const sold = asItems(rows[0]?.item ? [rows[0].item] : []);
    return { ok: true as const, item: sold[0]?.item ?? null, price: sold[0]?.price ?? 0 };
  });

export const clearOwnStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    if (!id || !(await owns(id, context.userId))) return { ok: false as const, items: [] as StallRow[] };
    const sql = await sqlOf();
    const rows = await sql.query<{ items: unknown }>(
      `with grabbed as (
         select items from stalls where character_id = $1 and user_id = $2
       ),
       upd as (
         update stalls s
         set items = '[]'::jsonb, updated_at = now()
         from grabbed
         where s.character_id = $1 and s.user_id = $2 and s.items = grabbed.items
         returning s.character_id
       )
       select grabbed.items as items from grabbed where exists (select 1 from upd)`,
      [id, context.userId],
    );
    if (!rows.length) {
      const exists = await sql<{ ok: number }>`select 1 as ok from stalls where character_id = ${id} and user_id = ${context.userId}`;
      if (!exists.length) return { ok: true as const, items: [] as StallRow[] };
      return { ok: false as const, items: [] as StallRow[] };
    }
    return { ok: true as const, items: asItems(rows[0]?.items) };
  });

export const myStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    if (!id || !(await owns(id, context.userId))) return { ok: false as const, exists: false, items: [] as StallRow[], bank: 0, x: 0, z: 0 };
    const sql = await sqlOf();
    const rows = await sql<{ x: number; z: number; items: unknown; bank: number }>`
      select x, z, items, bank from stalls where character_id = ${id} and user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) return { ok: true as const, exists: false, items: [] as StallRow[], bank: 0, x: 0, z: 0 };
    return {
      ok: true as const,
      exists: true,
      items: asItems(row.items),
      bank: Math.max(0, Math.floor(Number(row.bank) || 0)),
      x: Number(row.x) || 0,
      z: Number(row.z) || 0,
    };
  });

export const listOpenStalls = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => input ?? {})
  .handler(async () => {
    const sql = await sqlOf();
    const rows = await sql<{ character_id: string; nick: string; x: number; z: number; items: unknown }>`
      select character_id, nick, x, z, items from stalls
      where jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
    `;
    return rows.map((row) => ({
      id: `db:${row.character_id}`,
      nick: row.nick || "Oyuncu",
      x: Number(row.x) || 0,
      z: Number(row.z) || 0,
      items: asItems(row.items),
    })).filter((row) => row.items.length > 0);
  });

export const buyStallItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; uid: string; price: number }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    const uid = String(data.uid || "");
    const price = Math.max(1, Math.floor(Number(data.price) || 0));
    if (!id || !uid) return { ok: false as const, reason: "gone" as const };
    const sql = await sqlOf();
    const owner = await sql<{ user_id: string }>`select user_id from stalls where character_id = ${id}`;
    if (!owner.length) return { ok: false as const, reason: "gone" as const };
    if (owner[0].user_id === context.userId) return { ok: false as const, reason: "own" as const };
    const rows = await sql.query<{ item: unknown }>(
      `with src as (
         select character_id,
           (select elem from jsonb_array_elements(items) elem
             where elem->>'uid' = $3 and (elem->>'price')::int = $4
             limit 1) as sold
         from stalls
         where character_id = $1 and user_id <> $2
       ),
       upd as (
         update stalls s
         set items = coalesce((
               select jsonb_agg(elem) from jsonb_array_elements(s.items) elem
               where elem->>'uid' <> $3
             ), '[]'::jsonb),
             bank = s.bank + $4,
             updated_at = now()
         from src
         where s.character_id = src.character_id
           and src.sold is not null
           and exists (
             select 1 from jsonb_array_elements(s.items) e
             where e->>'uid' = $3 and (e->>'price')::int = $4
           )
         returning s.character_id
       )
       select src.sold as item from src
       where src.sold is not null and exists (select 1 from upd)`,
      [id, context.userId, uid, price],
    );
    const sold = asItems(rows[0]?.item ? [rows[0].item] : []);
    const item = sold[0]?.item;
    if (!item) return { ok: false as const, reason: "gone" as const };
    return { ok: true as const, item, price };
  });

export const returnStallItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; price: number; item: Item }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    const price = Math.max(1, Math.floor(Number(data.price) || 0));
    const packed = asItems([{ uid: data.item?.uid || "", price, item: data.item }]);
    if (!id || !packed.length) return { ok: false as const };
    const sql = await sqlOf();
    const payload = JSON.stringify(packed);
    await sql`
      update stalls
      set items = coalesce(items, '[]'::jsonb) || ${payload}::jsonb,
          bank = greatest(0, bank - ${price}),
          updated_at = now()
      where character_id = ${id} and user_id <> ${context.userId}
    `;
    return { ok: true as const };
  });

export const creditStallBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; amount: number }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    const amount = Math.max(1, Math.min(5_000_000, Math.floor(Number(data.amount) || 0)));
    if (!id || !amount || !(await owns(id, context.userId))) return { ok: false as const, bank: 0 };
    const sql = await sqlOf();
    const rows = await sql<{ bank: number }>`
      insert into stalls (character_id, user_id, nick, x, z, items, bank)
      values (${id}, ${context.userId}, ${"Oyuncu"}, 0, 0, '[]'::jsonb, ${amount})
      on conflict (character_id) do update set
        bank = stalls.bank + ${amount},
        updated_at = now()
      where stalls.user_id = ${context.userId}
      returning bank
    `;
    return { ok: true as const, bank: Math.max(0, Math.floor(Number(rows[0]?.bank) || 0)) };
  });

export const withdrawStallBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id || "");
    if (!id || !(await owns(id, context.userId))) return { ok: false as const, amount: 0 };
    const sql = await sqlOf();
    const rows = await sql<{ bank: number }>`
      select bank from stalls where character_id = ${id} and user_id = ${context.userId}
    `;
    const bank = Math.max(0, Math.floor(Number(rows[0]?.bank) || 0));
    if (!bank) return { ok: true as const, amount: 0 };
    const updated = await sql<{ bank: number }>`
      update stalls set bank = bank - ${bank}, updated_at = now()
      where character_id = ${id} and user_id = ${context.userId} and bank >= ${bank}
      returning bank
    `;
    if (!updated.length) return { ok: false as const, amount: 0 };
    return { ok: true as const, amount: bank };
  });
