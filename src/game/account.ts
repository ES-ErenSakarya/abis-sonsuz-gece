import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { CharacterSave, Item, Quest, StatKey } from "@/game/rpg";
import { asClassId, BAG_SIZE } from "@/game/rpg";

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
  pots: { hp: Item | null; mp: Item | null };
  quests: Quest[];
  depot: (Item | null)[];
  blocked: string[];
  bagStage: number;
  wellAt: number;
  bonusUntil: number;
  x?: number;
  z?: number;
  stall: CharacterSave["stall"];
  stallSpot: { x: number; z: number } | null;
  steed: CharacterSave["steed"];
  mountItem: Item | null;
  riding: boolean;
  greeted: boolean;
  mentored: boolean;
  fame: number;
  kills: number;
  mines: number;
  fish: number;
  damage: number;
  bossKills: number;
  duelWins: number;
  goldEarned: number;
  skillBank: number;
  filledGear: string[];
  weekClaim: string;
  friends: { id: string; nick: string; level: number }[];
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
  const spot = obj.stallSpot;
  const stallSpot = spot && typeof spot === "object" && typeof (spot as { x?: unknown }).x === "number" && typeof (spot as { z?: unknown }).z === "number"
    ? { x: (spot as { x: number }).x, z: (spot as { z: number }).z }
    : null;
  const steed = obj.steed && typeof obj.steed === "object" && typeof (obj.steed as { id?: unknown }).id === "string" ? (obj.steed as CharacterSave["steed"]) : null;
  const mountItem = obj.mountItem && typeof obj.mountItem === "object" && typeof (obj.mountItem as { id?: unknown }).id === "string" ? (obj.mountItem as Item) : null;
  return {
    invested: { str: num("str"), hp: num("hp"), ats: num("ats"), mvs: num("mvs"), ctp: num("ctp"), mag: num("mag"), mana: num("mana") },
    skills,
    skillPoints: num("skillPoints"),
    chosenTree: typeof obj.chosenTree === "string" ? obj.chosenTree : null,
    hotbar,
    pots: obj.pots && typeof obj.pots === "object" ? (obj.pots as { hp: Item | null; mp: Item | null }) : { hp: null, mp: null },
    quests,
    depot,
    blocked,
    bagStage: num("bagStage"),
    wellAt: num("wellAt"),
    bonusUntil: num("bonusUntil"),
    x: typeof obj.x === "number" && Number.isFinite(obj.x) ? obj.x : undefined,
    z: typeof obj.z === "number" && Number.isFinite(obj.z) ? obj.z : undefined,
    stall: Array.isArray(obj.stall) ? (obj.stall as NonNullable<CharacterSave["stall"]>) : null,
    stallSpot,
    steed,
    mountItem,
    riding: obj.riding === true,
    greeted: obj.greeted === true,
    mentored: obj.mentored === true,
    fame: num("fame"),
    kills: num("kills"),
    mines: num("mines"),
    fish: num("fish"),
    damage: num("damage"),
    bossKills: num("bossKills"),
    duelWins: num("duelWins"),
    goldEarned: num("goldEarned"),
    skillBank: num("skillBank"),
    filledGear: Array.isArray(obj.filledGear) ? obj.filledGear.filter((id) => typeof id === "string") : [],
    weekClaim: typeof obj.weekClaim === "string" ? obj.weekClaim : "",
    friends: Array.isArray(obj.friends)
      ? obj.friends
          .filter((row) => row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string")
          .map((row) => {
            const mate = row as { id: string; nick?: unknown; level?: unknown };
            return { id: mate.id, nick: typeof mate.nick === "string" ? mate.nick : "Dost", level: Math.max(1, Math.floor(Number(mate.level) || 1)) };
          })
      : [],
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
    pots: stats.pots,
    quests: stats.quests,
    depot: stats.depot,
    blocked: stats.blocked,
    bagStage: stats.bagStage,
    wellAt: stats.wellAt,
    bonusUntil: stats.bonusUntil,
    x: stats.x,
    z: stats.z,
    stall: stats.stall,
    stallSpot: stats.stallSpot,
    steed: stats.steed ?? null,
    mountItem: stats.mountItem,
    riding: stats.riding,
    greeted: stats.greeted,
    mentored: stats.mentored,
    fame: stats.fame,
    kills: stats.kills,
    mines: stats.mines,
    fish: stats.fish,
    damage: stats.damage,
    bossKills: stats.bossKills,
    duelWins: stats.duelWins,
    goldEarned: stats.goldEarned,
    skillBank: stats.skillBank,
    filledGear: stats.filledGear,
    weekClaim: stats.weekClaim,
    friends: stats.friends,
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
    const bagSlots = Array.from({ length: BAG_SIZE }, () => null as unknown);
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
          pots: save.pots ?? { hp: null, mp: null },
          quests: save.quests ?? [],
          depot: save.depot ?? [],
          blocked: save.blocked ?? [],
          bagStage: save.bagStage ?? 0,
          wellAt: save.wellAt ?? 0,
          bonusUntil: save.bonusUntil ?? 0,
          x: typeof save.x === "number" ? save.x : undefined,
          z: typeof save.z === "number" ? save.z : undefined,
          stall: Array.isArray(save.stall) ? save.stall : null,
          stallSpot: save.stallSpot && typeof save.stallSpot.x === "number" ? save.stallSpot : null,
          steed: save.steed ?? null,
          mountItem: save.mountItem ?? null,
          riding: save.riding === true,
          greeted: save.greeted === true,
          mentored: save.mentored === true,
          fame: Math.max(0, Math.floor(Number(save.fame) || 0)),
          kills: Math.max(0, Math.floor(Number(save.kills) || 0)),
          mines: Math.max(0, Math.floor(Number(save.mines) || 0)),
          fish: Math.max(0, Math.floor(Number(save.fish) || 0)),
          damage: Math.max(0, Math.floor(Number(save.damage) || 0)),
          bossKills: Math.max(0, Math.floor(Number(save.bossKills) || 0)),
          duelWins: Math.max(0, Math.floor(Number(save.duelWins) || 0)),
          goldEarned: Math.max(0, Math.floor(Number(save.goldEarned) || 0)),
          skillBank: Math.max(0, Math.floor(Number(save.skillBank) || 0)),
          filledGear: Array.isArray(save.filledGear) ? save.filledGear : [],
          weekClaim: typeof save.weekClaim === "string" ? save.weekClaim : "",
          friends: Array.isArray(save.friends) ? save.friends : [],
        }),
        JSON.stringify(Array.isArray(save.bag) ? save.bag.slice(0, BAG_SIZE) : []),
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

export type BoardRow = { name: string; level: number; kills: number; mines: number; fish: number; damage: number; fame: number; bossKills: number; duelWins: number; goldEarned: number };

export const leaderboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{ name: string; level: number; invested: unknown }>`
      select name, level, invested from characters limit 300
    `;
    return rows.map((row) => {
      const extra = asJson<Record<string, unknown>>(row.invested, {});
      const num = (key: string) => (typeof extra[key] === "number" ? Math.max(0, Math.floor(extra[key] as number)) : 0);
      const name = String(row.name || "Oyuncu").replace(/\s+/g, " ").slice(0, 16);
      return {
        name,
        level: Math.max(1, Math.floor(Number(row.level) || 1)),
        kills: num("kills"),
        mines: num("mines"),
        fish: num("fish"),
        damage: num("damage"),
        fame: num("fame"),
        bossKills: num("bossKills"),
        duelWins: num("duelWins"),
        goldEarned: num("goldEarned"),
      } satisfies BoardRow;
    });
  });
