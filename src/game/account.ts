import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { CharacterSave, Item, Quest, StatKey } from "@/game/rpg";
import { asClassId } from "@/game/rpg";

export type CharacterRow = CharacterSave & { id: string; slot: number };

function asJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value ?? fallback) as T;
}

function splitInvested(raw: unknown): {
  invested: Record<StatKey, number>;
  skills: Record<string, number>;
  skillPoints: number;
  chosenTree: string | null;
  hotbar: (string | null)[];
  quests: Quest[];
  depot: (Item | null)[];
  blocked: string[];
  bagStage: number;
  wellAt: number;
  bonusUntil: number;
  x?: number;
  z?: number;
} {
  const obj = asJson<Record<string, unknown>>(raw, {});
  const num = (key: string) => (typeof obj[key] === "number" ? (obj[key] as number) : 0);
  const skills: Record<string, number> = {};
  const extra = obj.skills;
  if (extra && typeof extra === "object") {
    for (const [key, value] of Object.entries(extra as Record<string, unknown>)) {
      if (typeof value === "number") skills[key] = value;
    }
  }
  const hotbar = Array.isArray(obj.hotbar) ? obj.hotbar.map((id) => (typeof id === "string" ? id : null)).slice(0, 8) : [];
  while (hotbar.length < 8) hotbar.push(null);
  const quests = Array.isArray(obj.quests) ? (obj.quests as Quest[]) : [];
  const depot = Array.isArray(obj.depot) ? (obj.depot as (Item | null)[]) : [];
  const blocked = Array.isArray(obj.blocked) ? obj.blocked.filter((id) => typeof id === "string") : [];
  return {
    invested: { str: num("str"), hp: num("hp"), ats: num("ats"), mvs: num("mvs"), ctp: num("ctp"), mag: num("mag"), mana: num("mana") },
    skills,
    skillPoints: num("skillPoints"),
    chosenTree: typeof obj.chosenTree === "string" ? obj.chosenTree : null,
    hotbar,
    quests,
    depot,
    blocked,
    bagStage: num("bagStage"),
    wellAt: num("wellAt"),
    bonusUntil: num("bonusUntil"),
    x: typeof obj.x === "number" && Number.isFinite(obj.x) ? obj.x : undefined,
    z: typeof obj.z === "number" && Number.isFinite(obj.z) ? obj.z : undefined,
  };
}

function rowOf(raw: {
  id: string;
  slot: number;
  class_id?: string;
  name: string;
  level: number;
  xp: number;
  vials: number;
  unspent: number;
  gold: number;
  hp: number;
  invested: unknown;
  bag: unknown;
  equipped: unknown;
}): CharacterRow {
  const stats = splitInvested(raw.invested);
  return {
    id: raw.id,
    slot: Number(raw.slot),
    classId: asClassId(raw.class_id),
    name: raw.name,
    level: Number(raw.level),
    xp: Number(raw.xp),
    vials: Number(raw.vials),
    unspent: Number(raw.unspent),
    gold: Number(raw.gold),
    hp: Number(raw.hp),
    invested: stats.invested,
    skills: stats.skills,
    skillPoints: stats.skillPoints,
    chosenTree: stats.chosenTree,
    hotbar: stats.hotbar,
    quests: stats.quests,
    depot: stats.depot,
    blocked: stats.blocked,
    bagStage: stats.bagStage,
    wellAt: stats.wellAt,
    bonusUntil: stats.bonusUntil,
    x: stats.x,
    z: stats.z,
    bag: asJson<CharacterSave["bag"]>(raw.bag, []),
    equipped: asJson<CharacterSave["equipped"]>(raw.equipped, {
      weapon: null,
      helmet: null,
      armor: null,
      earring: null,
      necklace: null,
      bracelet: null,
      boots: null,
      ring: null,
      gloves: null,
      belt: null,
    }),
  };
}

export const accountMeta = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`
      select user_id from account_secrets where user_id = ${context.userId}
    `;
    return { hasDeletePassword: rows.length > 0 };
  });

export const setDeletePassword = createServerFn({ method: "POST" })
  .validator((password: string) => password)
  .middleware([authMiddleware])
  .handler(async ({ context, data: password }) => {
    const pw = password.trim();
    if (pw.length < 4 || pw.length > 32) return { ok: false as const, reason: "length" as const };
    const sql = await getSql();
    const existing = await sql<{ user_id: string }>`
      select user_id from account_secrets where user_id = ${context.userId}
    `;
    if (existing.length) return { ok: false as const, reason: "exists" as const };
    const { hashSecret } = await import("@/game/secrets.server");
    const hash = await hashSecret(pw);
    await sql`
      insert into account_secrets (user_id, delete_pass_hash) values (${context.userId}, ${hash})
    `;
    return { ok: true as const };
  });

export const listCharacters = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      slot: number;
      name: string;
      level: number;
      xp: number;
      vials: number;
      unspent: number;
      gold: number;
      hp: number;
      invested: unknown;
      bag: unknown;
      equipped: unknown;
    }>`
      select id, slot, class_id, name, level, xp, vials, unspent, gold, hp, invested, bag, equipped
      from characters where user_id = ${context.userId} order by slot
    `;
    return rows.map(rowOf);
  });

