// @ts-nocheck
import { create } from "zustand";
import { readSim, queueHop } from "@/game/input";
import { REALMS, FISHER_STAND, campSpawns, meteorSpots, realmAt, realmGate, realmHerald, retireVein, veinAt } from "@/game/world";
import { priceOf, studioGrave, studioSafe } from "@/game/studio";
import { systemSay } from "@/game/chat";
import { friendMates, hydrateFriends } from "@/game/target";
import { useSession } from "@/game/session";
import { clearOwnStall, offerStallItem, takeOwnStallItem } from "@/game/stalls";

export const PAGE_SIZE = 24;
export const BAG_PAGES = 4;
export const BAG_SIZE = 96;
export const SKILL_MAX = 32;
export const SKILL_PER_LEVEL = 2;

export type ClassId = "savasci" | "okcu" | "buyucu" | "ninja";
export type StatKey = "str" | "hp" | "ats" | "mvs" | "ctp" | "mag" | "mana";
export type EquipSlot = "weapon" | "helmet" | "armor" | "earring" | "necklace" | "bracelet" | "boots" | "ring" | "gloves" | "belt";
export type WeaponStyle = "fist" | "sword" | "bow" | "staff" | "dagger" | "pala" | "kazma" | "olta";
export type CharTab = "stats" | "skills" | "quests";
export type ShopKind = "weapon" | "armor" | "market" | "stable" | "fisher" | "miner" | "smith" | "depot" | "guard" | "herald" | "gate" | "stall" | "craft" | "bazaar";
export type NearKind = "mentor" | "smith" | "guard" | "market" | "armor" | "weapon" | "depot" | "stable" | "fisher" | "miner" | "well" | "fish" | "vein" | "herald" | "gate" | "craft" | "stall" | "boss";

export type Item = {
  uid: string;
  id: string;
  name: string;
  slot: EquipSlot;
  level: number;
  plus: number;
  str: number;
  hp: number;
  ats: number;
  mvs: number;
  ctp: number;
  desc?: string;
  kind?: string;
  count?: number;
  price?: number;
  shop?: ShopKind;
  req?: number;
  forClass?: string;
  enchants?: { name: string; stat: string; value: number; boss?: string }[];
  loot?: Item[];
};

export type Quest = {
  id: string;
  title: string;
  detail: string;
  need: number;
  have: number;
  kind: string;
  mob?: string;
  talk?: string;
  track?: string;
  map?: string;
  done: boolean;
  claimed: boolean;
  seen: string[];
  minLevel: number;
  xpReward?: number;
  goldReward?: number;
  rewardName?: string;
};

export type CharacterSave = {
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  vials: number;
  unspent: number;
  gold: number;
  hp: number;
  invested: Record<StatKey, number>;
  bag: (Item | null)[];
  equipped: Record<EquipSlot, Item | null>;
  skills: Record<string, number>;
  skillPoints: number;
  chosenTree: string | null;
  hotbar: (string | null)[];
  pots?: { hp: Item | null; mp: Item | null };
  quests: Quest[];
  depot: (Item | null)[];
  blocked: string[];
  bagStage: number;
  wellAt: number;
  bonusUntil: number;
  x?: number;
  z?: number;
  stall?: { uid: string; item: Item; price: number }[] | null;
  stallSpot?: { x: number; z: number } | null;
  steed?: { id: string; name: string; coat: string; mane: string; dark: string; muzzle?: string } | null;
  mountItem?: Item | null;
  riding?: boolean;
  greeted?: boolean;
  mentored?: boolean;
  fame?: number;
  kills?: number;
  mines?: number;
  fish?: number;
  damage?: number;
  bossKills?: number;
  duelWins?: number;
  goldEarned?: number;
  skillBank?: number;
  mountSkills?: { surat: number; soluk: number; cifte: number };
  filledGear?: string[];
  weekClaim?: string;
  friends?: { id: string; nick: string; level: number }[];
  starterPots?: boolean;
  stallBank?: number;
};

