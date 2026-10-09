// @ts-nocheck
import { create } from "zustand";
import { readSim, queueHop } from "@/game/input";
import { REALMS, campSpawns, realmAt, realmGate, realmHerald } from "@/game/world";
import { priceOf, studioGrave, studioSafe } from "@/game/studio";

export const PAGE_SIZE = 24;
export const SKILL_MAX = 32;
export const BAG_SIZE = 72;

export type ClassId = "savasci" | "okcu" | "buyucu" | "ninja";
export type StatKey = "str" | "hp" | "ats" | "mvs" | "ctp" | "mag" | "mana";
export type EquipSlot = "weapon" | "helmet" | "armor" | "earring" | "necklace" | "bracelet" | "boots" | "ring" | "gloves" | "belt";
export type WeaponStyle = "fist" | "sword" | "bow" | "staff" | "dagger" | "pala" | "kazma" | "olta";
export type CharTab = "stats" | "skills" | "quests";
export type ShopKind = "weapon" | "armor" | "market" | "stable" | "fisher" | "miner" | "smith" | "depot" | "guard" | "herald" | "gate" | "stall" | "craft" | "bazaar";
export type NearKind = "mentor" | "smith" | "guard" | "market" | "armor" | "weapon" | "depot" | "stable" | "fisher" | "miner" | "well" | "fish" | "vein" | "herald" | "gate" | "craft" | "stall";

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
  quests: Quest[];
  depot: (Item | null)[];
  blocked: string[];
  bagStage: number;
  wellAt: number;
  bonusUntil: number;
  x?: number;
  z?: number;
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
	if (id === "kazma") return "kazma";
	if (id === "olta") return "olta";
	if (id.includes("bow")) return "bow";
	if (id.includes("staff")) return "staff";
	if (id.includes("dagger")) return "dagger";
	if (id.includes("pala")) return "pala";
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
export function skillCdLeft(id) {
	return Math.max(0, ((skillReadyAt[id] ?? 0) - Date.now()) / 1e3);
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
	if (!it || it.kind === "mat" || it.kind === "bag") return false;
	if (it.id === "kazma" || it.id === "olta" || it.id === "hizli-pazar") return it.id !== "hizli-pazar";
	if (it.forClass && it.forClass !== "hepsi" && it.forClass !== classId) return false;
	if (it.slot === "weapon" && it.kind !== "tool") return weaponFits(classId, it.id);
	return true;
}
export function classLine(slot, forClass) {
	const named = { savasci: "Savaşçı", okcu: "Okçu", buyucu: "Büyücü", ninja: "Ninja" };
	const limited = slot === "weapon" || slot === "armor" || slot === "helmet" || slot === "belt";
	if (!limited || !forClass || forClass === "hepsi") return "Bütün Karakterler Kuşanabilir";
	return named[forClass] || "Bütün Karakterler Kuşanabilir";
}
export function openBagCount(stage) {
	return 24 + Math.max(0, Math.min(4, stage)) * 12;
}
export const ENHANCE = [
	100,
	250,
	400,
	550,
	700,
	850,
	1e3,
	1250,
	1400,
	1550
];
export const PLUS_CHANCE = [90, 80, 70, 60, 50, 40, 30, 22, 15, 10];
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
		id: "pot-hp",
		name: "Can İksiri",
		slot: "belt",
		price: 18,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Canın beşte ikisini doldurur. Yığın 200.",
		shop: "market",
		kind: "potion"
	},
	{
		id: "pot-mp",
		name: "Mana İksiri",
		slot: "belt",
		price: 18,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Mananın beşte ikisini doldurur.",
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
		desc: "Envantere sürükle. Önce 2. pencere, o dolunca 3.",
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
		desc: "Binek becerisini açar.",
		shop: "stable",
		kind: "mat"
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
		req: 25
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
		req: 30
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
	{ id: "c-kask", name: "Maden Miğferi", slot: "helmet", forClass: "savasci", req: 30, gold: 2800, str: 2, hp: 36, ats: 0, mvs: 0, ores: [["demir-cevher", 6]] }
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
export function displayName(it) {
	return it.plus > 0 ? `${it.name} +${it.plus}` : it.name;
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
		desc: "Açılınca sınıfının başlangıç silahını verir ve kaybolur."
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
		str: 7,
		ats: 2,
		desc: "Başlangıç yayı. Sol elde durur."
	};
	if (id === "buyucu") return {
		...base,
		id: "starter-staff",
		name: "Asa",
		str: 6,
		hp: 6,
		desc: "Başlangıç asası."
	};
	if (id === "ninja") return {
		...base,
		id: "starter-dagger",
		name: "Hançer",
		str: 7,
		ats: 4,
		ctp: 3,
		desc: "Başlangıç hançeri."
	};
	return {
		...base,
		id: "starter-sword",
		name: "Kılıç",
		str: 9,
		desc: "Başlangıç kılıcı."
	};
}
export const QUEST_BOARD = [
	{ id: "q-merhaba", track: "ana", map: "koy", kind: "talk", talk: "guard", name: "Muhafızın Sözü", need: 1, min: 1, xp: 40, gold: 12, reward: "" },
	{ id: "q-rat", track: "ana", map: "koy", kind: "kill", mob: "rat", name: "Tarla Faresi", need: 12, min: 1, xp: 80, gold: 20, reward: "Başlangıç Zırhı" },
	{ id: "q-demirci", track: "ana", map: "koy", kind: "talk", talk: "smith", name: "Demircinin Ocağı", need: 1, min: 2, xp: 50, gold: 15, reward: "" },
	{ id: "q-hare", track: "ana", map: "koy", kind: "kill", mob: "hare", name: "Bozkır Tavşanı", need: 10, min: 3, xp: 90, gold: 24, reward: "" },
	{ id: "q-yem", track: "ana", map: "koy", kind: "bring", mob: "yem", name: "Balıkçıya Yem", need: 3, min: 4, xp: 70, gold: 18, reward: "" },
	{ id: "q-wolf", track: "ana", map: "koy", kind: "kill", mob: "wolf", name: "Gece Kurdu", need: 7, min: 5, xp: 120, gold: 36, reward: "Başlangıç Bileziği" },
	{ id: "q-frog", track: "ana", map: "koy", kind: "kill", mob: "frog", name: "Bataklık Kurbağası", need: 9, min: 8, xp: 140, gold: 40, reward: "" },
	{ id: "q-azman", track: "ana", map: "koy", kind: "kill", mob: "azman", name: "Tarla Azmanı", need: 1, min: 10, xp: 220, gold: 80, reward: "Başlangıç Küpesi" },
	{ id: "q-reis", track: "ana", map: "koy", kind: "kill", mob: "reis", name: "Kurbağa Reisi", need: 1, min: 12, xp: 260, gold: 100, reward: "" },
	{ id: "q-at", track: "ana", map: "koy2", kind: "kill", mob: "boar", name: "Yaban Domuzu", title: "Seyis'in Atı", need: 16, min: 15, xp: 640, gold: 240, reward: "At" },
	{ id: "q-jackal", track: "av", map: "koy2", kind: "kill", mob: "jackal", name: "Çakal", need: 14, min: 10, xp: 180, gold: 55, reward: "" },
	{ id: "q-boar", track: "av", map: "koy2", kind: "kill", mob: "boar", name: "Yaban Domuzu", need: 11, min: 14, xp: 220, gold: 70, reward: "" },
	{ id: "q-spider", track: "av", map: "koy2", kind: "kill", mob: "spider", name: "Mağara Örümceği", need: 9, min: 18, xp: 260, gold: 85, reward: "" },
	{ id: "q-scorp", track: "av", map: "koy2", kind: "kill", mob: "scorp", name: "Bozkır Akrebi", need: 8, min: 22, xp: 300, gold: 100, reward: "" },
	{ id: "q-kral", track: "av", map: "koy2", kind: "kill", mob: "kral", name: "Domuz Kral", need: 1, min: 24, xp: 420, gold: 160, reward: "" },
	{ id: "q-ana", track: "av", map: "koy2", kind: "kill", mob: "ana", name: "Akrep Ana", need: 1, min: 26, xp: 480, gold: 180, reward: "" },
	{ id: "q-bear", track: "av", map: "dolunay", kind: "kill", mob: "bear", name: "Orman Ayısı", need: 12, min: 25, xp: 360, gold: 120, reward: "" },
	{ id: "q-skel", track: "av", map: "dolunay", kind: "kill", mob: "skel", name: "İskelet Asker", need: 10, min: 29, xp: 420, gold: 140, reward: "" },
	{ id: "q-snake", track: "av", map: "dolunay", kind: "kill", mob: "snake", name: "Bataklık Yılanı", need: 8, min: 33, xp: 480, gold: 160, reward: "" },
	{ id: "q-goat", track: "av", map: "dolunay", kind: "kill", mob: "goat", name: "Dağ Tekesi", need: 7, min: 37, xp: 540, gold: 180, reward: "" },
	{ id: "q-ayi", track: "av", map: "dolunay", kind: "kill", mob: "ayi", name: "Ayı Reisi", need: 1, min: 40, xp: 700, gold: 240, reward: "" },
	{ id: "q-komutan", track: "av", map: "dolunay", kind: "kill", mob: "komutan", name: "İskelet Komutan", need: 1, min: 42, xp: 760, gold: 260, reward: "" },
	{ id: "q-bandit", track: "av", map: "ay", kind: "kill", mob: "bandit", name: "Harabe Haydutu", need: 15, min: 40, xp: 620, gold: 210, reward: "" },
	{ id: "q-golem", track: "av", map: "ay", kind: "kill", mob: "golem", name: "Taş Golem", need: 8, min: 44, xp: 700, gold: 240, reward: "" },
	{ id: "q-bat", track: "av", map: "ay", kind: "kill", mob: "bat", name: "Gece Yarasa", need: 11, min: 48, xp: 780, gold: 270, reward: "" },
	{ id: "q-wraith", track: "av", map: "ay", kind: "kill", mob: "wraith", name: "Buz Ruhu", need: 7, min: 52, xp: 860, gold: 300, reward: "" },
	{ id: "q-muhafiz", track: "av", map: "ay", kind: "kill", mob: "muhafiz", name: "Golem Muhafız", need: 1, min: 54, xp: 980, gold: 360, reward: "" },
	{ id: "q-lord", track: "av", map: "ay", kind: "kill", mob: "lord", name: "Ruh Lordu", need: 1, min: 56, xp: 1100, gold: 420, reward: "" },
	{ id: "y-fish", track: "yan", map: "koy", kind: "fish", name: "İlk Av", need: 3, min: 5, xp: 90, gold: 30, reward: "" },
	{ id: "y-mine", track: "yan", map: "koy", kind: "mine", name: "İlk Damarı", need: 6, min: 8, xp: 110, gold: 40, reward: "" },
	{ id: "y-sell", track: "yan", map: "koy", kind: "sell", name: "Fazlayı Sat", need: 1, min: 3, xp: 40, gold: 10, reward: "" },
	{ id: "y-stall", track: "yan", map: "koy", kind: "stall", name: "Pazar Kur", need: 1, min: 6, xp: 80, gold: 20, reward: "" },
	{ id: "y-list", track: "yan", map: "koy", kind: "list", name: "Tezgaha Koy", need: 1, min: 6, xp: 70, gold: 15, reward: "" },
	{ id: "y-sale", track: "yan", map: "koy", kind: "sale", name: "İlk Satış", need: 1, min: 6, xp: 120, gold: 25, reward: "" },
	{ id: "y-plus6", track: "yan", map: "koy", kind: "plus6", name: "Artı Altı", need: 1, min: 10, xp: 160, gold: 40, reward: "" },
	{ id: "y-plus10", track: "yan", map: "koy2", kind: "plus10", name: "Artı On", need: 1, min: 20, xp: 280, gold: 80, reward: "" },
	{ id: "y-enchant", track: "yan", map: "koy", kind: "enchant", name: "Beş Efsun", need: 5, min: 12, xp: 200, gold: 50, reward: "" },
	{ id: "y-reroll", track: "yan", map: "koy", kind: "reroll", name: "Efsun Değiştir", need: 1, min: 12, xp: 90, gold: 20, reward: "" },
	{ id: "y-craft", track: "yan", map: "koy", kind: "craft", name: "İlk İş", need: 1, min: 30, xp: 320, gold: 60, reward: "" },
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
];
export function questGuide(px, pz) {
	const open = useRpg.getState().quests.filter((quest) => !quest.claimed);
	if (!open.length) return null;
	const here = realmAt(px, pz);
	const boardOf = (quest) => QUEST_BOARD.find((row) => row.id === quest.id);
	const unfinished = open.filter((quest) => !quest.done);
	const local = unfinished.find((quest) => (boardOf(quest)?.map || quest.map) === here.id);
	const quest = local || unfinished[0] || open[0];
	const board = boardOf(quest);
	const mapId = board?.map || quest.map || "koy";
	const dest = REALMS.find((row) => row.id === mapId) || REALMS[0];
	const kind = board?.kind || quest.kind || "kill";
	if (here.id !== mapId) {
		const gate = realmGate(here.id);
		return { x: gate.x, z: gate.z, label: `Işınlayıcı · ${dest.name}`, kind: "gate" };
	}
	if (quest.done || kind === "talk" || kind === "bring") {
		const talk = board?.talk || quest.talk;
		if (!quest.done && talk === "smith") return { x: -15.05, z: 18.35, label: board?.name || "Demirci", kind: "npc" };
		if (!quest.done && talk === "market") return { x: -12.95, z: 19.85, label: board?.name || "Satıcı", kind: "npc" };
		const herald = realmHerald(mapId);
		return { x: herald.x, z: herald.z, label: quest.done ? "Görevliye dön" : (board?.name || "Görevli"), kind: "herald" };
	}
	if (kind === "fish") return { x: dest.x + (mapId === "koy" ? 33 : 2), z: dest.z + (mapId === "koy" ? 56 : 2), label: "Balık tut", kind: "npc" };
	if (kind === "stall" || kind === "list" || kind === "sale" || kind === "sell") return { x: -12.95, z: 19.85, label: board?.name || "Pazar", kind: "npc" };
	if (kind === "mine") return { x: 96, z: 40, label: "Maden", kind: "mob" };
	if (kind === "plus6" || kind === "plus10" || kind === "enchant" || kind === "reroll" || kind === "craft") {
		return { x: mapId === "koy" ? -15.05 : dest.x - 2.2, z: mapId === "koy" ? 18.35 : dest.z + 2.2, label: board?.name || "Zanaat", kind: "npc" };
	}
	const points = [];
	for (const spot of campSpawns()) {
		if (spot.realm === mapId && spot.specId === quest.mob) points.push(spot);
	}
	for (const boss of BOSSES) {
		if (boss.realm === mapId && boss.id === quest.mob) points.push(boss);
	}
	if (!points.length) {
		const herald = realmHerald(mapId);
		return { x: herald.x, z: herald.z, label: board?.name || "Görev", kind: "herald" };
	}
	let best = points[0];
	let bestD = Infinity;
	for (const spot of points) {
		const d = (spot.x - px) * (spot.x - px) + (spot.z - pz) * (spot.z - pz);
		if (d < bestD) {
			bestD = d;
			best = spot;
		}
	}
	return { x: best.x, z: best.z, label: board?.name || "Hedef", kind: "mob" };
}
export const GATE_COST = { koy: 100, koy2: 500, dolunay: 1500, ay: 4000 };
const SLOT_STONES = {
	weapon: ["tas-silah", "Silah Taşı"],
	armor: ["tas-zirh", "Zırh Taşı"],
	helmet: ["tas-kask", "Miğfer Taşı"],
	belt: ["tas-kemer", "Kemer Taşı"],
	gloves: ["tas-eldiven", "Eldiven Taşı"],
	boots: ["tas-cizme", "Çizme Taşı"],
	ring: ["tas-yuzuk", "Yüzük Taşı"],
	necklace: ["tas-kolye", "Kolye Taşı"],
	earring: ["tas-kupe", "Küpe Taşı"],
	bracelet: ["tas-bilezik", "Bilezik Taşı"]
};
export function matForPlus(plus, slot = "weapon") {
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
	const power = 4 + Math.floor(level / 4);
	return {
		uid: uid(),
		id: pick.id,
		name: pick.name,
		slot: pick.slot,
		level,
		plus: 0,
		str: pick.slot === "weapon" ? 6 + power : 1,
		hp: pick.slot === "armor" || pick.slot === "helmet" ? 8 + power * 2 : 2,
		ats: 0,
		mvs: pick.slot === "boots" ? 3 : 0,
		ctp: 0,
		desc: classLine(pick.slot, pick.forClass),
		kind: "gear",
		forClass: pick.forClass,
		enchants: []
	};
}
function matDrop(level) {
	const slots = ["weapon", "armor", "helmet", "belt", "boots", "gloves", "ring", "necklace", "earring", "bracelet"];
	const slot = slots[Math.floor(Math.random() * slots.length)];
	const plus = level >= 40 ? 7 : level >= 18 ? 4 : 0;
	const row = matForPlus(plus, slot);
	return {
		uid: uid(),
		id: row.id,
		name: row.name,
		slot: "ring",
		level: 1,
		plus: 0,
		str: 0,
		hp: 0,
		ats: 0,
		mvs: 0,
		ctp: 0,
		desc: "Yükseltme taşı. Yalnızca aynı parçaya basılır.",
		kind: "mat",
		count: 1
	};
}
export function rollKillLoot(level, boss): Item[] {
	const out = [];
	if (Math.random() < (boss ? 0.16 : 0.045)) out.push(gearDrop(level));
	if (Math.random() < (boss ? 0.22 : 0.04)) out.push(matDrop(level));
	return out;
}
export function dropTable(level) {
	return [
		`Sv.${level} silah, zırh, miğfer veya kemer`,
		"Bot, eldiven ve takı",
		"Parçaya özel yükseltme taşı (seyrek)"
	];
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
function questFromBoard(row) {
	const kind = row.kind || "kill";
	const detail = row.reward === "At" ? `${row.need} ${row.name} öldür. Ödül: at.` : kind === "talk" ? `${row.name} ile konuş.` : kind === "bring" ? `${row.need} ${row.name} götür.` : kind === "kill" ? `${row.need} ${row.name} öldür. Sv.${row.min}` : `${row.name}. Sv.${row.min}`;
	const title = row.title || row.name;
	return {
		id: row.id,
		title: row.track === "ana" ? `Ana · ${title}` : row.track === "yan" ? `Yan · ${title}` : `${title} avı`,
		detail,
		need: row.need,
		have: 0,
		kind,
		mob: row.mob,
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
	if (s.level >= 15 && !owned.has("q-at")) {
		const row = QUEST_BOARD.find((item) => item.id === "q-at");
		if (row) {
			set({
				quests: [...s.quests, questFromBoard(row)],
				toast: "Görev: Seyis'in Atı",
			});
			return;
		}
	}
	if (s.quests.some((quest) => !quest.claimed)) return;
	const main = QUEST_BOARD.find((row) => row.track !== "yan" && !owned.has(row.id) && s.level >= row.min);
	const side = QUEST_BOARD.find((row) => row.track === "yan" && !owned.has(row.id) && s.level >= row.min);
	const next = main || side;
	if (!next) return;
	set({
		quests: [...s.quests, questFromBoard(next)],
		toast: s.toast || `Görev: ${next.name}`
	});
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
	return list.map((quest) => ({
		...quest,
		seen: quest.seen ?? [],
		claimed: quest.claimed ?? Boolean(quest.done),
		minLevel: quest.minLevel ?? 1,
		have: quest.have ?? 0
	}));
}
function parkedBag(s) {
	const bag = s.bag.slice();
	const put = (item) => {
		if (!item) return;
		const hole = bag.findIndex((slot) => slot == null);
		if (hole >= 0) bag[hole] = item;
	};
	put(s.smithItem);
	put(s.smithStone);
	put(s.smithMat);
	return bag;
}
function releaseSmith(s) {
	if (!s.smithItem && !s.smithStone && !s.smithMat) return {};
	return {
		bag: parkedBag(s),
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
		quests: s.quests,
		depot: s.depot,
		blocked: s.blocked,
		bagStage: s.bagStage,
		wellAt: s.wellAt,
		bonusUntil: s.bonusUntil,
		stall: s.stall,
		steed: s.steed,
		riding: s.riding,
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
var saleClock = 0;
var questClock = 0;
var staRecover = 0;
var liveSta = -1;
var liveMana = -1;
var liveHp = -1;
var pendingCast = null;
var guardUntil = 0;
var guardCut = 0;
var stepUntil = 0;
var stepMul = 1;
var regenUntil = 0;
export function takeCast() {
	const next = pendingCast;
	pendingCast = null;
	return next;
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
		if (quest.claimed || quest.done || quest.kind !== kind) return quest;
		if (kind === "kill" && quest.mob !== mobId) return quest;
		if (kind === "talk" && quest.talk !== mobId) return quest;
		changed = true;
		const have = quest.have + 1;
		const done = have >= quest.need;
		if (done) doneTitle = quest.title;
		return {
			...quest,
			have,
			done
		};
	});
	if (!changed) return;
	set({
		quests,
		toast: doneTitle ? `${doneTitle} hazır. Görevliye dön.` : s.toast
	});
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
function applyVitals(s, fill) {
	const t = totalsOf(s);
	s.hpMax = 100 + t.hp + enchantMods(s).hp;
	s.manaMax = 50 + s.level * 8 + (s.invested?.mana || 0) * 8 + enchantMods(s).mana;
	s.staMax = Math.round(90 + t.mvs * 1.2);
	if (fill) {
		s.hp = s.hpMax;
		s.mana = s.manaMax;
		s.sta = s.staMax;
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
	return Array.from({ length: 72 }, () => null);
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
function inferTree(classId, skills) {
	const trees = CLASS_TREES[classId];
	for (let i = 0; i < trees.length; i++) if (trees[i].skills.some((sk) => (skills[sk.id] ?? 0) > 0)) return `${classId}:${i}`;
	return null;
}
export function applySave(save) {
	resetLiveVitals();
	const s = useRpg.getState();
	const classId = asClassId(save.classId);
	const bag = withStarterChest(Array.from({ length: 72 }, (_, i) => save.bag[i] ?? null), classId, {
		...blankEquip(),
		...save.equipped
	});
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
		equipped: {
			...s.equipped,
			...save.equipped
		},
		skills: { ...save.skills ?? {} },
		skillPoints: save.skillPoints ?? 0,
		chosenTree: save.chosenTree ?? inferTree(classId, save.skills ?? {}),
		hotbar: Array.from({ length: 8 }, (_, i) => save.hotbar?.[i] ?? null),
		quests: normalizeQuests(Array.isArray(save.quests) ? save.quests : []).filter((quest) => !String(quest.id).startsWith("q-lv-")),
		depot: Array.from({ length: 24 }, (_, i) => save.depot?.[i] ?? null),
		blocked: Array.isArray(save.blocked) ? save.blocked : [],
		bagStage: save.bagStage ?? 0,
		wellAt: save.wellAt ?? 0,
		bonusUntil: save.bonusUntil ?? 0,
		stall: Array.isArray(save.stall) ? save.stall : null,
		steed: save.steed ?? null,
		riding: Boolean(save.riding) && Boolean(save.steed),
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
	applyVitals(next, false);
	next.hp = Math.min(next.hp, next.hpMax);
	if (next.level <= 1 && next.xp === 0 && next.gold === 400) next.gold = 0;
	useRpg.setState(next);
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
  steed: { id: string; name: string; coat: string; mane: string; dark: string; muzzle?: string } | null;
  riding: boolean;
  down: { x: number; z: number } | null;
  mapLoad: string;
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
  noteKill: (mobId?: string) => void;
  startQuest: () => void;
  claimQuest: () => void;
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
  useBagItem: (index: number) => void;
  imbue: (from: number, to: number) => void;
  listStall: (index: number, price: number) => void;
  unlistStall: (id: string) => void;
  sellFromBag: (index: number) => void;
  sellEquipped: (slot: EquipSlot) => void;
  toggleRide: () => void;
  craftItem: (id: string) => void;
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
	{ id: "demir-cevher", name: "Demir Cevheri", desc: "Güç taşı eritmek için maden." },
	{ id: "bakir-cevher", name: "Bakır Cevheri", desc: "Güç taşı eritmek için maden." },
	{ id: "gumus-cevher", name: "Gümüş Cevheri", desc: "Güç taşı eritmek için maden." }
];
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
		let bag = s.bag;
		let toast = "";
		while (given < 3 && t >= MINE_AT[given]) {
			const ore = ORES[Math.floor(Math.random() * ORES.length)];
			const next = bag.slice();
			if (!pushMat(next, s.bagStage, ore)) {
				set({ bag, chore: null, toast: "Çanta dolu" });
				return;
			}
			bag = next;
			given += 1;
			toast = given >= 3 ? `${ore.name} · 3 maden çıktı` : `${ore.name} · ${given}/3`;
			bumpQuest(get, set, "mine");
		}
		if (given >= 3 || t >= 10) {
			set({ bag, chore: null, toast: toast || "Damar boşaldı" });
			return;
		}
		if (bag !== s.bag) set({ bag, chore: { kind: "mine", t, given }, toast });
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
		const zoneW = 0.08;
		set({
			chore: {
				kind: "fish",
				phase: "bite",
				t: 0,
				wait: chore.wait,
				zone: zoneW / 2 + Math.random() * (1 - zoneW),
				zoneW,
				needle: Math.random(),
				dir: Math.random() < 0.5 ? 1 : -1,
				flick: 0.2 + Math.random() * 0.4
			},
			toast: "Kancaya bir balık takıldı"
		});
		return;
	}
	let dir = chore.dir;
	let flick = (chore.flick ?? 0) - dt;
	let speed = 1.35 + Math.sin((chore.t + dt) * 11) * 0.85;
	if (flick <= 0) {
		dir *= -1;
		flick = 0.08 + Math.random() * 0.28;
		speed *= 1.7;
	}
	let needle = chore.needle + dir * dt * speed;
	if (needle >= 1) {
		needle = 1;
		dir = -1;
	} else if (needle <= 0) {
		needle = 0;
		dir = 1;
	}
	const t = chore.t + dt;
	if (t >= 3.6) {
		set({ chore: null, toast: "Geç kaldın, balık kaçtı" });
		return;
	}
	set({ chore: { ...chore, t, needle, dir, flick } });
}
export const useRpg = create<RpgState>((set, get) => ({
	classId: "savasci",
	level: 1,
	xp: 0,
	xpTo: xpForLevel(1),
	vials: 0,
	unspent: 0,
	gold: 0,
	hp: 120,
	hpMax: 120,
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
	steed: null,
	riding: false,
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
	toggleInv: () => set((s) => ({
		invOpen: !s.invOpen,
		charOpen: false
	})),
	toggleChar: () => get().showChar("stats"),
	showChar: (tab) => {
		const released = releaseSmith(get());
		set((s) => {
			if (s.charOpen && s.charTab === tab) return {
				...released,
				charOpen: false,
				shop: null
			};
			return {
				...released,
				charOpen: true,
				charTab: tab,
				invOpen: false,
				shop: null
			};
		});
	},
	closePanels: () => set((s) => ({
		...releaseSmith(s),
		invOpen: false,
		charOpen: false,
		shop: null
	})),
	closeShop: () => set((s) => ({
		...releaseSmith(s),
		shop: null
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
		if (s.level < (pick.req ?? 30)) {
			set({ toast: "Kazma için 30. seviye gerekir" });
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
		if (s.level < (rod.req ?? 25)) {
			set({ toast: "Olta için 25. seviye gerekir" });
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
		const bag = s.bag.slice();
		if (!pushMat(bag, s.bagStage, { id: "gol-baligi", name: "Göl Balığı", desc: "Gölden çıktı." })) {
			set({ chore: null, toast: "Çanta dolu, balık kaçtı" });
			return;
		}
		set({ bag, chore: null, toast: "Balık tutuldu" });
		get().grantXp(12);
		bumpQuest(get, set, "fish");
	},
	learnSkill: (id) => {
		const s = get();
		if (s.level < 5) {
			set({ toast: "Yetenek için 5. seviye gerekir" });
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
		const hotbar = get().hotbar.slice();
		hotbar[index] = id;
		set({ hotbar });
	},
	castSkill: (id) => {
		const s = get();
		if (!id) return;
		const rank = s.skills[id] ?? 0;
		if (rank <= 0) {
			set({ toast: "Bu yetenek öğrenilmedi" });
			return;
		}
		const left = skillCdLeft(id);
		if (left > .05) {
			set({ toast: `Bekleme ${left.toFixed(1)} sn` });
			return;
		}
		const cost = 6 + Math.min(rank, 10) * 2;
		if (s.mana < cost) {
			set({ toast: "Yetersiz mana" });
			return;
		}
		const sk = skillById(id);
		const t = totalsOf(s);
		skillReadyAt[id] = Date.now() + skillWait(id, rank) * 1e3;
		const mana = s.mana - cost;
		liveMana = mana;
		if (!sk || sk.kind === "buff") {
			const now = Date.now();
			const cut = Math.min(.55, .16 + rank * .012);
			if (id === "sv4") {
				const hp = Math.min(s.hpMax, s.hp + Math.round(s.hpMax * (.16 + rank * .004)));
				liveHp = hp;
				set({
					mana,
					hp,
					toast: `${sk?.name ?? "Siper"} · can toparlandı`
				});
			} else if (id === "sv6" || id === "nj4") {
				stepUntil = now + 12e3;
				stepMul = 1.18 + rank * .008;
				set({
					mana,
					toast: `${sk?.name ?? "Hız"} · hızlandın`
				});
			} else if (id === "sv10") {
				regenUntil = now + 12e3;
				set({
					mana,
					toast: "Direnç · can yenileniyor"
				});
			} else {
				guardUntil = now + 12e3;
				guardCut = cut;
				set({
					mana,
					toast: `${sk?.name ?? "Siper"} · hasar kesildi`
				});
			}
			return;
		}
		const stat = sk.mag ? t.mag : t.str;
		const power = sk.power + stat * (sk.mag ? .5 : .32);
		pendingCast = {
			id,
			aoe: sk.kind === "aoe",
			dmg: skillDamage(rank, power),
			hits: sk.hits ?? 1,
			slow: Boolean(sk.slow),
			dot: sk.kind === "dot",
			crit: Boolean(sk.crit)
		};
		set({
			mana,
			toast: `${sk.name} · ${skillTier(rank)}`
		});
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
		const map = s.shop === "herald" ? s.mentor || "koy2" : "koy";
		const open = s.quests.find((quest) => !quest.claimed);
		if (open) {
			set({ toast: open.done ? "Önce görevi tamamla" : "Açık görevin bitmeden yenisi alınmaz" });
			return;
		}
		const next = QUEST_BOARD.find((row) => row.map === map && !s.quests.some((quest) => quest.id === row.id));
		if (!next) {
			set({ toast: "Bu bölgenin görevi bitti" });
			return;
		}
		if (s.level < next.min) {
			set({ toast: `Seviye ${next.min} gerekir` });
			return;
		}
		set({
			quests: [...s.quests, questFromBoard(next)],
			toast: `Görev alındı: ${next.name}`
		});
	},
	claimQuest: () => {
		const s = get();
		const map = s.shop === "herald" ? s.mentor || "koy2" : "koy";
		const ready = s.quests.find((quest) => quest.done && !quest.claimed && QUEST_BOARD.some((row) => row.id === quest.id && row.map === map));
		if (!ready) {
			set({ toast: "Tamamlanan görev yok" });
			return;
		}
		const row = QUEST_BOARD.find((item) => item.id === ready.id);
		set({
			quests: s.quests.map((quest) => quest.id === ready.id ? { ...quest, claimed: true } : quest)
		});
		payQuest(get, ready.title, row?.xp ?? 80, row?.gold ?? 20);
		if (row?.reward === "At") {
			const coats = [
				{ id: "doru", name: "Doru", coat: "#6a3b22", mane: "#1a120e", dark: "#241810", muzzle: "#8a5340" },
				{ id: "siyah", name: "Siyah", coat: "#1c1916", mane: "#0a0908", dark: "#0e0c0a", muzzle: "#3a3028" },
				{ id: "al", name: "Al", coat: "#8a3a22", mane: "#2a140e", dark: "#3a1c14", muzzle: "#c4846a" },
				{ id: "kir", name: "Kır", coat: "#c8c2b6", mane: "#4e4a44", dark: "#6a6560", muzzle: "#ddd6ca" },
				{ id: "izabel", name: "İzabel", coat: "#c4a05a", mane: "#f4f0e6", dark: "#8a6840", muzzle: "#e6d2a8" },
				{ id: "yagiz", name: "Yağız", coat: "#3a2418", mane: "#120e0c", dark: "#1a100c", muzzle: "#6a4030" },
				{ id: "demirkir", name: "Demirkır", coat: "#6e7378", mane: "#1a1c1e", dark: "#3a3e42", muzzle: "#9aa0a4" },
			];
			const coat = coats[Math.floor(Math.random() * coats.length)];
			set({ steed: coat, riding: false, toast: `${coat.name} at senin. H ile bin.` });
		} else if (row?.reward) {
			const plus = Math.random() < 0.05 ? 1 : 0;
			const item = rewardItem(row.reward, plus);
			const bag = get().bag.slice();
			const hole = bag.findIndex((slot) => slot == null);
			if (hole >= 0) bag[hole] = item;
			set({
				bag,
				toast: plus ? `${item.name} +${plus} geldi` : `${item.name} geldi`
			});
		}
		ensureQuest(get, set);
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
			if (s.bagStage >= 4) {
				set({ toast: "Envanter sonuna kadar açık" });
				return;
			}
			spend();
			set({
				bag,
				bagStage: s.bagStage + 1,
				toast: s.bagStage % 2 === 0 ? "Pencerenin yarısı açıldı" : "Pencere tamamlandı"
			});
			return;
		}
		if (it.kind === "potion") {
			spend();
			const now = Date.now();
			if (it.id === "pot-hp") {
				const hp = Math.min(s.hpMax, s.hp + s.hpMax * .4);
				liveHp = hp;
				set({
					bag,
					hp,
					toast: "Can iksiri"
				});
			} else if (it.id === "pot-mp") {
				const mana = Math.min(s.manaMax, s.mana + s.manaMax * .4);
				liveMana = mana;
				set({
					bag,
					mana,
					toast: "Mana iksiri"
				});
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
			const need = matForPlus(s.smithItem.plus ?? 0, s.smithItem.slot);
			if (it.kind !== "mat" || it.id !== need.id) {
				set({ toast: `Gerekli: ${need.name}` });
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
		set({ bag, smithItem: it });
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
		const need = matForPlus(it.plus, it.slot);
		if (!s.smithMat || s.smithMat.id !== need.id) {
			set({ toast: `Gerekli: ${need.name}` });
			return;
		}
		const chance = upgradeChance(it.plus, Boolean(stone));
		const ok = Math.random() * 100 < chance;
		const nextItem = ok ? { ...it, plus: it.plus + 1 } : it;
		const equipped = { ...s.equipped };
		if (ok) {
			for (const slot of Object.keys(equipped)) if (equipped[slot]?.uid === it.uid) equipped[slot] = nextItem;
		}
		const next = {
			...s,
			smithItem: nextItem,
			smithStone: null,
			smithMat: null,
			equipped,
			gold: s.gold - cost,
			gearRev: ok ? s.gearRev + 1 : s.gearRev,
			toast: ok ? "Yükseltme Başarılı" : "Yükseltme Başarısız"
		};
		if (ok) applyVitals(next, false);
		set(next);
		if (ok && nextItem.plus >= 6) bumpQuest(get, set, "plus6");
		if (ok && nextItem.plus >= 10) bumpQuest(get, set, "plus10");
	},
	noteKill: (mobId) => bumpQuest(get, set, "kill", mobId),
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
			if (done) doneTitle = quest.title;
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
			toast: doneTitle ? `${doneTitle} hazır. Görevliye dön.` : s.toast
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
			set({
				charOpen: true,
				charTab: "skills",
				invOpen: false,
				shop: null
			});
			return;
		}
		if (near === "guard" || near === "herald") {
			const talkId = "guard";
			bumpQuest(get, set, "talk", talkId);
			const s = get();
			const bring = s.quests.find((quest) => !quest.claimed && !quest.done && quest.kind === "bring");
			if (bring) {
				const idx = s.bag.findIndex((item) => item && (item.id === bring.mob || item.name === bring.name));
				if (idx >= 0) {
					const bag = s.bag.slice();
					const it = bag[idx];
					const left = (it.count ?? 1) - 1;
					bag[idx] = left > 0 ? { ...it, count: left } : null;
					set({ bag });
					bumpQuest(get, set, "bring");
				}
			}
			get().acceptQuests();
			return;
		}
		if (near === "smith" || near === "market" || near === "fisher" || near === "miner" || near === "craft") {
			bumpQuest(get, set, "talk", near);
		}
		if (near === "gate") {
			set({ shop: "gate", charOpen: false });
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
			const vendor = near === "weapon" || near === "armor" || near === "market" || near === "stable" || near === "fisher" || near === "miner" || near === "smith";
			return {
				...(leaving ? releaseSmith(s) : {}),
				shop: opening ? near : null,
				invOpen: vendor && opening ? true : s.invOpen,
				charOpen: false
			};
		});
	},
	openBagChest: (index) => {
		const s = get();
		const it = s.bag[index];
		if (!it || it.id !== "starter-chest") return;
		const made = starterWeapon(s.classId);
		const bag = s.bag.slice();
		bag[index] = null;
		const hole = bag.findIndex((slot) => slot == null);
		if (hole < 0) bag[index] = made;
		else bag[hole] = made;
		set({
			bag,
			toast: `Sandık açıldı ve kayboldu. ${made.name} envantere geldi`
		});
	},
	equipFromBag: (index) => {
		const s = get();
		const it = s.bag[index];
		if (!it) return;
		if (it.id === "starter-chest") {
			get().openBagChest(index);
			return;
		}
		if (it.kind && it.kind !== "gear" && it.id !== "kazma" && it.id !== "olta") {
			get().useBagItem(index);
			return;
		}
		if (it.slot === "weapon" && !weaponFits(s.classId, it.id)) {
			set({ toast: "Bu silah senin sınıfına ait değil" });
			return;
		}
		if (it.forClass && it.forClass !== "hepsi" && it.forClass !== s.classId) {
			set({ toast: "Bu eşya senin sınıfına ait değil" });
			return;
		}
		if ((it.req ?? 1) > s.level) {
			set({ toast: `Seviye ${it.req} gerekir` });
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
			toast: `${displayName(it)} giyildi`,
			chore: it.slot === "weapon" ? null : s.chore,
			vein: it.slot === "weapon" && it.id !== "kazma" ? null : s.vein
		};
		applyVitals(next, false);
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
			toast: `${displayName(it)} çıkarıldı`,
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
			toast: `${displayName(it)} çantaya alındı`
		};
		applyVitals(next, false);
		set(next);
	},
	moveToPage: (from, page) => {
		const s = get();
		if (from < 0 || from >= s.bag.length) return;
		const item = s.bag[from];
		if (!item) return;
		const start = page * 24;
		if (from >= start && from < start + 24) return;
		const bag = s.bag.slice();
		let dest = -1;
		for (let i = 0; i < 24; i++) if (bag[start + i] == null) {
			dest = start + i;
			break;
		}
		if (dest < 0) {
			set({ toast: "Bu pencere dolu" });
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
		const bag = get().bag.slice();
		const tmp = bag[from];
		bag[from] = bag[to] ?? null;
		bag[to] = tmp ?? null;
		set({ bag });
	},
	buy: (id) => {
		const def = SHOP.find((x) => x.id === id);
		if (!def) return;
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
			set({ toast: "Çanta dolu" });
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
			s.skillPoints += 1;
			notes.push(`Seviye ${s.level}. +1 yetenek puanı`);
		}
		if (s.level >= 99) s.xp = Math.min(s.xp, Math.max(0, s.xpTo - 1));
		const filled = Math.min(4, Math.floor(s.xp / s.xpTo * 4 + 1e-6));
		while (s.vials < filled) {
			s.vials += 1;
			s.unspent += 1;
			notes.push(`Tüp ${s.vials}/4 doldu. +1 puan`);
		}
		applyVitals(s, notes.some((n) => n.startsWith("Seviye")));
		s.toast = notes[0] ?? s.toast;
		set(s);
		ensureQuest(get, set);
		return notes;
	},
	addGold: (n) => set((s) => ({ gold: s.gold + (bonusLive(s.bonusUntil) ? Math.round(n * 1.15) : n) })),
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
			bag[to] = { ...it, enchants: next };
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
		bag[to] = { ...it, enchants: list };
		const equipped = { ...s.equipped };
		for (const slot of Object.keys(equipped)) if (equipped[slot]?.uid === it.uid) equipped[slot] = bag[to];
		const next = { ...s, bag, equipped, gearRev: s.gearRev + 1, toast: list[list.length - 1].name };
		applyVitals(next, false);
		set(next);
	},
	listStall: (index, price) => {
		const s = get();
		const it = s.bag[index];
		const cost = Math.max(1, Math.floor(Number(price) || 0));
		if (!it || !Array.isArray(s.stall)) return;
		if (it.id === "starter-chest" || it.kind === "bag") {
			set({ toast: "Bu eşya satılmaz" });
			return;
		}
		const bag = s.bag.slice();
		bag[index] = null;
		const here = readSim();
		set({
			bag,
			stall: [...s.stall, { uid: uid(), item: it, price: cost }],
			stallSpot: s.stallSpot || { x: here.x, z: here.z },
			toast: `${it.name} satışta · ${cost} altın`
		});
		bumpQuest(get, set, "list");
	},
	unlistStall: (id) => {
		const s = get();
		if (!Array.isArray(s.stall)) return;
		const row = s.stall.find((entry) => entry.uid === id);
		if (!row) return;
		const bag = s.bag.slice();
		const hole = bag.findIndex((slot) => slot == null);
		if (hole < 0) {
			set({ toast: "Çanta dolu" });
			return;
		}
		bag[hole] = row.item;
		set({ bag, stall: s.stall.filter((entry) => entry.uid !== id), toast: "Satıştan kaldırıldı" });
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
		const count = it.count ?? 1;
		const gold = Math.max(1, Math.round((it.price || 6 + (it.level || 1) * 2 + (it.plus || 0) * 12) * 0.3)) * count;
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
		const count = it.count ?? 1;
		const gold = Math.max(1, Math.round((it.price || 6 + (it.level || 1) * 2 + (it.plus || 0) * 12) * 0.3)) * count;
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
		if (!s.steed) {
			set({ toast: s.level >= 15 ? "Atın yok. İkinci köyde Seyis'in Atı görevini bitir." : "At görevi 15. seviyede açılır." });
			return;
		}
		const riding = !s.riding;
		set({ riding, toast: riding ? `${s.steed.name} ata bindin. H ile inersin.` : "Attan indin." });
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
	travel: (id) => {
		const realm = REALMS.find((row) => row.id === id);
		const cost = GATE_COST[id] ?? 0;
		if (!realm) return;
		if (get().gold < cost) {
			set({ toast: "Yetersiz altın" });
			return;
		}
		set({ gold: get().gold - cost, shop: null, mapLoad: realm.name });
		window.setTimeout(() => {
			queueHop(realm.x, realm.z + (realm.id === "koy" ? 10 : 6));
			useRpg.setState({ mapLoad: "" });
		}, 1400);
	},
	knockDown: () => {
		if (get().down) return;
		const here = readSim();
		liveHp = 0;
		set({ hp: 0, down: { x: here.x, z: here.z }, toast: "", chore: null });
	},
	reviveHere: () => {
		liveHp = 1;
		set({ hp: 1, down: null, toast: "Canın yavaş dolacak" });
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
		const def = Math.min(50, enchantMods(get()).def) / 100;
		const dealt = Math.max(1, Math.round(dmg * (1 - Math.min(.6, guard)) * (1 - def)));
		const hp = Math.max(0, get().hp - dealt);
		set({
			hp,
			hurt: .35
		});
		liveHp = hp;
		return hp <= 0;
	},
	tick: (dt, sprinting) => {
		stepChore(get, set, dt);
		const s = get();
		if (liveSta < 0 || Math.abs(s.sta - liveSta) > 2.5) liveSta = s.sta;
		if (liveMana < 0 || Math.abs(s.mana - liveMana) > 2.5) liveMana = s.mana;
		if (liveHp < 0 || s.hp < liveHp - 1.5 || s.hp > liveHp + 1.5) liveHp = s.hp;
		const drain = 1.35 * (1 - Math.min(.45, (s.skills.sv6 ?? 0) * .12));
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
		liveMana = Math.min(s.manaMax, liveMana + 5 * dt);
		if (!s.down && liveHp < s.hpMax) liveHp = Math.min(s.hpMax, liveHp + (regenUntil > Date.now() ? 9 : 1.6) * dt);
		let hurt = s.hurt;
		if (hurt > 0) hurt = Math.max(0, hurt - dt);
		const listed = s.stall;
		if (Array.isArray(listed) && listed.length) {
			saleClock += dt;
			if (saleClock >= 75) {
				saleClock = 0;
				const row = listed.slice().sort((a, b) => a.price - b.price)[0];
				set({
					stall: listed.filter((entry) => entry.uid !== row.uid),
					gold: s.gold + row.price,
					toast: `Bir gezgin ${row.item.name} satın aldı · ${row.price} altın`
				});
				bumpQuest(get, set, "sale");
			}
		} else saleClock = 0;
		questClock += dt;
		if (questClock >= 1.4) {
			questClock = 0;
			ensureQuest(get, set);
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
		const ride = s.riding && s.steed ? 1.62 : 1;
		const walk = Math.min(4.15, (2.15 + Math.min(90, totalsOf(s).mvs) * .02) * swift * burst * (1 + Math.min(40, ench.mvs) / 100));
		const paced = walk * ride;
		const cap = s.riding && s.steed ? 8.6 : 6.2;
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
		const haste = get().hasteUntil > Date.now() ? .75 : 1;
		const ench = 1 + enchantMods(get()).ats / 100;
		return Math.max(.42, (.55 - Math.min(40, totalsOf(get()).ats) * .006) * haste / Math.min(1.35, ench));
	}
}));