export const createCharacter = createServerFn({ method: "POST" })
  .validator((input: { slot: number; name: string; classId?: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const slot = Math.floor(Number(data.slot));
    const name = data.name.trim().replace(/\s+/g, " ").slice(0, 16);
    if (slot < 0 || slot > 5 || name.length < 2) return { ok: false as const, reason: "invalid" as const };
    const sql = await getSql();
    const taken = await sql<{ id: string }>`
      select id from characters where user_id = ${context.userId} and slot = ${slot}
    `;
    if (taken.length) return { ok: false as const, reason: "taken" as const };
    const count = await sql<{ n: number }>`
      select count(*)::int as n from characters where user_id = ${context.userId}
    `;
    if (Number(count[0]?.n ?? 0) >= 6) return { ok: false as const, reason: "full" as const };
    const named = await sql<{ id: string }>`
      select id from characters where lower(name) = lower(${name})
    `;
    if (named.length) return { ok: false as const, reason: "name" as const };
    const classId = asClassId(data.classId);
    const id = crypto.randomUUID();
    const invested = JSON.stringify({ str: 0, hp: 0, ats: 0, mvs: 0, ctp: 0 });
    const bagSlots = Array.from({ length: 72 }, () => null as unknown);
    bagSlots[0] = {
      uid: `chest-${id.slice(0, 8)}`,
      id: "starter-chest",
      name: "Başlangıç Sandığı",
      slot: "weapon",
      level: 1,
      plus: 0,
      str: 0,
      hp: 0,
      ats: 0,
      mvs: 0,
      ctp: 0,
      desc: "Açılınca sınıfının başlangıç silahını verir ve kaybolur.",
    };
    const bag = JSON.stringify(bagSlots);
    const equipped = JSON.stringify({
      weapon: null,
      helmet: null,
      armor: null,
      earring: null,
      necklace: null,
      bracelet: null,
      boots: null,
      ring: null,
      gloves: null,
      belt: null,
    });
    await sql.query(
      `insert into characters (id, user_id, slot, name, class_id, gold, invested, bag, equipped)
       values ($1, $2, $3, $4, $5, 0, $6::jsonb, $7::jsonb, $8::jsonb)`,
      [id, context.userId, slot, name, classId, invested, bag, equipped],
    );
    const rows = await sql<{
      id: string;
      slot: number;
      name: string;
      level: number;
      xp: number;
      vials: number;
      unspent: number;
      gold: number;
      hp: number;
      invested: unknown;
      bag: unknown;
      equipped: unknown;
    }>`select id, slot, class_id, name, level, xp, vials, unspent, gold, hp, invested, bag, equipped from characters where id = ${id}`;
    const row = rows[0];
    if (!row) return { ok: false as const, reason: "invalid" as const };
    return { ok: true as const, character: rowOf(row) };
  });

export const saveCharacter = createServerFn({ method: "POST" })
  .validator((input: { id: string; save: CharacterSave }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const id = data.id;
    const save = data.save;
    if (!id || !save || typeof save.name !== "string") return { ok: false as const };
    const level = Math.max(1, Math.min(200, Math.floor(Number(save.level) || 1)));
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from characters where id = ${id} and user_id = ${context.userId}
    `;
    if (!owned.length) return { ok: false as const };
    await sql.query(
      `update characters set
         level = $1, xp = $2, vials = $3, unspent = $4, gold = $5, hp = $6,
         invested = $7::jsonb, bag = $8::jsonb, equipped = $9::jsonb, updated_at = now()
       where id = $10 and user_id = $11`,
      [
        level,
        Math.max(0, Math.floor(Number(save.xp) || 0)),
        Math.max(0, Math.min(4, Math.floor(Number(save.vials) || 0))),
        Math.max(0, Math.floor(Number(save.unspent) || 0)),
        Math.max(0, Math.floor(Number(save.gold) || 0)),
        Math.max(0, Math.floor(Number(save.hp) || 0)),
        JSON.stringify({
          ...(save.invested ?? {}),
          skills: save.skills ?? {},
          skillPoints: save.skillPoints ?? 0,
          chosenTree: save.chosenTree ?? null,
          hotbar: save.hotbar ?? [],
          quests: save.quests ?? [],
          depot: save.depot ?? [],
          blocked: save.blocked ?? [],
          bagStage: save.bagStage ?? 0,
          wellAt: save.wellAt ?? 0,
          bonusUntil: save.bonusUntil ?? 0,
          x: typeof save.x === "number" ? save.x : undefined,
          z: typeof save.z === "number" ? save.z : undefined,
        }),
        JSON.stringify(Array.isArray(save.bag) ? save.bag.slice(0, 72) : []),
        JSON.stringify(save.equipped ?? {}),
        id,
        context.userId,
      ],
    );
    return { ok: true as const };
  });

export const deleteCharacter = createServerFn({ method: "POST" })
  .validator((input: { id: string; password: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const secrets = await sql<{ delete_pass_hash: string }>`
      select delete_pass_hash from account_secrets where user_id = ${context.userId}
    `;
    const hash = secrets[0]?.delete_pass_hash;
    if (!hash) return { ok: false as const, reason: "no-password" as const };
    const { verifySecret } = await import("@/game/secrets.server");
    const match = await verifySecret(data.password ?? "", hash);
    if (!match) return { ok: false as const, reason: "bad-password" as const };
    await sql`delete from characters where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const changeDeletePassword = createServerFn({ method: "POST" })
  .validator((input: { current: string; next: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const next = (data.next ?? "").trim();
    if (next.length < 4 || next.length > 32) return { ok: false as const, reason: "length" as const };
    const sql = await getSql();
    const secrets = await sql<{ delete_pass_hash: string }>`
      select delete_pass_hash from account_secrets where user_id = ${context.userId}
    `;
    const hash = secrets[0]?.delete_pass_hash;
    if (!hash) return { ok: false as const, reason: "no-password" as const };
    const { verifySecret, hashSecret } = await import("@/game/secrets.server");
    const match = await verifySecret(data.current ?? "", hash);
    if (!match) return { ok: false as const, reason: "bad-password" as const };
    const nextHash = await hashSecret(next);
    await sql`update account_secrets set delete_pass_hash = ${nextHash} where user_id = ${context.userId}`;
    return { ok: true as const };
  });