export const SLOT_LABEL = {
	weapon: "Silah",
	helmet: "Kask",
	armor: "Zırh",
	earring: "Küpe",
	necklace: "Kolye",
	bracelet: "Bilezik",
	boots: "Ayakkabı",
	ring: "Yüzük",
	gloves: "Eldiven",
	belt: "Kemer"
};
export const STAT_LABEL: Record<string, string> = {
	str: "Hasar (ATD)",
	hp: "Can (HP)",
	ats: "Saldırı Hızı (ATS)",
	mvs: "Hareket Hızı (MVS)",
	ctp: "Kritik",
	mag: "Büyü Hasarı (ABP)",
	mana: "Mana (SP)"
};
export const STAT_HINT: Record<string, string> = {
	str: "Hasar (ATD): vuruşunun gücünü artırır. En fazla 90 puan.",
	hp: "Can (HP): azami canı artırır. En fazla 90 puan.",
	ats: "Saldırı Hızı (ATS): vuruş aralığını kısaltır. Etki sınırlıdır, hile hızına çıkmaz.",
	mvs: "Hareket Hızı (MVS): yürüyüşü hızlandırır. Koşu hızının bir tavanı vardır.",
	ctp: "Kritik artık statüden verilmez.",
	mag: "Büyü Hasarı (ABP): büyü yeteneklerinin gücünü artırır. En fazla 90 puan.",
	mana: "Mana (SP): azami manayı artırır. En fazla 90 puan."
};
export const CLASS_LIST: { id: ClassId; name: string; arm: string; line: string }[] = [
	{
		id: "savasci",
		name: "Savaşçı",
		arm: "Kılıç",
		line: "Yakın kesik"
	},
	{
		id: "okcu",
		name: "Okçu",
		arm: "Yay",
		line: "Gerip bırakır"
	},
	{
		id: "buyucu",
		name: "Büyücü",
		arm: "Asa",
		line: "Asa darbesi"
	},
	{
		id: "ninja",
		name: "Ninja",
		arm: "Hançer",
		line: "Kısa ve hızlı"
	}
];
export function className(id) {
	return CLASS_LIST.find((row) => row.id === id)?.name ?? "Savaşçı";
}
export const CLASS_TREES = {
	savasci: [{
		name: "Kesik",
		skills: [
			{
				id: "sv1",
				name: "Güçlü Kesik",
				desc: "Tek hedefe ağır kılıç.",
				kind: "strike",
				power: 32
			},
			{
				id: "sv2",
				name: "Dönüş",
				desc: "Etrafındaki herkese döner.",
				kind: "aoe",
				power: 18
			},
			{
				id: "sv3",
				name: "Kanatma",
				desc: "Hedefi kanatır, bir süre kanar.",
				kind: "dot",
				power: 20
			},
			{
				id: "sv7",
				name: "Yarma",
				desc: "Tek hedefe en ağır kesik.",
				kind: "strike",
				power: 48
			},
			{
				id: "sv8",
				name: "Savruluş",
				desc: "Geniş savurma, etraf hasarı.",
				kind: "aoe",
				power: 22
			}
		]
	}, {
		name: "Siper",
		skills: [
			{
				id: "sv4",
				name: "Siper",
				desc: "Canını toparlar. Hasar vermez.",
				kind: "buff",
				power: 0
			},
			{
				id: "sv5",
				name: "Dayanış",
				desc: "Bir süre daha az hasar alırsın.",
				kind: "buff",
				power: 0
			},
			{
				id: "sv6",
				name: "Hamle",
				desc: "Bir süre daha hızlı koşarsın.",
				kind: "buff",
				power: 0
			},
			{
				id: "sv9",
				name: "Kalkan",
				desc: "Kısa süre gelen hasarı keser.",
				kind: "buff",
				power: 0
			},
			{
				id: "sv10",
				name: "Direnç",
				desc: "Bir süre canın kendiliğinden dolar.",
				kind: "buff",
				power: 0
			}
		]
	}],
	okcu: [{
		name: "Nişan",
		skills: [
			{
				id: "ok1",
				name: "Hızlı Ok",
				desc: "Tek hedefe hızlı ok. Hedef şart.",
				kind: "strike",
				power: 22
			},
			{
				id: "ok2",
				name: "Çift Atış",
				desc: "Aynı hedefe iki ok.",
				kind: "strike",
				power: 14,
				hits: 2
			},
			{
				id: "ok3",
				name: "Delici",
				desc: "Zırhı delen tek ve sert ok.",
				kind: "strike",
				power: 36
			},
			{
				id: "ok7",
				name: "Sabit Nişan",
				desc: "Kilitli hedefe sert ok.",
				kind: "strike",
				power: 30
			},
			{
				id: "ok8",
				name: "Seri",
				desc: "Kısa beklemeli tek ok.",
				kind: "strike",
				power: 16
			}
		]
	}, {
		name: "İz",
		skills: [
			{
				id: "ok4",
				name: "Yavaşlatma",
				desc: "Hedefi yavaşlatır.",
				kind: "strike",
				power: 14,
				slow: true
			},
			{
				id: "ok5",
				name: "Zehir Oku",
				desc: "Oka zehir bulaşır, süre hasarı.",
				kind: "dot",
				power: 18
			},
			{
				id: "ok6",
				name: "Ok Yağmuru",
				desc: "Etrafına ok yağar.",
				kind: "aoe",
				power: 15
			},
			{
				id: "ok9",
				name: "İz Sürme",
				desc: "Seçili hedefe iz hasarı.",
				kind: "strike",
				power: 26
			},
			{
				id: "ok10",
				name: "Tuzak",
				desc: "Ayaklarının altında alan hasarı.",
				kind: "aoe",
				power: 20
			}
		]
	}],
	ninja: [{
		name: "Hançer",
		skills: [
			{
				id: "nj1",
				name: "Çift Kesik",
				desc: "Aynı hedefe iki bıçak.",
				kind: "strike",
				power: 15,
				hits: 2
			},
			{
				id: "nj2",
				name: "Boşluk",
				desc: "Etrafı keser.",
				kind: "aoe",
				power: 16
			},
			{
				id: "nj3",
				name: "Zehir",
				desc: "Hançere zehir bulaşır.",
				kind: "dot",
				power: 17
			},
			{
				id: "nj7",
				name: "Kesik",
				desc: "Hızlı tek hançer.",
				kind: "strike",
				power: 20
			},
			{
				id: "nj8",
				name: "Çengel",
				desc: "Kritik şanslı hançer.",
				kind: "strike",
				power: 24,
				crit: true
			}
		]
	}, {
		name: "Gölge",
		skills: [
			{
				id: "nj4",
				name: "Adım",
				desc: "Bir süre hızlanırsın. Hasar vermez.",
				kind: "buff",
				power: 0
			},
			{
				id: "nj5",
				name: "Sis",
				desc: "Sis: bir süre daha az hasar alırsın.",
				kind: "buff",
				power: 0
			},
			{
				id: "nj6",
				name: "Ölüm",
				desc: "Tek hedefe kritik ölüm vuruşu.",
				kind: "strike",
				power: 44,
				crit: true
			},
			{
				id: "nj9",
				name: "Giz",
				desc: "Gölgede bir süre daha az hasar.",
				kind: "buff",
				power: 0
			},
			{
				id: "nj10",
				name: "Son Vuruş",
				desc: "Tek hedefe bitirici hançer.",
				kind: "strike",
				power: 40
			}
		]
	}],
	buyucu: [{
		name: "Ateş",
		skills: [
			{
				id: "mg1",
				name: "Kıvılcım",
				desc: "Küçük ateş. Hedef şart.",
				kind: "strike",
				power: 18,
				mag: true
			},
			{
				id: "mg2",
				name: "Ateş Topu",
				desc: "Büyük tek ateş topu.",
				kind: "strike",
				power: 38,
				mag: true
			},
			{
				id: "mg3",
				name: "Patlama",
				desc: "Etrafı patlatır.",
				kind: "aoe",
				power: 18,
				mag: true
			},
			{
				id: "mg7",
				name: "Kor",
				desc: "Tek hedefe kor.",
				kind: "strike",
				power: 26,
				mag: true
			},
			{
				id: "mg8",
				name: "Duvar",
				desc: "Alev duvarı, alan hasarı.",
				kind: "aoe",
				power: 16,
				mag: true
			}
		]
	}, {
		name: "Buz",
		skills: [
			{
				id: "mg4",
				name: "Don",
				desc: "Hedefi dondurur ve yavaşlatır.",
				kind: "strike",
				power: 18,
				mag: true,
				slow: true
			},
			{
				id: "mg5",
				name: "Mızrak",
				desc: "Tek hedefe buz mızrağı.",
				kind: "strike",
				power: 36,
				mag: true
			},
			{
				id: "mg6",
				name: "Fırtına",
				desc: "Alan fırtınası.",
				kind: "aoe",
				power: 17,
				mag: true
			},
			{
				id: "mg9",
				name: "Kırağı",
				desc: "Tek hedefe buz.",
				kind: "strike",
				power: 24,
				mag: true
			},
			{
				id: "mg10",
				name: "Çığ",
				desc: "Alan çığı.",
				kind: "aoe",
				power: 21,
				mag: true
			}
		]
	}]
};
export const MENTORS = [
	{
		id: "sv-a",
		cls: "savasci",
		tree: 0,
		name: "Kesik Ustası",
		x: 10,
		z: -26
	},
	{
		id: "sv-b",
		cls: "savasci",
		tree: 1,
		name: "Siper Ustası",
		x: 13.4,
		z: -26
	},
	{
		id: "ok-a",
		cls: "okcu",
		tree: 0,
		name: "Nişan Ustası",
		x: 16.8,
		z: -26
	},
	{
		id: "ok-b",
		cls: "okcu",
		tree: 1,
		name: "İz Ustası",
		x: 20.2,
		z: -26
	},
	{
		id: "nj-a",
		cls: "ninja",
		tree: 0,
		name: "Hançer Ustası",
		x: 23.6,
		z: -26
	},
	{
		id: "nj-b",
		cls: "ninja",
		tree: 1,
		name: "Gölge Ustası",
		x: 27,
		z: -26
	},
	{
		id: "mg-a",
		cls: "buyucu",
		tree: 0,
		name: "Ateş Ustası",
		x: 30.4,
		z: -26
	},
	{
		id: "mg-b",
		cls: "buyucu",
		tree: 1,
		name: "Buz Ustası",
		x: 33.8,
		z: -26
	}
];
export function asClassId(id) {
	return CLASS_LIST.some((row) => row.id === id) ? id : "savasci";
}
export function weaponStyleOf(id) {
	if (!id) return "fist";
	const key = String(id).toLocaleLowerCase("tr");
	if (key === "kazma") return "kazma";
	if (key === "olta") return "olta";
	if (key.includes("bow") || key.includes("yay")) return "bow";
	if (key.includes("staff") || key.includes("asa")) return "staff";
	if (key.includes("dagger") || key.includes("hancer") || key.includes("hançer")) return "dagger";
	if (key.includes("pala")) return "pala";
	return "sword";
}
export function skillTier(rank) {
	if (rank <= 0) return "0";
	if (rank <= 10) return String(rank);
	if (rank <= 20) return `P${rank - 10}`;
	if (rank === 21) return "P";
	if (rank <= 31) return `S${rank - 21}`;
	return "S+";
}
function spentSkillPoints(skills) {
	let n = 0;
	for (const rank of Object.values(skills || {})) n += Math.max(0, Math.floor(Number(rank) || 0));
	return n;
}
export function skillPointGap(row) {
	const level = Math.max(1, Math.floor(Number(row?.level) || 1));
	const earned = (level - 1) * SKILL_PER_LEVEL;
	const have = spentSkillPoints(row?.skills) + Math.max(0, Math.floor(Number(row?.skillPoints) || 0)) + Math.max(0, Math.floor(Number(row?.skillBank) || 0));
	return Math.max(0, earned - have);
}
function skillMultiplier(rank) {
	if (rank <= 0) return 0;
	const ten = Math.pow(1.14, 9);
	const pure = ten * Math.pow(1.1, 10) * 1.12;
	const s10 = pure * Math.pow(1.08, 10);
	if (rank <= 10) return Math.pow(1.14, rank - 1);
	if (rank <= 20) return ten * Math.pow(1.1, rank - 10);
	if (rank === 21) return pure;
	if (rank <= 31) return pure * Math.pow(1.08, rank - 21);
	return s10 * 1.18;
}
function skillDamage(rank, power) {
	return Math.max(0, Math.round(power * skillMultiplier(rank)));
}
function skillWait(id, rank) {
	const sk = skillById(id);
	const quick = id === "ok1" || id === "ok8" || id === "nj7";
	const slow = sk?.kind === "aoe" ? 7.2 : quick ? 2.2 : 4.6;
	return Math.max(quick ? .7 : 1.15, slow - Math.min(rank, 22) * .05);
}
function skillById(id) {
	for (const trees of Object.values(CLASS_TREES)) for (const tree of trees) {
		const sk = tree.skills.find((row) => row.id === id);
		if (sk) return sk;
	}
}
export function skillPreview(id, rank, totals) {
	const sk = skillById(id);
	if (!sk || sk.kind === "buff") return {
		dmg: 0,
		next: 0,
		buff: true,
		text: sk?.desc ?? ""
	};
	const stat = sk.mag ? totals.mag : totals.str;
	const power = sk.power + stat * (sk.mag ? .5 : .32);
	return {
		dmg: rank > 0 ? skillDamage(rank, power) : 0,
		next: skillDamage(Math.min(32, Math.max(1, rank + 1)), power),
		buff: false,
		text: sk.desc
	};
}
var skillReadyAt = {};
var pendingKick = null;
export function takeMountKick() {
	const row = pendingKick;
	pendingKick = null;
	return row;
}
export function skillCdLeft(id) {
	return Math.max(0, ((skillReadyAt[id] ?? 0) - Date.now()) / 1e3);
}
export function skillCdTotal(id) {
	const mount = MOUNT_SKILLS.find((row) => row.id === id);
	if (mount) {
		const rank = Math.max(1, Math.min(SKILL_MAX, useRpg.getState().mountSkills?.[mount.id] || 1));
		return Math.max(3.2, 8.5 - rank * 0.12);
	}
	const rank = useRpg.getState().skills[id] ?? 1;
	return skillWait(id, Math.max(1, rank));
}
export function weaponFits(classId, itemId) {
	const style = weaponStyleOf(itemId);
	if (style === "fist" || style === "kazma" || style === "olta") return true;
	if (classId === "savasci") return style === "sword" || style === "pala";
	if (classId === "okcu") return style === "bow";
	if (classId === "buyucu") return style === "staff";
	return style === "dagger";
}
export function itemFits(classId, it) {
	if (!it || it.kind === "mat" || it.kind === "bag" || it.kind === "book") return false;
	if (it.id === "kazma" || it.id === "olta" || it.id === "hizli-pazar") return it.id !== "hizli-pazar";
	if (it.forClass && it.forClass !== "hepsi" && it.forClass !== classId) return false;
	if (it.slot === "weapon" && it.kind !== "tool") {
		if (it.forClass && it.forClass !== "hepsi") return it.forClass === classId;
		return weaponFits(classId, it.id);
	}
	return true;
}
export function classLine(slot, forClass) {
	const named = { savasci: "Savaşçı", okcu: "Okçu", buyucu: "Büyücü", ninja: "Ninja" };
	const limited = slot === "weapon" || slot === "armor" || slot === "helmet" || slot === "belt";
	if (!limited || !forClass || forClass === "hepsi") return "Bütün Karakterler Kuşanabilir";
	return named[forClass] || "Bütün Karakterler Kuşanabilir";
}
export function openBagCount(stage) {
	const n = Math.max(0, Math.min(8, Math.floor(Number(stage) || 0)));
	return Math.min(BAG_SIZE, 24 + n * 9);
}
export function rankOf(score) {
	const n = Math.max(0, Math.floor(Number(score) || 0));
	if (n < 1000) return null;
	if (n < 3000) return { name: "Acemi", color: "#f2d15a", glow: false };
	if (n < 8000) return { name: "Deneyimli", color: "#e07a2f", glow: false };
	if (n < 12000) return { name: "Usta", color: "#3cbf6a", glow: false };
	if (n < 15000) return { name: "Ajan", color: "#e23b3b", glow: false };
	return { name: "Abis Kahramanı", color: "#4aa3ff", glow: true };
}
export const ENHANCE = [
	40,
	70,
	110,
	160,
	220,
	300,
	700,
	1000,
	1300,
	1550
];
export const PLUS_CHANCE = [100, 100, 95, 90, 80, 70, 45, 30, 20, 12];
export const STONE_BONUS = 35;
export function upgradeChance(plus, stone) {
	return Math.min(100, (PLUS_CHANCE[plus] ?? 10) + (stone ? STONE_BONUS : 0));
}
var SHOP = [
	{
		id: "gece-weapon",
		name: "Gece Kılıcı",
		slot: "weapon",
		price: 40,
		str: 10,
		hp: 0,
		ats: 3,
		mvs: 0,
		ctp: 0,
		desc: "Savaşçı kılıcı. Seviye 1.",
		shop: "weapon"
	},
	{
		id: "gece-pala",
		name: "Gece Palası",
		slot: "weapon",
		price: 95,
		str: 18,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 2,
		desc: "Savaşçı palası. İki elle tutulur.",
		shop: "weapon"
	},
	{
		id: "gece-bow",
		name: "Gece Yayı",
		slot: "weapon",
		price: 40,
		str: 8,
		hp: 0,
		ats: 4,
		mvs: 0,
		ctp: 0,
		desc: "Okçu yayı.",
		shop: "weapon"
	},
	{
		id: "gece-staff",
		name: "Gece Asası",
		slot: "weapon",
		price: 40,
		str: 7,
		hp: 8,
		ats: 2,
		mvs: 0,
		ctp: 0,
		desc: "Büyücü asası.",
		shop: "weapon"
	},
	{
		id: "gece-dagger",
		name: "Gece Hançeri",
		slot: "weapon",
		price: 40,
		str: 8,
		hp: 0,
		ats: 5,
		mvs: 0,
		ctp: 3,
		desc: "Ninja hançeri.",
		shop: "weapon"
	},
	{
		id: "gece-helmet",
		name: "Gece Kask",
		slot: "helmet",
		price: 35,
		str: 1,
		hp: 12,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Zırhçı kaskı.",
		shop: "armor"
	},
	{
		id: "gece-armor",
		name: "Gece Zırh",
		slot: "armor",
		price: 55,
		str: 1,
		hp: 24,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Zırhçı gövdesi.",
		shop: "armor"
	},
	{
		id: "gece-earring",
		name: "Gece Küpe",
		slot: "earring",
		price: 25,
		str: 1,
		hp: 4,
		ats: 0,
		mvs: 0,
		ctp: 2,
		desc: "Küpe.",
		shop: "armor"
	},
	{
		id: "gece-necklace",
		name: "Gece Kolye",
		slot: "necklace",
		price: 30,
		str: 1,
		hp: 4,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Kolye.",
		shop: "armor"
	},
	{
		id: "gece-bracelet",
		name: "Gece Bilezik",
		slot: "bracelet",
		price: 25,
		str: 1,
		hp: 4,
		ats: 2,
		mvs: 0,
		ctp: 0,
		desc: "Bilezik.",
		shop: "armor"
	},
	{
		id: "gece-boots",
		name: "Gece Ayakkabı",
		slot: "boots",
		price: 30,
		str: 1,
		hp: 4,
		ats: 0,
		mvs: 4,
		ctp: 0,
		desc: "Ayakkabı.",
		shop: "armor"
	},
	{
		id: "gece-ring",
		name: "Gece Yüzük",
		slot: "ring",
		price: 25,
		str: 1,
		hp: 4,
		ats: 0,
		mvs: 0,
		ctp: 2,
		desc: "Yüzük.",
		shop: "armor"
	},
	{
		id: "gece-gloves",
		name: "Gece Eldiven",
		slot: "gloves",
		price: 28,
		str: 2,
		hp: 4,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Eldiven.",
		shop: "armor"
	},
	{
		id: "gece-belt",
		name: "Gece Kemer",
		slot: "belt",
		price: 28,
		str: 1,
		hp: 8,
		ats: 0,
		mvs: 1,
		ctp: 0,
		desc: "Kemer.",
		shop: "armor"
	},
	{
		id: "yol-boots",
		name: "Yol Çizmesi",
		slot: "boots",
		price: 48,
		str: 1,
		hp: 4,
		ats: 0,
		mvs: 8,
		ctp: 0,
		desc: "Uzun yol çizmesi.",
		shop: "armor"
	},
	{
		id: "pot-hp-s",
		name: "Can İksiri S",
		slot: "belt",
		price: 12,
		str: 0,
		hp: 50,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Can +50.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-hp-m",
		name: "Can İksiri M",
		slot: "belt",
		price: 28,
		str: 0,
		hp: 100,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Can +100.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-hp-l",
		name: "Can İksiri L",
		slot: "belt",
		price: 55,
		str: 0,
		hp: 200,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Can +200.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-mp-s",
		name: "Mana İksiri S",
		slot: "belt",
		price: 12,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Mana +50.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-mp-m",
		name: "Mana İksiri M",
		slot: "belt",
		price: 28,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Mana +100.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-mp-l",
		name: "Mana İksiri L",
		slot: "belt",
		price: 55,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Mana +200.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-mvs",
		name: "Hareket Hızı İksiri",
		slot: "belt",
		price: 26,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Bir dakika daha hızlı yürürsün.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-ats",
		name: "Saldırı Hızı İksiri",
		slot: "belt",
		price: 26,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Bir dakika daha sık vurursun.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "bag-expand",
		name: "Envanter Genişletme",
		slot: "belt",
		price: 350,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Envantere sürükle veya çift tıkla. 9 yuva açar.",
		shop: "market",
		kind: "bag"
	},
	{
		id: "guc-tasi",
		name: "Güç Taşı",
		slot: "belt",
		price: 40,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Demircide + basmak için. Yığın 200.",
		shop: "market",
		kind: "mat"
	},
	{
		id: "pazar-tezgah",
		name: "Pazar",
		slot: "belt",
		price: 500,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Kullanınca tezgah açılır. Eşyanı fiyat yazıp satışa koyarsın.",
		shop: "market",
		kind: "tool"
	},
	{
		id: "mistik-efsun",
		name: "Mistik Efsun",
		slot: "belt",
		price: 250,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Eşyalarınıza özellik eklemek için eşya üzerine sürükleyiniz. En fazla 5 adet eklenebilir.",
		shop: "market",
		kind: "mat"
	},
	{
		id: "mistik-degistirici",
		name: "Mistik Değiştirici",
		slot: "belt",
		price: 300,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Eşyanın üstüne sürükle. Ekli efsunlar yeniden çekilir.",
		shop: "market",
		kind: "mat"
	},
	{
		id: "saman",
		name: "Saman",
		slot: "belt",
		price: 80,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Bineği besler. At görevinde istenir.",
		shop: "stable",
		kind: "mat"
	},
	{
		id: "binek-tas",
		name: "Binek Seviye Arttırma Taşı+",
		slot: "belt",
		price: 220,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Binek seviyesini yükseltir.",
		shop: "stable",
		kind: "mat"
	},
	{
		id: "binek-kitap",
		name: "Binek Beceri Arttırma Kitabı",
		slot: "belt",
		price: 260,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Eski kitap. Yeni at kitapları meteor ve üretimden gelir.",
		kind: "mat"
	},
	{
		id: "kitap-surat",
		name: "Sürat Kitabı",
		slot: "belt",
		price: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Seyis'te Binek Geliştir. Sürat yeteneğine + basar. Binince at hızlanır. Son basamak S+.",
		kind: "book"
	},
	{
		id: "kitap-soluk",
		name: "Soluk Kitabı",
		slot: "belt",
		price: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Seyis'te Binek Geliştir. Soluk yeteneğine + basar. Binince dayanıklılık daha geç biter. Son basamak S+.",
		kind: "book"
	},
	{
		id: "kitap-cifte",
		name: "Çifte Kitabı",
		slot: "belt",
		price: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Seyis'te Binek Geliştir. Çifte yeteneğine + basar. Binince at yakındaki yaratığa tekme atar. Son basamak S+.",
		kind: "book"
	},
	{
		id: "olta",
		name: "Olta",
		slot: "weapon",
		price: 180,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Ele alınır. İskelede balık tut. Balık vurunca çek.",
		shop: "fisher",
		kind: "tool",
		req: 1
	},
	{
		id: "yem",
		name: "Yem",
		slot: "belt",
		price: 8,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Yemsiz olta suya inmez.",
		shop: "fisher",
		kind: "mat"
	},
	{
		id: "kazma",
		name: "Kazma",
		slot: "weapon",
		price: 240,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Ele alınır. Taş seç, Space ile 10 saniye kaz. 3 maden.",
		shop: "miner",
		kind: "tool",
		req: 8,
		level: 8
	},
	{
		id: "hizli-pazar",
		name: "Hızlı Pazar",
		slot: "belt",
		price: 4000,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Nerede olursan ol, tezgahlardaki eşyaları gösterir.",
		shop: "market",
		kind: "tool",
		req: 1
	}
];
export const CATALOG = SHOP;
function tuneShop() {
	const patch = (id, forClass, req) => {
		const row = SHOP.find((item) => item.id === id);
		if (!row) return;
		row.forClass = forClass;
		row.req = req;
		row.level = req;
		row.desc = classLine(row.slot, forClass);
	};
	patch("gece-weapon", "savasci", 1);
	patch("gece-pala", "savasci", 15);
	patch("gece-bow", "okcu", 1);
	patch("gece-staff", "buyucu", 1);
	patch("gece-dagger", "ninja", 1);
	patch("gece-helmet", "savasci", 1);
	patch("gece-armor", "savasci", 1);
	patch("gece-belt", "savasci", 1);
	for (const id of ["gece-earring", "gece-necklace", "gece-bracelet", "gece-boots", "gece-ring", "gece-gloves", "yol-boots"]) {
		const row = SHOP.find((item) => item.id === id);
		if (!row) continue;
		row.forClass = "hepsi";
		row.req = row.req || 1;
		row.level = row.req || 1;
		row.desc = classLine(row.slot, "hepsi");
	}
	const classes = [
		["savasci", "Savaşçı", "Kılıcı", "kilic"],
		["okcu", "Okçu", "Yayı", "yay"],
		["buyucu", "Büyücü", "Asası", "asa"],
		["ninja", "Ninja", "Hançeri", "hancer"]
	];
	const push = (row) => {
		if (SHOP.some((item) => item.id === row.id)) return;
		SHOP.push(row);
	};
	for (const [cls, label, weapon, slug] of classes) {
		for (const req of [1, 15, 25, 30]) {
			const skipWeapon = (cls === "savasci" && (req === 1 || req === 15)) || (cls !== "savasci" && req === 1);
			if (!skipWeapon) {
				push({
					id: `${slug}-${req}`,
					name: `${label} ${weapon}`,
					slot: "weapon",
					price: 36 + req * 52,
					str: 8 + Math.round(req * 1.15),
					hp: cls === "buyucu" ? 8 : 0,
					ats: cls === "okcu" || cls === "ninja" ? 5 : 2,
					mvs: 0,
					ctp: 0,
					desc: classLine("weapon", cls),
					shop: "weapon",
					kind: "gear",
					forClass: cls,
					req,
					level: req
				});
			}
			if (cls === "savasci" && req === 1) continue;
			for (const [slot, word, hp, str] of [["armor", "Zırhı", 18, 1], ["helmet", "Miğferi", 10, 1], ["belt", "Kemeri", 8, 1]]) {
				push({
					id: `${slug}-${slot}-${req}`,
					name: `${label} ${word}`,
					slot,
					price: 28 + req * 36,
					str: str + Math.floor(req / 15),
					hp: hp + req * 2,
					ats: 0,
					mvs: slot === "belt" ? 1 : 0,
					ctp: 0,
					desc: classLine(slot, cls),
					shop: "armor",
					kind: "gear",
					forClass: cls,
					req,
					level: req
				});
			}
		}
	}
	for (const req of [15, 25, 30]) {
		for (const [slot, name, hp, str, mvs] of [
			["earring", "Küpe", 8, 2, 0],
			["necklace", "Kolye", 8, 2, 0],
			["bracelet", "Bilezik", 6, 2, 0],
			["boots", "Çizme", 6, 1, 4],
			["ring", "Yüzük", 6, 2, 0],
			["gloves", "Eldiven", 6, 3, 0]
		]) {
			push({
				id: `ortak-${slot}-${req}`,
				name: `${name} ${req}`,
				slot,
				price: 22 + req * 18,
				str,
				hp: hp + Math.floor(req / 5),
				ats: 0,
				mvs,
				ctp: 0,
				desc: classLine(slot, "hepsi"),
				shop: "armor",
				kind: "gear",
				forClass: "hepsi",
				req,
				level: req
			});
		}
	}
}
tuneShop();
export const CRAFTS = [
	{ id: "c-kilic", name: "Maden Kılıcı", slot: "weapon", forClass: "savasci", req: 30, gold: 3500, str: 52, hp: 0, ats: 5, mvs: 0, ores: [["demir-cevher", 8], ["bakir-cevher", 3]] },
	{ id: "c-yay", name: "Maden Yayı", slot: "weapon", forClass: "okcu", req: 30, gold: 3500, str: 44, hp: 0, ats: 8, mvs: 2, ores: [["gumus-cevher", 6], ["demir-cevher", 4]] },
	{ id: "c-asa", name: "Maden Asası", slot: "weapon", forClass: "buyucu", req: 30, gold: 3500, str: 36, hp: 20, ats: 4, mvs: 0, ores: [["gumus-cevher", 8], ["bakir-cevher", 4]] },
	{ id: "c-hancer", name: "Maden Hançeri", slot: "weapon", forClass: "ninja", req: 30, gold: 3500, str: 40, hp: 0, ats: 10, mvs: 2, ores: [["demir-cevher", 5], ["gumus-cevher", 4]] },
	{ id: "c-zirh", name: "Maden Zırhı", slot: "armor", forClass: "savasci", req: 30, gold: 4200, str: 4, hp: 80, ats: 0, mvs: 0, ores: [["demir-cevher", 12]] },
	{ id: "c-zirh-ok", name: "Maden Av Zırhı", slot: "armor", forClass: "okcu", req: 30, gold: 4200, str: 2, hp: 64, ats: 2, mvs: 4, ores: [["demir-cevher", 6], ["bakir-cevher", 6]] },
	{ id: "c-zirh-buy", name: "Maden Cübbesi", slot: "armor", forClass: "buyucu", req: 30, gold: 4200, str: 2, hp: 48, ats: 2, mvs: 0, ores: [["gumus-cevher", 8], ["bakir-cevher", 4]] },
	{ id: "c-zirh-nin", name: "Maden Giz Zırhı", slot: "armor", forClass: "ninja", req: 30, gold: 4200, str: 3, hp: 56, ats: 4, mvs: 4, ores: [["demir-cevher", 4], ["gumus-cevher", 6]] },
	{ id: "c-kask", name: "Maden Miğferi", slot: "helmet", forClass: "savasci", req: 30, gold: 2800, str: 2, hp: 36, ats: 0, mvs: 0, ores: [["demir-cevher", 6]] },
	{ id: "c-surat", name: "Sürat Kitabı", slot: "belt", forClass: "hepsi", req: 30, gold: 45000, str: 0, hp: 0, ats: 0, mvs: 0, book: "kitap-surat", ores: [["demir-cevher", 48], ["bakir-cevher", 32], ["gumus-cevher", 24], ["altin-cevher", 12], ["saman", 60]] },
	{ id: "c-soluk", name: "Soluk Kitabı", slot: "belt", forClass: "hepsi", req: 30, gold: 45000, str: 0, hp: 0, ats: 0, mvs: 0, book: "kitap-soluk", ores: [["demir-cevher", 28], ["bakir-cevher", 40], ["gumus-cevher", 32], ["altin-cevher", 12], ["saman", 50]] },
	{ id: "c-cifte", name: "Çifte Kitabı", slot: "belt", forClass: "hepsi", req: 30, gold: 52000, str: 0, hp: 0, ats: 0, mvs: 0, book: "kitap-cifte", ores: [["demir-cevher", 32], ["bakir-cevher", 24], ["gumus-cevher", 40], ["altin-cevher", 16], ["saman", 40]] }
];
export const BAZAAR_OFFERS = [
	{ id: "b-kilic", name: "Gezgin Kılıcı", slot: "weapon", forClass: "savasci", level: 15, price: 1200, str: 24, hp: 0, ats: 3, mvs: 0 },
	{ id: "b-yay", name: "Gezgin Yayı", slot: "weapon", forClass: "okcu", level: 15, price: 1200, str: 20, hp: 0, ats: 5, mvs: 1 },
	{ id: "b-asa", name: "Gezgin Asası", slot: "weapon", forClass: "buyucu", level: 15, price: 1200, str: 16, hp: 12, ats: 2, mvs: 0 },
	{ id: "b-hancer", name: "Gezgin Hançeri", slot: "weapon", forClass: "ninja", level: 15, price: 1200, str: 18, hp: 0, ats: 6, mvs: 1 },
	{ id: "b-kupe", name: "Gezgin Küpe", slot: "earring", forClass: "hepsi", level: 15, price: 600, str: 2, hp: 10, ats: 0, mvs: 0 }
];
function xpForLevel(level) {
	return Math.floor(180 + level * 85);
}
function blankEquip() {
	return {
		weapon: null,
		helmet: null,
		armor: null,
		earring: null,
		necklace: null,
		bracelet: null,
		boots: null,
		ring: null,
		gloves: null,
		belt: null
	};
}
export function itemStats(it) {
	const m = 1 + it.plus * .12;
	return {
		str: Math.round(it.str * m),
		hp: Math.round(it.hp * m),
		ats: Math.round(it.ats * m),
		mvs: Math.round(it.mvs * m),
		ctp: Math.round(it.ctp * m)
	};
}
const PLUS_SLOTS = new Set(["weapon", "helmet", "armor", "earring", "necklace", "bracelet", "boots", "ring", "gloves", "belt"]);
export function showsGearPlus(it) {
	if (!it) return false;
	if (it.id === "starter-chest" || it.id === "boss-sandik" || it.id === "kazma" || it.id === "olta") return false;
	if (it.kind && it.kind !== "gear") return false;
	return PLUS_SLOTS.has(it.slot);
}
export function displayName(it) {
	if (!it) return "";
	if (!showsGearPlus(it)) return it.name;
	return `${it.name} +${Math.max(0, Math.floor(Number(it.plus) || 0))}`;
}
function starterChest() {
	return {
		uid: `chest-${Math.random().toString(36).slice(2, 8)}`,
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
		desc: "Açılınca sınıfının başlangıç silahını, 10 S can iksiri ve 10 S mana iksiri verir."
	};
}
function starterWeapon(classId) {
	const id = asClassId(classId);
	const base = {
		uid: `start-${id}-${Math.random().toString(36).slice(2, 7)}`,
		slot: "weapon",
		level: 1,
		plus: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0
	};
	if (id === "okcu") return {
		...base,
		id: "starter-bow",
		name: "Yay",
		str: 3,
		ats: 1,
		desc: "Başlangıç yayı. Düşen yaylardan zayıftır."
	};
	if (id === "buyucu") return {
		...base,
		id: "starter-staff",
		name: "Asa",
		str: 3,
		hp: 3,
		desc: "Başlangıç asası. Düşen asalardan zayıftır."
	};
	if (id === "ninja") return {
		...base,
		id: "starter-dagger",
		name: "Hançer",
		str: 4,
		ats: 2,
		ctp: 1,
		desc: "Başlangıç hançeri. Düşen hançerlerden zayıftır."
	};
	return {
		...base,
		id: "starter-sword",
		name: "Kılıç",
		str: 4,
		desc: "Başlangıç kılıcı. Düşen kılıçlardan zayıftır."
	};
}
export const QUEST_BOARD = [
	{ id: "q-merhaba", track: "ana", map: "koy", kind: "talk", talk: "guard", name: "Muhafızın Sözü", need: 1, min: 1, xp: 120, gold: 12, reward: "" },
	{ id: "q-rat", track: "ana", map: "koy", kind: "kill", mob: "rat", name: "Tarla Faresi", need: 12, min: 1, xp: 240, gold: 20, reward: "Başlangıç Zırhı" },
	{ id: "q-demirci", track: "ana", map: "koy", kind: "talk", talk: "smith", name: "Demircinin Ocağı", need: 1, min: 2, xp: 150, gold: 15, reward: "" },
	{ id: "q-hare", track: "ana", map: "koy", kind: "kill", mob: "hare", name: "Bozkır Tavşanı", need: 10, min: 3, xp: 270, gold: 24, reward: "" },
	{ id: "q-yem", track: "ana", map: "koy", kind: "fish", name: "Üç Balık", title: "Üç Balık", need: 3, min: 4, xp: 210, gold: 18, reward: "" },
	{ id: "q-wolf", track: "ana", map: "koy", kind: "kill", mob: "wolf", name: "Gece Kurdu", need: 7, min: 6, xp: 360, gold: 36, reward: "Başlangıç Bileziği" },
	{ id: "q-frog", track: "ana", map: "koy", kind: "kill", mob: "frog", name: "Bataklık Kurbağası", need: 9, min: 9, xp: 420, gold: 40, reward: "" },
	{ id: "q-azman", track: "ana", map: "koy", kind: "kill", mob: "azman", name: "Tarla Azmanı", need: 1, min: 11, xp: 660, gold: 80, reward: "Başlangıç Küpesi" },
	{ id: "q-reis", track: "ana", map: "koy", kind: "kill", mob: "reis", name: "Kurbağa Reisi", need: 1, min: 13, xp: 780, gold: 100, reward: "" },
	{ id: "q-at", track: "ana", map: "koy2", kind: "kill", mob: "boar", name: "Yaban Domuzu", title: "Seyis'in Atı", need: 16, min: 15, xp: 1920, gold: 240, reward: "At", talk: "stable" },
	{ id: "q-terbiye", track: "yan", map: "dolunay", kind: "kill", mob: "bear", name: "Orman Ayısı", title: "At Terbiyesi", need: 15, min: 30, xp: 1560, gold: 360, reward: "kitap", talk: "stable" },
	{ id: "q-jackal", track: "av", map: "koy2", kind: "kill", mob: "jackal", name: "Çakal", need: 14, min: 16, xp: 540, gold: 55, reward: "" },
	{ id: "q-boar", track: "av", map: "koy2", kind: "kill", mob: "boar", name: "Yaban Domuzu", need: 11, min: 17, xp: 660, gold: 70, reward: "" },
	{ id: "q-spider", track: "av", map: "koy2", kind: "kill", mob: "spider", name: "Mağara Örümceği", need: 9, min: 20, xp: 780, gold: 85, reward: "" },
	{ id: "q-scorp", track: "av", map: "koy2", kind: "kill", mob: "scorp", name: "Bozkır Akrebi", need: 8, min: 24, xp: 900, gold: 100, reward: "" },
	{ id: "q-kral", track: "av", map: "koy2", kind: "kill", mob: "kral", name: "Domuz Kral", need: 1, min: 26, xp: 1260, gold: 160, reward: "" },
	{ id: "q-ana", track: "av", map: "koy2", kind: "kill", mob: "ana", name: "Akrep Ana", need: 1, min: 28, xp: 1440, gold: 180, reward: "" },
	{ id: "q-bear", track: "av", map: "dolunay", kind: "kill", mob: "bear", name: "Orman Ayısı", need: 12, min: 29, xp: 1080, gold: 120, reward: "" },
	{ id: "q-skel", track: "av", map: "dolunay", kind: "kill", mob: "skel", name: "İskelet Asker", need: 10, min: 32, xp: 1260, gold: 140, reward: "" },
	{ id: "q-snake", track: "av", map: "dolunay", kind: "kill", mob: "snake", name: "Bataklık Yılanı", need: 8, min: 36, xp: 1440, gold: 160, reward: "" },
	{ id: "q-goat", track: "av", map: "dolunay", kind: "kill", mob: "goat", name: "Dağ Tekesi", need: 7, min: 40, xp: 1620, gold: 180, reward: "" },
	{ id: "q-ayi", track: "av", map: "dolunay", kind: "kill", mob: "ayi", name: "Ayı Reisi", need: 1, min: 42, xp: 2100, gold: 240, reward: "" },
	{ id: "q-komutan", track: "av", map: "dolunay", kind: "kill", mob: "komutan", name: "İskelet Komutan", need: 1, min: 44, xp: 2280, gold: 260, reward: "" },
	{ id: "q-bandit", track: "av", map: "ay", kind: "kill", mob: "bandit", name: "Harabe Haydutu", need: 15, min: 45, xp: 1860, gold: 210, reward: "" },
	{ id: "q-golem", track: "av", map: "ay", kind: "kill", mob: "golem", name: "Taş Golem", need: 8, min: 47, xp: 2100, gold: 240, reward: "" },
	{ id: "q-bat", track: "av", map: "ay", kind: "kill", mob: "bat", name: "Gece Yarasa", need: 11, min: 50, xp: 2340, gold: 270, reward: "" },
	{ id: "q-wraith", track: "av", map: "ay", kind: "kill", mob: "wraith", name: "Buz Ruhu", need: 7, min: 54, xp: 2580, gold: 300, reward: "" },
	{ id: "q-muhafiz", track: "av", map: "ay", kind: "kill", mob: "muhafiz", name: "Golem Muhafız", need: 1, min: 56, xp: 2940, gold: 360, reward: "" },
	{ id: "q-lord", track: "av", map: "ay", kind: "kill", mob: "lord", name: "Ruh Lordu", need: 1, min: 58, xp: 1260, gold: 180, reward: "" },
	{ id: "q-60", track: "ana", map: "abis", kind: "kill", mob: "knight", name: "Gezegene Adım", need: 12, min: 60, xp: 2940, gold: 420, reward: "" },
	{ id: "q-64", track: "ana", map: "abis", kind: "kill", mob: "abyss", name: "Abis Solucanı", need: 10, min: 64, xp: 3360, gold: 500, reward: "" },
	{ id: "q-68", track: "ana", map: "abis", kind: "kill", mob: "abis-kral", name: "Abis Kralı", need: 1, min: 66, xp: 4200, gold: 680, reward: "" },
	{ id: "q-72", track: "ana", map: "abis", kind: "kill", mob: "sentinel", name: "Gezegen Gözcüsü", need: 8, min: 68, xp: 3840, gold: 560, reward: "" },
	{ id: "q-76", track: "ana", map: "abis", kind: "kill", mob: "gezegen", name: "Gezegen Bekçisi", need: 1, min: 69, xp: 4680, gold: 760, reward: "" },
	{ id: "q-80", track: "ana", map: "kanli", kind: "kill", mob: "blood", name: "Kan Avı", need: 12, min: 72, xp: 5040, gold: 820, reward: "" },
	{ id: "q-84", track: "ana", map: "kanli", kind: "kill", mob: "drake", name: "Kemik Ejderi", need: 8, min: 75, xp: 5580, gold: 900, reward: "" },
	{ id: "q-88", track: "ana", map: "kanli", kind: "kill", mob: "cellat", name: "Kan Celladı", need: 1, min: 78, xp: 6300, gold: 1040, reward: "" },
	{ id: "q-92", track: "ana", map: "kanli", kind: "kill", mob: "ejder", name: "Kanlı Ejder", need: 1, min: 80, xp: 6900, gold: 1180, reward: "" },
	{ id: "q-96", track: "ana", map: "kiyamet", kind: "kill", mob: "night", name: "Sonsuz Gece", need: 10, min: 84, xp: 7500, gold: 1300, reward: "" },
	{ id: "q-gece", track: "ana", map: "kiyamet", kind: "kill", mob: "gece", name: "Gece Muhafızı", need: 1, min: 88, xp: 8400, gold: 1500, reward: "" },
	{ id: "q-doom", track: "ana", map: "kiyamet", kind: "kill", mob: "doom", name: "Kıyamet Atlısı", need: 8, min: 90, xp: 8100, gold: 1460, reward: "" },
	{ id: "q-end", track: "ana", map: "kiyamet", kind: "kill", mob: "end", name: "Son Muhafız", need: 8, min: 95, xp: 9000, gold: 1700, reward: "" },
	{ id: "q-son", track: "ana", map: "kiyamet", kind: "kill", mob: "son", name: "Kıyamet", need: 1, min: 97, xp: 10800, gold: 2200, reward: "" },
	{ id: "y-fish", track: "yan", map: "koy", kind: "fish", name: "İlk Av", need: 3, min: 5, xp: 270, gold: 30, reward: "" },
	{ id: "y-mine", track: "yan", map: "koy", kind: "mine", name: "İlk Damarı", need: 6, min: 8, xp: 330, gold: 40, reward: "" },
	{ id: "y-sell", track: "yan", map: "koy", kind: "sell", name: "Fazlayı Sat", need: 1, min: 3, xp: 120, gold: 10, reward: "" },
	{ id: "y-stall", track: "yan", map: "koy", kind: "stall", name: "Pazar Kur", need: 1, min: 6, xp: 240, gold: 20, reward: "" },
	{ id: "y-list", track: "yan", map: "koy", kind: "list", name: "Tezgaha Koy", need: 1, min: 6, xp: 210, gold: 15, reward: "" },
	{ id: "y-sale", track: "yan", map: "koy", kind: "sale", name: "İlk Satış", need: 1, min: 6, xp: 360, gold: 25, reward: "" },
	{ id: "y-plus6", track: "yan", map: "koy", kind: "plus6", name: "Artı Altı", need: 1, min: 10, xp: 480, gold: 40, reward: "" },
	{ id: "y-plus10", track: "yan", map: "koy2", kind: "plus10", name: "Artı On", need: 1, min: 70, xp: 840, gold: 80, reward: "" },
	{ id: "y-enchant", track: "yan", map: "koy", kind: "enchant", name: "Beş Efsun", need: 5, min: 12, xp: 600, gold: 50, reward: "" },
	{ id: "y-reroll", track: "yan", map: "koy", kind: "reroll", name: "Efsun Değiştir", need: 1, min: 12, xp: 270, gold: 20, reward: "" },
	{ id: "y-craft", track: "yan", map: "koy", kind: "craft", name: "İlk İş", need: 1, min: 30, xp: 960, gold: 60, reward: "" },
	{ id: "y-meteor-koy", track: "yan", map: "koy", kind: "meteor", name: "Kıvılcım Taşı", need: 1, min: 8, xp: 480, gold: 60, reward: "", meteors: ["meteor-koy-0"] },
	{ id: "y-meteor-koy2", track: "yan", map: "koy2", kind: "meteor", name: "Demir Yağmuru", need: 2, min: 18, xp: 840, gold: 110, reward: "", meteors: ["meteor-koy2-0", "meteor-koy2-1"] },
	{ id: "y-meteor-dolunay", track: "yan", map: "dolunay", kind: "meteor", name: "Ay Parçası", need: 2, min: 30, xp: 1260, gold: 180, reward: "", meteors: ["meteor-dolunay-0", "meteor-dolunay-1"] },
	{ id: "y-meteor-ay", track: "yan", map: "ay", kind: "meteor", name: "Sonsuz Kıvılcım", need: 3, min: 45, xp: 1920, gold: 280, reward: "", meteors: ["meteor-ay-0", "meteor-ay-1", "meteor-ay-2"] },
	{ id: "y-meteor-abis", track: "yan", map: "abis", kind: "meteor", name: "Abis Çekirdeği", need: 3, min: 62, xp: 2700, gold: 420, reward: "", meteors: ["meteor-abis-0", "meteor-abis-1", "meteor-abis-2"] },
	{ id: "y-meteor-kanli", track: "yan", map: "kanli", kind: "meteor", name: "Kanlı Kıvılcım", need: 3, min: 74, xp: 3600, gold: 560, reward: "", meteors: ["meteor-kanli-0", "meteor-kanli-1", "meteor-kanli-2"] },
	{ id: "y-meteor-kiyamet", track: "yan", map: "kiyamet", kind: "meteor", name: "Kıyamet Çekirdeği", need: 4, min: 85, xp: 4800, gold: 780, reward: "", meteors: ["meteor-kiyamet-0", "meteor-kiyamet-1", "meteor-kiyamet-2", "meteor-kiyamet-3"] },
];
export const BOSSES = [
	{ id: "azman", name: "Tarla Azmanı", level: 12, realm: "koy", x: 118, z: 46, spec: "wolf" },
	{ id: "reis", name: "Kurbağa Reisi", level: 14, realm: "koy", x: -110, z: 58, spec: "frog" },
	{ id: "kral", name: "Domuz Kral", level: 26, realm: "koy2", x: 34, z: 468, spec: "boar" },
	{ id: "ana", name: "Akrep Ana", level: 28, realm: "koy2", x: -38, z: 388, spec: "scorp" },
	{ id: "ayi", name: "Ayı Reisi", level: 42, realm: "dolunay", x: 470, z: 34, spec: "bear" },
	{ id: "komutan", name: "İskelet Komutan", level: 44, realm: "dolunay", x: 388, z: -32, spec: "skel" },
	{ id: "muhafiz", name: "Golem Muhafız", level: 56, realm: "ay", x: -470, z: 28, spec: "golem" },
	{ id: "lord", name: "Ruh Lordu", level: 58, realm: "ay", x: -384, z: -36, spec: "wraith" },
	{ id: "abis-kral", name: "Abis Kralı", level: 66, realm: "abis", x: 78, z: -352, spec: "knight" },
	{ id: "gezegen", name: "Gezegen Bekçisi", level: 69, realm: "abis", x: -86, z: -488, spec: "sentinel" },
	{ id: "cellat", name: "Kan Celladı", level: 78, realm: "kanli", x: 498, z: 468, spec: "hangman" },
	{ id: "ejder", name: "Kanlı Ejder", level: 80, realm: "kanli", x: 348, z: 500, spec: "drake" },
	{ id: "gece", name: "Gece Muhafızı", level: 88, realm: "kiyamet", x: -348, z: 492, spec: "night" },
	{ id: "son", name: "Kıyamet", level: 97, realm: "kiyamet", x: -506, z: 352, spec: "end" },
];
export function questGiver(row: { id?: string; kind?: string; talk?: string; map?: string } | undefined | null) {
	if (!row) return null;
	if (row.id === "q-at" || row.talk === "stable") return "stable";
	if (row.id === "q-yem" || row.kind === "fish" || row.talk === "fisher") return "fisher";
	if (row.id === "q-demirci" || row.talk === "smith") return "smith";
	if (row.kind === "mine" || row.talk === "miner") return "miner";
	if (row.kind === "sell" || row.kind === "stall" || row.kind === "list" || row.kind === "sale") return "market";
	if (row.kind === "craft" || row.talk === "craft") return "craft";
	if (row.kind === "plus6" || row.kind === "plus10" || row.kind === "enchant" || row.kind === "reroll") return "smith";
	if (row.id === "q-merhaba" || row.talk === "guard") return "guard";
	if (row.talk) return row.talk;
	if (row.map && row.map !== "koy") return "herald";
	return "guard";
}
const GIVER_NAME = {
	guard: "Köy Muhafızı",
	herald: "Görevli",
	smith: "Demirci",
	fisher: "Balıkçı",
	miner: "Madenci",
	market: "Satıcı",
	stable: "Seyis",
	craft: "Üretimci",
};
export function giverLabel(id) {
	return GIVER_NAME[id] || "Görevli";
}
export function questBoardRow(quest) {
	if (!quest) return null;
	return QUEST_BOARD.find((row) => row.id === quest.id) || null;
}
export function questMatchesNpc(row, giver, mapId) {
	if (!row || !giver || questGiver(row) !== giver) return false;
	if (giver === "herald") return (row.map || "koy") === mapId;
	if (giver === "guard") return !row.map || row.map === "koy";
	return true;
}
function trackOf(quest) {
	if (!quest) return "av";
	if (quest.track) return quest.track;
	return QUEST_BOARD.find((row) => row.id === quest.id)?.track || "av";
}
export function nextStoryRow(quests) {
	const list = quests || [];
	const owned = new Set(list.map((quest) => quest.id));
	const claimed = new Set(list.filter((quest) => quest.claimed).map((quest) => quest.id));
	let last = -1;
	QUEST_BOARD.forEach((row, index) => {
		if (row.track === "ana" && claimed.has(row.id)) last = index;
	});
	return QUEST_BOARD.find((row, index) => row.track === "ana" && index > last && !owned.has(row.id)) || null;
}
function questFinished(quest) {
	if (!quest || quest.claimed) return false;
	return Boolean(quest.done) || (quest.need > 0 && quest.have >= quest.need);
}
export function questMapFor(giver, mentor) {
	if (giver !== "herald") return "koy";
	if (mentor && REALMS.some((row) => row.id === mentor)) return mentor;
	const here = realmAt(readSim().x, readSim().z).id;
	return here && here !== "koy" ? here : "koy2";
}
export function offerForNpc(quests, level, giver, mapId) {
	if (!giver) return null;
	const list = quests || [];
	const owned = new Set(list.map((quest) => quest.id));
	const openTrack = (track) => list.some((quest) => !quest.claimed && trackOf(quest) === track);
	const main = nextStoryRow(quests);
	if (main && !openTrack("ana") && level >= main.min && questMatchesNpc(main, giver, mapId)) return main;
	const openYan = list.some((quest) => !quest.claimed && trackOf(quest) === "yan" && quest.kind !== "meteor");
	if (!openYan) {
		const horseReady = list.some((quest) => quest.id === "q-at" && quest.claimed);
		const side = QUEST_BOARD.find((row) => {
			if (row.id === "q-terbiye" && !horseReady) return false;
			return row.track === "yan" && row.kind !== "meteor" && !owned.has(row.id) && level >= row.min && questMatchesNpc(row, giver, mapId);
		}) || null;
		if (side) return side;
	}
	if (main && level < main.min && questMatchesNpc(main, giver, mapId)) return null;
	return null;
}
export function readyForNpc(quests, giver, mapId) {
	return (quests || []).find((quest) => questFinished(quest) && questMatchesNpc(questBoardRow(quest), giver, mapId)) || null;
}
export function storyLockForNpc(quests, level, giver, mapId) {
	if (!giver || (quests || []).some((quest) => !quest.claimed && trackOf(quest) === "ana")) return null;
	const story = nextStoryRow(quests);
	if (!story || level >= story.min || !questMatchesNpc(story, giver, mapId)) return null;
	return story;
}
export function activeForNpc(quests, giver, mapId) {
	return (quests || []).find((quest) => !quest.claimed && questMatchesNpc(questBoardRow(quest), giver, mapId)) || null;
}
function giverSpot(giver, mapId, label) {
	const spot = (x, z, role) => ({ x, z, label, kind: "npc", role });
	if (giver === "smith") return spot(-15.05, 18.35, "smith");
	if (giver === "market") return spot(-12.95, 19.85, "market");
	if (giver === "stable") return spot(16.6, 16.4, "stable");
	if (giver === "fisher") return spot(FISHER_STAND.x, FISHER_STAND.z, "fisher");
	if (giver === "miner") return spot(70, 10, "miner");
	if (giver === "craft") return spot(-18, 8, "craft");
	if (giver === "guard") return spot(2.2, 2.5, "guard");
	const herald = realmHerald(mapId || "koy2");
	return { x: herald.x, z: herald.z, label, kind: "npc", role: "herald" };
}
export function questGuide(px, pz) {
	const state = useRpg.getState();
	const here = realmAt(px, pz);
	const boardOf = (quest) => QUEST_BOARD.find((row) => row.id === quest.id);
	const open = state.quests.filter((quest) => !quest.claimed);
	let quest = null;
	let row = null;
	if (open.length) {
		const unfinished = open.filter((item) => !item.done && !(item.need > 0 && item.have >= item.need));
		const local = unfinished.find((item) => (boardOf(item)?.map || item.map) === here.id);
		quest = local || unfinished[0] || open.find((item) => item.done || (item.need > 0 && item.have >= item.need)) || open[0];
		row = boardOf(quest);
	} else {
		const story = nextStoryRow(state.quests);
		const side = QUEST_BOARD.find((item) => item.track === "yan" && !state.quests.some((quest) => quest.id === item.id) && state.level >= item.min);
		if (story && state.level >= story.min) row = story;
		else if (side) row = side;
	}
	if (!row && !quest) return null;
	const giver = questGiver(row);
	const kind = row?.kind || quest?.kind || "kill";
	const done = Boolean(quest && (quest.done || (quest.need > 0 && quest.have >= quest.need)));
	const atNpc = !quest || done || kind === "talk" || kind === "bring" || kind === "sell" || kind === "stall" || kind === "list" || kind === "sale" || kind === "plus6" || kind === "plus10" || kind === "enchant" || kind === "reroll" || kind === "craft";
	const home = giver === "herald" ? (row?.map || quest?.map || "koy2") : "koy";
	const hunt = row?.map || quest?.map || "koy";
	const mapId = atNpc ? home : hunt;
	if (here.id !== mapId) {
		const dest = REALMS.find((item) => item.id === mapId) || REALMS[0];
		const gate = realmGate(here.id);
		return { x: gate.x, z: gate.z, label: `Işınlayıcı · ${dest.name}`, kind: "gate", role: "gate" };
	}
	const label = done ? `${giverLabel(giver)} · teslim` : (row?.name || "Görev");
	if (atNpc) return giverSpot(giver, mapId, label);
	if (kind === "fish") return giverSpot("fisher", mapId, "Balık tut");
	if (kind === "mine") return { x: 96, z: 40, label: "Maden", kind: "mob" };
	if (kind === "meteor") {
		const ids = quest?.meteors || row?.meteors || [];
		const seen = new Set(quest?.seen || []);
		const spots = meteorSpots().filter((spot) => spot.realm === mapId && ids.includes(spot.id) && !seen.has(spot.id));
		const list = spots.length ? spots : meteorSpots().filter((spot) => ids.includes(spot.id));
		if (!list.length) return giverSpot(giver, mapId, label);
		let best = list[0];
		let bestD = Infinity;
		for (const spot of list) {
			const d = (spot.x - px) * (spot.x - px) + (spot.z - pz) * (spot.z - pz);
			if (d < bestD) {
				bestD = d;
				best = spot;
			}
		}
		const tag = best.live ? best.name : `${best.name} · beliriyor`;
		return { x: best.x, z: best.z, label: tag, kind: "rock" };
	}
	const points = [];
	const mob = quest?.mob || row?.mob;
	for (const spot of campSpawns()) {
		if (spot.realm === mapId && spot.specId === mob) points.push(spot);
	}
	for (const boss of BOSSES) {
		if (boss.realm === mapId && boss.id === mob) points.push(boss);
	}
	if (!points.length) return giverSpot(giver, mapId, label);
	let best = points[0];
	let bestD = Infinity;
	for (const spot of points) {
		const d = (spot.x - px) * (spot.x - px) + (spot.z - pz) * (spot.z - pz);
		if (d < bestD) {
			bestD = d;
			best = spot;
		}
	}
	return { x: best.x, z: best.z, label: BOSSES.some((boss) => boss.x === best.x && boss.z === best.z) ? `${BOSSES.find((boss) => boss.x === best.x && boss.z === best.z)?.name || "Boss"} zindan kapısı` : (row?.name || "Hedef"), kind: "mob" };
}
export function questLevelLock() {
	const state = useRpg.getState();
	const owned = new Set(state.quests.map((quest) => quest.id));
	const storyOpen = state.quests.some((quest) => !quest.claimed && trackOf(quest) === "ana");
	const story = storyOpen ? null : nextStoryRow(state.quests);
	if (story && state.level < story.min) return `${story.name}: görevi almak için ${story.min}. seviye olman gerekiyor`;
	if (state.quests.some((quest) => !quest.claimed) || (story && state.level >= story.min)) return "";
	const ready = QUEST_BOARD.some((item) => !owned.has(item.id) && state.level >= item.min);
	if (ready) return "";
	const next = QUEST_BOARD.find((item) => !owned.has(item.id) && state.level < item.min);
	if (!next) return "";
	return `${next.name}: görevi almak için ${next.min}. seviye olman gerekiyor`;
}
function npcOffers(state, giver, mapId) {
	if (readyForNpc(state.quests, giver, mapId)) return true;
	if (offerForNpc(state.quests, state.level, giver, mapId)) return true;
	const active = activeForNpc(state.quests, giver, mapId);
	if (!active || active.claimed) return false;
	const done = active.done || (active.need > 0 && active.have >= active.need);
	if (done) return true;
	const kind = active.kind || "";
	return kind === "talk" || kind === "bring" || kind === "sell" || kind === "stall" || kind === "list" || kind === "sale" || kind === "plus6" || kind === "plus10" || kind === "enchant" || kind === "reroll" || kind === "craft";
}
export function questNpcMarks() {
	const state = useRpg.getState();
	const here = realmAt(readSim().x, readSim().z);
	const marks = [];
	for (const giver of ["guard", "smith", "market", "stable", "fisher", "miner", "craft"]) {
		if (!npcOffers(state, giver, "koy")) continue;
		marks.push(giverSpot(giver, "koy", giverLabel(giver)));
	}
	if (here.id !== "koy" && npcOffers(state, "herald", here.id)) marks.push(giverSpot("herald", here.id, giverLabel("herald")));
	return marks;
}
export const GATE_COST = { koy: 100, koy2: 500, dolunay: 1500, ay: 4000, abis: 7500, kanli: 12000, kiyamet: 18000 };
const SLOT_STONES = {
	weapon: ["tas-silah", "Silah Taşı"],
	armor: ["tas-zirh", "Zırh Taşı"],
	helmet: ["tas-kask", "Miğfer Taşı"],
	belt: ["tas-kemer", "Kemer Taşı"],
	gloves: ["tas-eldiven", "Eldiven Taşı"],
	boots: ["tas-cizme", "Çizme Taşı"]
};
function isAccessorySlot(slot) {
	return slot === "ring" || slot === "necklace" || slot === "earring" || slot === "bracelet";
}
function accessoryStone(plus) {
	if (plus >= 7) return { id: "tas-aksesuar-efsanevi", name: "Efsanevi Aksesuar Taşı" };
	if (plus >= 4) return { id: "tas-aksesuar-kati", name: "Katı Aksesuar Taşı" };
	return { id: "tas-aksesuar-kirik", name: "Kırık Aksesuar Taşı" };
}
function accessoryTierOf(id) {
	const low = String(id || "").toLocaleLowerCase("tr");
	const family = low.startsWith("tas-aksesuar-") || low.startsWith("tas-yuzuk-") || low.startsWith("tas-kolye-") || low.startsWith("tas-kupe-") || low.startsWith("tas-bilezik-");
	if (!family) return "";
	if (low.includes("efsane")) return "efsanevi";
	if (low.includes("kat")) return "kati";
	return "kirik";
}
export function matForPlus(plus, slot = "weapon") {
	if (isAccessorySlot(slot)) return { ...accessoryStone(plus), slot };
	const pair = SLOT_STONES[slot] || SLOT_STONES.weapon;
	const tier = plus >= 7 ? "Efsane" : plus >= 4 ? "Katı" : "Kırık";
	return { id: `${pair[0]}-${tier.toLowerCase()}`, name: `${tier} ${pair[1]}`, slot };
}
const BOSS_NAMES = BOSSES.map((row) => row.name);
function rollEnchant(slot, existing = []) {
	const used = new Set(existing.map((row) => `${row.stat}:${row.boss || ""}`));
	const armor = slot === "helmet" || slot === "armor" || slot === "boots" || slot === "gloves" || slot === "belt";
	const access = slot === "earring" || slot === "necklace" || slot === "bracelet" || slot === "ring";
	const pct = () => 8 + Math.floor(Math.random() * 8);
	const pool = [];
	if (slot === "weapon") {
		pool.push({ name: "Canavarlara Karşı Güçlü", stat: "mob", value: pct() });
		const boss = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];
		pool.push({ name: `${boss} Karşı Güçlü`, stat: "boss", value: pct(), boss });
		pool.push({ name: "Saldırı Hızı", stat: "ats", value: pct() });
		pool.push({ name: "Kritik Vuruş", stat: "ctp", value: pct() });
	} else if (armor) {
		pool.push({ name: "HP", stat: "hp", value: 1000 + Math.floor(Math.random() * 2001) });
		pool.push({ name: "Mana", stat: "mana", value: 500 + Math.floor(Math.random() * 1001) });
		pool.push({ name: "Hareket Hızı", stat: "mvs", value: pct() });
		pool.push({ name: "Savunma", stat: "def", value: pct() });
		pool.push({ name: "Saldırı Gücü", stat: "str", value: pct() });
	} else if (access) {
		pool.push({ name: "Kritik Vuruş", stat: "ctp", value: pct() });
		pool.push({ name: "HP", stat: "hp", value: 1000 + Math.floor(Math.random() * 2001) });
		pool.push({ name: "Mana", stat: "mana", value: 500 + Math.floor(Math.random() * 1001) });
		pool.push({ name: "Hareket Hızı", stat: "mvs", value: pct() });
	} else pool.push({ name: "HP", stat: "hp", value: 1000 });
	const fresh = pool.filter((row) => !used.has(`${row.stat}:${row.boss || ""}`));
	if (!fresh.length) return null;
	return fresh[Math.floor(Math.random() * fresh.length)];
}
function rewardItem(name, plus) {
	const n = String(name).toLocaleLowerCase("tr");
	const slot = /kılıç|kılınç|balta|yay|asa|hançer/.test(n) ? "weapon" : /zırh|kalkan|post|pelerin/.test(n) ? "armor" : /miğfer|kask/.test(n) ? "helmet" : /kemer/.test(n) ? "belt" : /çizme/.test(n) ? "boots" : /eldiven/.test(n) ? "gloves" : /kolye|boynuz/.test(n) ? "necklace" : /küpe/.test(n) ? "earring" : /bilezik/.test(n) ? "bracelet" : "ring";
	const power = 6 + Math.min(40, plus * 4);
	const limited = slot === "weapon" || slot === "armor" || slot === "helmet" || slot === "belt";
	const forClass = limited ? useRpg.getState().classId : "hepsi";
	return {
		uid: uid(),
		id: `odul-${n.replace(/\s+/g, "-")}`,
		name,
		slot,
		level: 1,
		plus,
		str: slot === "weapon" ? 8 + power : 2,
		hp: slot === "armor" ? 20 + power : 4,
		ats: 0,
		mvs: slot === "boots" ? 4 : 0,
		ctp: 0,
		desc: classLine(slot, forClass),
		kind: "gear",
		forClass,
		enchants: []
	};
}
function gearDrop(level) {
	const classes = ["savasci", "okcu", "buyucu", "ninja"];
	const cls = classes[Math.floor(Math.random() * classes.length)];
	const weapons = {
		savasci: ["Avcı Kılıcı", "sword-av"],
		okcu: ["Avcı Yayı", "bow-av"],
		buyucu: ["Avcı Asası", "staff-av"],
		ninja: ["Avcı Hançeri", "dagger-av"]
	};
	const slots = [
		{ slot: "weapon", name: weapons[cls][0], id: weapons[cls][1], forClass: cls },
		{ slot: "armor", name: "Avcı Zırhı", id: "armor-av", forClass: cls },
		{ slot: "helmet", name: "Avcı Miğferi", id: "helm-av", forClass: cls },
		{ slot: "belt", name: "Avcı Kemeri", id: "belt-av", forClass: cls },
		{ slot: "boots", name: "Avcı Çizmesi", id: "boots-av", forClass: "hepsi" },
		{ slot: "ring", name: "Avcı Yüzüğü", id: "ring-av", forClass: "hepsi" },
		{ slot: "necklace", name: "Avcı Kolyesi", id: "neck-av", forClass: "hepsi" },
		{ slot: "earring", name: "Avcı Küpesi", id: "ear-av", forClass: "hepsi" },
		{ slot: "bracelet", name: "Avcı Bilekliği", id: "br-av", forClass: "hepsi" },
		{ slot: "gloves", name: "Avcı Eldiveni", id: "glove-av", forClass: "hepsi" }
	];
	const pick = slots[Math.floor(Math.random() * slots.length)];
	const power = 12 + Math.floor(level * 1.35);
	return {
		uid: uid(),
		id: pick.id,
		name: pick.name,
		slot: pick.slot,
		level,
		plus: rollDropPlus(),
		str: pick.slot === "weapon" ? 14 + power : 4 + Math.floor(level / 4),
		hp: pick.slot === "armor" || pick.slot === "helmet" ? 28 + power * 2 : 8 + Math.floor(level / 3),
		ats: pick.slot === "weapon" ? 2 + Math.floor(level / 12) : 0,
		mvs: pick.slot === "boots" ? 4 + Math.floor(level / 15) : 0,
		ctp: pick.slot === "gloves" || pick.slot === "ring" ? 1 + Math.floor(level / 20) : 0,
		desc: classLine(pick.slot, pick.forClass),
		kind: "gear",
		forClass: pick.forClass,
		req: level,
		enchants: rollDropEnchants(pick.slot)
	};
}
function rollDropPlus() {
	const roll = Math.random();
	if (roll < 0.07) return 3;
	if (roll < 0.2) return 2;
	if (roll < 0.45) return 1;
	return 0;
}
function rollEnchantCount() {
	const roll = Math.random();
	if (roll < 0.01) return 5;
	if (roll < 0.03) return 4;
	if (roll < 0.06) return 3;
	if (roll < 0.1) return 2;
	if (roll < 0.15) return 1;
	return 0;
}
function rollDropEnchants(slot) {
	const count = rollEnchantCount();
	const list = [];
	for (let n = 0; n < count; n++) {
		const row = rollEnchant(slot, list);
		if (!row) break;
		list.push(row);
	}
	return list;
}
function tidyItem(item) {
	if (!item) return item;
	const next = item.id === "kazma" ? { ...item, level: 8, req: 8 } : { ...item };
	if ((!next.kind || next.kind === "gear") && next.id !== "starter-chest" && next.id !== "boss-sandik") {
		const lv = Math.max(1, Math.floor(Number(next.level) || 1));
		next.level = lv;
		next.req = Math.max(lv, Math.floor(Number(next.req) || 1));
	}
	if (Array.isArray(next.enchants)) next.enchants = dedupeEnchants(next.enchants);
	return next;
}
function itemNeed(it) {
	if (!it) return 1;
	if (it.id === "kazma") return 8;
	if (it.kind && it.kind !== "gear" && it.kind !== "tool") return Math.max(1, Math.floor(Number(it.req) || 1));
	const lv = Math.max(1, Math.floor(Number(it.level) || 1));
	const req = Math.max(1, Math.floor(Number(it.req) || 1));
	return Math.max(req, lv);
}
function matDrop(level) {
	const slots = ["weapon", "armor", "helmet", "belt", "boots", "gloves", "ring"];
	const slot = slots[Math.floor(Math.random() * slots.length)];
	const plus = level >= 40 ? 7 : level >= 18 ? 4 : 0;
	const row = matForPlus(plus, slot);
	return {
		uid: uid(),
		id: row.id,
		name: row.name,
		slot: "belt",
		level: 1,
		plus: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: `${row.name}. Yükseltme taşı, kuşanılmaz.`,
		kind: "mat",
		count: 1
	};
}
function catalogItem(id) {
	const row = CATALOG.find((item) => item.id === id);
	if (!row) return null;
	return {
		...row,
		uid: uid(),
		level: row.level || 1,
		plus: 0,
		count: 1,
		enchants: []
	};
}
function matFits(it, gear) {
	if (!it || it.kind !== "mat" || it.id === "guc-tasi") return false;
	const plus = gear?.plus ?? 0;
	if (plus < 6) return true;
	const need = matForPlus(plus, gear.slot);
	if (it.id === need.id) return true;
	if (!isAccessorySlot(gear.slot)) return false;
	const have = accessoryTierOf(it.id);
	return Boolean(have) && have === accessoryTierOf(need.id);
}
function attachSmith(bag, item, stone, mat) {
	let nextStone = stone;
	let nextMat = mat;
	if (item && !nextStone) {
		const i = bag.findIndex((it) => it && it.id === "guc-tasi" && (it.count ?? 1) > 0);
		if (i >= 0) {
			const it = bag[i];
			const left = (it.count ?? 1) - 1;
			bag[i] = left > 0 ? { ...it, count: left } : null;
			nextStone = { ...it, count: 1, uid: uid() };
		}
	}
	if (item && !nextMat) {
		const plus = item.plus ?? 0;
		const need = matForPlus(plus, item.slot);
		const i = bag.findIndex((it) => matFits(it, item) && (plus < 6 || it.id === need.id));
		if (i >= 0) {
			const it = bag[i];
			const left = (it.count ?? 1) - 1;
			bag[i] = left > 0 ? { ...it, count: left } : null;
			nextMat = { ...it, count: 1, uid: uid() };
		}
	}
	return { smithStone: nextStone, smithMat: nextMat };
}
function dedupeEnchants(list) {
	const seen = new Set();
	const out = [];
	for (const row of list || []) {
		const key = `${row.stat}:${row.boss || ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(row);
	}
	return out;
}
function potTier(id) {
	const key = String(id || "");
	if (key.endsWith("-l")) return 200;
	if (key.endsWith("-m")) return 100;
	if (key === "pot-hp" || key === "pot-mp") return 50;
	return 50;
}
function rollPot(kind) {
	const roll = Math.random();
	const tier = roll < 0.62 ? "s" : roll < 0.9 ? "m" : "l";
	return catalogItem(`pot-${kind}-${tier}`);
}
export const LOOT_BAND = {
	koy: [1, 20],
	koy2: [20, 40],
	dolunay: [40, 55],
	ay: [55, 70],
	abis: [70, 82],
	kanli: [80, 92],
	kiyamet: [90, 99]
};
export function lootBandAllows(realmId, playerLevel) {
	const band = LOOT_BAND[realmId];
	if (!band) return true;
	const lv = Math.max(1, Math.floor(Number(playerLevel) || 1));
	return lv >= band[0] && lv <= band[1];
}
export function rollKillLoot(level, boss, playerLevel = level, realmId = "") {
	if (realmId && !lootBandAllows(realmId, playerLevel)) return [];
	const gap = Math.max(0, Math.floor(playerLevel || level) - Math.floor(level));
	const near = Math.pow(0.62, Math.min(16, gap));
	const out = [];
	if (Math.random() < (boss ? 0.62 : 0.28) * near) out.push(gearDrop(level));
	if (boss && Math.random() < 0.24 * near) out.push(gearDrop(Math.max(1, level - 1)));
	if (Math.random() < (boss ? 0.22 : 0.07) * Math.max(0.2, near)) {
		const pot = rollPot(Math.random() < 0.5 ? "hp" : "mp");
		if (pot) out.push(pot);
	}
	return out;
}
export function meteorLoot(level, playerLevel = level, realmId = "") {
	if (realmId && !lootBandAllows(realmId, playerLevel)) return [];
	const out = [];
	if (Math.random() < 0.32) out.push(matDrop(level));
	if (Math.random() < 0.06) out.push(matDrop(level));
	if (Math.random() < 0.22) out.push(gearDrop(level));
	if (Math.random() < 0.01) {
		const stone = catalogItem("guc-tasi");
		if (stone) out.push(stone);
	}
	if (Math.random() < 0.02) {
		const books = ["kitap-surat", "kitap-soluk", "kitap-cifte"];
		const book = catalogItem(books[Math.floor(Math.random() * books.length)]);
		if (book) out.push(book);
	}
	return out;
}
export function bossChestItem(name, level) {
	const loot = [];
	loot.push(gearDrop(level));
	if (Math.random() < 0.4) loot.push(gearDrop(Math.max(1, level - 2)));
	const pot = rollPot(Math.random() < 0.5 ? "hp" : "mp");
	if (pot) loot.push(pot);
	return {
		uid: uid(),
		id: "boss-sandik",
		name: `${name} Sandığı`,
		slot: "belt",
		level: 1,
		plus: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Çift tıkla. İçindeki eşyalar envantere dökülür.",
		kind: "chest",
		loot
	};
}
export function dropTable(level) {
	return [
		`Sv.${level} giyilebilir eşya`,
		"Bot, eldiven ve takı",
		"İksir",
		"+0 ile +3 ve seyrek efsun"
	];
}
export function claimWeekly(place) {
	const now = new Date();
	if (now.getDay() !== 1) return;
	const start = new Date(now.getFullYear(), 0, 1);
	const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
	const key = `${now.getFullYear()}-W${week}`;
	const s = useRpg.getState();
	if (s.weekClaim === key) return;
	if (place < 1 || place > 3) return;
	const plus = place === 1 ? 10 : place === 2 ? 6 : 3;
	const gold = place === 1 ? 10000 : place === 2 ? 7000 : 5000;
	const names = ["Haftanın Kılıcı", "Haftanın Zırhı", "Haftanın Miğferi"];
	const item = rewardItem(names[place - 1], plus);
	item.plus = plus;
	item.level = Math.max(item.level, s.level);
	const ok = tryReceiveItem(item);
	useRpg.getState().addGold(gold);
	useRpg.setState({ weekClaim: key, toast: ok ? `Haftalık ödül: +${plus} eşya ve ${gold} altın` : `Haftalık ${gold} altın. Eşya sığmadı.` });
}
export function saleGold(it) {
	if (!it) return 0;
	const base = it.price || 24 + (it.level || 1) * 9 + (it.str || 0) * 4 + (it.hp || 0) * 1.2;
	const plus = 1 + (it.plus || 0) * 0.4;
	return Math.max(4, Math.round(base * 0.7 * plus)) * (it.count ?? 1);
}
export function tryReceiveItem(item) {
	if (!item) return false;
	const s = useRpg.getState();
	const bag = s.bag.slice();
	const limit = openBagCount(s.bagStage);
	const stackable = item.kind === "mat" || item.kind === "potion" || item.kind === "fish" || item.kind === "book" || item.id === "yem" || item.id === "guc-tasi";
	if (item.kind === "potion" && (String(item.id).startsWith("pot-hp") || String(item.id).startsWith("pot-mp"))) {
		const key = String(item.id).startsWith("pot-mp") ? "mp" : "hp";
		const belt = s.pots?.[key];
		if (belt && belt.id === item.id && (belt.count ?? 1) < 200) {
			const count = Math.min(200, (belt.count ?? 1) + (item.count ?? 1));
			useRpg.setState({ pots: { ...s.pots, [key]: { ...belt, count } } });
			systemSay(`${item.name} iksir yuvasına eklendi`);
			return true;
		}
	}
	if (stackable) {
		const stack = bag.findIndex((slot, i) => i < limit && slot?.id === item.id && (slot.count ?? 1) < 200);
		if (stack >= 0) {
			const have = bag[stack].count ?? 1;
			const add = item.count ?? 1;
			if (have + add <= 200) {
				bag[stack] = { ...bag[stack], count: have + add };
				useRpg.setState({ bag });
				systemSay(`${item.name} x${add}`);
				return true;
			}
		}
	}
	const hole = bag.findIndex((slot, i) => i < limit && slot == null);
	if (hole < 0) {
		useRpg.setState({ toast: "Envanterinde yer yok" });
		return false;
	}
	bag[hole] = item;
	useRpg.setState({ bag });
	systemSay(`${item.name} alındı`);
	return true;
}
export function bagRoom(item?: { id?: string; kind?: string; count?: number } | null) {
	const s = useRpg.getState();
	const limit = openBagCount(s.bagStage);
	const count = item?.count ?? 1;
	const stackable = item && (item.kind === "mat" || item.kind === "potion" || item.kind === "fish" || item.kind === "book" || item.id === "yem" || item.id === "guc-tasi");
	if (stackable && item?.id) {
		const stack = s.bag.findIndex((slot, i) => i < limit && slot?.id === item.id && (slot.count ?? 1) + count <= 200);
		if (stack >= 0) return true;
	}
	return s.bag.some((slot, i) => i < limit && slot == null);
}
const HORSE_COATS = [
	{ id: "doru", name: "Doru", coat: "#6a3b22", mane: "#1a120e", dark: "#241810", muzzle: "#8a5340" },
	{ id: "siyah", name: "Siyah", coat: "#1c1916", mane: "#0a0908", dark: "#0e0c0a", muzzle: "#3a3028" },
	{ id: "al", name: "Al", coat: "#8a3a22", mane: "#2a140e", dark: "#3a1c14", muzzle: "#c4846a" },
	{ id: "kir", name: "Kır", coat: "#c8c2b6", mane: "#4e4a44", dark: "#6a6560", muzzle: "#ddd6ca" },
	{ id: "izabel", name: "İzabel", coat: "#c4a05a", mane: "#f4f0e6", dark: "#8a6840", muzzle: "#e6d2a8" },
	{ id: "yagiz", name: "Yağız", coat: "#3a2418", mane: "#120e0c", dark: "#1a100c", muzzle: "#6a4030" },
	{ id: "demirkir", name: "Demirkır", coat: "#6e7378", mane: "#1a1c1e", dark: "#3a3e42", muzzle: "#9aa0a4" }
];
function horseCoat(id) {
	return HORSE_COATS.find((row) => row.id === id) || HORSE_COATS[0];
}
export const MOUNT_SKILLS: { id: "surat" | "soluk" | "cifte"; book: string; name: string; line: string }[] = [
	{ id: "surat", book: "kitap-surat", name: "Sürat", line: "Binince hızın artar." },
	{ id: "soluk", book: "kitap-soluk", name: "Soluk", line: "Binince dayanıklılık daha geç biter." },
	{ id: "cifte", book: "kitap-cifte", name: "Çifte", line: "Binince yakındaki yaratığa tekme atar." }
];
export function blankMountSkills() {
	return { surat: 0, soluk: 0, cifte: 0 };
}
export function clampMountSkills(raw) {
	const n = (value) => Math.max(0, Math.min(SKILL_MAX, Math.floor(Number(value) || 0)));
	return {
		surat: n(raw?.surat),
		soluk: n(raw?.soluk),
		cifte: n(raw?.cifte)
	};
}
function mountSkillOf(id) {
	return MOUNT_SKILLS.find((row) => row.book === id) || null;
}
function horseItem(coat) {
	const look = coat || HORSE_COATS[0];
	return {
		uid: uid(),
		id: "binek-at",
		name: `${look.name} At`,
		slot: "belt",
		level: 1,
		plus: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 8,
		ctp: 0,
		desc: "At yuvasına takılır. H ile binilir, inince yuvada kalır.",
		kind: "mount",
		req: 1,
		forClass: "hepsi",
		coatId: look.id
	};
}
function ownsHorse(s) {
	return Boolean(s.steed) || Boolean(s.mountItem) || s.bag?.some((item) => item?.kind === "mount" || item?.id === "binek-at") || s.quests?.some((quest) => quest.id === "q-at" && quest.claimed);
}
function enchantMods(s) {
	const out = { hp: 0, mana: 0, ats: 0, ctp: 0, mvs: 0, def: 0, str: 0, mob: 0, bosses: {} };
	for (const it of Object.values(s.equipped || {})) {
		if (!it?.enchants) continue;
		for (const row of it.enchants) {
			if (row.stat === "boss") out.bosses[row.boss || row.name] = (out.bosses[row.boss || row.name] || 0) + row.value;
			else if (out[row.stat] != null) out[row.stat] += row.value;
		}
	}
	return out;
}
export function enchantView(s): { hp: number; mana: number; ats: number; ctp: number; mvs: number; def: number; str: number; mob: number; bosses: Record<string, number> } {
	return enchantMods(s);
}
function questBrief(row) {
	if (!row) return "";
	const map = REALMS.find((item) => item.id === row.map)?.name || "Ana Köy";
	const who = giverLabel(questGiver(row));
	const boss = BOSSES.find((item) => item.id === row.mob);
	if (row.id === "q-terbiye") return `${map} bölgesinde ${row.need} ${row.name} kes. Bitince Seyis bir Sürat Kitabı verir. Kitabı Binek Geliştir sekmesinde ata bas. Son basamak S+.`;
	if (row.kind === "kill" && boss) return `${map} haritasında yerdeki mavi halkadan geç. Havada duran yuvarlak zeminde 5 dalga var: ilk üç dalga 3 yaratık, 4. dalga 4 yaratık, 5. dalgada yalnız ${boss.name}. Her dalga bir öncekinden güçlüdür ve üstüne koşar. Boss düşünce kapının önüne dönersin. Sonra ${who} teslim alır.`;
	if (row.kind === "kill") return `${map} bölgesinde ${row.need} ${row.name} kes. Sarı ok sürüyü gösterir. Bitince ${who} teslim alır.`;
	if (row.kind === "talk") return `${who} ile konuş. Sarı ok onu gösterir. Konuşunca görev ilerler.`;
	if (row.kind === "fish") return `Balıkçıdan olta ve yem al. Oltayı kuşan, iskelede Space ile at. İğne yeşil çizgideyken tekrar Space. ${row.need} balık tut. ${who} teslim alır.`;
	if (row.kind === "mine") return `Madenciden kazmayı al. Seviye 8 yeter. Damarın üstüne gel, kazmayı kuşan, Space ile kaz. ${row.need} maden çıkar. ${who} teslim alır.`;
	if (row.kind === "sell") return `Fazla eşyayı Satıcı penceresine sürükleyip sat. Bir satış yeter. ${who} teslim alır.`;
	if (row.kind === "stall") return `Satıcıdan Pazar al ve kullan. Tezgah açılınca görev ilerler. ${who} teslim alır.`;
	if (row.kind === "list") return `Kendi tezgahında boş yuvaya eşya sürükle, fiyatı yaz, Tamam de. ${who} teslim alır.`;
	if (row.kind === "sale") return `Başka bir oyuncunun tezgahından bir eşya alınca biter. Sağ tık, evet de. ${who} teslim alır.`;
	if (row.kind === "plus6") return `Demirciye eşyayı sürükle. Güç taşı ve yükseltme taşı çantadan kendisi gelir. Aynı eşyayı +6 yap. ${who} teslim alır.`;
	if (row.kind === "plus10") return `Seviye 70 şart. Demircide aynı eşyayı +10 yap. +7 sonrası taşın adı parçayla aynı olmalı. ${who} teslim alır.`;
	if (row.kind === "enchant") return `Satıcıdan Mistik Efsun al. Eşyanın üstüne sürükle. 5 efsun dolunca biter. ${who} teslim alır.`;
	if (row.kind === "reroll") return `Mistik Değiştiriciyi efsunlu eşyanın üstüne sürükle. Efsunlar yenilenir. ${who} teslim alır.`;
	if (row.kind === "craft") return `Üretimcide tarif seç. İstenen madenler çantanda olsun, üret. ${who} teslim alır.`;
	if (row.kind === "meteor") {
		const names = (row.meteors || []).map((id) => meteorSpots().find((spot) => spot.id === id)?.name || id);
		const list = names.length ? names.join(", ") : "adlı meteor";
		return `${map} haritasında yalnız ${list} kırılacak. Başka meteorlar sayılmaz. Taşı sol tıkla, karakter yanına gidip vurur. Bitince ${who} teslim alır.`;
	}
	return `${row.name}. Bitince ${who} teslim alır. Haritadaki sarı ok yolu gösterir.`;
}
function questFromBoard(row) {
	const kind = row.kind || "kill";
	const detail = questBrief(row);
	const title = row.title || row.name;
	return {
		id: row.id,
		title: row.track === "ana" ? `Ana · ${title}` : row.track === "yan" ? `Yan · ${title}` : `Av · ${title}`,
		detail,
		need: row.need,
		have: 0,
		kind,
		mob: row.meteors?.[0] || row.mob,
		meteors: row.meteors || [],
		talk: row.talk,
		track: row.track || "av",
		map: row.map,
		done: false,
		claimed: false,
		seen: [],
		minLevel: row.min,
		xpReward: row.xp,
		goldReward: row.gold,
		rewardName: row.reward
	};
}
function ensureQuest(get, set) {
	const s = get();
	const owned = new Set(s.quests.map((quest) => quest.id));
	const add = [];
	if (!s.quests.some((quest) => !quest.claimed && trackOf(quest) === "av")) {
		const row = QUEST_BOARD.find((item) => item.track === "av" && !owned.has(item.id) && s.level >= item.min);
		if (row) add.push(row);
	}
	if (!s.quests.some((quest) => !quest.claimed && (quest.kind || QUEST_BOARD.find((item) => item.id === quest.id)?.kind) === "meteor")) {
		const row = QUEST_BOARD.find((item) => item.kind === "meteor" && !owned.has(item.id) && s.level >= item.min);
		if (row) add.push(row);
	}
	if (!add.length) return;
	set({
		quests: [...s.quests, ...add.map(questFromBoard)],
		toast: s.toast && String(s.toast).startsWith("Seviye") ? s.toast : `Görev: ${add.map((row) => row.name).join(", ")}`
	});
}
function gearPlus(s) {
	let best = 0;
	const look = (item) => {
		const plus = item?.plus || 0;
		if (plus > best) best = plus;
	};
	for (const item of s.bag || []) look(item);
	for (const item of Object.values(s.equipped || {})) look(item);
	look(s.smithItem);
	return best;
}
function syncPlusQuests(get, set) {
	const s = get();
	const plus = gearPlus(s);
	if (plus < 6) return;
	let changed = false;
	let doneTitle = "";
	const quests = s.quests.map((quest) => {
		if (quest.claimed || quest.done || (quest.need > 0 && quest.have >= quest.need)) return quest;
		const kind = quest.kind || QUEST_BOARD.find((row) => row.id === quest.id)?.kind;
		const met = (kind === "plus6" && plus >= 6) || (kind === "plus10" && plus >= 10);
		if (!met) return quest;
		changed = true;
		const who = giverLabel(questGiver(QUEST_BOARD.find((row) => row.id === quest.id)));
		doneTitle = `${quest.title} hazır. Çantadaki +${plus} eşya sayıldı. ${who} teslim alır.`;
		return { ...quest, kind, have: quest.need, done: true };
	});
	if (!changed) return;
	set({ quests, toast: doneTitle });
}
function blankHotbar() {
	return Array.from({ length: 8 }, () => null);
}
function blankDepot() {
	return Array.from({ length: 24 }, () => null);
}
function withSkillQuest(_level, chosenTree, quests) {
	if (!chosenTree) return quests;
	return quests.map((quest) => quest.id === "q-skills" && !quest.claimed ? {
		...quest,
		done: true,
		claimed: true,
		have: 1
	} : quest);
}
function normalizeQuests(list) {
	return list.map((quest) => {
		const row = QUEST_BOARD.find((item) => item.id === quest.id);
		const need = quest.need || row?.need || 1;
		const meteors = row?.meteors || quest.meteors || [];
		let seen = quest.seen ?? [];
		let have = quest.have ?? 0;
		let done = Boolean(quest.done) || have >= need;
		if (row?.kind === "meteor" && !quest.claimed) {
			seen = (quest.seen ?? []).filter((id) => meteors.includes(id));
			if (quest.done && have >= need && !seen.length) {
				done = true;
				have = need;
			} else {
				have = seen.length;
				done = have >= need;
			}
		}
		return {
			...quest,
			kind: quest.kind || row?.kind || "kill",
			mob: quest.mob || row?.mob || meteors[0],
			meteors,
			talk: quest.talk || row?.talk,
			track: quest.track || row?.track || "av",
			map: quest.map || row?.map,
			need,
			have,
			title: row ? (row.track === "ana" ? `Ana · ${row.title || row.name}` : row.track === "yan" ? `Yan · ${row.title || row.name}` : `Av · ${row.title || row.name}`) : quest.title,
			detail: row ? questBrief(row) : quest.detail,
			done,
			seen,
			claimed: quest.claimed === true,
			minLevel: row?.min ?? quest.minLevel ?? 1
		};
	});
}
function parkedBag(s) {
	const bag = s.bag.slice();
	const put = (item) => {
		if (!item) return;
		if (item.kind === "book") {
			const stack = bag.findIndex((slot) => slot?.id === item.id && (slot.count ?? 1) + (item.count ?? 1) <= 200);
			if (stack >= 0) {
				bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + (item.count ?? 1) };
				return;
			}
		}
		const hole = bag.findIndex((slot) => slot == null);
		if (hole >= 0) bag[hole] = item;
	};
	put(s.smithItem);
	put(s.smithStone);
	put(s.smithMat);
	if (!s.benchWorn) put(s.benchMount);
	put(s.benchBook);
	return bag;
}
function releaseBench(s) {
	const beforeMount = s.benchWorn ? null : s.benchMount || null;
	const beforeBook = s.benchBook || null;
	if (!beforeMount && !beforeBook && !s.benchWorn) return {};
	const bag = s.bag.slice();
	const limit = openBagCount(s.bagStage);
	const put = (item) => {
		if (!item) return null;
		if (item.kind === "book") {
			const stack = bag.findIndex((slot, i) => i < limit && slot?.id === item.id && (slot.count ?? 1) + (item.count ?? 1) <= 200);
			if (stack >= 0) {
				bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + (item.count ?? 1) };
				return null;
			}
		}
		const hole = bag.findIndex((slot, i) => i < limit && slot == null);
		if (hole < 0) return item;
		bag[hole] = item;
		return null;
	};
	const mountLeft = put(beforeMount);
	const bookLeft = put(beforeBook);
	if (mountLeft === beforeMount && bookLeft === beforeBook) {
		if (s.benchWorn && !beforeMount && !beforeBook) return { benchMount: null, benchBook: null, benchWorn: false };
		return {};
	}
	return {
		bag,
		benchMount: mountLeft,
		benchBook: bookLeft,
		benchWorn: false
	};
}
function releaseWork(s) {
	const smith = releaseSmith(s);
	const bench = releaseBench({ ...s, ...smith });
	return { ...smith, ...bench };
}
function releaseSmith(s) {
	if (!s.smithItem && !s.smithStone && !s.smithMat) return {};
	const bag = s.bag.slice();
	const put = (item) => {
		if (!item) return;
		const hole = bag.findIndex((slot) => slot == null);
		if (hole >= 0) bag[hole] = item;
	};
	put(s.smithItem);
	put(s.smithStone);
	put(s.smithMat);
	return {
		bag,
		smithItem: null,
		smithStone: null,
		smithMat: null
	};
}
function bonusLive(until) {
	return until > Date.now();
}
export function captureSave() {
	const s = useRpg.getState();
	const here = readSim();
	return {
		name: s.nick,
		classId: s.classId,
		level: s.level,
		xp: s.xp,
		vials: s.vials,
		unspent: s.unspent,
		gold: s.gold,
		hp: s.hp,
		invested: s.invested,
		bag: parkedBag(s),
		equipped: s.equipped,
		skills: s.skills,
		skillPoints: s.skillPoints,
		chosenTree: s.chosenTree,
		hotbar: s.hotbar,
		pots: s.pots,
		quests: s.quests,
		depot: s.depot,
		blocked: s.blocked,
		bagStage: s.bagStage,
		wellAt: s.wellAt,
		bonusUntil: s.bonusUntil,
		stall: s.stall,
		stallSpot: s.stallSpot,
		steed: s.steed,
		mountItem: s.mountItem,
		riding: s.riding,
		mountSkills: clampMountSkills(s.mountSkills),
		greeted: s.greeted,
		mentored: s.mentored,
		fame: s.fame,
		kills: s.kills,
		mines: s.mines,
		fish: s.fish,
		damage: s.damage,
		bossKills: s.bossKills,
		duelWins: s.duelWins,
		goldEarned: s.goldEarned,
		skillBank: s.skillBank || 0,
		filledGear: s.filledGear || [],
		weekClaim: s.weekClaim || "",
		friends: friendMates(),
		starterPots: s.starterPots === true,
		stallBank: Math.max(0, Math.floor(Number(s.stallBank) || 0)),
		x: here.x,
		z: here.z
	};
}
var carry = null;
export function setCarry(next) {
	carry = next;
}
export function readCarry() {
	return carry;
}
var staClock = 0;
var hpRegenClock = 0;
var levelLockAt = 0;
var benchWarn = false;
var questClock = 0;
var staRecover = 0;
var liveSta = -1;
var liveMana = -1;
var liveHp = -1;
let levelPing = 0;
export function takeLevelPing() {
	const n = levelPing;
	levelPing = 0;
	return n;
}
var pendingCast = null;
var guardUntil = 0;
var guardCut = 0;
var stepUntil = 0;
var stepMul = 1;
var regenUntil = 0;
var reviveBoostUntil = 0;
export function takeCast() {
	const next = pendingCast;
	pendingCast = null;
	return next;
}
export function commitSkill(id) {
	const rank = useRpg.getState().skills[id] ?? 1;
	skillReadyAt[id] = Date.now() + skillWait(id, rank) * 1e3;
}
export function refundSkill(cost) {
	const s = useRpg.getState();
	const mana = Math.min(s.manaMax, s.mana + cost);
	liveMana = mana;
	useRpg.setState({ mana });
}
function payQuest(get, title, xp, gold) {
	get().grantXp(xp);
	get().addGold(gold);
	useRpg.setState({ toast: `${title} teslim edildi. +${xp} XP +${gold} altın` });
}
function bumpQuest(get, set, kind, mobId) {
	const s = get();
	let changed = false;
	let doneTitle = "";
	const quests = s.quests.map((quest) => {
		const row = QUEST_BOARD.find((item) => item.id === quest.id);
		const kindOf = quest.kind || row?.kind || "";
		const mob = quest.mob || row?.mob;
		const talk = quest.talk || row?.talk;
		if (quest.claimed || quest.done || (quest.need > 0 && quest.have >= quest.need) || kindOf !== kind) return quest;
		if (kind === "kill" && mob !== mobId) return quest;
		if (kind === "talk" && talk !== mobId) return quest;
		if (kind === "meteor") {
			const want = quest.meteors || row?.meteors || [];
			if (!mobId || !want.includes(mobId)) return quest;
			const seen = quest.seen ?? [];
			if (seen.includes(mobId)) return quest;
			changed = true;
			const have = seen.length + 1;
			const done = have >= (quest.need || 1);
			if (done) {
				const who = giverLabel(questGiver(row));
				doneTitle = `${quest.title} hazır. ${who} teslim alır.`;
			}
			return { ...quest, kind: kindOf, mob, meteors: want, seen: [...seen, mobId], have, done };
		}
		changed = true;
		const have = quest.have + 1;
		const done = have >= quest.need;
		if (done) {
			const who = giverLabel(questGiver(QUEST_BOARD.find((row) => row.id === quest.id)));
			doneTitle = `${quest.title} hazır. ${who} teslim alır.`;
		}
		return {
			...quest,
			kind: kindOf,
			mob,
			talk,
			have,
			done
		};
	});
	if (!changed) return;
	set({
		quests,
		toast: doneTitle || s.toast
	});
}
export function noteQuest(kind) {
	bumpQuest(useRpg.getState, useRpg.setState, kind);
}
function resetLiveVitals() {
	liveSta = -1;
	liveMana = -1;
	liveHp = -1;
}
function uid() {
	return Math.random().toString(36).slice(2, 9);
}
function cloneShop(def) {
	return {
		uid: uid(),
		id: def.id,
		name: def.name,
		slot: def.slot,
		level: def.level ?? def.req ?? 1,
		plus: 0,
		str: def.str,
		hp: def.hp,
		ats: def.ats,
		mvs: def.mvs,
		ctp: def.ctp,
		desc: def.desc,
		kind: def.kind ?? "gear",
		count: def.kind && def.kind !== "gear" ? 1 : void 0,
		req: def.req,
		forClass: def.forClass
	};
}
function rememberFill(prev, next) {
	const seen = new Set(next.filledGear || []);
	let fillHp = false;
	let fillMana = false;
	for (const slot of Object.keys(next.equipped || {})) {
		const it = next.equipped[slot];
		const old = prev.equipped?.[slot];
		if (!it || it.uid === old?.uid) continue;
		if (seen.has(it.uid)) continue;
		seen.add(it.uid);
		if ((it.hp || 0) > 0 || (it.enchants || []).some((row) => row.stat === "hp")) fillHp = true;
		if ((it.enchants || []).some((row) => row.stat === "mana")) fillMana = true;
	}
	next.filledGear = [...seen];
	if (fillHp && next.hpMax > (prev.hpMax || 0) + 0.5) {
		next.hp = next.hpMax;
		liveHp = next.hp;
	}
	if (fillMana && next.manaMax > (prev.manaMax || 0) + 0.5) {
		next.mana = next.manaMax;
		liveMana = next.mana;
	}
}
function applyVitals(s, fill) {
	const t = totalsOf(s);
	s.hpMax = 380 + t.hp + enchantMods(s).hp;
	s.manaMax = 50 + s.level * 8 + (s.invested?.mana || 0) * 8 + enchantMods(s).mana;
	s.staMax = Math.round(90 + t.mvs * 1.2);
	if (fill) {
		s.hp = s.hpMax;
		s.mana = s.manaMax;
		s.sta = s.staMax;
		liveHp = s.hp;
		liveMana = s.mana;
		liveSta = s.sta;
	} else {
		s.hp = Math.min(s.hp, s.hpMax);
		s.mana = Math.min(s.mana, s.manaMax);
		s.sta = Math.min(s.sta, s.staMax);
	}
}
function totalsOf(s) {
	const g = {
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		mag: 0
	};
	for (const it of Object.values(s.equipped)) {
		if (!it) continue;
		const st = itemStats(it);
		g.str += st.str;
		g.hp += st.hp;
		g.ats += st.ats;
		g.mvs += st.mvs;
		g.ctp += st.ctp;
	}
	const inv = s.invested;
	return {
		str: s.base.str + (inv.str || 0) + g.str + (s.level - 1),
		hp: s.base.hp + (inv.hp || 0) * 6 + g.hp + (s.level - 1) * 8 + (s.skills?.sv4 ?? 0) * 8,
		ats: s.base.ats + (inv.ats || 0) + g.ats,
		mvs: s.base.mvs + (inv.mvs || 0) + g.mvs,
		ctp: Math.min(60, s.base.ctp + (inv.ctp || 0) + g.ctp),
		mag: s.base.mag + (inv.mag || 0) * 4 + (s.level - 1) * 2,
		mana: (s.base.mana || 0) + (inv.mana || 0) * 4 + (s.level - 1) * 2
	};
}
export function sumStats(s) {
	return totalsOf(s);
}
function emptyBag() {
	return Array.from({ length: BAG_SIZE }, () => null);
}
function withStarterChest(bag, classId, equipped) {
	if (Boolean(equipped.weapon) || bag.some((it) => it && (it.id === "starter-chest" || it.slot === "weapon"))) return bag;
	const next = bag.slice();
	const hole = next.findIndex((it) => it == null);
	if (hole >= 0) next[hole] = {
		...starterChest(),
		desc: `${classId} sandığı`
	};
	return next;
}
function potionStack(id, count) {
	const made = catalogItem(id);
	if (!made) return null;
	return { ...made, count };
}
function putStack(bag, item, limit = bag.length) {
	if (!item) return false;
	const stack = bag.findIndex((slot, i) => i < limit && slot?.id === item.id && (slot.count ?? 1) + (item.count ?? 1) <= 200);
	if (stack >= 0) {
		bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + (item.count ?? 1) };
		return true;
	}
	const hole = bag.findIndex((slot, i) => i < limit && slot == null);
	if (hole < 0) return false;
	bag[hole] = item;
	return true;
}
function grantStarterPotions(bag, limit) {
	const red = potionStack("pot-hp-s", 10);
	const blue = potionStack("pot-mp-s", 10);
	const trial = bag.slice();
	if (!putStack(trial, red, limit) || !putStack(trial, blue, limit)) return false;
	putStack(bag, red, limit);
	putStack(bag, blue, limit);
	return true;
}
function inferTree(classId, skills) {
	const trees = CLASS_TREES[classId];
	for (let i = 0; i < trees.length; i++) if (trees[i].skills.some((sk) => (skills[sk.id] ?? 0) > 0)) return `${classId}:${i}`;
	return null;
}
export function applySave(save) {
	resetLiveVitals();
	levelPing = 0;
	const s = useRpg.getState();
	const classId = asClassId(save.classId);
	const bag = withStarterChest(Array.from({ length: BAG_SIZE }, (_, i) => save.bag[i] ?? null), classId, {
		...blankEquip(),
		...save.equipped
	}).map((item) => tidyItem(item));
	const equipped = {
		...blankEquip(),
		...save.equipped
	};
	for (const key of Object.keys(equipped)) equipped[key] = tidyItem(equipped[key]);
	const skills = { ...save.skills ?? {} };
	let quests = normalizeQuests(Array.isArray(save.quests) ? save.quests : []).filter((quest) => !String(quest.id).startsWith("q-lv-"));
	if ((save.level ?? 1) < 70) quests = quests.filter((quest) => quest.id !== "y-plus10" || quest.claimed);
	const next = {
		...s,
		classId,
		nick: save.name.slice(0, 16) || "Savaşçı",
		level: save.level,
		xp: save.xp,
		xpTo: xpForLevel(save.level),
		vials: save.vials,
		unspent: save.unspent,
		gold: save.gold,
		hp: save.hp,
		invested: {
			...s.invested,
			...save.invested
		},
		bag,
		equipped,
		skills,
		skillPoints: save.skillPoints ?? 0,
		chosenTree: save.chosenTree ?? inferTree(classId, skills),
		hotbar: Array.from({ length: 8 }, (_, i) => save.hotbar?.[i] ?? null),
		pots: {
			hp: save.pots?.hp ?? null,
			mp: save.pots?.mp ?? null
		},
		quests,
		depot: Array.from({ length: 24 }, (_, i) => save.depot?.[i] ?? null),
		blocked: Array.isArray(save.blocked) ? save.blocked : [],
		bagStage: Math.max(0, Math.min(8, Math.floor(Number(save.bagStage) || 0))),
		wellAt: save.wellAt ?? 0,
		bonusUntil: save.bonusUntil ?? 0,
		stall: Array.isArray(save.stall) ? save.stall : null,
		stallSpot: save.stallSpot && typeof save.stallSpot.x === "number" && typeof save.stallSpot.z === "number" ? { x: save.stallSpot.x, z: save.stallSpot.z } : null,
		stallBank: Math.max(0, Math.floor(Number(save.stallBank) || 0)),
		starterPots: save.starterPots === true,
		steed: save.steed ?? null,
		mountItem: save.mountItem ?? null,
		riding: Boolean(save.riding) && Boolean(save.steed || save.mountItem),
		mountSkills: clampMountSkills(save.mountSkills),
		benchMount: null,
		benchBook: null,
		benchWorn: false,
		greeted: save.greeted === true || (save.greeted == null && ((save.level ?? 1) > 1 || (save.xp ?? 0) > 0 || (Array.isArray(save.quests) && save.quests.length > 0))),
		mentored: save.mentored === true || Object.values(skills).some((rank) => Number(rank) > 0),
		fame: Math.max(0, Math.floor(Number(save.fame) || 0)),
		kills: Math.max(0, Math.floor(Number(save.kills) || 0)),
		mines: Math.max(0, Math.floor(Number(save.mines) || 0)),
		fish: Math.max(0, Math.floor(Number(save.fish) || 0)),
		damage: Math.max(0, Math.floor(Number(save.damage) || 0)),
		bossKills: Math.max(0, Math.floor(Number(save.bossKills) || 0)),
		duelWins: Math.max(0, Math.floor(Number(save.duelWins) || 0)),
		goldEarned: Math.max(0, Math.floor(Number(save.goldEarned) || 0)),
		skillBank: Math.max(0, Math.floor(Number(save.skillBank) || 0)),
		filledGear: Array.isArray(save.filledGear) ? save.filledGear.filter((id) => typeof id === "string") : [],
		weekClaim: typeof save.weekClaim === "string" ? save.weekClaim : "",
		bossPrompt: null,
		down: null,
		mapLoad: "",
		gearRev: s.gearRev + 1,
		toast: "",
		vein: null,
		chore: null,
		invOpen: false,
		charOpen: false,
		shop: null
	};
	for (const key of Object.keys(next.equipped)) {
		const it = next.equipped[key];
		if (!it || itemNeed(it) <= next.level) continue;
		const hole = next.bag.findIndex((slot, i) => i < openBagCount(next.bagStage) && slot == null);
		if (hole >= 0) {
			next.bag[hole] = it;
			next.equipped[key] = null;
		}
	}
	applyVitals(next, true);
	if (next.level <= 1 && next.xp === 0 && next.gold === 400) next.gold = 0;
	const earnedHorse = next.quests.some((quest) => quest.id === "q-at" && quest.claimed);
	if (earnedHorse && !next.steed) next.steed = horseCoat(next.mountItem?.coatId);
	if (earnedHorse && !next.mountItem && !next.bag.some((item) => item?.id === "binek-at" || item?.kind === "mount")) {
		const made = horseItem(next.steed ? horseCoat(next.steed.id) : null);
		const hole = next.bag.findIndex((slot, i) => i < openBagCount(next.bagStage) && slot == null);
		if (hole >= 0) next.bag[hole] = made;
		else next.mountItem = made;
	}
	if (next.mountItem?.coatId && !next.steed) next.steed = horseCoat(next.mountItem.coatId);
	const potsNote = "Açılınca sınıfının başlangıç silahını, 10 S can iksiri ve 10 S mana iksiri verir.";
	for (let i = 0; i < next.bag.length; i++) if (next.bag[i]?.id === "starter-chest") next.bag[i] = { ...next.bag[i], desc: potsNote };
	for (let i = 0; i < next.depot.length; i++) if (next.depot[i]?.id === "starter-chest") next.depot[i] = { ...next.depot[i], desc: potsNote };
	if (!next.starterPots) {
		const chestWaiting = next.bag.some((item) => item?.id === "starter-chest") || next.depot.some((item) => item?.id === "starter-chest");
		if (chestWaiting) next.starterPots = true;
		else if (grantStarterPotions(next.bag, openBagCount(next.bagStage))) {
			next.starterPots = true;
			if (!next.toast) next.toast = "10 S can ve 10 S mana iksiri çantana kondu";
		} else if (!next.toast) next.toast = "Başlangıç iksirleri için çantada iki boş yer aç";
	}
	const skillGap = skillPointGap(next);
	if (skillGap > 0) {
		if (next.mentored) next.skillPoints += skillGap;
		else next.skillBank += skillGap;
		next.toast = `Eksik ${skillGap} yetenek puanı verildi. Her seviyede 2 puan.`;
	}
	useRpg.setState(next);
	hydrateFriends(Array.isArray(save.friends) ? save.friends.filter((row) => row && typeof row.nick === "string" && typeof row.id === "string") : []);
	ensureQuest(useRpg.getState, useRpg.setState);
}
export type ToolChore =
  | { kind: "mine"; t: number; given: number }
  | { kind: "fish"; phase: "wait" | "bite"; t: number; wait: number; zone: number; zoneW: number; needle: number; dir: number; flick?: number };

export interface RpgState {
  classId: ClassId;
  level: number;
  xp: number;
  xpTo: number;
  vials: number;
  unspent: number;
  gold: number;
  hp: number;
  hpMax: number;
  mana: number;
  manaMax: number;
  sta: number;
  staMax: number;
  base: Record<StatKey, number>;
  invested: Record<StatKey, number>;
  bag: (Item | null)[];
  equipped: Record<EquipSlot, Item | null>;
  gearRev: number;
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
  swiftUntil: number;
  hasteUntil: number;
  smithItem: Item | null;
  smithStone: Item | null;
  smithMat: Item | null;
  stall: { uid: string; item: Item; price: number }[] | null;
  stallSpot: { x: number; z: number } | null;
  stallBank: number;
  starterPots: boolean;
  steed: { id: string; name: string; coat: string; mane: string; dark: string; muzzle?: string } | null;
  mountItem: Item | null;
  riding: boolean;
  mountSkills: { surat: number; soluk: number; cifte: number };
  benchMount: Item | null;
  benchBook: Item | null;
  benchWorn: boolean;
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
  bossPrompt: string | null;
  npcAsk: NearKind | null;
  boardFor: NearKind | null;
  boardMap: string | null;
  down: { x: number; z: number } | null;
  mapLoad: string;
  loadMap: (name: string) => void;
  invOpen: boolean;
  charOpen: boolean;
  shop: ShopKind | null;
  near: NearKind | null;
  vein: { x: number; z: number } | null;
  chore: ToolChore | null;
  mentor: string | null;
  charTab: CharTab;
  toast: string;
  nick: string;
  hurt: number;
  toggleInv: () => void;
  showChar: (tab: CharTab) => void;
  closePanels: () => void;
  closeShop: () => void;
  setNear: (near: NearKind | null, mentor?: string | null) => void;
  selectVein: (x: number, z: number) => void;
  beginMine: () => void;
  beginFish: () => void;
  reel: () => void;
  learnSkill: (id: string) => void;
  setHotbar: (index: number, id: string | null) => void;
  castSkill: (id: string) => void;
  spend: (key: StatKey) => void;
  tick: (dt: number, sprinting: boolean) => void;
  punch: () => { dmg: number; crit: boolean };
  attackGap: () => number;
  moveSpeed: (sprinting: boolean) => number;
  hurtPlayer: (dmg: number) => boolean;
  addGold: (n: number) => void;
  noteKill: (mobId?: string, mobLevel?: number) => void;
  noteMeteor: (id?: string) => void;
  noteDuelWin: () => void;
  noteDamage: (n: number) => void;
  startQuest: () => void;
  claimQuest: () => void;
  takeGiverQuest: () => void;
  notePlace: (name: string) => void;
  grantXp: (n: number) => void;
  interact: () => void;
  buy: (id: string) => void;
  unequip: (slot: EquipSlot) => void;
  equipFromBag: (index: number) => void;
  placeEquip: (slot: EquipSlot, index: number) => void;
  deposit: (index: number) => void;
  withdraw: (index: number) => void;
  moveToPage: (from: number, page: number) => void;
  splitStack: (index: number, count: number) => void;
  useBagItem: (index: number) => void;
  imbue: (from: number, to: number) => void;
  listStall: (index: number, price: number) => void;
  unlistStall: (id: string) => void;
  fulfillStall: (uid: string, price: number) => { item: Item; price: number } | null;
  sellFromBag: (index: number) => void;
  sellEquipped: (slot: EquipSlot) => void;
  toggleRide: () => void;
  drinkPotion: (kind: "hp" | "mp") => void;
  setBeltPot: (kind: "hp" | "mp", index: number) => void;
  takeBeltPot: (kind: "hp" | "mp", index: number) => void;
  restoreStall: (uid: string, item: Item, price: number) => void;
  closeStall: () => void;
  tidyBag: () => void;
  stowMount: (index: number) => void;
  craftItem: (id: string) => void;
  setBench: (which: "mount" | "book", raw: string) => void;
  takeBench: (which: "mount" | "book") => void;
  trainMount: () => void;
  buyOffer: (id: string) => void;
  startQuestId: (id: string) => void;
  travel: (id: string) => void;
  knockDown: () => void;
  reviveHere: () => void;
  reviveTown: () => void;
  swapBag: (from: number, index: number) => void;
  setSmith: (which: "item" | "stone" | "mat", index: number | null) => void;
  takeSmith: (which: "item" | "stone" | "mat", dest: number | null) => void;
  forge: () => void;
}

const MINE_AT = [10 / 3, 20 / 3, 10];
const ORES = [
	{ id: "demir-cevher", name: "Demir Cevheri", desc: "Yalnız demir damarından çıkar." },
	{ id: "bakir-cevher", name: "Bakır Cevheri", desc: "Yalnız bakır damarından çıkar." },
	{ id: "gumus-cevher", name: "Gümüş Cevheri", desc: "Yalnız gümüş damarından çıkar." },
	{ id: "altin-cevher", name: "Altın Cevheri", desc: "Yalnız altın damarından çıkar." }
];
const ORE_BY = { demir: ORES[0], bakir: ORES[1], gumus: ORES[2], altin: ORES[3] };
const FISHES = [
	{ id: "balik-gol", name: "Göl Balığı", desc: "Sakin sudan çıktı." },
	{ id: "balik-sazan", name: "Sazan", desc: "Dipte dolaşan sazan." },
	{ id: "balik-turna", name: "Turna", desc: "Sivri dişli turna." },
	{ id: "balik-yayin", name: "Yayın", desc: "Bıyıklı yayın balığı." },
	{ id: "balik-alabalik", name: "Alabalık", desc: "Soğuk su alabalığı." },
	{ id: "balik-levrek", name: "Levrek", desc: "Parlak levrek." },
	{ id: "balik-kefal", name: "Kefal", desc: "Sürüden kopmuş kefal." },
	{ id: "balik-yilan", name: "Yılan Balığı", desc: "Kıvrak yılan balığı." },
	{ id: "balik-capak", name: "Çapak", desc: "Gümüş çapak." },
	{ id: "balik-kizil", name: "Kızılkanat", desc: "Kırmızı yüzgeçli kızılkanat." }
];
let lastFish = "";
function rollFish() {
	const others = FISHES.filter((row) => row.id !== lastFish);
	const repeat = lastFish && Math.random() < 0.4;
	const pick = repeat ? FISHES.find((row) => row.id === lastFish) || FISHES[0] : others[Math.floor(Math.random() * others.length)] || FISHES[0];
	lastFish = pick.id;
	return pick;
}
function pushMat(bag, stage, spec) {
	const limit = openBagCount(stage);
	const stack = bag.findIndex((item, i) => i < limit && item?.id === spec.id && (item.count ?? 1) < 200);
	if (stack >= 0) {
		bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + 1 };
		return true;
	}
	const hole = bag.findIndex((item, i) => i < limit && item == null);
	if (hole < 0) return false;
	bag[hole] = {
		uid: uid(),
		id: spec.id,
		name: spec.name,
		slot: "belt",
		level: 1,
		plus: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: spec.desc,
		kind: "mat",
		count: 1
	};
	return true;
}
function stepChore(get, set, dt) {
	const s = get();
	const chore = s.chore;
	if (!chore) return;
	if (s.down) {
		set({ chore: null });
		return;
	}
	if (chore.kind === "mine") {
		const here = readSim();
		const style = weaponStyleOf(s.equipped.weapon?.id);
		const far = !s.vein || Math.hypot(here.x - s.vein.x, here.z - s.vein.z) > 2.45;
		if (style !== "kazma" || far) {
			set({ chore: null, toast: far ? "Taştan uzaklaştın" : "Kazma bırakıldı" });
			return;
		}
		const t = chore.t + dt;
		let given = chore.given;
		let mined = 0;
		let bag = s.bag;
		let toast = "";
		while (given < 3 && t >= MINE_AT[given]) {
			const spot = s.vein ? veinAt(s.vein.x, s.vein.z) : null;
			const ore = (spot && ORE_BY[spot.ore]) || ORES[0];
			const next = bag.slice();
			if (!pushMat(next, s.bagStage, ore)) {
				set({ bag, chore: null, toast: "Çanta dolu", mines: s.mines + mined });
				return;
			}
			bag = next;
			given += 1;
			mined += 1;
			toast = given >= 3 ? `${ore.name} · damar tükendi` : `${ore.name} · ${given}/3`;
			bumpQuest(get, set, "mine");
		}
		if (given >= 3 || t >= 10) {
			if (s.vein && given >= 3) retireVein(s.vein.x, s.vein.z);
			set({ bag, chore: null, vein: null, toast: toast || "Damar boşaldı", mines: s.mines + mined });
			return;
		}
		if (bag !== s.bag) set({ bag, chore: { kind: "mine", t, given }, toast, mines: s.mines + mined });
		else set({ chore: { kind: "mine", t, given } });
		return;
	}
	if (weaponStyleOf(s.equipped.weapon?.id) !== "olta" || s.near !== "fish") {
		set({ chore: null, toast: "Balık kaçtı" });
		return;
	}
	if (chore.phase === "wait") {
		const t = chore.t + dt;
		const chance = 1 - Math.exp(-dt * (0.7 + t * 0.45));
		if (t < 0.05 || Math.random() > chance && t < 7) {
			set({ chore: { ...chore, t } });
			return;
		}
		const zoneW = 0.3;
		set({
			chore: {
				kind: "fish",
				phase: "bite",
				t: 0,
				wait: chore.wait,
				zone: 0.34 + Math.random() * 0.32,
				zoneW,
				needle: 0,
				dir: 1
			},
			toast: "Kancaya bir balık takıldı"
		});
		return;
	}
	const step = Math.min(0.05, dt);
	let dir = chore.dir || 1;
	let needle = chore.needle + dir * step * 0.46;
	if (needle >= 1) {
		needle = 1;
		dir = -1;
	} else if (needle <= 0) {
		needle = 0;
		dir = 1;
	}
	const t = chore.t + dt;
	if (t >= 12) {
		set({ chore: null, toast: "Geç kaldın, balık kaçtı" });
		return;
	}
	set({ chore: { ...chore, t, needle, dir } });
}
let mapLoadTimer = 0;
function holdMapLoad(name: string, ms = 1600) {
	window.clearTimeout(mapLoadTimer);
	useRpg.setState({ mapLoad: name });
	mapLoadTimer = window.setTimeout(() => {
		if (useRpg.getState().mapLoad === name) useRpg.setState({ mapLoad: "" });
	}, ms);
}
export const useRpg = create<RpgState>((set, get) => ({
	classId: "savasci",
	level: 1,
	xp: 0,
	xpTo: xpForLevel(1),
	vials: 0,
	unspent: 0,
	gold: 0,
	hp: 400,
	hpMax: 400,
	mana: 58,
	manaMax: 58,
	sta: 102,
	staMax: 102,
	base: {
		str: 12,
		hp: 20,
		ats: 8,
		mvs: 10,
		ctp: 4,
		mag: 6,
		mana: 8
	},
	invested: {
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		mag: 0,
		mana: 0
	},
	bag: emptyBag(),
	equipped: blankEquip(),
	gearRev: 0,
	skills: {},
	skillPoints: 0,
	chosenTree: null,
	hotbar: blankHotbar(),
	pots: { hp: null, mp: null },
	quests: [],
	depot: blankDepot(),
	blocked: [],
	bagStage: 0,
	wellAt: 0,
	bonusUntil: 0,
	swiftUntil: 0,
	hasteUntil: 0,
	smithItem: null,
	smithStone: null,
	smithMat: null,
	stall: null,
	stallSpot: null,
	stallBank: 0,
	starterPots: false,
	steed: null,
	mountItem: null,
	riding: false,
	mountSkills: blankMountSkills(),
	benchMount: null,
	benchBook: null,
	benchWorn: false,
	greeted: false,
	mentored: false,
	fame: 0,
	kills: 0,
	mines: 0,
	fish: 0,
	damage: 0,
	bossKills: 0,
	duelWins: 0,
	goldEarned: 0,
	skillBank: 0,
	filledGear: [],
	weekClaim: "",
	bossPrompt: null,
	npcAsk: null,
	boardFor: null,
	boardMap: null,
	down: null,
	mapLoad: "",
	invOpen: false,
	charOpen: false,
	shop: null,
	near: null,
	vein: null,
	chore: null,
	mentor: null,
	charTab: "stats",
	toast: "",
	nick: "Savaşçı",
	hurt: 0,
	toggleInv: () => set((s) => ({ invOpen: !s.invOpen })),
	toggleChar: () => get().showChar("stats"),
	showChar: (tab) => {
		const released = releaseWork(get());
		set((s) => {
			if (s.charOpen && s.charTab === tab) return {
				...released,
				charOpen: false
			};
			return {
				...released,
				charOpen: true,
				charTab: tab
			};
		});
	},
	closePanels: () => set((s) => ({
		...releaseWork(s),
		invOpen: false,
		charOpen: false,
		shop: null,
		boardFor: null,
		boardMap: null,
		npcAsk: null,
		bossPrompt: null
	})),
	closeShop: () => set((s) => ({
		...releaseWork(s),
		shop: null,
		boardFor: null,
		boardMap: null,
		npcAsk: null
	})),
	setNick: (nick) => {
		set({ nick: nick.trim().slice(0, 16) || "Savaşçı" });
	},
	setNear: (near, mentor = null) => {
		const s = get();
		if (s.near === near && s.mentor === (mentor ?? null)) return;
		set({
			near,
			mentor: mentor ?? null
		});
	},
	selectVein: (x, z) => {
		const s = get();
		const armed = weaponStyleOf(s.equipped.weapon?.id) === "kazma";
		set({
			vein: { x, z },
			chore: s.chore?.kind === "mine" ? null : s.chore,
			toast: armed ? "Taş seçildi. Space ile kaz" : "Kazmak için kazma giymelisin"
		});
	},
	beginMine: () => {
		const s = get();
		if (s.down || s.chore) return;
		const pick = s.equipped.weapon;
		if (!pick || pick.id !== "kazma") {
			set({ toast: "Kazmak için kazma giymelisin" });
			return;
		}
		if (s.level < 8) {
			set({ toast: "Kazma için 8. seviye gerekir" });
			return;
		}
		if (!s.vein) {
			set({ toast: "Önce taşa tıkla" });
			return;
		}
		const here = readSim();
		if (Math.hypot(here.x - s.vein.x, here.z - s.vein.z) > 2.3) {
			set({ toast: "Seçtiğin taşa yaklaş" });
			return;
		}
		set({ chore: { kind: "mine", t: 0, given: 0 }, toast: "Kazma indi" });
	},
	beginFish: () => {
		const s = get();
		if (s.down || s.chore) return;
		const rod = s.equipped.weapon;
		if (!rod || rod.id !== "olta") {
			set({ toast: "Oltayı kuşan" });
			return;
		}
		if (s.near !== "fish") {
			set({ toast: "İskeleye gel" });
			return;
		}
		const baitAt = s.bag.findIndex((item) => item?.id === "yem" && (item.count ?? 1) > 0);
		if (baitAt < 0) {
			set({ toast: "Yem yok. Yemsiz tutulmaz." });
			return;
		}
		const bag = s.bag.slice();
		const bait = bag[baitAt];
		const left = (bait.count ?? 1) - 1;
		bag[baitAt] = left > 0 ? { ...bait, count: left } : null;
		set({
			bag,
			chore: {
				kind: "fish",
				phase: "wait",
				t: 0,
				wait: 2.4 + Math.random() * 2.8,
				zone: 0.5,
				zoneW: 0.22,
				needle: 0,
				dir: 1
			},
			toast: "Olta atıldı"
		});
	},
	reel: () => {
		const s = get();
		const chore = s.chore;
		if (!chore || chore.kind !== "fish" || chore.phase !== "bite") return;
		const hit = Math.abs(chore.needle - chore.zone) <= chore.zoneW * 0.5;
		if (!hit) {
			set({ chore: null, toast: "Balık kurtuldu" });
			return;
		}
		const fish = rollFish();
		const bag = s.bag.slice();
		if (!tryReceiveItem({ ...fish, uid: uid(), slot: "belt", level: 1, plus: 0, str: 0, hp: 0, ats: 0, mvs: 0, ctp: 0, kind: "fish", count: 1 })) {
			set({ chore: null });
			return;
		}
		set({ chore: null, toast: `${fish.name} tutuldu`, fish: s.fish + 1 });
		get().grantXp(12);
		bumpQuest(get, set, "fish");
	},
	learnSkill: (id) => {
		const s = get();
		if (s.level < 5) {
			set({ toast: "Yetenek için 5. seviye gerekir" });
			return;
		}
		if (!s.mentored) {
			set({ toast: "Önce sınıfının ustasına uğra" });
			return;
		}
		const trees = CLASS_TREES[s.classId];
		const treeIndex = trees.findIndex((tree) => tree.skills.some((sk) => sk.id === id));
		if (treeIndex < 0) {
			set({ toast: "Bu ağaç senin sınıfın değil" });
			return;
		}
		const key = `${s.classId}:${treeIndex}`;
		if (s.chosenTree && s.chosenTree !== key) {
			set({ toast: "Yalnız bir yetenek ağacı seçebilirsin" });
			return;
		}
		const rank = s.skills[id] ?? 0;
		if (rank >= 32) {
			set({ toast: "Bu yetenek S+ — son seviye" });
			return;
		}
		if (s.skillPoints <= 0) {
			set({ toast: "Yetenek puanın yok" });
			return;
		}
		const next = rank + 1;
		set({
			skills: {
				...s.skills,
				[id]: next
			},
			skillPoints: s.skillPoints - 1,
			chosenTree: s.chosenTree || key,
			quests: withSkillQuest(s.level, s.chosenTree || key, s.quests),
			toast: `${trees[treeIndex].skills.find((sk) => sk.id === id)?.name ?? "Yetenek"} ${skillTier(next)}`
		});
	},
	setHotbar: (index, id) => {
		if (index < 0 || index > 7) return;
		if (id && MOUNT_SKILLS.some((row) => row.id === id) && (get().mountSkills?.[id] || 0) <= 0) {
			set({ toast: "Bu at becerisi henüz yok" });
			return;
		}
		const hotbar = get().hotbar.slice();
		hotbar[index] = id;
		set({ hotbar });
	},
	castSkill: (id) => {
		const s = get();
		if (!id || s.down) return;
		const mount = MOUNT_SKILLS.find((row) => row.id === id);
		if (mount) {
			const rank = Math.max(0, Math.min(SKILL_MAX, s.mountSkills?.[mount.id] || 0));
			if (rank <= 0) {
				set({ toast: "Bu at becerisi öğrenilmedi" });
				return;
			}
			if (!s.riding || !s.steed) {
				set({ toast: "At becerisi yalnız binince çalışır" });
				return;
			}
			if (skillCdLeft(id) > 0.05) return;
			const wait = Math.max(3.2, 8.5 - rank * 0.12);
			skillReadyAt[id] = Date.now() + wait * 1000;
			if (id === "surat") {
				stepUntil = Date.now() + 4500;
				stepMul = Math.max(stepMul, 1.22 + rank * 0.008);
				set({ toast: `Sürat ${skillTier(rank)}` });
			} else if (id === "soluk") {
				const nowSta = liveSta < 0 ? s.sta : liveSta;
				liveSta = Math.min(s.staMax, nowSta + s.staMax * (0.22 + rank * 0.012));
				set({ sta: liveSta, toast: `Soluk ${skillTier(rank)}` });
			} else {
				pendingKick = { rank };
				set({ toast: `Çifte ${skillTier(rank)}` });
			}
			return;
		}
		if (s.riding) {
			set({ toast: "At üzerinde yetenek kullanılamaz" });
			return;
		}
		const style = weaponStyleOf(s.equipped.weapon?.id);
		if (style === "olta" || style === "kazma") {
			set({ toast: style === "olta" ? "Olta yalnızca balık tutar" : "Kazma yalnızca kazı yapar" });
			return;
		}
		const rank = s.skills[id] ?? 0;
		if (rank <= 0) {
			set({ toast: "Bu yetenek öğrenilmedi" });
			return;
		}
		const left = skillCdLeft(id);
		if (left > .05) return;
		const cost = 6 + Math.min(rank, 10) * 2;
		if (s.mana < cost) {
			set({ toast: "Yetersiz mana" });
			return;
		}
		const sk = skillById(id);
		const t = totalsOf(s);
		const mana = s.mana - cost;
		liveMana = mana;
		if (!sk || sk.kind === "buff") {
			skillReadyAt[id] = Date.now() + skillWait(id, rank) * 1e3;
			const now = Date.now();
			const cut = Math.min(.55, .16 + rank * .012);
			if (id === "sv4") {
				const hp = Math.min(s.hpMax, s.hp + Math.round(s.hpMax * (.16 + rank * .004)));
				liveHp = hp;
				set({ mana, hp });
			} else if (id === "sv6" || id === "nj4") {
				stepUntil = now + 12e3;
				stepMul = 1.18 + rank * .008;
				set({ mana });
			} else if (id === "sv10") {
				regenUntil = now + 12e3;
				set({ mana });
			} else {
				guardUntil = now + 12e3;
				guardCut = cut;
				set({ mana });
			}
			return;
		}
		const stat = sk.mag ? t.mag : t.str;
		const power = sk.power + stat * (sk.mag ? .5 : .32);
		pendingCast = {
			id,
			cost,
			aoe: sk.kind === "aoe",
			dmg: skillDamage(rank, power),
			hits: sk.hits ?? 1,
			slow: Boolean(sk.slow),
			dot: sk.kind === "dot",
			crit: Boolean(sk.crit)
		};
		set({ mana });
	},
	acceptQuests: () => {
		const s = get();
		set({
			shop: s.near === "herald" ? "herald" : "guard",
			charOpen: false
		});
	},
	startQuest: () => {
		const s = get();
		const giver = s.boardFor || s.near;
		const mapId = s.boardMap || questMapFor(giver, s.mentor);
		const next = offerForNpc(s.quests, s.level, giver, mapId);
		if (!next) {
			const story = nextStoryRow(s.quests);
			set({ toast: story ? `Sıradaki görev ${giverLabel(questGiver(story))} üzerinde` : "Alınacak görev yok" });
			return;
		}
		get().takeGiverQuest();
	},
	takeGiverQuest: () => {
		const s = get();
		const near = s.boardFor || s.near;
		const mapId = s.boardMap || questMapFor(near, s.mentor);
		const story = nextStoryRow(s.quests);
		const next = offerForNpc(s.quests, s.level, near, mapId);
		if (!next) {
			if (story && questMatchesNpc(story, near, mapId) && s.level < story.min) {
				set({ toast: `${story.name} için seviye ${story.min} gerekir` });
				return;
			}
			const who = story ? giverLabel(questGiver(story)) : "";
			set({ toast: story ? `Sıradaki görev ${who} üzerinde` : "Burada alınacak görev yok" });
			return;
		}
		const bag = s.bag.slice();
		let toast = `Görev alındı: ${next.title || next.name}`;
		if (questGiver(next) === "fisher") {
			for (let n = 0; n < 12; n++) pushMat(bag, s.bagStage, { id: "yem", name: "Yem", desc: "Yemsiz olta suya inmez." });
			toast = "Görev alındı. Balıkçı 12 yem verdi.";
		}
		set({
			quests: [...s.quests, questFromBoard(next)],
			bag,
			toast,
			shop: null,
			boardFor: null,
			boardMap: null,
			npcAsk: null,
		});
		syncPlusQuests(get, set);
	},
	claimQuest: () => {
		const s = get();
		const giver = s.boardFor || (s.shop === "herald" ? "herald" : s.shop === "guard" ? "guard" : null);
		const mapId = (giver === "herald" && s.boardMap) ? s.boardMap : questMapFor(giver, s.mentor);
		const ready = giver ? readyForNpc(s.quests, giver, mapId) : null;
		if (!ready) {
			set({ toast: "Bu kişide teslim edilecek görev yok" });
			return;
		}
		const row = questBoardRow(ready);
		if (row?.reward && row.reward !== "At" && row.reward !== "kitap" && !s.bag.some((slot) => slot == null)) {
			set({ toast: "Çanta dolu. Yer aç, sonra teslim et." });
			return;
		}
		if (row?.reward === "kitap" && !bagRoom({ id: "kitap-surat", kind: "book", count: 1 })) {
			set({ toast: "Çanta dolu. Yer aç, sonra teslim et." });
			return;
		}
		const quests = s.quests.map((quest) => quest.id === ready.id ? { ...quest, claimed: true } : quest);
		set({ quests });
		const xp = row?.xp ?? 80;
		const gold = row?.gold ?? 20;
		payQuest(get, ready.title, xp, gold);
		let bag = get().bag.slice();
		let steed = get().steed;
		let mountItem = get().mountItem;
		let riding = get().riding;
		let toast = `${ready.title} teslim edildi. +${xp} XP +${gold} altın`;
		if (row?.reward === "At") {
			const coat = HORSE_COATS[Math.floor(Math.random() * HORSE_COATS.length)];
			steed = coat;
			riding = false;
			const made = horseItem(coat);
			const hole = bag.findIndex((slot, i) => i < openBagCount(get().bagStage) && slot == null);
			if (hole >= 0) bag[hole] = made;
			else mountItem = made;
			toast = `${coat.name} at envanterine geldi.`;
		} else if (row?.reward === "kitap") {
			const made = catalogItem("kitap-surat");
			const limit = openBagCount(get().bagStage);
			const stack = made ? bag.findIndex((slot, i) => i < limit && slot?.id === made.id && (slot.count ?? 1) < 200) : -1;
			if (stack >= 0 && made) bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + 1 };
			else if (made) {
				const hole = bag.findIndex((slot, i) => i < limit && slot == null);
				if (hole >= 0) bag[hole] = made;
			}
			toast = "Sürat Kitabı geldi. Seyis'te Binek Geliştir sekmesine koy.";
		} else if (row?.reward) {
			const plus = Math.random() < 0.05 ? 1 : 0;
			const item = rewardItem(row.reward, plus);
			const hole = bag.findIndex((slot) => slot == null);
			if (hole >= 0) bag[hole] = item;
			else toast = "Çanta dolu, ödül sığmadı";
			if (hole >= 0) toast = plus ? `${item.name} +${plus} geldi` : `${item.name} geldi`;
		}
		const level = get().level;
		const next = nextStoryRow(get().quests);
		const same = Boolean(next && giver && questMatchesNpc(next, giver, mapId) && level >= (next.min || 1));
		if (same) toast = `${toast} Sıradaki görev hazır.`;
		else if (next) {
			const need = level < next.min ? ` Seviye ${next.min} gerekir.` : "";
			toast = `${toast} Sıradaki: ${next.name} — ${giverLabel(questGiver(next))}.${need}`;
		}
		set({
			bag,
			steed,
			mountItem,
			riding,
			toast,
			boardFor: same ? giver : null,
			boardMap: same ? mapId : null,
			shop: same ? (giver === "herald" ? "herald" : "guard") : null,
			npcAsk: null,
		});
	},
	splitStack: (index, count) => {
		const s = get();
		const it = s.bag[index];
		const have = it?.count ?? 1;
		const n = Math.floor(Number(count) || 0);
		if (!it || n < 1 || n >= have) {
			set({ toast: "Bölünecek adet geçersiz" });
			return;
		}
		const bag = s.bag.slice();
		const limit = openBagCount(s.bagStage);
		const hole = bag.findIndex((slot, i) => i < limit && slot == null);
		if (hole < 0) {
			set({ toast: "Envanterinde yer yok" });
			return;
		}
		bag[index] = { ...it, count: have - n };
		bag[hole] = { ...it, uid: uid(), count: n };
		set({ bag, toast: `${it.name} ${n} adet ayrıldı` });
	},
	useBagItem: (index) => {
		const s = get();
		const it = s.bag[index];
		if (!it) return;
		const bag = s.bag.slice();
		const spend = () => {
			const left = (it.count ?? 1) - 1;
			bag[index] = left > 0 ? {
				...it,
				count: left
			} : null;
		};
		if (it.id === "hizli-pazar") {
			set({ shop: "bazaar", charOpen: false, toast: "Hızlı Pazar" });
			return;
		}
		if (it.id === "bag-expand") {
			if (s.bagStage >= 8) {
				set({ toast: "Envanter sonuna kadar açık" });
				return;
			}
			spend();
			set({
				bag,
				bagStage: s.bagStage + 1,
				toast: "9 yuva açıldı"
			});
			return;
		}
		if (it.kind === "potion") {
			const heal = potTier(it.id);
			const hpPot = String(it.id).startsWith("pot-hp");
			const mpPot = String(it.id).startsWith("pot-mp");
			if (hpPot && s.hp >= s.hpMax - 0.4) {
				set({ toast: "Canın zaten dolu" });
				return;
			}
			if (mpPot && s.mana >= s.manaMax - 0.4) {
				set({ toast: "Manan zaten dolu" });
				return;
			}
			spend();
			const now = Date.now();
			if (hpPot) {
				const hp = Math.min(s.hpMax, s.hp + heal);
				liveHp = hp;
				set({ bag, hp, toast: it.name });
			} else if (mpPot) {
				const mana = Math.min(s.manaMax, s.mana + heal);
				liveMana = mana;
				set({ bag, mana, toast: it.name });
			} else if (it.id === "pot-mvs") set({
				bag,
				swiftUntil: now + 6e4,
				toast: "Hareket hızlandı"
			});
			else if (it.id === "pot-ats") set({
				bag,
				hasteUntil: now + 6e4,
				toast: "Saldırı hızlandı"
			});
			else set({
				bag,
				toast: it.name
			});
			return;
		}
		if (it.id === "pazar-tezgah") {
			if (s.stall == null) spend();
			const here = readSim();
			set({
				bag: s.stall == null ? bag : s.bag,
				stall: s.stall ?? [],
				stallSpot: s.stallSpot || { x: here.x, z: here.z },
				shop: "stall",
				invOpen: true,
				charOpen: false,
				toast: "Pazar açıldı"
			});
			bumpQuest(get, set, "stall");
			return;
		}
		if (it.id === "mistik-efsun" || it.id === "mistik-degistirici") {
			set({ toast: "Eşyanın üzerine sürükle" });
			return;
		}
		if (it.kind === "tool") {
			set({ toast: it.id === "olta" || it.id === "kazma" ? "Kuşanmak için sürükle" : it.desc });
			return;
		}
		set({ toast: it.desc || it.name });
	},
	setSmith: (which, index) => {
		const s = get();
		if (index == null) {
			get().takeSmith(which, null);
			return;
		}
		const it = s.bag[index];
		if (!it) return;
		if (which === "stone") {
			if (it.id !== "guc-tasi") {
				set({ toast: "Buraya yalnızca Güç Taşı" });
				return;
			}
			if (s.smithStone) {
				set({ toast: "Tek taş konur" });
				return;
			}
			const bag = s.bag.slice();
			const left = (it.count ?? 1) - 1;
			bag[index] = left > 0 ? { ...it, count: left } : null;
			set({
				bag,
				smithStone: { ...it, count: 1, uid: uid() }
			});
			return;
		}
		if (which === "mat") {
			if (!s.smithItem) {
				set({ toast: "Önce eşyayı koy" });
				return;
			}
			const plus = s.smithItem.plus ?? 0;
			const need = matForPlus(plus, s.smithItem.slot);
			if (!matFits(it, s.smithItem)) {
				set({ toast: plus < 6 ? "Buraya yükseltme taşı konur" : `Gerekli: ${need.name}` });
				return;
			}
			const bag = s.bag.slice();
			const previous = s.smithMat;
			const left = (it.count ?? 1) - 1;
			bag[index] = left > 0 ? { ...it, count: left } : null;
			if (previous) {
				const hole = bag.findIndex((slot) => slot == null);
				if (hole >= 0) bag[hole] = previous;
			}
			set({ bag, smithMat: { ...it, count: 1, uid: uid() } });
			return;
		}
		if (it.id === "guc-tasi" || it.kind === "potion" || it.kind === "mat" || it.kind === "bag" || it.id === "starter-chest") {
			set({ toast: "Bu eşyaya + basılmaz" });
			return;
		}
		const bag = s.bag.slice();
		const previous = s.smithItem;
		bag[index] = null;
		if (previous) {
			const hole = bag.findIndex((slot) => slot == null);
			if (hole < 0) {
				bag[index] = it;
				set({ toast: "Çanta dolu" });
				return;
			}
			bag[hole] = previous;
		}
		const extra = attachSmith(bag, it, s.smithStone, s.smithMat);
		set({
			bag,
			smithItem: it,
			smithStone: extra.smithStone,
			smithMat: extra.smithMat,
			toast: extra.smithMat ? "Eşya kondu. Taş ve malzeme envanterden alındı." : "Eşya kondu. Envanterde uygun taş yok."
		});
	},
	takeSmith: (which, dest) => {
		const s = get();
		const held = which === "item" ? s.smithItem : which === "stone" ? s.smithStone : s.smithMat;
		if (!held) return;
		const bag = s.bag.slice();
		const hole = dest != null && dest >= 0 && bag[dest] == null ? dest : bag.findIndex((slot) => slot == null);
		if (hole < 0) {
			set({ toast: "Çanta dolu" });
			return;
		}
		bag[hole] = held;
		if (which === "item") set({ bag, smithItem: null });
		else if (which === "stone") set({ bag, smithStone: null });
		else set({ bag, smithMat: null });
	},
	forge: () => {
		const s = get();
		const it = s.smithItem;
		if (!it) {
			set({ toast: "Önce eşya koy" });
			return;
		}
		if (it.id === "guc-tasi" || it.kind === "mat" || it.kind === "potion" || it.kind === "bag") {
			set({ toast: "Bu eşyaya + basılmaz" });
			return;
		}
		if (it.plus >= 10) {
			set({ toast: "Bu eşya +10" });
			return;
		}
		const cost = ENHANCE[it.plus] ?? 1550;
		if (s.gold < cost) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		const stone = s.smithStone;
		const plus = it.plus ?? 0;
		const need = matForPlus(plus, it.slot);
		if (!matFits(s.smithMat, it)) {
			set({ toast: plus < 6 ? "Envanterde yükseltme taşı yok" : `Gerekli: ${need.name}` });
			return;
		}
		const chance = upgradeChance(it.plus, Boolean(stone));
		const ok = Math.random() * 100 < chance;
		const nextItem = ok ? { ...it, plus: it.plus + 1 } : it;
		const equipped = { ...s.equipped };
		if (ok) {
			for (const slot of Object.keys(equipped)) if (equipped[slot]?.uid === it.uid) equipped[slot] = nextItem;
		}
		const bag = s.bag.slice();
		const keptMat = ok ? null : s.smithMat;
		const filled = attachSmith(bag, nextItem, null, keptMat);
		const next = {
			...s,
			bag,
			smithItem: nextItem,
			smithStone: filled.smithStone,
			smithMat: filled.smithMat,
			equipped,
			gold: s.gold - cost,
			gearRev: ok ? s.gearRev + 1 : s.gearRev,
			toast: ok ? "Yükseltme Başarılı" : "Yükseltme Başarısız. Taş duruyor, tekrar bas."
		};
		if (ok) applyVitals(next, false);
		set(next);
		if (ok && nextItem.plus >= 6) bumpQuest(get, set, "plus6");
		if (ok && nextItem.plus >= 10) bumpQuest(get, set, "plus10");
		syncPlusQuests(get, set);
	},
	noteKill: (mobId, mobLevel) => {
		bumpQuest(get, set, "kill", mobId);
		const s = get();
		const ml = Math.max(1, Math.floor(Number(mobLevel) || s.level));
		const gap = Math.max(0, s.level - ml);
		const gain = Math.max(1, Math.round((8 + ml * 0.6) * Math.pow(0.9, Math.min(20, gap))));
		const bossKill = BOSSES.some((row) => row.id === mobId);
		set({ fame: (s.fame || 0) + gain, kills: (s.kills || 0) + 1, bossKills: (s.bossKills || 0) + (bossKill ? 1 : 0) });
	},
	noteMeteor: (id) => {
		if (!id) return;
		const before = get();
		const spot = meteorSpots().find((row) => row.id === id);
		const matched = before.quests.some((quest) => {
			if (quest.claimed || quest.done || (quest.need > 0 && quest.have >= quest.need)) return false;
			const kind = quest.kind || QUEST_BOARD.find((row) => row.id === quest.id)?.kind;
			const want = quest.meteors || QUEST_BOARD.find((row) => row.id === quest.id)?.meteors || [];
			return kind === "meteor" && want.includes(id) && !(quest.seen || []).includes(id);
		});
		bumpQuest(get, set, "meteor", id);
		if (matched) return;
		const open = get().quests.find((quest) => {
			if (quest.claimed || quest.done) return false;
			const kind = quest.kind || QUEST_BOARD.find((row) => row.id === quest.id)?.kind;
			return kind === "meteor" && (quest.map || QUEST_BOARD.find((row) => row.id === quest.id)?.map) === spot?.realm;
		});
		if (!open) return;
		const names = (open.meteors || QUEST_BOARD.find((row) => row.id === open.id)?.meteors || [])
			.map((mid) => meteorSpots().find((row) => row.id === mid)?.name)
			.filter(Boolean);
		set({ toast: `${spot?.name || "Meteor"} görev taşı değil. İstenen: ${names.join(", ")}` });
	},
	noteDuelWin: () => set((s) => ({ duelWins: (s.duelWins || 0) + 1 })),
	noteDamage: (n) => {
		const add = Math.max(0, Math.floor(Number(n) || 0));
		if (!add) return;
		set({ damage: (get().damage || 0) + add });
	},
	notePlace: (place) => {
		if (!place) return;
		const s = get();
		let changed = false;
		let doneTitle = "";
		const quests = s.quests.map((quest) => {
			if (quest.claimed || quest.done || quest.kind !== "bridge") return quest;
			const seen = quest.seen ?? [];
			if (seen.includes(place)) return quest;
			changed = true;
			const have = seen.length + 1;
			const done = have >= quest.need;
			if (done) doneTitle = `${quest.title} hazır. Köprü görevi teslim edilir.`;
			return {
				...quest,
				seen: [...seen, place],
				have,
				done
			};
		});
		if (!changed) return;
		set({
			quests,
			toast: doneTitle || s.toast
		});
	},
	noteMentor: () => bumpQuest(get, set, "mentor"),
	deposit: (index) => {
		const s = get();
		const it = s.bag[index];
		if (!it || it.id === "starter-chest") return;
		const hole = s.depot.findIndex((slot) => slot == null);
		if (hole < 0) {
			set({ toast: "Depo dolu" });
			return;
		}
		const bag = s.bag.slice();
		const depot = s.depot.slice();
		bag[index] = null;
		depot[hole] = it;
		set({
			bag,
			depot,
			toast: `${it.name} depoya kondu`
		});
	},
	withdraw: (index) => {
		const s = get();
		const it = s.depot[index];
		if (!it) return;
		const hole = s.bag.findIndex((slot, i) => i < openBagCount(s.bagStage) && slot == null);
		if (hole < 0) {
			set({ toast: "Çanta dolu" });
			return;
		}
		const bag = s.bag.slice();
		const depot = s.depot.slice();
		depot[index] = null;
		bag[hole] = it;
		set({
			bag,
			depot,
			toast: `${it.name} çantaya alındı`
		});
	},
	interact: () => {
		const near = get().near;
		if (!near) return;
		if (near === "mentor") {
			const row = MENTORS.find((mentor) => mentor.id === get().mentor);
			if (!row || row.cls !== get().classId) {
				set({ toast: "Bu usta senin sınıfın değil" });
				return;
			}
			const key = `${get().classId}:${row.tree}`;
			if (get().chosenTree && get().chosenTree !== key) {
				set({ toast: "Başka bir yetenek ağacı seçtin" });
				return;
			}
			get().noteMentor();
			const bank = get().skillBank || 0;
			const points = get().skillPoints + bank;
			set({
				charOpen: true,
				charTab: "skills",
				invOpen: false,
				shop: null,
				mentored: true,
				skillPoints: points,
				skillBank: 0,
				toast: bank ? `Usta ağacı açtı. ${points} yetenek puanın kullanılabilir.` : "Usta ağacı açtı. Bundan sonra her seviyede 2 yetenek puanı gelir."
			});
			return;
		}
		if (near === "guard" || near === "herald") {
			bumpQuest(get, set, "talk", near === "herald" ? "herald" : "guard");
			const s = get();
			const mapId = questMapFor(near, s.mentor);
			const ready = readyForNpc(s.quests, near, mapId);
			const active = activeForNpc(s.quests, near, mapId);
			const offer = offerForNpc(s.quests, s.level, near, mapId);
			const locked = storyLockForNpc(s.quests, s.level, near, mapId);
			const underway = active && !active.done && !(active.need > 0 && active.have >= active.need);
			if (ready || offer || locked || underway) {
				set({
					shop: near === "herald" ? "herald" : "guard",
					boardFor: near,
					boardMap: mapId,
					npcAsk: null,
					charOpen: false,
					invOpen: false,
				});
				return;
			}
			const doneElse = s.quests.find((quest) => !quest.claimed && (quest.done || (quest.need > 0 && quest.have >= quest.need)));
			if (doneElse) {
				set({
					toast: `${doneElse.title} — ${giverLabel(questGiver(questBoardRow(doneElse)))} teslim alır.`,
					shop: null,
					boardFor: null,
					boardMap: null,
					npcAsk: null,
				});
				return;
			}
			const story = nextStoryRow(s.quests);
			const who = story ? giverLabel(questGiver(story)) : "";
			const lock = story && s.level < story.min ? ` Seviye ${story.min} gerekir.` : "";
			set({
				toast: story ? `Sıradaki görev ${who} üzerinde.${lock}` : "Bu bölgenin görevi bitti",
				shop: null,
				boardFor: null,
				boardMap: null,
				npcAsk: null,
			});
			return;
		}
		if (near === "smith" || near === "market" || near === "fisher" || near === "miner" || near === "craft") {
			bumpQuest(get, set, "talk", near);
		}
		if (near === "gate") {
			set({ shop: "gate", charOpen: false, npcAsk: null });
			return;
		}
		if (near === "well") {
			const now = Date.now();
			if (now - get().wellAt < 72e6) {
				set({ toast: `Kuyu yarın tekrar verir. ${Math.ceil((72e6 - (now - get().wellAt)) / 6e4)} dk` });
				return;
			}
			set({
				wellAt: now,
				bonusUntil: now + 9e5,
				toast: "Kuyu 15 dakika %15 altın ve XP verdi"
			});
			return;
		}
		if (near === "boss") {
			set({ bossPrompt: get().mentor || null, shop: null, invOpen: false, charOpen: false, npcAsk: null });
			return;
		}
		if (near === "fish") {
			get().beginFish();
			return;
		}
		if (near === "vein") {
			set({ toast: "Taşa tıkla, sonra Space" });
			return;
		}
		set((s) => {
			const opening = s.shop !== near;
			const leaving = !opening || near !== "smith";
			const vendor = near === "weapon" || near === "armor" || near === "market" || near === "stable" || near === "fisher" || near === "miner" || near === "smith" || near === "craft" || near === "depot";
			let bag = s.bag;
			let toast = s.toast;
			let quests = s.quests;
			if (opening && near === "fisher") {
				const needsBait = quests.some((quest) => !quest.claimed && (quest.id === "q-yem" || quest.kind === "fish"));
				const hasBait = bag.some((item) => item?.id === "yem" && (item.count ?? 1) > 0);
				if (needsBait && !hasBait) {
					bag = bag.slice();
					for (let n = 0; n < 12; n++) pushMat(bag, s.bagStage, { id: "yem", name: "Yem", desc: "Yemsiz olta suya inmez." });
					toast = "Balıkçı 12 yem verdi";
				} else {
					const bring = quests.find((quest) => !quest.claimed && !quest.done && quest.have < quest.need && quest.kind === "bring" && (quest.id === "q-yem" || quest.mob === "yem"));
					if (bring && hasBait) {
						bag = bag.slice();
						const idx = bag.findIndex((item) => item?.id === "yem" && (item.count ?? 1) > 0);
						if (idx >= 0) {
							const it = bag[idx];
							const left = (it.count ?? 1) - 1;
							bag[idx] = left > 0 ? { ...it, count: left } : null;
							const have = bring.have + 1;
							const done = have >= bring.need;
							quests = quests.map((quest) => quest.id === bring.id ? { ...quest, have, done } : quest);
							toast = done ? `${bring.title} hazır. Balıkçıya teslim et.` : `Yem verildi · ${have}/${bring.need}`;
						}
					}
				}
			}
			const questNpc = near === "smith" || near === "market" || near === "fisher" || near === "miner" || near === "stable" || near === "craft";
			if (opening && questNpc) {
				const mapId = questMapFor(near, s.mentor);
				const ready = readyForNpc(quests, near, mapId);
				const active = activeForNpc(quests, near, mapId);
				const offer = offerForNpc(quests, s.level, near, mapId);
				const locked = storyLockForNpc(quests, s.level, near, mapId);
				const underway = active && !active.done && !(active.need > 0 && active.have >= active.need);
				const elsewhere = quests.find((quest) => !quest.claimed && (quest.done || (quest.need > 0 && quest.have >= quest.need)) && !questMatchesNpc(questBoardRow(quest), near, mapId));
				if (ready || (offer && !active)) {
					return { shop: "guard", boardFor: near, boardMap: mapId, charOpen: false, npcAsk: null, invOpen: false, bag, toast, quests, ...(leaving ? releaseWork(s) : {}) };
				}
				if (underway || locked || elsewhere) {
					return { npcAsk: near, shop: null, boardFor: null, boardMap: null, invOpen: false, charOpen: false, bag, toast, quests, ...(leaving ? releaseWork(s) : {}) };
				}
			}
			return {
				...(leaving ? releaseWork(s) : {}),
				shop: opening ? near : null,
				boardFor: null,
				boardMap: null,
				npcAsk: null,
				bag,
				toast,
				quests,
				invOpen: s.invOpen,
				charOpen: false
			};
		});
	},
	openBagChest: (index) => {
		const s = get();
		const it = s.bag[index];
		if (!it) return;
		if (it.kind === "chest" && Array.isArray(it.loot)) {
			const bag = s.bag.slice();
			const limit = openBagCount(s.bagStage);
			const pending = it.loot.slice();
			bag[index] = null;
			for (const drop of pending) {
				let placed = false;
				if (drop.kind === "mat" || drop.kind === "potion" || drop.kind === "fish" || drop.kind === "book") {
					const stack = bag.findIndex((slot, i) => i < limit && slot?.id === drop.id && (slot.count ?? 1) + (drop.count ?? 1) <= 200);
					if (stack >= 0) {
						bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + (drop.count ?? 1) };
						placed = true;
					}
				}
				if (!placed) {
					const hole = bag.findIndex((slot, i) => i < limit && slot == null);
					if (hole < 0) {
						set({ toast: "Envanterinde yer yok" });
						return;
					}
					bag[hole] = drop;
				}
			}
			set({ bag, toast: `${it.name} açıldı` });
			systemSay(`${it.name} açıldı`);
			return;
		}
		if (it.id !== "starter-chest") return;
		const made = starterWeapon(s.classId);
		const bag = s.bag.slice();
		bag[index] = null;
		const hole = bag.findIndex((slot) => slot == null);
		if (hole < 0) bag[index] = made;
		else bag[hole] = made;
		const trial = bag.slice();
		const room = openBagCount(s.bagStage);
		const pots = putStack(trial, potionStack("pot-hp-s", 10), room) && putStack(trial, potionStack("pot-mp-s", 10), room);
		set({
			bag: pots ? trial : bag,
			starterPots: pots || s.starterPots,
			toast: pots ? `Sandık açıldı. ${made.name}, 10 S can ve 10 S mana iksiri geldi` : `Sandık açıldı. ${made.name} geldi. İksirler için yer yok`
		});
	},
	equipFromBag: (index) => {
		const s = get();
		const it = s.bag[index];
		if (!it) return;
		if (it.id === "starter-chest" || it.kind === "chest") {
			get().openBagChest(index);
			return;
		}
		if (it.kind === "mount" || it.id === "binek-at") {
			const bag = s.bag.slice();
			bag[index] = s.mountItem;
			const steed = horseCoat(it.coatId) || s.steed;
			set({ bag, mountItem: it, steed, toast: "At kuşanıldı." });
			return;
		}
		if (it.kind && it.kind !== "gear" && it.id !== "kazma" && it.id !== "olta") {
			get().useBagItem(index);
			return;
		}
		if (it.slot === "weapon") {
			const tagged = it.forClass && it.forClass !== "hepsi";
			if (tagged ? it.forClass !== s.classId : !weaponFits(s.classId, it.id)) {
				set({ toast: "Bu silah senin sınıfına ait değil" });
				return;
			}
		} else if (it.forClass && it.forClass !== "hepsi" && it.forClass !== s.classId) {
			set({ toast: "Bu eşya senin sınıfına ait değil" });
			return;
		}
		const need = itemNeed(it);
		if (need > s.level) {
			set({ toast: `Seviye ${need} gerekir` });
			return;
		}
		const prev = s.equipped[it.slot];
		if (prev?.uid === it.uid) return;
		const bag = s.bag.slice();
		bag[index] = null;
		if (prev && !bag.some((x) => x?.uid === prev.uid)) bag[index] = prev;
		const equipped = {
			...s.equipped,
			[it.slot]: it
		};
		const next = {
			...s,
			bag,
			equipped,
			gearRev: s.gearRev + 1,
			toast: "",
			chore: it.slot === "weapon" ? null : s.chore,
			vein: it.slot === "weapon" && it.id !== "kazma" ? null : s.vein
		};
		applyVitals(next, false);
		rememberFill(s, next);
		systemSay(`${displayName(it)} giyildi`);
		set(next);
	},
	unequip: (slot) => {
		const s = get();
		const it = s.equipped[slot];
		if (!it) return;
		const bag = s.bag.slice();
		if (bag.findIndex((x) => x?.uid === it.uid) < 0) {
			const empty = bag.findIndex((x) => x == null);
			if (empty < 0) {
				set({ toast: "Çanta dolu" });
				return;
			}
			bag[empty] = it;
		}
		const equipped = {
			...s.equipped,
			[slot]: null
		};
		const next = {
			...s,
			bag,
			equipped,
			gearRev: s.gearRev + 1,
			toast: "",
			chore: slot === "weapon" ? null : s.chore,
			vein: slot === "weapon" ? null : s.vein
		};
		applyVitals(next, false);
		set(next);
	},
	placeEquip: (slot, index) => {
		const s = get();
		const it = s.equipped[slot];
		if (!it || index < 0 || index >= s.bag.length) return;
		if (index >= openBagCount(s.bagStage)) {
			set({ toast: "Slot kilitli" });
			return;
		}
		const bag = s.bag.slice();
		const other = bag[index] ?? null;
		const equipped = { ...s.equipped };
		if (!other) {
			bag[index] = it;
			equipped[slot] = null;
		} else if (other.id !== "starter-chest" && other.slot === slot) {
			bag[index] = it;
			equipped[slot] = other;
		} else {
			const empty = bag.findIndex((x) => x == null);
			if (empty < 0) {
				set({ toast: "Çanta dolu" });
				return;
			}
			bag[empty] = other;
			bag[index] = it;
			equipped[slot] = null;
		}
		const next = {
			...s,
			bag,
			equipped,
			gearRev: s.gearRev + 1,
			toast: ""
		};
		applyVitals(next, false);
		rememberFill(s, next);
		set(next);
	},
	moveToPage: (from, page) => {
		const s = get();
		if (from < 0 || from >= s.bag.length) return;
		const item = s.bag[from];
		if (!item) return;
		const start = page * PAGE_SIZE;
		if (from >= start && from < start + PAGE_SIZE) return;
		const open = openBagCount(s.bagStage);
		const bag = s.bag.slice();
		let dest = -1;
		for (let i = 0; i < PAGE_SIZE; i++) {
			const index = start + i;
			if (index < open && bag[index] == null) {
				dest = index;
				break;
			}
		}
		if (dest < 0) {
			set({ toast: start >= open ? "Slot kilitli" : "Bu pencere dolu" });
			return;
		}
		bag[dest] = item;
		bag[from] = null;
		set({
			bag,
			toast: `${displayName(item)} pencere ${page + 1}`
		});
	},
	swapBag: (from, to) => {
		const s = get();
		if (from === to || from < 0 || to < 0 || from >= s.bag.length || to >= s.bag.length) return;
		const open = openBagCount(s.bagStage);
		if (from >= open || to >= open) {
			set({ toast: "Slot kilitli" });
			return;
		}
		const bag = s.bag.slice();
		const tmp = bag[from];
		bag[from] = bag[to] ?? null;
		bag[to] = tmp ?? null;
		set({ bag });
	},
	buy: (id) => {
		const def = SHOP.find((x) => x.id === id);
		if (!def || def.kind === "book") return;
		const s = get();
		const cost = priceOf(def.id, def.price);
		if (s.gold < cost) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		const bag = s.bag.slice();
		const limit = openBagCount(s.bagStage);
		if (def.kind && def.kind !== "gear") {
			const stack = bag.findIndex((item, i) => i < limit && item?.id === def.id && (item.count ?? 1) < 200);
			if (stack >= 0) {
				const pile = bag[stack];
				bag[stack] = {
					...pile,
					count: Math.min(200, (pile.count ?? 1) + 1)
				};
				set({
					bag,
					gold: s.gold - cost,
					toast: `${def.name} alındı`
				});
				return;
			}
		}
		const empty = bag.findIndex((item, i) => i < limit && item == null);
		if (empty < 0) {
			set({ toast: "Envanterinde yer yok" });
			return;
		}
		bag[empty] = cloneShop(def);
		set({
			bag,
			gold: s.gold - cost,
			toast: `${def.name} alındı`
		});
	},
	enhance: (slot) => {
		const s = get();
		const it = s.equipped[slot];
		if (!it || it.plus >= 10) return;
		const cost = ENHANCE[it.plus] ?? 1550;
		if (s.gold < cost) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		const nextItem = {
			...it,
			plus: it.plus + 1
		};
		const bag = s.bag.map((x) => x?.uid === it.uid ? nextItem : x);
		const equipped = {
			...s.equipped,
			[slot]: nextItem
		};
		const next = {
			...s,
			bag,
			equipped,
			gold: s.gold - cost,
			gearRev: s.gearRev + 1,
			toast: `${displayName(nextItem)} güçlendirildi`
		};
		applyVitals(next, false);
		set(next);
	},
	spend: (key) => {
		const s = get();
		if (key === "ctp") return;
		if (s.unspent <= 0) return;
		if ((s.invested[key] || 0) >= 90) {
			set({ toast: "Bu statü en fazla 90" });
			return;
		}
		const invested = {
			...s.invested,
			[key]: s.invested[key] + 1
		};
		const next = {
			...s,
			invested,
			unspent: s.unspent - 1,
			toast: `${STAT_LABEL[key]} +1`
		};
		applyVitals(next, false);
		if (key === "hp") next.hp = Math.min(next.hpMax, next.hp + 6);
		set(next);
	},
	grantXp: (amount) => {
		const boosted = bonusLive(get().bonusUntil) ? Math.round(amount * 1.15) : amount;
		const s = { ...get() };
		const notes = [];
		s.xp += boosted;
		while (s.xp >= s.xpTo && s.level < 99) {
			s.xp -= s.xpTo;
			s.level += 1;
			s.xpTo = xpForLevel(s.level);
			while (s.vials < 4) {
				s.vials += 1;
				s.unspent += 1;
			}
			s.vials = 0;
			if (s.mentored) s.skillPoints += SKILL_PER_LEVEL;
			else s.skillBank = (s.skillBank || 0) + SKILL_PER_LEVEL;
			notes.push(`Seviye ${s.level}`);
		}
		if (s.level >= 99) s.xp = Math.min(s.xp, Math.max(0, s.xpTo - 1));
		const filled = Math.min(4, Math.floor(s.xp / s.xpTo * 4 + 1e-6));
		let vialJumped = false;
		while (s.vials < filled) {
			s.vials += 1;
			s.unspent += 1;
			vialJumped = true;
		}
		applyVitals(s, notes.some((n) => n.startsWith("Seviye")) || vialJumped);
		if (notes.length) {
			s.toast = notes[notes.length - 1];
			levelPing = s.level;
		}
		set(s);
		ensureQuest(get, set);
		return notes;
	},
	addGold: (n) => set((s) => {
		const gain = Math.max(0, Math.floor(bonusLive(s.bonusUntil) ? Math.round(n * 1.15) : n));
		return { gold: s.gold + gain, goldEarned: (s.goldEarned || 0) + gain };
	}),
	imbue: (from, to) => {
		const s = get();
		const scroll = s.bag[from];
		const it = s.bag[to];
		if (!scroll || !it || from === to) return;
		if (scroll.id !== "mistik-efsun" && scroll.id !== "mistik-degistirici") return;
		if (it.kind && it.kind !== "gear") {
			set({ toast: "Efsun yalnızca ekipmana gider" });
			return;
		}
		const bag = s.bag.slice();
		const left = (scroll.count ?? 1) - 1;
		bag[from] = left > 0 ? { ...scroll, count: left } : null;
		const list = Array.isArray(it.enchants) ? it.enchants.slice() : [];
		if (scroll.id === "mistik-degistirici") {
			if (!list.length) {
				set({ toast: "Bu eşyada efsun yok" });
				return;
			}
			const next = list.map((row, index) => rollEnchant(it.slot, list.filter((_, i) => i !== index)) || row);
			bag[to] = { ...it, enchants: dedupeEnchants(next) };
			set({ bag, gearRev: s.gearRev + 1, toast: "Efsunlar değişti" });
			bumpQuest(get, set, "reroll");
			return;
		}
		if (list.length >= 5) {
			set({ toast: "En fazla 5 efsun" });
			return;
		}
		const rolled = rollEnchant(it.slot, list);
		if (!rolled) {
			set({ toast: "Bu eşyada yeni efsun kalmadı" });
			return;
		}
		list.push(rolled);
		bag[to] = { ...it, enchants: dedupeEnchants(list) };
		const equipped = { ...s.equipped };
		for (const slot of Object.keys(equipped)) if (equipped[slot]?.uid === it.uid) equipped[slot] = bag[to];
		const next = { ...s, bag, equipped, gearRev: s.gearRev + 1, toast: list[list.length - 1].name };
		applyVitals(next, false);
		set(next);
		bumpQuest(get, set, "enchant");
	},
	listStall: (index, price) => {
		const s = get();
		const it = s.bag[index];
		const cost = Math.max(1, Math.floor(Number(price) || 0));
		if (!it || !Array.isArray(s.stall)) return;
		if (s.stall.length >= 12) {
			set({ toast: "Pazar dolu" });
			return;
		}
		if (it.id === "starter-chest" || it.kind === "bag") {
			set({ toast: "Bu eşya satılmaz" });
			return;
		}
		if (s.stall.some((row) => row.uid === it.uid || row.item?.uid === it.uid)) {
			set({ toast: "Bu eşya zaten satışta" });
			return;
		}
		const characterId = useSession.getState().activeId;
		if (!characterId) {
			set({ toast: "Pazar hazır değil" });
			return;
		}
		const here = readSim();
		const spot = s.stallSpot || { x: here.x, z: here.z };
		void import("@/game/field").then((mod) => mod.noteStallEdit());
		void offerStallItem({
			data: { id: characterId, nick: s.nick, x: spot.x, z: spot.z, price: cost, item: it },
		}).then((res) => {
			const live = get();
			const still = live.bag[index];
			if (!res.ok || !res.listed || !still || still.uid !== it.uid) {
				set({ toast: !res.ok || res.reason === "full" ? "Pazar dolu" : "Pazara konamadı" });
				if (res.listed && (!still || still.uid !== it.uid)) {
					void takeOwnStallItem({ data: { id: characterId, uid: it.uid } });
				}
				return;
			}
			const bag = live.bag.slice();
			bag[index] = null;
			const stall = Array.isArray(live.stall) ? live.stall.slice() : [];
			if (!stall.some((row) => row.uid === it.uid)) stall.push({ uid: it.uid, item: it, price: cost });
			set({
				bag,
				stall,
				stallSpot: live.stallSpot || spot,
				toast: `${it.name} satışta · ${cost} altın`,
			});
			bumpQuest(get, set, "list");
		}).catch(() => set({ toast: "Pazar yanıt vermedi" }));
	},
	fulfillStall: (uid, price) => {
		const s = get();
		if (!Array.isArray(s.stall)) return null;
		const row = s.stall.find((entry) => entry.uid === uid);
		if (!row || row.price !== Math.max(1, Math.floor(Number(price) || 0))) return null;
		set({
			stall: s.stall.filter((entry) => entry.uid !== uid),
			stallBank: (s.stallBank || 0) + row.price,
			toast: `${row.item?.name || "Eşya"} satıldı · ${row.price} altın kumbara'ya`
		});
		bumpQuest(get, set, "sale");
		return { item: row.item, price: row.price };
	},
	unlistStall: (id) => {
		const s = get();
		if (!Array.isArray(s.stall)) return;
		const row = s.stall.find((entry) => entry.uid === id);
		if (!row) return;
		const limit = openBagCount(s.bagStage);
		if (s.bag.findIndex((slot, i) => i < limit && slot == null) < 0) {
			set({ toast: "Çanta dolu" });
			return;
		}
		const characterId = useSession.getState().activeId;
		if (!characterId) return;
		void import("@/game/field").then((mod) => mod.noteStallEdit());
		void takeOwnStallItem({ data: { id: characterId, uid: id } }).then((res) => {
			const live = get();
			if (!res.ok || !res.item) {
				set({
					stall: Array.isArray(live.stall) ? live.stall.filter((entry) => entry.uid !== id) : live.stall,
					toast: "Bu eşya satılmış, altın kumbarada",
				});
				return;
			}
			const bag = live.bag.slice();
			const hole = bag.findIndex((slot, i) => i < openBagCount(live.bagStage) && slot == null);
			if (hole < 0) {
				const spot = live.stallSpot || { x: readSim().x, z: readSim().z };
				void offerStallItem({ data: { id: characterId, nick: live.nick, x: spot.x, z: spot.z, price: row.price, item: res.item } });
				set({ toast: "Çanta dolu" });
				return;
			}
			bag[hole] = res.item;
			set({
				bag,
				stall: Array.isArray(live.stall) ? live.stall.filter((entry) => entry.uid !== id) : live.stall,
				toast: "Satıştan kaldırıldı",
			});
		}).catch(() => set({ toast: "Pazar yanıt vermedi" }));
	},
	sellFromBag: (index) => {
		const s = get();
		const it = s.bag[index];
		if (!it) return;
		if (it.id === "starter-chest" || it.kind === "bag") {
			set({ toast: "Bu eşya satılmaz" });
			return;
		}
		const bag = s.bag.slice();
		const gold = saleGold(it);
		bag[index] = null;
		set({ bag, gold: s.gold + gold, toast: `${it.name} satıldı · ${gold} altın` });
		bumpQuest(get, set, "sell");
	},
	sellEquipped: (slot) => {
		const s = get();
		const it = s.equipped[slot];
		if (!it) return;
		if (it.id === "starter-chest" || it.kind === "bag") {
			set({ toast: "Bu eşya satılmaz" });
			return;
		}
		const gold = saleGold(it);
		const equipped = { ...s.equipped, [slot]: null };
		const next = { ...s, equipped, gold: s.gold + gold, gearRev: s.gearRev + 1, toast: `${it.name} satıldı · ${gold} altın` };
		applyVitals(next, false);
		set(next);
		bumpQuest(get, set, "sell");
	},
	toggleRide: () => {
		const s = get();
		if (s.down) return;
		if (s.chore) {
			set({ toast: "Önce elindeki işi bırak" });
			return;
		}
		const limit = openBagCount(s.bagStage);
		if (s.riding) {
			set({ riding: false, toast: "Attan indin" });
			return;
		}
		const bag = s.bag.slice();
		let item = s.mountItem;
		if (!item) {
			const idx = bag.findIndex((slot, i) => i < limit && (slot?.id === "binek-at" || slot?.kind === "mount"));
			if (idx >= 0) {
				item = bag[idx];
				bag[idx] = null;
			}
		}
		const earned = s.quests.some((quest) => quest.id === "q-at" && quest.claimed);
		if (!item && (s.steed || earned)) item = horseItem(s.steed ? horseCoat(s.steed.id) : HORSE_COATS[0]);
		if (!item) {
			set({ toast: s.level >= 15 ? "Atın yok. Seyis'in Atı görevini bitir." : "At görevi 15. seviyede açılır." });
			return;
		}
		const steed = s.steed || horseCoat(item.coatId);
		set({ bag, mountItem: item, steed, riding: true, toast: `${steed.name} ata bindin.` });
	},
	drinkPotion: (kind) => {
		const s = get();
		if (s.down) return;
		const pot = s.pots[kind];
		if (!pot || (pot.count ?? 1) <= 0) {
			set({ toast: kind === "hp" ? "Can yuvası boş. Kırmızı iksiri sürükle." : "Mana yuvası boş. Mavi iksiri sürükle." });
			return;
		}
		if (kind === "hp" && s.hp >= s.hpMax - 0.4) {
			set({ toast: "Canın zaten dolu" });
			return;
		}
		if (kind === "mp" && s.mana >= s.manaMax - 0.4) {
			set({ toast: "Manan zaten dolu" });
			return;
		}
		const left = (pot.count ?? 1) - 1;
		const pots = { ...s.pots, [kind]: left > 0 ? { ...pot, count: left } : null };
		if (kind === "hp") {
			const hp = Math.min(s.hpMax, s.hp + potTier(pot.id));
			liveHp = hp;
			set({ pots, hp, toast: pot.name });
			return;
		}
		const mana = Math.min(s.manaMax, s.mana + potTier(pot.id));
		liveMana = mana;
		set({ pots, mana, toast: pot.name });
	},
	setBeltPot: (kind, index) => {
		const s = get();
		const it = s.bag[index];
		const want = kind === "hp" ? "pot-hp" : "pot-mp";
		if (!it || !String(it.id).startsWith(want)) {
			set({ toast: kind === "hp" ? "Can yuvasına kırmızı iksir sürükle" : "Mana yuvasına mavi iksir sürükle" });
			return;
		}
		const bag = s.bag.slice();
		bag[index] = null;
		const prev = s.pots[kind];
		if (prev && prev.id === it.id) {
			const count = (prev.count ?? 1) + (it.count ?? 1);
			const pots = { ...s.pots, [kind]: { ...prev, count: Math.min(200, count) } };
			if (count > 200) bag[index] = { ...it, count: count - 200 };
			set({ bag, pots, toast: `${it.name} yuvaya kondu` });
			return;
		}
		if (prev) bag[index] = prev;
		set({ bag, pots: { ...s.pots, [kind]: it }, toast: `${it.name} yuvaya kondu` });
	},
	takeBeltPot: (kind, index) => {
		const s = get();
		const pot = s.pots[kind];
		if (!pot) return;
		if (index < 0 || index >= openBagCount(s.bagStage)) {
			set({ toast: "Slot kilitli" });
			return;
		}
		const bag = s.bag.slice();
		const other = bag[index];
		if (!other) {
			bag[index] = pot;
			set({ bag, pots: { ...s.pots, [kind]: null }, toast: `${pot.name} çantaya alındı` });
			return;
		}
		if (other.id === pot.id && (other.count ?? 1) + (pot.count ?? 1) <= 200) {
			bag[index] = { ...other, count: (other.count ?? 1) + (pot.count ?? 1) };
			set({ bag, pots: { ...s.pots, [kind]: null }, toast: `${pot.name} çantaya alındı` });
			return;
		}
		set({ toast: "Yuva dolu" });
	},
	restoreStall: (id, item, price) => {
		const s = get();
		const stall = Array.isArray(s.stall) ? s.stall.slice() : [];
		if (!stall.some((row) => row.uid === id)) stall.push({ uid: id || item.uid, item, price: Math.max(1, price) });
		const here = readSim();
		set({
			stall,
			gold: Math.max(0, s.gold - Math.max(0, price)),
			stallSpot: s.stallSpot || { x: here.x, z: here.z },
			toast: "Alıcıda yer yoktu, eşya pazarda kaldı"
		});
	},
	closeStall: () => {
		const s = get();
		const rows = s.stall || [];
		const limit = openBagCount(s.bagStage);
		const free = s.bag.filter((slot, i) => i < limit && slot == null).length;
		if (rows.length && free < rows.length) {
			set({ toast: "Çanta dolu, bazı ilanlar duruyor" });
			return;
		}
		const characterId = useSession.getState().activeId;
		const finish = (left) => set({
			stall: left.length ? left : null,
			stallSpot: left.length ? get().stallSpot : null,
			shop: null,
			toast: left.length ? "Çanta dolu, bazı ilanlar duruyor" : "Pazar kapatıldı",
		});
		if (!characterId || !rows.length) {
			finish([]);
			return;
		}
		void import("@/game/field").then((mod) => mod.noteStallEdit());
		void clearOwnStall({ data: { id: characterId } }).then((res) => {
			if (!res.ok) {
				set({ toast: "Pazar kapanmadı, tekrar dene" });
				return;
			}
			const live = get();
			const bag = live.bag.slice();
			const open = openBagCount(live.bagStage);
			const left = [];
			for (const row of res.items) {
				const hole = bag.findIndex((slot, i) => i < open && slot == null);
				if (hole >= 0) bag[hole] = row.item;
				else left.push(row);
			}
			const spot = live.stallSpot || { x: readSim().x, z: readSim().z };
			for (const row of left) {
				void offerStallItem({ data: { id: characterId, nick: live.nick, x: spot.x, z: spot.z, price: row.price, item: row.item } });
			}
			set({
				bag,
				stall: left.length ? left : null,
				stallSpot: left.length ? spot : null,
				shop: null,
				toast: left.length ? "Çanta dolu, bazı ilanlar duruyor" : "Pazar kapatıldı",
			});
		}).catch(() => set({ toast: "Pazar yanıt vermedi" }));
	},
	tidyBag: () => {
		const s = get();
		const limit = openBagCount(s.bagStage);
		const bag = s.bag.slice();
		const groups = new Map();
		const holes = [];
		const stackable = (it) => it && (it.kind === "mat" || it.kind === "potion" || it.kind === "fish" || it.kind === "book");
		for (let i = 0; i < limit; i++) {
			const it = bag[i];
			if (!stackable(it)) continue;
			const row = groups.get(it.id) || { proto: it, n: 0 };
			row.n += it.count ?? 1;
			groups.set(it.id, row);
			bag[i] = null;
			holes.push(i);
		}
		let cursor = 0;
		for (const row of groups.values()) {
			let left = row.n;
			while (left > 0 && cursor < holes.length) {
				const take = Math.min(200, left);
				bag[holes[cursor]] = { ...row.proto, count: take, uid: cursor === 0 ? row.proto.uid : uid() };
				left -= take;
				cursor += 1;
			}
		}
		set({ bag, toast: "Envanter düzenlendi" });
	},
	stowMount: (index) => {
		const s = get();
		if (s.riding) {
			set({ toast: "Önce attan in" });
			return;
		}
		const it = s.mountItem;
		if (!it || index < 0 || index >= s.bag.length) return;
		if (index >= openBagCount(s.bagStage)) {
			set({ toast: "Kilitli yuva" });
			return;
		}
		const bag = s.bag.slice();
		const other = bag[index];
		if (!other) {
			bag[index] = it;
			set({ bag, mountItem: null, toast: "At çantaya alındı" });
			return;
		}
		if (other.kind === "mount" || other.id === "binek-at") {
			bag[index] = it;
			set({ bag, mountItem: other, steed: horseCoat(other.coatId) || s.steed, toast: "At değişti" });
			return;
		}
		set({ toast: "Bu yuva dolu" });
	},
	buyOffer: (id) => {
		const offer = BAZAAR_OFFERS.find((row) => row.id === id);
		if (!offer) return;
		const s = get();
		if (s.gold < offer.price) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		const bag = s.bag.slice();
		const hole = bag.findIndex((slot, i) => i < openBagCount(s.bagStage) && slot == null);
		if (hole < 0) {
			set({ toast: "Çanta dolu" });
			return;
		}
		bag[hole] = {
			uid: uid(),
			id: offer.id,
			name: offer.name,
			slot: offer.slot,
			level: offer.level,
			plus: 0,
			str: offer.str,
			hp: offer.hp,
			ats: offer.ats,
			mvs: offer.mvs,
			ctp: 0,
			desc: classLine(offer.slot, offer.forClass),
			kind: "gear",
			req: offer.level,
			forClass: offer.forClass,
			price: offer.price
		};
		set({ bag, gold: s.gold - offer.price, toast: `${offer.name} alındı` });
	},
	craftItem: (id) => {
		const recipe = CRAFTS.find((row) => row.id === id);
		if (!recipe) return;
		const s = get();
		if (s.level < 30) {
			set({ toast: "Üretim için 30. seviye gerekir" });
			return;
		}
		if (s.gold < recipe.gold) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		const bag = s.bag.slice();
		const have = (oreId) => bag.reduce((sum, item) => sum + (item && item.id === oreId ? item.count ?? 1 : 0), 0);
		for (const [oreId, need] of recipe.ores) {
			if (have(oreId) < need) {
				set({ toast: "Maden yetmiyor" });
				return;
			}
		}
		if (recipe.book) {
			const limit = openBagCount(s.bagStage);
			const canStack = bag.some((slot, i) => i < limit && slot?.id === recipe.book && (slot.count ?? 1) < 200);
			const hole = bag.findIndex((slot, i) => i < limit && slot == null);
			if (!canStack && hole < 0) {
				set({ toast: "Çanta dolu" });
				return;
			}
		}
		for (const [oreId, need] of recipe.ores) {
			let left = need;
			for (let i = 0; i < bag.length && left > 0; i++) {
				const item = bag[i];
				if (!item || item.id !== oreId) continue;
				const count = item.count ?? 1;
				const used = Math.min(count, left);
				left -= used;
				bag[i] = count - used > 0 ? { ...item, count: count - used } : null;
			}
		}
		const hole = bag.findIndex((slot, i) => i < openBagCount(s.bagStage) && slot == null);
		if (recipe.book) {
			const book = catalogItem(recipe.book);
			if (!book) {
				set({ toast: "Kitap hazırlanamadı" });
				return;
			}
			const limit = openBagCount(s.bagStage);
			const stack = bag.findIndex((slot, i) => i < limit && slot?.id === book.id && (slot.count ?? 1) < 200);
			if (stack >= 0) bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + 1 };
			else if (hole >= 0) bag[hole] = book;
			else {
				set({ toast: "Çanta dolu" });
				return;
			}
			set({ bag, gold: s.gold - recipe.gold, toast: `${recipe.name} üretildi` });
			bumpQuest(get, set, "craft");
			return;
		}
		if (hole < 0) {
			set({ toast: "Çanta dolu" });
			return;
		}
		bag[hole] = {
			uid: uid(),
			id: recipe.id,
			name: recipe.name,
			slot: recipe.slot,
			level: recipe.req,
			plus: 0,
			str: recipe.str,
			hp: recipe.hp,
			ats: recipe.ats,
			mvs: recipe.mvs,
			ctp: 0,
			desc: classLine(recipe.slot, recipe.forClass),
			kind: "gear",
			req: recipe.req,
			forClass: recipe.forClass
		};
		set({ bag, gold: s.gold - recipe.gold, toast: `${recipe.name} üretildi` });
		bumpQuest(get, set, "craft");
	},
	setBench: (which, raw) => {
		const s = get();
		if (s.level < 30) {
			set({ toast: "30. seviye gerekir" });
			return;
		}
		if (s.riding && which === "mount") {
			set({ toast: "Önce attan in" });
			return;
		}
		const token = String(raw || "");
		const carried = readCarry();
		let worn = token === "mount:1" || (carried?.kind === "bag" && carried.index < 0 && token !== "bag");
		let index = token.startsWith("bag:") ? Number(token.slice(4)) : carried?.kind === "bag" ? carried.index : -1;
		if (token === "mount:1") worn = true;
		if (carried?.kind === "bench") return;
		const item = worn ? s.mountItem : index >= 0 ? s.bag[index] : null;
		if (!item) return;
		if (which === "mount") {
			if (item.kind !== "mount" && item.id !== "binek-at") {
				set({ toast: "İlk slota yalnızca at konur" });
				return;
			}
			const bag = s.bag.slice();
			const limit = openBagCount(s.bagStage);
			if (!worn) bag[index] = null;
			if (s.benchMount && !s.benchWorn) {
				if (worn) {
					const hole = bag.findIndex((slot, i) => i < limit && slot == null);
					if (hole < 0) {
						set({ toast: "Çanta dolu" });
						return;
					}
					bag[hole] = s.benchMount;
				} else bag[index] = s.benchMount;
			}
			set({ bag, benchMount: item, benchWorn: worn, toast: "At kondu" });
			return;
		}
		const skill = mountSkillOf(item.id);
		if (!skill) {
			set({ toast: "Buraya yalnızca yetenek kitabı konur" });
			return;
		}
		if (worn) return;
		const bag = s.bag.slice();
		const have = s.benchBook;
		if (have && have.id === item.id) {
			const sum = (have.count ?? 1) + (item.count ?? 1);
			if (sum > 200) {
				set({ toast: "Bu yığın 200'de durur" });
				return;
			}
			bag[index] = null;
			set({ bag, benchBook: { ...have, count: sum }, toast: `${item.name} kondu` });
			return;
		}
		bag[index] = have || null;
		set({ bag, benchBook: item, toast: `${item.name} kondu` });
	},
	takeBench: (which) => {
		const s = get();
		if (which === "mount") {
			if (!s.benchMount || s.benchWorn) {
				set({ benchMount: null, benchWorn: false });
				return;
			}
			const bag = s.bag.slice();
			const hole = bag.findIndex((slot, i) => i < openBagCount(s.bagStage) && slot == null);
			if (hole < 0) {
				set({ toast: "Çanta dolu" });
				return;
			}
			bag[hole] = s.benchMount;
			set({ bag, benchMount: null, benchWorn: false, toast: "At çantaya alındı" });
			return;
		}
		if (!s.benchBook) return;
		const bag = s.bag.slice();
		const limit = openBagCount(s.bagStage);
		const book = s.benchBook;
		const stack = bag.findIndex((slot, i) => i < limit && slot?.id === book.id && (slot.count ?? 1) + (book.count ?? 1) <= 200);
		if (stack >= 0) bag[stack] = { ...bag[stack], count: (bag[stack].count ?? 1) + (book.count ?? 1) };
		else {
			const hole = bag.findIndex((slot, i) => i < limit && slot == null);
			if (hole < 0) {
				set({ toast: "Çanta dolu" });
				return;
			}
			bag[hole] = book;
		}
		set({ bag, benchBook: null, toast: "Kitap çantaya alındı" });
	},
	trainMount: () => {
		const s = get();
		if (s.level < 30) {
			set({ toast: "30. seviye gerekir" });
			return;
		}
		if (!s.benchMount) {
			set({ toast: "İlk slota at koy" });
			return;
		}
		const skill = mountSkillOf(s.benchBook?.id);
		if (!skill || !s.benchBook) {
			set({ toast: "İkinci slota yetenek kitabı koy" });
			return;
		}
		const skills = clampMountSkills(s.mountSkills);
		const rank = skills[skill.id];
		if (rank >= SKILL_MAX) {
			set({ toast: `${skill.name} zaten S+` });
			return;
		}
		const cost = 150 + rank * 60;
		if (s.gold < cost) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		const left = (s.benchBook.count ?? 1) - 1;
		skills[skill.id] = rank + 1;
		set({
			gold: s.gold - cost,
			mountSkills: skills,
			benchBook: left > 0 ? { ...s.benchBook, count: left } : null,
			toast: `${skill.name} ${skillTier(rank + 1)}`
		});
	},
	loadMap: (name) => {
		if (!name || get().mapLoad) return;
		holdMapLoad(name);
	},
	travel: (id) => {
		const realm = REALMS.find((row) => row.id === id);
		const cost = GATE_COST[id] ?? 0;
		if (!realm) return;
		if (get().level < realm.min) {
			set({ toast: `${realm.name} için seviye ${realm.min} gerekir` });
			return;
		}
		if (get().gold < cost) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		set({ gold: get().gold - cost, shop: null });
		holdMapLoad(realm.name, 1700);
		window.setTimeout(() => {
			queueHop(realm.x, realm.z + (realm.id === "koy" ? 10 : 6));
		}, 700);
	},
	knockDown: () => {
		if (get().down) return;
		const here = readSim();
		liveHp = 0;
		set({ hp: 0, down: { x: here.x, z: here.z }, toast: "", chore: null });
	},
	reviveHere: () => {
		reviveBoostUntil = Date.now() + 90000;
		liveHp = 1;
		hpRegenClock = 0;
		set({ hp: 1, down: null, toast: "Canın doluyor" });
	},
	reviveTown: () => {
		const here = readSim();
		const realm = realmAt(here.x, here.z);
		queueHop(realm.x, realm.z + (realm.id === "koy" ? 10 : 6));
		const hp = get().hpMax;
		liveHp = hp;
		set({ hp, down: null, toast: `${realm.name} girişinde` });
	},
	hurtPlayer: (dmg) => {
		if (get().down) return false;
		const guard = guardUntil > Date.now() ? guardCut : 0;
		const levelDef = Math.min(0.62, Math.max(0, get().level - 1) * 0.0055);
		const ench = Math.min(0.35, enchantMods(get()).def / 100);
		const cut = Math.min(0.84, levelDef + ench);
		const dealt = Math.max(1, Math.round(dmg * (1 - Math.min(.55, guard)) * (1 - cut)));
		const hp = Math.max(0, get().hp - dealt);
		set({
			hp,
			hurt: .35
		});
		liveHp = hp;
		return hp <= 0;
	},
	tick: (dt, sprinting) => {
		const gap = skillPointGap(get());
		if (gap > 0) {
			const cur = get();
			if (cur.mentored) set({ skillPoints: cur.skillPoints + gap, toast: `Eksik ${gap} yetenek puanı verildi. Her seviyede 2 puan.` });
			else set({ skillBank: (cur.skillBank || 0) + gap });
		}
		stepChore(get, set, dt);
		const s = get();
		if (s.shop !== "stable" && (s.benchMount || s.benchBook || s.benchWorn)) {
			const back = releaseBench(s);
			if (back.bag || (back.benchWorn === false && s.benchWorn)) {
				benchWarn = false;
				set(back);
			} else if (!benchWarn && (s.benchBook || (s.benchMount && !s.benchWorn))) {
				benchWarn = true;
				set({ toast: "Çanta dolu. Yer açınca at ve kitap geri gelir." });
			}
		} else benchWarn = false;
		if (liveSta < 0 || Math.abs(s.sta - liveSta) > 2.5) liveSta = s.sta;
		if (liveMana < 0 || Math.abs(s.mana - liveMana) > 2.5) liveMana = s.mana;
		if (liveHp < 0 || s.hp < liveHp - 1.5 || s.hp > liveHp + 1.5) liveHp = s.hp;
		const drain = 1.35 * (1 - Math.min(.45, (s.skills.sv6 ?? 0) * .12)) * (s.riding && s.steed ? Math.max(0.35, 1 - Math.min(SKILL_MAX, s.mountSkills?.soluk || 0) * 0.018) : 1);
		if (staRecover > 0) {
			staRecover = Math.max(0, staRecover - dt);
			liveSta = Math.min(s.staMax, liveSta + s.staMax / 6 * dt);
			if (staRecover <= 0) liveSta = s.staMax;
		} else if (sprinting && liveSta > 0) {
			liveSta = Math.max(0, liveSta - drain * dt);
			if (liveSta <= .05) {
				liveSta = 0;
				staRecover = 6;
			}
		}
		staClock += dt;
		while (staClock >= 2) {
			staClock -= 2;
			if (staRecover <= 0 && !sprinting) liveSta = Math.min(s.staMax, liveSta + s.staMax * .04);
		}
		liveMana = Math.min(s.manaMax, liveMana + 1.15 * dt);
		if (!s.down && liveHp < s.hpMax) {
			const boosted = reviveBoostUntil > Date.now();
			const pot = regenUntil > Date.now();
			const gap = boosted ? 0.22 : pot ? 0.28 : 0.9;
			hpRegenClock += dt;
			if (hpRegenClock >= gap) {
				hpRegenClock = 0;
				liveHp = Math.min(s.hpMax, liveHp + (Math.random() < 0.5 ? 2 : 3));
			}
		} else hpRegenClock = 0;
		let hurt = s.hurt;
		if (hurt > 0) hurt = Math.max(0, hurt - dt);
		questClock += dt;
		if (questClock >= 1.4) {
			questClock = 0;
			ensureQuest(get, set);
			syncPlusQuests(get, set);
			const lock = questLevelLock();
			const now = Date.now();
			if (lock && !get().toast && now - levelLockAt > 14000) {
				levelLockAt = now;
				set({ toast: lock });
			}
		}
		const shown = (n) => Math.ceil(n);
		if (shown(liveSta) !== shown(s.sta) || shown(liveMana) !== shown(s.mana) || shown(liveHp) !== shown(s.hp) || hurt !== s.hurt) set({
			sta: liveSta,
			mana: liveMana,
			hp: liveHp,
			hurt
		});
	},
	totals: () => totalsOf(get()),
	moveSpeed: (sprinting) => {
		const s = get();
		const swift = s.swiftUntil > Date.now() ? 1.25 : 1;
		const burst = stepUntil > Date.now() ? stepMul : 1;
		const ench = enchantMods(s);
		const surat = s.riding && s.steed ? Math.max(0, Math.min(SKILL_MAX, s.mountSkills?.surat || 0)) : 0;
		const ride = s.riding && s.steed ? 1.62 * (1 + surat * 0.018) : 1;
		const walk = Math.min(4.15, (2.15 + Math.min(90, totalsOf(s).mvs) * .02) * swift * burst * (1 + Math.min(40, ench.mvs) / 100));
		const paced = walk * ride;
		const cap = s.riding && s.steed ? 8.6 + surat * 0.08 : 6.2;
		return Math.min(cap, sprinting ? paced * 1.42 : paced);
	},
	punch: () => {
		const state = get();
		const t = totalsOf(state);
		const weapon = state.equipped.weapon;
		const ench = enchantMods(state);
		const bonus = weapon ? itemStats(weapon).str * .45 : 0;
		const base = (8 + t.str * 1.15 + bonus) * (1 + ench.str / 100);
		const crit = Math.random() * 100 < t.ctp + ench.ctp;
		return {
			dmg: Math.round(base * (crit ? 1.7 : 1) * (.92 + Math.random() * .16)),
			crit
		};
	},
	attackGap: () => {
		const haste = get().hasteUntil > Date.now() ? 0.86 : 1;
		const ench = 1 + Math.min(20, enchantMods(get()).ats) / 100;
		const ats = Math.min(180, Math.max(0, totalsOf(get()).ats));
		return Math.max(0.82, (1.55 - ats * 0.0036) * haste / Math.min(1.12, ench));
	}
}));
