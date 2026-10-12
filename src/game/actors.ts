// @ts-nocheck
import * as THREE from "three";
import { weaponStyleOf } from "@/game/rpg";
import { DUNGEON_BOUND, REALMS, VILLAGE_BOUND } from "@/game/world";

function std(color, rough = 0.62, metal = 0.04) {
	return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function surf(_url, color, rough, metal) {
	return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function bar() {
	const g = new THREE.Group();
	const bg = new THREE.Mesh(new THREE.PlaneGeometry(.9, .08), new THREE.MeshBasicMaterial({
		color: "#1c1916",
		depthTest: false
	}));
	const fill = new THREE.Mesh(new THREE.PlaneGeometry(.86, .05), new THREE.MeshBasicMaterial({
		color: "#b5443c",
		depthTest: false
	}));
	fill.position.z = .01;
	g.add(bg, fill);
	g.userData.fill = fill;
	return g;
}
function setBar(g, _ratio, _cam) {
	g.visible = false;
}
function label(text) {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 64;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "rgba(28,25,22,0.72)";
		ctx.fillRect(16, 8, 224, 48);
		ctx.fillStyle = "#f3efe8";
		ctx.font = "28px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText(text, 128, 42);
	}
	const map = new THREE.CanvasTexture(canvas);
	map.colorSpace = THREE.SRGBColorSpace;
	const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
		map,
		transparent: true,
		depthWrite: false
	}));
	sprite.scale.set(1.4, .35, 1);
	return sprite;
}
export function adoptDummy(root) {
	const body = root.userData.body ?? root;
	const hpBar = bar();
	hpBar.position.y = 2.2;
	root.add(hpBar);
	return {
		root,
		body,
		bar: hpBar,
		hp: 220,
		hpMax: 220,
		alive: true,
		shake: 0,
		respawn: 0
	};
}
export function hitDummy(d, dmg) {
	if (!d.alive) return;
	d.hp = Math.max(0, d.hp - dmg);
	d.shake = .38;
	if (d.hp <= 0) {
		d.alive = false;
		d.respawn = 5;
	}
}
export function tickDummy(d, dt, cam) {
	if (d.shake > 0) {
		d.shake -= dt;
		d.body.rotation.z = Math.sin(d.shake * 48) * d.shake * .7;
		d.body.position.x = Math.sin(d.shake * 54) * d.shake * .2;
	} else if (d.alive) {
		d.body.rotation.z = 0;
		d.body.position.x = 0;
	}
	if (!d.alive) {
		d.body.rotation.x = Math.min(1.2, d.body.rotation.x + dt * 2);
		d.respawn -= dt;
		if (d.respawn <= 0) {
			d.hp = d.hpMax;
			d.alive = true;
			d.body.rotation.set(0, 0, 0);
			d.body.position.set(0, 0, 0);
		}
	}
	setBar(d.bar, d.alive ? d.hp / d.hpMax : 0, cam);
}
function person(cloth, skin, hair) {
	const hips = new THREE.Group();
	hips.position.y = .68;
	const tunic = std(cloth, .78);
	const flesh = std(skin, .58);
	const dark = std("#2a241e", .75);
	const pelvis = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 12), tunic);
	pelvis.scale.set(1.25, .72, .95);
	pelvis.castShadow = true;
	const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .28, 6, 12), tunic);
	torso.position.y = .3;
	torso.castShadow = true;
	const chest = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 12), tunic);
	chest.position.y = .44;
	chest.scale.set(1.28, .78, .82);
	chest.castShadow = true;
	const shoulderPad = (side) => {
		const pad = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 8), tunic);
		pad.position.set(side * .2, .46, 0);
		pad.scale.set(1.15, .75, .9);
		pad.castShadow = true;
		return pad;
	};
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(.05, .058, .09, 10), flesh);
	neck.position.y = .62;
	const head = new THREE.Mesh(new THREE.SphereGeometry(.118, 18, 14), flesh);
	head.position.y = .77;
	head.scale.set(.92, 1.08, .96);
	head.castShadow = true;
	const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.124, 16, 12, 0, Math.PI * 2, 0, Math.PI * .55), std(hair, .85));
	hairCap.position.y = .8;
	const eyeGeo = new THREE.SphereGeometry(.014, 8, 6);
	const eyeMat = std("#1a1412", .35);
	const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
	eyeL.position.set(-.04, .79, .1);
	const eyeR = eyeL.clone();
	eyeR.position.x = .04;
	const nose = new THREE.Mesh(new THREE.SphereGeometry(.016, 8, 6), flesh);
	nose.position.set(0, .75, .112);
	nose.scale.set(.7, 1.15, .8);
	const mouth = new THREE.Mesh(new THREE.BoxGeometry(.045, .008, .012), std("#8d5348", .6));
	mouth.position.set(0, .71, .108);
	const brow = new THREE.Mesh(new THREE.BoxGeometry(.1, .012, .016), std(hair, .8));
	brow.position.set(0, .83, .09);
	const ear = (side) => {
		const e = new THREE.Mesh(new THREE.SphereGeometry(.026, 8, 6), flesh);
		e.position.set(side * .108, .76, 0);
		e.scale.set(.42, 1, .65);
		return e;
	};
	const arm = (side) => {
		const g = new THREE.Group();
		g.position.set(side * .24, .44, 0);
		const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .16, 4, 8), flesh);
		upper.position.y = -.16;
		upper.castShadow = true;
		const fore = new THREE.Mesh(new THREE.CapsuleGeometry(.044, .15, 4, 8), flesh);
		fore.position.y = -.36;
		fore.castShadow = true;
		const hand = new THREE.Mesh(new THREE.BoxGeometry(.07, .045, .08), flesh);
		hand.position.set(0, -.48, .01);
		const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.068, .074, .12, 8), tunic);
		sleeve.position.y = -.05;
		g.add(upper, fore, hand, sleeve);
		return g;
	};
	const leg = (side) => {
		const g = new THREE.Group();
		g.position.set(side * .09, -.02, 0);
		const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .2, 4, 8), tunic);
		thigh.position.y = -.18;
		thigh.castShadow = true;
		const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.052, .2, 4, 8), dark);
		shin.position.y = -.46;
		shin.castShadow = true;
		const foot = new THREE.Mesh(new THREE.BoxGeometry(.1, .05, .2), std("#241c18", .7));
		foot.position.set(0, -.62, .04);
		foot.castShadow = true;
		g.add(thigh, shin, foot);
		return g;
	};
	const belt = new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .18), std("#8a7040", .45, .35));
	belt.position.y = .08;
	const armR = arm(-1);
	const armL = arm(1);
	hips.add(pelvis, torso, chest, shoulderPad(-1), shoulderPad(1), neck, head, hairCap, eyeL, eyeR, nose, mouth, brow, ear(-1), ear(1), belt, armL, armR, leg(-1), leg(1));
	return {
		hips,
		armR,
		head
	};
}
export function createVendor(kind, x, z, yaw) {
	const root = new THREE.Group();
	root.position.set(x, 0, z);
	root.rotation.y = yaw;
	const made = kind === "smith" ? person("#5a3030", "#c4a07a", "#2a211c") : person("#2f4a3c", "#d2b090", "#1e2428");
	if (kind === "smith") {
		const apron = new THREE.Mesh(new THREE.BoxGeometry(.22, .28, .04), std("#6a4a32", .85));
		apron.position.set(0, .22, .12);
		made.hips.add(apron);
		const beard = new THREE.Mesh(new THREE.ConeGeometry(.04, .1, 6), std("#3a2e28", .9));
		beard.position.set(0, .58, .09);
		made.hips.add(beard);
	} else {
		const hood = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), std("#24362e", .75));
		hood.position.y = .76;
		made.hips.add(hood);
		const crate = new THREE.Mesh(new THREE.BoxGeometry(.42, .28, .34), std("#6a4a2c", .86));
		crate.position.set(.55, .16, .2);
		crate.castShadow = true;
		root.add(crate);
	}
	root.add(made.hips);
	let hammer = null;
	if (kind === "smith") {
		hammer = new THREE.Mesh(new THREE.BoxGeometry(.08, .22, .08), std("#9aa0a6", .35, .75));
		const handle = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .28, 6), std("#5a3d22", .8));
		handle.position.y = -.18;
		hammer.add(handle);
		hammer.position.set(0, -.5, .06);
		made.armR.add(hammer);
	}
	const tag = label(kind === "smith" ? "Demirci" : "Gece Satıcısı");
	tag.position.y = 1.62;
	root.add(tag);
	const stand = weaponStand();
	stand.position.set(kind === "smith" ? .95 : -.95, 0, .15);
	root.add(stand);
	return {
		root,
		hips: made.hips,
		armR: made.armR,
		hammer,
		kind
	};
}
var CLASS_CLOTH = {
	savasci: "#6a3030",
	okcu: "#3d5a32",
	ninja: "#2c2c3c",
	buyucu: "#3a3058"
};
export function createMentor(name, x, z, yaw, cls) {
	const root = new THREE.Group();
	root.position.set(x, 0, z);
	root.rotation.y = yaw;
	const made = person(CLASS_CLOTH[cls] ?? "#3a3430", "#d2b090", "#1c1916");
	root.add(made.hips);
	const tag = label(name);
	tag.position.y = 1.62;
	root.add(tag);
	return {
		root,
		hips: made.hips,
		name
	};
}
export function createTownsman(name, x, z, yaw, cloth, spear = false) {
	const root = new THREE.Group();
	root.position.set(x, 0, z);
	root.rotation.y = yaw;
	const made = person(cloth, "#d2b090", "#1c1916");
	root.add(made.hips);
	if (spear) {
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(.015, .018, 1.35, 6), std("#6a5340", .7));
		pole.position.set(.16, .7, .08);
		const tip = new THREE.Mesh(new THREE.ConeGeometry(.04, .16, 6), std("#d5dbe3", .3, .7));
		tip.position.y = .74;
		pole.add(tip);
		made.hips.add(pole);
	}
	const tag = label(name);
	tag.position.y = 1.62;
	root.add(tag);
	return {
		root,
		hips: made.hips,
		name
	};
}
const CLASS_LOOK = {
	savasci: { skin: "#c48b6a", hair: "#2a2118", iris: "#5c4632", bulk: 1.12, kind: "warrior" },
	buyucu: { skin: "#d7b79a", hair: "#efe8dc", iris: "#6d8aa8", bulk: 0.9, kind: "mage" },
	ninja: { skin: "#c49a78", hair: "#14110e", iris: "#2c241c", bulk: 0.86, kind: "ninja" },
	okcu: { skin: "#c9a07c", hair: "#3a2414", iris: "#6a4a28", bulk: 0.96, kind: "archer" },
};
export function createClassAvatar(classId) {
	const look = CLASS_LOOK[classId] ?? CLASS_LOOK.savasci;
	const root = new THREE.Group();
	root.name = "class-avatar";
	root.userData.classMesh = true;
	const b = look.bulk;
	const skin = surf("/textures/skin.jpg", look.skin, 0.58, 0.02, 1.4, 1.4);
	const hair = std(look.hair, 0.72);
	const iron = surf("/textures/iron.jpg", "#9a9288", 0.46, 0.82, 1.2, 1.2);
	const leather = surf("/textures/leather.jpg", "#6a5338", 0.78, 0.04, 1.6, 1.6);
	const velvet = surf("/textures/velvet.jpg", "#2a1844", 0.86, 0.02, 1.4, 2);
	const cloth = look.kind === "mage" ? velvet : look.kind === "archer" ? surf("/textures/leather.jpg", "#4e5a38", 0.8, 0.03, 1.5, 1.5) : look.kind === "ninja" ? std("#12151c", 0.84) : leather;
	const dark = std("#1a1814", 0.8, 0.12);
	const bone = (name, parent, x, y, z, rx = 0) => {
		const part = new THREE.Bone();
		part.name = name;
		part.position.set(x, y, z);
		if (rx) part.rotation.x = rx;
		parent.add(part);
		return part;
	};
	const mesh = (parent, geo, material, x, y, z) => {
		const m = new THREE.Mesh(geo, material);
		m.position.set(x, y, z);
		m.castShadow = true;
		m.frustumCulled = false;
		parent.add(m);
		return m;
	};
	const along = (parent, geo, material, length) => mesh(parent, geo, material, 0, length * 0.5, 0);
	root.userData.bulk = b;
	const cover = (m, slot) => {
		m.userData.cover = slot;
		return m;
	};
	const hips = bone("Hips", root, 0, 0.96, 0);
	cover(mesh(hips, new THREE.SphereGeometry(0.132 * b, 16, 12), cloth, 0, 0.01, 0), "torso").scale.set(1.36, 0.58, 1.02);
	cover(mesh(hips, new THREE.SphereGeometry(0.072 * b, 12, 10), cloth, 0.062 * b, -0.03, -0.055), "torso").scale.set(0.95, 0.8, 0.72);
	cover(mesh(hips, new THREE.SphereGeometry(0.072 * b, 12, 10), cloth, -0.062 * b, -0.03, -0.055), "torso").scale.set(0.95, 0.8, 0.72);
	const spine = bone("Spine", hips, 0, 0.1, 0);
	const spine1 = bone("Spine1", spine, 0, 0.13, 0);
	const chest = bone("Spine2", spine1, 0, 0.13, 0);
	cover(along(spine, new THREE.CapsuleGeometry(0.108 * b, 0.07, 5, 12), cloth, 0.12), "torso");
	cover(mesh(spine, new THREE.SphereGeometry(0.062 * b, 10, 8), cloth, 0, 0.05, 0.055 * b), "torso").scale.set(0.95, 0.72, 0.5);
	const rib = cover(along(chest, new THREE.CapsuleGeometry(0.148 * b, 0.09, 6, 14), cloth, 0.12), "torso");
	rib.scale.set(1.12, 0.96, 0.78);
	cover(mesh(chest, new THREE.SphereGeometry(0.064 * b, 12, 10), cloth, 0.078 * b, 0.055, 0.09 * b), "torso").scale.set(1.05, 0.58, 0.46);
	cover(mesh(chest, new THREE.SphereGeometry(0.064 * b, 12, 10), cloth, -0.078 * b, 0.055, 0.09 * b), "torso").scale.set(1.05, 0.58, 0.46);
	const neck = bone("Neck", chest, 0, 0.16, 0);
	along(neck, new THREE.CylinderGeometry(0.046, 0.058, 0.09, 12), skin, 0.09);
	const head = bone("Head", neck, 0, 0.12, 0);
	const skull = mesh(head, new THREE.SphereGeometry(0.112, 28, 20), skin, 0, 0.02, 0.008);
	skull.scale.set(0.9, 1.14, 1.0);
	mesh(head, new THREE.SphereGeometry(0.064, 16, 12), skin, 0, -0.05, 0.02).scale.set(0.82, 0.5, 0.88);
	mesh(head, new THREE.BoxGeometry(0.092, 0.016, 0.028), skin, 0, 0.048, 0.092);
	mesh(head, new THREE.BoxGeometry(0.016, 0.046, 0.028), skin, 0, 0.004, 0.108);
	mesh(head, new THREE.SphereGeometry(0.013, 10, 8), skin, 0, -0.02, 0.12);
	mesh(head, new THREE.BoxGeometry(0.034, 0.01, 0.01), std("#8a403c", 0.42), 0, -0.05, 0.102);
	const cornea = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 });
	const iris = std(look.iris, 0.25);
	const pupil = std("#0c0c0c", 0.2);
	for (const side of [1, -1]) {
		mesh(head, new THREE.SphereGeometry(0.018, 12, 10), std("#f7f4ee", 0.3), side * 0.038, 0.028, 0.092);
		mesh(head, new THREE.SphereGeometry(0.009, 10, 8), iris, side * 0.038, 0.028, 0.104);
		mesh(head, new THREE.SphereGeometry(0.0045, 8, 6), pupil, side * 0.038, 0.028, 0.11);
		mesh(head, new THREE.SphereGeometry(0.02, 12, 10), cornea, side * 0.038, 0.028, 0.1);
		mesh(head, new THREE.SphereGeometry(0.024, 10, 8), skin, side * 0.108, 0, 0).scale.set(0.38, 1.05, 0.55);
	}
	if (look.kind === "warrior") {
		mesh(head, new THREE.BoxGeometry(0.055, 0.006, 0.008), std("#9a4a42", 0.5), 0.03, 0.02, 0.1).rotation.z = 0.5;
		mesh(head, new THREE.BoxGeometry(0.04, 0.006, 0.008), std("#8a4038", 0.5), -0.02, -0.03, 0.1).rotation.z = -0.3;
		for (let i = 0; i < 7; i++) {
			const tuft = mesh(head, new THREE.ConeGeometry(0.008, 0.035, 4), std("#3a2c22", 0.8), (i - 3) * 0.012, -0.07, 0.06);
			tuft.rotation.x = 0.4;
		}
		const belt = mesh(chest, new THREE.TorusGeometry(0.16 * b, 0.012, 6, 16), dark, 0, -0.08, 0);
		belt.rotation.x = Math.PI / 2;
		belt.userData.cover = "torso";
		const cape = mesh(chest, new THREE.PlaneGeometry(0.42, 0.72, 4, 6), new THREE.MeshStandardMaterial({ color: "#4a1c18", roughness: 0.86, side: THREE.DoubleSide }), 0, -0.28, -0.2);
		cape.castShadow = true;
	} else if (look.kind === "mage") {
		mesh(head, new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.05, -0.01);
		for (let i = 0; i < 5; i++) {
			const lock = mesh(head, new THREE.BoxGeometry(0.012, 0.22, 0.012), hair, (i - 2) * 0.02, -0.08, 0.02);
			lock.rotation.x = 0.15;
		}
		mesh(head, new THREE.BoxGeometry(0.07, 0.16, 0.02), hair, 0, -0.12, 0.07);
		const collar = mesh(chest, new THREE.TorusGeometry(0.12 * b, 0.01, 6, 16), surf("/textures/leather.jpg", "#c2a15a", 0.45, 0.35), 0, 0.02, 0.12 * b);
		collar.rotation.x = Math.PI / 2;
		collar.userData.cover = "torso";
		const gem = mesh(chest, new THREE.OctahedronGeometry(0.028, 0), std("#9fd0ff", 0.2, 0.1), 0, -0.02, 0.17 * b);
		gem.userData.cover = "torso";
		const robe = mesh(hips, new THREE.CylinderGeometry(0.2 * b, 0.36, 0.82, 16, 3, true), velvet, 0, -0.42, 0);
		robe.material.side = THREE.DoubleSide;
		robe.userData.cover = "torso";
	} else if (look.kind === "ninja") {
		mesh(head, new THREE.SphereGeometry(0.128, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), cloth, 0, 0.04, -0.02);
		mesh(head, new THREE.BoxGeometry(0.15, 0.055, 0.03), dark, 0, -0.02, 0.1);
		mesh(chest, new THREE.BoxGeometry(0.22, 0.035, 0.018), std("#6e2430", 0.6), 0, 0.04, 0.16 * b).userData.cover = "torso";
		mesh(chest, new THREE.BoxGeometry(0.16, 0.08, 0.02), leather, 0, -0.04, 0.155 * b).userData.cover = "torso";
	} else {
		mesh(head, new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), hair, 0, 0.05, 0);
		mesh(chest, new THREE.BoxGeometry(0.2, 0.14, 0.03), leather, 0, 0.03, 0.155 * b).userData.cover = "torso";
		const quiver = mesh(chest, new THREE.CylinderGeometry(0.04, 0.045, 0.46, 8), dark, -0.12, -0.02, -0.22);
		quiver.rotation.x = 0.15;
		for (let i = 0; i < 4; i++) {
			const shaft = mesh(chest, new THREE.CylinderGeometry(0.004, 0.004, 0.28, 4), std("#6b4a2a", 0.7), -0.12 + (i - 1.5) * 0.012, 0.16, -0.24);
			shaft.rotation.x = 0.15;
		}
		mesh(hips, new THREE.BoxGeometry(0.05, 0.03, 0.08), leather, 0.12, 0.02, 0.08);
	}
	const leg = (side, upName, lowName, footName) => {
		const up = bone(upName, hips, side * 0.09, -0.02, 0);
		up.rotation.z = Math.PI;
		const thigh = cover(along(up, new THREE.CapsuleGeometry(0.072 * b, 0.2, 6, 10), skin, 0.34), "thigh");
		thigh.scale.set(1.08, 1, 0.9);
		cover(mesh(up, new THREE.SphereGeometry(0.05 * b, 10, 8), skin, 0, 0.16, 0.05), "thigh").scale.set(0.82, 1.2, 0.55);
		cover(mesh(up, new THREE.SphereGeometry(0.04 * b, 8, 6), skin, 0, 0.2, -0.035), "thigh").scale.set(0.75, 1.05, 0.5);
		cover(mesh(up, new THREE.SphereGeometry(0.042 * b, 10, 8), skin, 0, 0.39, 0.03), "thigh").scale.set(0.95, 0.62, 0.7);
		const low = bone(lowName, up, 0, 0.42, 0);
		low.rotation.y = Math.PI;
		cover(along(low, new THREE.CapsuleGeometry(0.04 * b, 0.18, 5, 8), skin, 0.32), "shin").scale.set(0.88, 1, 0.8);
		cover(mesh(low, new THREE.SphereGeometry(0.05 * b, 10, 8), skin, 0, 0.15, 0.038), "shin").scale.set(0.72, 1.4, 0.78);
		cover(mesh(low, new THREE.SphereGeometry(0.03 * b, 8, 6), skin, 0, 0.36, 0), "shin");
		const foot = bone(footName, low, 0, 0.4, 0);
		cover(mesh(foot, new THREE.BoxGeometry(0.078, 0.04, 0.09), skin, 0, 0.03, 0.03), "foot");
		cover(mesh(foot, new THREE.BoxGeometry(0.086, 0.028, 0.2), dark, 0, 0.016, -0.04), "foot");
		cover(mesh(foot, new THREE.BoxGeometry(0.08, 0.026, 0.055), skin, 0, 0.034, -0.125), "foot");
		return foot;
	};
	leg(1, "LeftUpLeg", "LeftLeg", "LeftFoot");
	leg(-1, "RightUpLeg", "RightLeg", "RightFoot");
	const arm = (side, armName, foreName, handName) => {
		const up = bone(armName, chest, side * 0.2 * b, 0.04, 0);
		const upper = mesh(up, new THREE.CapsuleGeometry(0.044 * b, 0.2, 5, 8), skin, 0, 0.15, -0.006);
		upper.scale.set(1.02, 1, 0.88);
		mesh(up, new THREE.SphereGeometry(0.054 * b, 10, 8), skin, side * 0.008, 0.02, -0.01).scale.set(1.12, 0.66, 0.82);
		mesh(up, new THREE.SphereGeometry(0.032 * b, 8, 6), skin, 0, 0.11, -0.028).scale.set(0.75, 1.15, 0.62);
		const elbow = mesh(up, new THREE.SphereGeometry(0.037 * b, 10, 8), skin, 0, 0.272, 0.008);
		elbow.scale.set(1.24, 0.7, 0.8);
		const olec = mesh(up, new THREE.SphereGeometry(0.016 * b, 8, 6), skin, 0, 0.28, 0.024);
		olec.scale.set(0.7, 0.82, 1.05);
		const fore = bone(foreName, up, 0, 0.28, 0);
		const foreMat = look.kind === "archer" && side > 0 ? leather : skin;
		const forearm = mesh(fore, new THREE.CapsuleGeometry(0.032 * b, 0.16, 5, 8), foreMat, 0, 0.098, -0.004);
		forearm.scale.set(0.92, 1, 0.8);
		mesh(fore, new THREE.SphereGeometry(0.026 * b, 8, 6), skin, 0, 0.22, 0);
		const hand = bone(handName, fore, 0, 0.25, 0);
		mesh(hand, new THREE.BoxGeometry(0.064, 0.03, 0.05), skin, 0, 0.03, 0.008);
		mesh(hand, new THREE.SphereGeometry(0.026, 8, 6), skin, 0, 0.032, 0.01);
		const prefix = side > 0 ? "Left" : "Right";
		["Index", "Middle", "Ring", "Pinky"].forEach((name, i) => {
			const x = (i - 1.5) * 0.014;
			const a = bone(`${prefix}Hand${name}1`, hand, x, 0.078, 0.012);
			along(a, new THREE.CapsuleGeometry(0.007, 0.018, 3, 6), skin, 0.03);
			const c = bone(`${prefix}Hand${name}2`, a, 0, 0.03, 0);
			along(c, new THREE.CapsuleGeometry(0.006, 0.014, 3, 5), skin, 0.022);
		});
		const thumb = bone(`${prefix}HandThumb1`, hand, side * 0.036, 0.032, 0.01);
		thumb.rotation.z = side * -0.8;
		along(thumb, new THREE.CapsuleGeometry(0.008, 0.018, 3, 5), skin, 0.028);
		return hand;
	};
	arm(1, "LeftArm", "LeftForeArm", "LeftHand");
	arm(-1, "RightArm", "RightForeArm", "RightHand");
	root.rotation.y = Math.PI;
	root.traverse((obj) => {
		if (!obj.isMesh) return;
		obj.castShadow = true;
		obj.frustumCulled = false;
	});
	return root;
}
export function createHorse(look?: { coat?: string; mane?: string; dark?: string; muzzle?: string } | null, opts?: { hitched?: boolean } | null) {
	const root = new THREE.Group();
	const hitched = !opts || opts.hitched !== false;
	root.name = hitched ? "seyis-at" : "binek";
	const coat = std(look && look.coat ? look.coat : "#6a3b22", 0.74);
	const dark = std(look && look.dark ? look.dark : "#241810", 0.82);
	const mane = std(look && look.mane ? look.mane : "#140e0c", 0.9);
	const hoofMat = std("#1a1410", 0.5, 0.15);
	const wood = std("#6d4c30", 0.86);
	const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 5, 12), coat);
	body.rotation.x = Math.PI / 2;
	body.position.set(0, 1.02, -0.02);
	body.castShadow = true;
	const chest = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), coat);
	chest.scale.set(0.86, 0.9, 1.05);
	chest.position.set(0, 0.98, 0.48);
	chest.castShadow = true;
	const rump = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), coat);
	rump.scale.set(0.95, 0.9, 0.8);
	rump.position.set(0, 1.06, -0.52);
	rump.castShadow = true;
	const neck = new THREE.Group();
	neck.position.set(0, 1.08, 0.48);
	neck.rotation.x = 0.85;
	const neckMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), coat);
	neckMesh.position.y = 0.28;
	neckMesh.castShadow = true;
	const maneStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.08), mane);
	maneStrip.position.set(0, 0.3, -0.08);
	neck.add(neckMesh, maneStrip);
	const head = new THREE.Group();
	head.position.set(0, 0.52, 0.04);
	const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), coat);
	skull.scale.set(0.72, 0.82, 1.25);
	skull.castShadow = true;
	const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.26), std(look && look.muzzle ? look.muzzle : "#7a4a30", 0.7));
	muzzle.position.set(0, -0.05, 0.2);
	const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.08), std("#4a2c1c", 0.65));
	nose.position.set(0, -0.02, 0.32);
	const blaze = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), std("#efe6d8", 0.55));
	blaze.position.set(0, 0.05, 0.16);
	const ear = (side) => {
		const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.13, 6), coat);
		tip.position.set(side * 0.06, 0.15, -0.02);
		tip.rotation.z = side * -0.25;
		return tip;
	};
	const eyeGeo = new THREE.SphereGeometry(0.018, 8, 6);
	const eyeMat = std("#1a1410", 0.35);
	const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
	eyeL.position.set(-0.06, 0.03, 0.12);
	const eyeR = eyeL.clone();
	eyeR.position.x = 0.06;
	const bridle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14), dark);
	bridle.rotation.y = Math.PI / 2;
	bridle.position.set(0, -0.02, 0.14);
	head.add(skull, muzzle, nose, blaze, ear(-1), ear(1), eyeL, eyeR, bridle);
	neck.add(head);
	const tail = new THREE.Group();
	tail.position.set(0, 1.16, -0.7);
	tail.rotation.x = 0.45;
	const hair = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.7, 7), mane);
	hair.position.y = -0.32;
	hair.castShadow = true;
	tail.add(hair);
	const leg = (x, z) => {
		const g = new THREE.Group();
		g.position.set(x, 0.96, z);
		const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 3, 7), coat);
		upper.position.y = -0.2;
		upper.castShadow = true;
		const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.32, 3, 7), dark);
		lower.position.y = -0.55;
		lower.castShadow = true;
		const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.13), hoofMat);
		hoof.position.set(0, -0.9, 0.02);
		hoof.castShadow = true;
		g.add(upper, lower, hoof);
		return g;
	};
	const post = (z) => {
		const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 1.15, 8), wood);
		p.position.set(0.72, 0.58, z);
		p.castShadow = true;
		return p;
	};
	const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.15, 8), wood);
	rail.rotation.x = Math.PI / 2;
	rail.position.set(0.72, 0.98, 0.15);
	rail.castShadow = true;
	const legs = [leg(-0.14, 0.42), leg(0.14, 0.42), leg(-0.14, -0.48), leg(0.14, -0.48)];
	root.add(body, chest, rump, neck, tail, ...legs);
	if (hitched) {
		root.add(post(0.7), post(-0.4), rail);
	} else {
		const pad = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.48), std("#6e2430", 0.82));
		pad.position.set(0, 1.18, -0.02);
		pad.castShadow = true;
		const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.34), dark);
		saddle.position.set(0, 1.23, -0.02);
		saddle.castShadow = true;
		const horn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark);
		horn.position.set(0, 1.28, 0.12);
		const stirrupL = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 5, 10), hoofMat);
		stirrupL.position.set(-0.18, 0.82, 0.04);
		const stirrupR = stirrupL.clone();
		stirrupR.position.x = 0.18;
		root.add(pad, saddle, horn, stirrupL, stirrupR);
	}
	return { root, head, tail, neck, legs };
}
export function tickVendor(v, t) {
	if (v.kind === "smith") {
		const swing = (Math.sin(t * 6.5) + 1) * .5;
		v.hips.rotation.x = Math.sin(t * 6.5) * .05;
		v.armR.rotation.x = -.15 - swing * 1.15;
	} else {
		v.hips.rotation.y = Math.sin(t * .7) * .08;
		v.armR.rotation.x = Math.sin(t * .6) * .06;
	}
}
export const SPECIES = [
	{
		id: "rat",
		name: "Tarla Faresi",
		level: 1,
		hp: 36,
		tint: "#6d5644",
		belly: "#d7c4a4",
		scale: .42,
		form: "quad",
		speed: 1.7
	},
	{
		id: "hare",
		name: "Bozkır Tavşanı",
		level: 3,
		hp: 48,
		tint: "#c4b39a",
		belly: "#f2ead8",
		scale: .5,
		form: "quad",
		speed: 2.1
	},
	{
		id: "wolf",
		name: "Gece Kurdu",
		level: 5,
		hp: 70,
		tint: "#2a2430",
		belly: "#4a3a40",
		scale: .92,
		form: "quad",
		speed: 2.05
	},
	{
		id: "frog",
		name: "Bataklık Kurbağası",
		level: 8,
		hp: 90,
		tint: "#3d6a3a",
		belly: "#d7d2a4",
		scale: .7,
		form: "bulky",
		speed: 1.3
	},
	{
		id: "jackal",
		name: "Çakal",
		level: 11,
		hp: 110,
		tint: "#8a6a3e",
		belly: "#e6d2a4",
		scale: .82,
		form: "quad",
		speed: 2.2
	},
	{
		id: "boar",
		name: "Yaban Domuzu",
		level: 14,
		hp: 160,
		tint: "#5a4034",
		belly: "#c4a080",
		scale: 1.05,
		form: "bulky",
		speed: 1.7
	},
	{
		id: "spider",
		name: "Mağara Örümceği",
		level: 17,
		hp: 140,
		tint: "#2c2420",
		belly: "#6a3030",
		scale: .85,
		form: "spider",
		speed: 1.85
	},
	{
		id: "scorp",
		name: "Bozkır Akrebi",
		level: 20,
		hp: 170,
		tint: "#6a4a28",
		belly: "#c4a060",
		scale: .9,
		form: "scorpion",
		speed: 1.55
	},
	{
		id: "bear",
		name: "Orman Ayısı",
		level: 24,
		hp: 240,
		tint: "#3a2a22",
		belly: "#6a5344",
		scale: 1.25,
		form: "bulky",
		speed: 1.45
	},
	{
		id: "skel",
		name: "İskelet Asker",
		level: 28,
		hp: 200,
		tint: "#d9d3c4",
		belly: "#b7b0a2",
		scale: 1,
		form: "biped",
		speed: 1.6
	},
	{
		id: "snake",
		name: "Bataklık Yılanı",
		level: 32,
		hp: 190,
		tint: "#2f5a3a",
		belly: "#d8d2a0",
		scale: 1,
		form: "snake",
		speed: 1.7
	},
	{
		id: "goat",
		name: "Dağ Tekesi",
		level: 36,
		hp: 230,
		tint: "#8a8274",
		belly: "#efe6d4",
		scale: 1.05,
		form: "quad",
		speed: 1.8
	},
	{
		id: "bandit",
		name: "Harabe Haydutu",
		level: 40,
		hp: 250,
		tint: "#4a3428",
		belly: "#c4a07a",
		scale: 1,
		form: "biped",
		speed: 1.7
	},
	{
		id: "golem",
		name: "Taş Golem",
		level: 44,
		hp: 340,
		tint: "#7a756c",
		belly: "#9a9488",
		scale: 1.35,
		form: "golem",
		speed: 1.15
	},
	{
		id: "bat",
		name: "Gece Yarasa",
		level: 48,
		hp: 210,
		tint: "#241820",
		belly: "#5a3040",
		scale: .85,
		form: "bat",
		speed: 2.3
	},
	{
		id: "wraith",
		name: "Buz Ruhu",
		level: 52,
		hp: 240,
		tint: "#9fd0e0",
		belly: "#e8f4f8",
		scale: 1.05,
		form: "wraith",
		speed: 1.65
	},
	{
		id: "ifrit",
		name: "Ateş İfriti",
		level: 56,
		hp: 280,
		tint: "#8a3018",
		belly: "#f0a050",
		scale: 1.1,
		form: "biped",
		speed: 1.7
	},
	{
		id: "knight",
		name: "Gölge Şövalye",
		level: 62,
		hp: 340,
		tint: "#2a3140",
		belly: "#8a7040",
		scale: 1.15,
		form: "biped",
		speed: 1.55
	},
	{
		id: "drake",
		name: "Kemik Ejderi",
		level: 70,
		hp: 420,
		tint: "#cfc6b4",
		belly: "#8a4030",
		scale: 1.35,
		form: "drake",
		speed: 1.6
	},
	{
		id: "night",
		name: "Sonsuz Gece",
		level: 80,
		hp: 560,
		tint: "#120814",
		belly: "#3a1848",
		scale: 1.5,
		form: "drake",
		speed: 1.7
	}
];
function mesh(geo, mat) {
	const m = new THREE.Mesh(geo, mat);
	m.castShadow = true;
	return m;
}
function buildCreature(spec) {
	const hide = std(spec.tint, .62, spec.form === "wraith" ? .25 : .08);
	const soft = std(spec.belly, .75);
	const bone = std("#efe6d4", .4);
	const eyeMat = new THREE.MeshStandardMaterial({
		color: "#ffb45a",
		emissive: "#ff6a12",
		emissiveIntensity: .8
	});
	const body = new THREE.Group();
	const head = new THREE.Group();
	const legs = [];
	const jaw = new THREE.Object3D();
	const leg = (x, z, len = .55) => {
		const g = new THREE.Group();
		g.position.set(x, .62, z);
		g.add(mesh(new THREE.CapsuleGeometry(.06, len, 4, 6), hide));
		const paw = mesh(new THREE.SphereGeometry(.07, 8, 6), std("#1a1410", .8));
		paw.position.y = -len * .62;
		g.add(paw);
		legs.push(g);
		return g;
	};
	if (spec.form === "spider") {
		const belly = mesh(new THREE.SphereGeometry(.38, 16, 12), hide);
		belly.position.y = .55;
		belly.scale.set(1.15, .75, 1.3);
		const abdomen = mesh(new THREE.SphereGeometry(.32, 14, 10), soft);
		abdomen.position.set(-.42, .48, 0);
		head.position.set(.42, .5, 0);
		head.add(mesh(new THREE.SphereGeometry(.16, 12, 10), hide));
		for (const z of [-.08, .08]) {
			const eye = mesh(new THREE.SphereGeometry(.03, 6, 6), eyeMat);
			eye.position.set(.12, .04, z);
			head.add(eye);
		}
		body.add(belly, abdomen, head);
		for (let i = 0; i < 8; i++) {
			const side = i < 4 ? 1 : -1;
			const along = i % 4 - 1.5;
			body.add(leg(along * .12, side * .28, .48));
		}
	} else if (spec.form === "scorpion") {
		const shell = mesh(new THREE.CapsuleGeometry(.22, .7, 5, 8), hide);
		shell.rotation.z = Math.PI / 2;
		shell.position.y = .42;
		head.position.set(.48, .42, 0);
		const claw = (z) => {
			const c = mesh(new THREE.BoxGeometry(.16, .06, .1), bone);
			c.position.set(.18, 0, z);
			return c;
		};
		head.add(mesh(new THREE.SphereGeometry(.12, 10, 8), hide), claw(.12), claw(-.12));
		const tail = mesh(new THREE.CapsuleGeometry(.05, .7, 4, 6), hide);
		tail.position.set(-.45, .85, 0);
		tail.rotation.z = 1.1;
		const sting = mesh(new THREE.ConeGeometry(.04, .16, 5), bone);
		sting.position.set(-.78, 1.15, 0);
		body.add(shell, head, tail, sting, leg(.2, .2, .32), leg(.2, -.2, .32), leg(-.15, .2, .32), leg(-.15, -.2, .32));
	} else if (spec.form === "snake") {
		for (let i = 0; i < 6; i++) {
			const seg = mesh(new THREE.SphereGeometry(.16 - i * .012, 10, 8), i % 2 ? soft : hide);
			seg.position.set(-i * .22, .18, Math.sin(i) * .05);
			seg.scale.set(1.3, .7, .7);
			body.add(seg);
		}
		head.position.set(.28, .22, 0);
		const skull = mesh(new THREE.SphereGeometry(.14, 12, 10), hide);
		skull.scale.set(1.4, .7, .8);
		jaw.position.set(.08, -.04, 0);
		head.add(skull, jaw);
		const eye = mesh(new THREE.SphereGeometry(.025, 6, 6), eyeMat);
		eye.position.set(.1, .04, .07);
		head.add(eye, eye.clone().translateZ(-.14));
		body.add(head);
	} else if (spec.form === "biped") {
		const torso = mesh(new THREE.CapsuleGeometry(.22, .45, 5, 8), hide);
		torso.position.y = 1.05;
		head.position.set(0, 1.55, 0);
		const skull = mesh(new THREE.SphereGeometry(.16, 12, 10), spec.id === "skel" ? bone : hide);
		jaw.position.set(0, -.08, .04);
		head.add(skull, jaw);
		const eye = mesh(new THREE.SphereGeometry(.025, 6, 6), eyeMat);
		eye.position.set(.08, .02, .1);
		const eye2 = eye.clone();
		eye2.position.x = -.08;
		head.add(eye, eye2);
		const arm = (x) => {
			const g = new THREE.Group();
			g.position.set(x, 1.25, 0);
			g.add(mesh(new THREE.CapsuleGeometry(.05, .4, 4, 6), hide));
			legs.push(g);
			return g;
		};
		body.add(torso, head, arm(.28), arm(-.28), leg(.1, 0, .7), leg(-.1, 0, .7));
	} else if (spec.form === "bat") {
		const torso = mesh(new THREE.SphereGeometry(.22, 12, 10), hide);
		torso.position.y = .7;
		head.position.set(.18, .82, 0);
		head.add(mesh(new THREE.SphereGeometry(.12, 10, 8), hide));
		const wing = (z) => {
			const w = mesh(new THREE.CircleGeometry(.45, 3), hide);
			w.position.set(-.05, .75, z);
			w.rotation.y = z > 0 ? .6 : -.6;
			return w;
		};
		body.add(torso, head, wing(.15), wing(-.15), leg(.05, .08, .28), leg(.05, -.08, .28));
	} else if (spec.form === "golem") {
		const torso = mesh(new THREE.DodecahedronGeometry(.42, 0), hide);
		torso.position.y = .95;
		torso.scale.set(1.1, 1.25, .8);
		head.position.set(0, 1.55, 0);
		head.add(mesh(new THREE.BoxGeometry(.28, .24, .24), soft));
		const eye = mesh(new THREE.SphereGeometry(.04, 6, 6), eyeMat);
		eye.position.set(.08, 0, .1);
		head.add(eye, eye.clone().translateZ(-.2));
		body.add(torso, head, leg(.18, 0, .7), leg(-.18, 0, .7));
	} else if (spec.form === "wraith") {
		const cloak = mesh(new THREE.ConeGeometry(.38, 1.3, 10), hide);
		cloak.position.y = .7;
		head.position.set(0, 1.35, 0);
		head.add(mesh(new THREE.SphereGeometry(.14, 12, 10), soft));
		const eye = mesh(new THREE.SphereGeometry(.03, 6, 6), eyeMat);
		eye.position.set(.06, 0, .1);
		head.add(eye);
		body.add(cloak, head);
	} else if (spec.form === "drake") {
		const torso = mesh(new THREE.CapsuleGeometry(.28, 1.1, 6, 10), hide);
		torso.rotation.z = Math.PI / 2;
		torso.position.y = .85;
		head.position.set(.85, 1.05, 0);
		const skull = mesh(new THREE.SphereGeometry(.2, 12, 10), hide);
		skull.scale.set(1.3, .8, .75);
		const snout = mesh(new THREE.ConeGeometry(.08, .28, 6), hide);
		snout.rotation.z = -Math.PI / 2;
		snout.position.set(.28, 0, 0);
		jaw.position.set(.1, -.08, 0);
		head.add(skull, snout, jaw);
		const wing = (z) => {
			const w = mesh(new THREE.ConeGeometry(.08, .7, 4), soft);
			w.position.set(-.1, 1.15, z);
			w.rotation.z = z > 0 ? -.8 : .8;
			w.rotation.y = z > 0 ? .4 : -.4;
			return w;
		};
		const tail = mesh(new THREE.CapsuleGeometry(.06, .8, 4, 6), hide);
		tail.position.set(-.9, .7, 0);
		tail.rotation.z = .5;
		body.add(torso, head, wing(.2), wing(-.2), tail, leg(.35, .18, .5), leg(.35, -.18, .5), leg(-.3, .16, .45), leg(-.3, -.16, .45));
	} else {
		const girth = spec.form === "bulky" ? .42 : .28;
		const torso = mesh(new THREE.CapsuleGeometry(girth, spec.form === "bulky" ? .85 : .7, 6, 10), hide);
		torso.rotation.z = Math.PI / 2;
		torso.position.y = spec.form === "bulky" ? .78 : .7;
		const chest = mesh(new THREE.SphereGeometry(girth * .95, 12, 10), hide);
		chest.position.set(.28, torso.position.y, 0);
		const gut = mesh(new THREE.SphereGeometry(.16, 10, 8), soft);
		gut.position.set(0, torso.position.y - .22, 0);
		gut.scale.set(1.4, .5, .8);
		head.position.set(.62, torso.position.y + .08, 0);
		const skull = mesh(new THREE.SphereGeometry(.16, 12, 10), hide);
		skull.scale.set(1.15, .85, .8);
		const snout = mesh(new THREE.CapsuleGeometry(.05, .14, 3, 6), hide);
		snout.rotation.z = Math.PI / 2;
		snout.position.set(.16, -.02, 0);
		jaw.position.set(.1, -.08, 0);
		head.add(skull, snout, jaw);
		const eye = mesh(new THREE.SphereGeometry(.028, 6, 6), eyeMat);
		eye.position.set(.08, .04, .08);
		head.add(eye, eye.clone().translateZ(-.16));
		if (spec.id === "goat" || spec.id === "boar") {
			const horn = mesh(new THREE.ConeGeometry(.04, .22, 5), bone);
			horn.position.set(-.02, .16, .08);
			horn.rotation.z = -.5;
			const horn2 = horn.clone();
			horn2.position.z = -.08;
			head.add(horn, horn2);
		}
		if (spec.id === "hare") {
			const ear = mesh(new THREE.CapsuleGeometry(.03, .22, 3, 5), hide);
			ear.position.set(-.04, .22, .06);
			head.add(ear, ear.clone().translateZ(-.12));
		}
		const tail = mesh(new THREE.CapsuleGeometry(.04, .28, 3, 5), hide);
		tail.position.set(-.55, torso.position.y, 0);
		tail.rotation.z = .6;
		body.add(torso, chest, gut, head, tail, leg(.22, .16), leg(.22, -.16), leg(-.22, .16), leg(-.22, -.16));
	}
	body.scale.setScalar(spec.scale);
	return {
		body,
		head,
		jaw,
		legs
	};
}
export function mobHpFor(level, weight = 1) {
	const hit = 42 + Math.max(0, level - 1) * 1.85;
	const hits = 5.2 + level * 0.18;
	return Math.max(70, Math.round(hit * hits * weight));
}
export function mitigate(mobLevel, playerLevel, dmg) {
	const gap = mobLevel - playerLevel;
	let mult = 0.68;
	if (gap > 0) mult *= Math.max(0.1, 1 - gap * 0.045);
	else if (gap < 0) mult *= Math.min(1.25, 1 + -gap * 0.01);
	return Math.max(1, Math.round(dmg * mult));
}
export function mobBite(mobLevel, playerLevel) {
	const base = 5 + mobLevel * 1.65;
	const gap = playerLevel - mobLevel;
	let scale = 1;
	if (gap > 0) scale = Math.pow(0.84, Math.min(36, gap));
	else if (gap < 0) scale = Math.min(2.4, Math.pow(1.07, Math.min(20, -gap)));
	const jitter = 0.9 + Math.random() * 0.2;
	return Math.max(1, Math.round(base * scale * jitter));
}
export function mobXp(level, boss, playerLevel) {
	const xp = Math.round(20 + Math.max(1, level) * 8);
	const base = boss ? Math.round(xp * 2.15) : xp;
	const gap = Math.max(0, Math.floor(playerLevel || level) - Math.floor(level));
	const scale = Math.pow(0.82, Math.min(30, gap));
	return Math.max(1, Math.round(base * scale));
}
export function createBeast(x, z, id = "beast", pack = 0, spec = SPECIES[2]) {
	const root = new THREE.Group();
	root.position.set(x, 0, z);
	const made = buildCreature(spec);
	const hpBar = bar();
	hpBar.position.y = 1.55 * spec.scale + .35;
	const tag = label(`${spec.name} · Sv.${spec.level}`);
	tag.position.y = hpBar.position.y + .28;
	tag.visible = false;
	hpBar.visible = false;
	root.add(made.body, hpBar, tag);
	const weight = 0.8 + Math.min(0.55, (spec.hp || 40) / 1200);
	const hp = mobHpFor(spec.level, weight);
	return {
		id,
		pack,
		name: spec.name,
		specId: spec.id,
		level: spec.level,
		speed: spec.speed,
		root,
		bar: hpBar,
		hp,
		hpMax: hp,
		alive: true,
		anger: false,
		homeX: x,
		homeZ: z,
		yaw: Math.random() * Math.PI * 2,
		phase: Math.random() * 4,
		shake: 0,
		cool: 0,
		respawn: 0,
		slow: 0,
		poison: 0,
		poisonDps: 0,
		legs: made.legs,
		head: made.head,
		jaw: made.jaw,
		body: made.body,
		boss: false,
		returning: false,
		drift: Math.random() * Math.PI * 2,
		roam: 100
	};
}
function damp(cur, target, lambda, dt) {
	return cur + Math.atan2(Math.sin(target - cur), Math.cos(target - cur)) * (1 - Math.exp(-lambda * dt));
}

const VILLAGE_EDGE = 67;
function clampRealm(x, z, hx, hz) {
	let realm = REALMS[0];
	let best = Infinity;
	for (let i = 0; i < REALMS.length; i++) {
		const row = REALMS[i];
		const d = Math.hypot(hx - row.x, hz - row.z);
		if (d < best) {
			best = d;
			realm = row;
		}
	}
	const limit = (realm.id === "koy" ? VILLAGE_BOUND : DUNGEON_BOUND) - 2.4;
	const dx = x - realm.x;
	const dz = z - realm.z;
	const r = Math.hypot(dx, dz) || 1;
	if (r <= limit) return { x, z };
	return { x: realm.x + (dx / r) * limit, z: realm.z + (dz / r) * limit };
}
function stepOutside(b, nx, nz) {
	const spot = clampRealm(nx, nz, b.homeX, b.homeZ);
	nx = spot.x;
	nz = spot.z;
	if (b.anger) {
		b.root.position.x = nx;
		b.root.position.z = nz;
		return;
	}
	if (Math.hypot(nx, nz) >= VILLAGE_EDGE) {
		b.root.position.x = nx;
		b.root.position.z = nz;
		return;
	}
	const r = Math.hypot(b.root.position.x, b.root.position.z);
	if (r >= VILLAGE_EDGE) return;
	const push = Math.hypot(nx, nz) || 1;
	b.root.position.x = nx / push * VILLAGE_EDGE;
	b.root.position.z = nz / push * VILLAGE_EDGE;
}
export function tickBeast(b, dt, px, pz, cam, puppet = false) {
	setBar(b.bar, b.alive ? b.hp / b.hpMax : 0, cam);
	if (!b.alive) {
		b.root.rotation.x = Math.min(1.25, b.root.rotation.x + dt * 1.5);
		return false;
	}
	if (puppet) {
		b.phase += dt * (b.anger ? 1 : .35);
		if (b.anger) {
			const face = Math.atan2(px - b.root.position.x, pz - b.root.position.z);
			b.yaw = damp(b.yaw, face, 3.2, dt);
			b.root.rotation.y = b.yaw - Math.PI / 2;
			const step = Math.sin(b.phase * 8);
			b.legs.forEach((leg, i) => {
				const sign = i % 2 === 0 ? 1 : -1;
				const pair = i < 2 ? 1 : -1;
				leg.rotation.z = step * sign * pair * .4;
			});
		}
		return false;
	}
	const dx = px - b.root.position.x;
	const dz = pz - b.root.position.z;
	const dist = Math.hypot(dx, dz);
	b.phase += dt * (b.anger && dist < 11 ? 1 : .35);
	b.root.userData.atk = Math.max(0, Number(b.root.userData.atk) || 0) - dt;
	b.slow = Math.max(0, b.slow - dt);
	const pace = b.speed * (b.slow > 0 ? .45 : 1);
	if (b.shake > 0) {
		b.shake -= dt;
		b.body.position.y = Math.sin(b.shake * 40) * .08;
	} else b.body.position.y = 0;
	if (b.flash > 0) {
		b.flash = Math.max(0, b.flash - dt);
		const hot = b.flash > 0;
		if (b.body) {
			b.body.traverse((obj) => {
				if (!obj.isMesh || !obj.material || !obj.material.color) return;
				if (obj.userData.baseColor == null) obj.userData.baseColor = obj.material.color.getHex();
				obj.material.color.set(hot ? "#ff3b32" : obj.userData.baseColor);
				if (obj.material.emissive) {
					obj.material.emissive.set(hot ? "#ff2a22" : "#000000");
					obj.material.emissiveIntensity = hot ? 0.85 : 0;
				}
			});
		}
	}
	const homeNow = Math.hypot(b.root.position.x - b.homeX, b.root.position.z - b.homeZ);
	if (b.returning || (b.anger && homeNow > 15)) {
		b.returning = true;
		b.anger = false;
		if (homeNow < 0.7) {
			b.returning = false;
			b.root.position.x = b.homeX;
			b.root.position.z = b.homeZ;
			return false;
		}
		const face = Math.atan2(b.homeX - b.root.position.x, b.homeZ - b.root.position.z);
		b.yaw = damp(b.yaw, face, 4.2, dt);
		b.root.rotation.y = b.yaw - Math.PI / 2;
		const sp = pace * 1.5;
		stepOutside(b, b.root.position.x + Math.sin(b.yaw) * sp * dt, b.root.position.z + Math.cos(b.yaw) * sp * dt);
		const stride = Math.sin(b.phase * 8);
		b.legs.forEach((leg, i) => {
			const sign = i % 2 === 0 ? 1 : -1;
			const pair = i < 2 ? 1 : -1;
			leg.rotation.z = stride * sign * pair * .5;
		});
		return false;
	}
	if (!b.anger && b.patrol && b.patrol.length > 1) {
		b.patrolI = b.patrolI || 0;
		const point = b.patrol[b.patrolI % b.patrol.length];
		const mx = point.x - b.root.position.x;
		const mz = point.z - b.root.position.z;
		const distHome = Math.hypot(mx, mz) || 0.001;
		if (distHome < 1.25) b.patrolI += 1;
		const face = Math.atan2(mx, mz);
		b.yaw = damp(b.yaw, face, 2.4, dt);
		b.root.rotation.y = b.yaw - Math.PI / 2;
		const step = Math.min(distHome, pace * 0.6 * dt);
		stepOutside(b, b.root.position.x + (mx / distHome) * step, b.root.position.z + (mz / distHome) * step);
		return false;
	}
	if (!b.anger) {
		const roam = b.boss ? 11 : Math.min(b.roam || 12, 12);
		b.drift = (b.drift || 0) + dt * (0.22 + ((b.phase * 10) % 1) * 0.35);
		const tx = b.homeX + Math.cos(b.drift) * roam * 0.72 + Math.sin(b.phase * 0.31) * roam * 0.28;
		const tz = b.homeZ + Math.sin(b.drift * 0.83) * roam * 0.7 + Math.cos(b.phase * 0.27) * roam * 0.3;
		const mx = tx - b.root.position.x;
		const mz = tz - b.root.position.z;
		const distHome = Math.hypot(mx, mz) || .001;
		const face = Math.atan2(mx, mz);
		b.yaw = damp(b.yaw, face, 2.2, dt);
		b.root.rotation.y = b.yaw - Math.PI / 2;
		const away = Math.hypot(px - b.root.position.x, pz - b.root.position.z);
		let step = Math.min(distHome, pace * .55 * dt);
		if (away < 2.4) step = pace * .7 * dt;
		const dirx = away < 2.4 ? (b.root.position.x - px) / (away || 1) : mx / distHome;
		const dirz = away < 2.4 ? (b.root.position.z - pz) / (away || 1) : mz / distHome;
		const nx = b.root.position.x + dirx * step;
		const nz = b.root.position.z + dirz * step;
		if (Math.hypot(nx - b.homeX, nz - b.homeZ) <= roam) stepOutside(b, nx, nz);
		const stride = Math.sin(b.phase * 7);
		b.legs.forEach((leg, i) => {
			const sign = i % 2 === 0 ? 1 : -1;
			const pair = i < 2 ? 1 : -1;
			leg.rotation.z = stride * sign * pair * .38;
		});
		b.head.rotation.z *= .85;
		b.jaw.rotation.z *= .8;
		return false;
	}
	if (dist > 15) {
		b.anger = false;
		b.returning = true;
		return false;
	}
	const face = Math.atan2(dx, dz);
	b.cool = Math.max(0, b.cool - dt);
	const chasing = dist > 1.65;
	if (chasing) {
		b.yaw = damp(b.yaw, face, 4.4, dt);
		b.root.rotation.y = b.yaw - Math.PI / 2;
		const sp = pace * 1.38;
		stepOutside(b, b.root.position.x + Math.sin(b.yaw) * sp * dt, b.root.position.z + Math.cos(b.yaw) * sp * dt);
	} else if (b.alive) b.root.rotation.y = b.yaw - Math.PI / 2;
	const step = chasing ? Math.sin(b.phase * 8) : Math.sin(b.phase * 1.4) * .25;
	b.legs.forEach((leg, i) => {
		const sign = i % 2 === 0 ? 1 : -1;
		const pair = i < 2 ? 1 : -1;
		leg.rotation.z = step * sign * pair * .55;
	});
	if (dist < 2.05) {
		b.yaw = damp(b.yaw, face, 6, dt);
		b.root.rotation.y = b.yaw - Math.PI / 2;
		const lunge = Math.max(0, Math.sin(b.phase * 8));
		b.head.rotation.z = -lunge * .45;
		b.jaw.rotation.z = lunge * .55;
		if (b.cool <= 0) {
			b.cool = 1.15;
			b.root.userData.atk = 0.62;
			return true;
		}
	} else {
		b.head.rotation.z *= .85;
		b.jaw.rotation.z *= .85;
	}
	return false;
}
export function hitBeast(b, dmg) {
	if (!b.alive) return;
	b.hp = Math.max(0, b.hp - dmg);
	b.shake = .28;
	b.flash = 0.34;
	if (b.hp <= 0) {
		b.alive = false;
		b.respawn = 10;
	}
}
function itemId(value) {
	if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
	return value ? "gece-weapon" : "";
}
function paintPlus(root, plus) {
	const glow = Math.min(1, Math.max(0, Number(plus) || 0) / 10);
	if (!root || glow <= 0) return;
	root.traverse((obj) => {
		if (!obj.isMesh || !obj.material || !obj.material.emissive) return;
		obj.material.emissive.set(glow > 0.85 ? "#fff1c2" : glow > 0.55 ? "#7ec8ff" : "#3a6ea5");
		obj.material.emissiveIntensity = 0.12 + glow * 1.25;
	});
}
function gearHash(id) {
	let n = 0;
	const text = String(id || "x");
	for (let i = 0; i < text.length; i++) n = (n * 33 + text.charCodeAt(i)) >>> 0;
	return n;
}
export function weaponMesh(style, seed = 0, plus = 0) {
	const g = new THREE.Group();
	const v = Math.abs(Math.floor(Number(seed) || 0)) % 5;
	const steelTint = ["#d5dbe3", "#c9a36a", "#9eb0c4", "#f4f7fb", "#8d9aa8"][v];
	const woodTint = ["#6a4428", "#4a3020", "#7a5a32", "#3a2418", "#8a6840"][v];
	const steel = surf("/textures/steel.jpg", steelTint, 0.32, 0.86, 1, 3);
	const steelDark = surf("/textures/steel.jpg", "#4a5158", 0.4, 0.8, 1, 2);
	const wood = surf("/textures/wood.jpg", woodTint, 0.78, 0.04, 1, 3);
	const wrap = surf("/textures/leather.jpg", "#3a2a1c", 0.84, 0.02, 2, 1);
	const gripAt = (y = 0.05) => g.position.set(0, y, 0.012);
	if (style === "bow") {
		const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.018, 0.5, 6), wood);
		upper.position.set(0, 0.25, 0);
		const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.011, 0.5, 6), wood);
		lower.position.set(0, -0.25, 0);
		const hornU = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), std("#e4d7c4", 0.4, 0.15));
		hornU.position.set(0, 0.5, 0);
		const hornD = hornU.clone();
		hornD.position.set(0, -0.5, 0);
		const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), wrap);
		const tipU = new THREE.Object3D();
		tipU.name = "bow-tip-up";
		tipU.position.set(0, 0.5, 0.045);
		const tipD = new THREE.Object3D();
		tipD.name = "bow-tip-down";
		tipD.position.set(0, -0.5, 0.045);
		const stringMat = std("#f3efe6", 0.35);
		const stringGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 4);
		const stringTop = new THREE.Mesh(stringGeo, stringMat);
		stringTop.name = "string-top";
		const stringBot = new THREE.Mesh(stringGeo, stringMat);
		stringBot.name = "string-bot";
		const nock = new THREE.Group();
		nock.name = "nocked";
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 5), wood);
		shaft.rotation.x = Math.PI / 2;
		const tip = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.03, 5), steel);
		tip.rotation.x = Math.PI / 2;
		tip.position.z = -0.09;
		const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.002, 0.018), std("#efe6d4", 0.6));
		fletch.position.z = 0.07;
		nock.add(shaft, tip, fletch);
		g.add(upper, lower, hornU, hornD, grip, tipU, tipD, stringTop, stringBot, nock);
		gripAt(0);
	} else if (style === "staff") {
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, 1.15, 10), wood);
		shaft.position.y = 0.28;
		const knot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), wood);
		knot.position.y = 0.55;
		knot.scale.set(1, 0.6, 1);
		const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 1), new THREE.MeshPhysicalMaterial({ color: "#9fd0ff", roughness: 0.15, metalness: 0.05, emissive: "#3d6cb0", emissiveIntensity: 0.45, clearcoat: 1 }));
		gem.position.y = 0.9;
		const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), std("#c2a15a", 0.35, 0.6));
		collar.position.y = 0.78;
		const rune = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 12), std("#d4c07a", 0.4, 0.5));
		rune.position.y = 0.2;
		rune.rotation.x = Math.PI / 2;
		g.add(shaft, knot, gem, collar, rune);
		gripAt(0.05);
	} else if (style === "dagger") {
		const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.005), steelDark);
		blade.position.set(0, 0.14, 0);
		blade.userData.edge = true;
		const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.11, 0.007), std("#1a1c1e", 0.3, 0.7));
		fuller.position.set(0, 0.14, 0);
		fuller.userData.edge = true;
		const guard = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.01, 0.014), steelDark);
		guard.position.y = 0.045;
		const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.08, 8), wrap);
		g.add(blade, fuller, guard, grip);
		gripAt(0.048);
	} else if (style === "pala") {
		const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.016), steel);
		blade.position.y = 0.62;
		const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.7, 0.018), std("#8a929c", 0.35, 0.7));
		fuller.position.y = 0.62;
		const rune = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), std("#6a3030", 0.4, 0.4));
		rune.position.set(0, 0.4, 0);
		const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.03), steel);
		guard.position.y = 0.12;
		const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.22, 10), wrap);
		grip.position.y = -0.02;
		const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), steel);
		pommel.position.y = -0.15;
		g.add(blade, fuller, rune, guard, grip, pommel);
		gripAt(0.05);
	} else if (style === "kazma") {
		const handle = new THREE.Mesh(new THREE.CylinderGeometry(.016, .02, .78, 8), std("#6a4324", .7));
		handle.position.y = .18;
		const collar = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .04, 8), std("#3a2a1c", .6));
		collar.position.y = .5;
		const head = new THREE.Mesh(new THREE.BoxGeometry(.34, .055, .05), std("#b7bdc6", .32, .72));
		head.position.y = .54;
		const tipL = new THREE.Mesh(new THREE.ConeGeometry(.03, .12, 5), std("#e4e8ee", .25, .8));
		tipL.rotation.z = Math.PI / 2;
		tipL.position.set(-.2, .54, 0);
		const tipR = tipL.clone();
		tipR.rotation.z = -Math.PI / 2;
		tipR.position.set(.2, .54, 0);
		g.add(handle, collar, head, tipL, tipR);
		gripAt(0.05);
	} else if (style === "olta") {
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.007, .013, 1.25, 6), std("#8a5a32", .62));
		shaft.position.y = .48;
		const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .14, 8), std("#2a2118", .7));
		wrap.position.y = .08;
		const reel = new THREE.Mesh(new THREE.CylinderGeometry(.034, .034, .02, 10), std("#8a7a40", .4, .45));
		reel.rotation.x = Math.PI / 2;
		reel.position.set(0, .1, .03);
		const guide = new THREE.Mesh(new THREE.TorusGeometry(.012, .003, 5, 8), std("#d5dbe3", .35, .5));
		guide.position.y = 1.08;
		const line = new THREE.Mesh(new THREE.BoxGeometry(.004, .62, .004), std("#efe6d4", .45));
		line.position.set(.02, .74, .03);
		g.add(shaft, wrap, reel, guide, line);
		gripAt(0.05);
	} else {
		const blade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.52, 0.008), steel);
		blade.position.y = 0.38;
		const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.46, 0.01), std("#f4f7fb", 0.18, 0.92));
		edge.position.set(0.012, 0.38, 0);
		const guard = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.022), steel);
		guard.position.y = 0.09;
		const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.1, 10), wrap);
		const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), steel);
		pommel.position.y = -0.07;
		g.add(blade, edge, guard, grip, pommel);
		gripAt(0.05);
	}
	g.traverse((obj) => {
		if (!obj.isMesh || !obj.material) return;
		const mat = obj.material;
		mat.transparent = false;
		mat.opacity = 1;
		mat.depthWrite = true;
		mat.depthTest = true;
	});
	const n = Math.abs(Math.floor(Number(seed) || 0));
	g.scale.set(0.82 + (n % 5) * 0.08, 0.86 + ((n >> 3) % 5) * 0.06, 1);
	paintPlus(g, plus);
	return g;
}
function weaponStand() {
	const rack = new THREE.Group();
	const post = new THREE.Mesh(new THREE.BoxGeometry(.08, .92, .08), std("#5a3d22", .8));
	post.position.y = .46;
	const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.05, .045, .18), std("#6a4428", .75));
	shelf.position.y = .9;
	rack.add(post, shelf);
	[
		"sword",
		"bow",
		"staff",
		"dagger"
	].forEach((style, i) => {
		const w = weaponMesh(style);
		w.scale.setScalar(style === "staff" ? .62 : .78);
		w.position.set(-.36 + i * .24, 1.02, 0);
		rack.add(w);
	});
	const off = weaponMesh("dagger");
	off.scale.setScalar(.78);
	off.position.set(.38, 1.02, .06);
	rack.add(off);
	return rack;
}
var _bowUp = new THREE.Vector3(0, 1, 0);
var _bowA = new THREE.Vector3();
var _bowB = new THREE.Vector3();
var _bowC = new THREE.Vector3();
var _bowX = new THREE.Vector3();
var _bowY = new THREE.Vector3();
var _bowZ = new THREE.Vector3();
var _bowQ = new THREE.Quaternion();
var _bowInv = new THREE.Quaternion();
var _bowM = new THREE.Matrix4();
function spanString(mesh, from, to) {
	_bowC.copy(to).sub(from);
	const len = Math.max(0.05, _bowC.length());
	mesh.position.copy(from).addScaledVector(_bowC, 0.5);
	mesh.scale.set(1, len, 1);
	_bowC.multiplyScalar(1 / len);
	if (_bowC.y < -0.999) mesh.quaternion.set(1, 0, 0, 0);
	else mesh.quaternion.setFromUnitVectors(_bowUp, _bowC);
}
export function syncBow(model, extend) {
	let bow = model.userData.gear?.weapon;
	if (!bow || bow.userData.kind !== "bow") return;
	if (!bow.userData.straight) {
		const host = bow.parent;
		const fresh = weaponMesh("bow");
		fresh.userData.kind = "bow";
		fresh.userData.straight = 1;
		if (host) {
			host.remove(bow);
			host.add(fresh);
		}
		model.userData.gear.weapon = fresh;
		bow = fresh;
	}
	const tipU = bow.getObjectByName("bow-tip-up");
	const tipD = bow.getObjectByName("bow-tip-down");
	const up = bow.getObjectByName("string-top");
	const lo = bow.getObjectByName("string-bot");
	const nock = bow.getObjectByName("nocked");
	const parent = bow.parent;
	if (!tipU || !tipD || !up || !lo || !nock || !parent) return;
	const lift = Math.max(0, Math.min(1, extend || 0));
	bow.position.set(0, 0.02, -0.045);
	bow.scale.set(1, 1, 1);
	const hand = bow.parent;
	hand.updateWorldMatrix(true, false);
	model.getWorldDirection(_bowA);
	_bowY.set(0, -1, 0);
	if (lift > 0.001) {
		_bowB.copy(_bowA).addScaledVector(_bowUp, 0.42 + lift * 0.35).normalize();
		_bowY.lerp(_bowB, lift).normalize();
	}
	_bowZ.copy(_bowA).negate();
	_bowZ.y = 0;
	if (_bowZ.lengthSq() < 1e-8) _bowZ.set(1, 0, 0);
	_bowZ.normalize();
	_bowZ.addScaledVector(_bowY, -_bowZ.dot(_bowY));
	if (_bowZ.lengthSq() < 1e-8) _bowZ.set(1, 0, 0);
	_bowZ.normalize();
	_bowX.crossVectors(_bowY, _bowZ).normalize();
	_bowZ.crossVectors(_bowX, _bowY).normalize();
	_bowM.makeBasis(_bowX, _bowY, _bowZ);
	_bowQ.setFromRotationMatrix(_bowM);
	hand.getWorldQuaternion(_bowInv);
	bow.quaternion.copy(_bowInv.invert()).multiply(_bowQ);
	bow.updateMatrix();
	bow.matrixWorld.multiplyMatrices(hand.matrixWorld, bow.matrix);
	const local = _bowB.set(0, 0.06, 0.05);
	spanString(up, tipU.position, _bowA.set(0, 0, 0.05 + lift * 0.04));
	spanString(lo, tipD.position, _bowA);
	nock.position.copy(local);
	nock.rotation.set(-Math.PI / 2, 0, 0);
	nock.scale.setScalar(0.42);
	nock.visible = lift > 0.12;
}
var NIGHT = "#2a2e38";
var GOLD = "#8a7a40";
export function syncGear(model, equipped) {
	const store = model.userData.gear ??= {};
	const weaponId = itemId(equipped.weapon);
	const style = weaponStyleOf(weaponId);
	const wsig = `${weaponId}:${equipped.weapon?.plus || 0}`;
	const dropPiece = (slot) => {
		const piece = store[slot];
		if (!piece) return;
		const parts = piece.userData.parts || [];
		for (const part of parts) part.parent?.remove(part);
		if (piece.userData.extra) piece.userData.extra.parent?.remove(piece.userData.extra);
		piece.parent?.remove(piece);
		delete store[slot];
	};
	if (store.weapon && store.weapon.userData.sig !== wsig) dropPiece("weapon");
	const parentOf = (slot) => {
		if (slot === "weapon") return model.getObjectByName("RightHand");
		if (slot === "gloves") return model.getObjectByName("RightHand");
		if (slot === "helmet") return model.getObjectByName("Head");
		if (slot === "boots") return model;
		if (slot === "belt") return model.getObjectByName("Hips");
		return model.getObjectByName("Spine2") ?? model.getObjectByName("Spine1");
	};
	const seatDagger = (g, side) => {
		g.position.set(0, 0.03, 0.01);
		g.traverse((obj) => {
			if (obj.userData && obj.userData.edge) obj.position.x = side * 0.09;
		});
	};
	const held = store.weapon;
	if (held && held.userData.kind !== style) {
		held.parent?.remove(held);
		delete store.weapon;
	}
	if (style === "dagger") {
		if (!store.offhand) {
			const left = weaponMesh("dagger");
			left.userData.kind = "offhand";
			seatDagger(left, -1);
			model.getObjectByName("LeftHand")?.add(left);
			store.offhand = left;
		}
	} else if (store.offhand) {
		store.offhand.parent?.remove(store.offhand);
		delete store.offhand;
	}
	const make = (slot) => {
		if (slot === "weapon") {
			const g = weaponMesh(style, gearHash(weaponId), equipped.weapon?.plus || 0);
			g.userData.kind = style;
			g.userData.sig = `${weaponId}:${equipped.weapon?.plus || 0}`;
			if (style === "bow") g.userData.straight = 1;
			if (style === "dagger") seatDagger(g, 1);
			return g;
		}
		const tones = ["#8a93a0", "#6a4a32", "#3e4a38", "#4a3a55", "#7a6840", "#2e3a48", "#5c4030", "#303848"];
		const tone = tones[gearHash(equipped[slot]?.id) % tones.length];
		const g = new THREE.Group();
		const wear = (boneName, mesh) => {
			const host = model.getObjectByName(boneName) || g;
			host.add(mesh);
			const parts = g.userData.parts || (g.userData.parts = []);
			parts.push(mesh);
			return mesh;
		};
		if (slot === "helmet") {
			return null;
		} else if (slot === "armor") {
			g.userData.fitted = true;
			const bulk = model.userData.bulk || 1;
			const plateMat = std(tone, 0.45, 0.42);
			const clothMat = std("#2c241c", 0.68, 0.12);
			const cuirass = new THREE.Mesh(new THREE.CapsuleGeometry(0.168 * bulk, 0.1, 5, 12), plateMat);
			cuirass.position.set(0, 0.06, 0);
			cuirass.scale.set(1.08, 0.96, 0.84);
			const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.16 * bulk, 0.2, 0.02), std("#3a4250", 0.4, 0.5));
			ridge.position.set(0, 0.07, 0.15 * bulk);
			const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.12 * bulk, 0.06, 4, 8), std("#343844", 0.55, 0.28));
			belly.position.set(0, 0.05, 0);
			const trim = new THREE.Mesh(new THREE.TorusGeometry(0.15 * bulk, 0.012, 6, 14), std(GOLD, 0.4, 0.55));
			trim.rotation.x = Math.PI / 2;
			trim.position.set(0, -0.02, 0);
			const hipshell = new THREE.Mesh(new THREE.SphereGeometry(0.145 * bulk, 12, 10), clothMat);
			hipshell.scale.set(1.3, 0.55, 1);
			wear("Spine2", cuirass);
			wear("Spine2", ridge);
			wear("Spine", belly);
			wear("Spine2", trim);
			wear("Hips", hipshell);
			const pauldron = (arm, x) => {
				const p = new THREE.Mesh(new THREE.SphereGeometry(0.072 * bulk, 10, 8), plateMat);
				p.scale.set(1.2, 0.52, 0.95);
				p.position.set(x, 0.06, 0.015);
				wear(arm, p);
			};
			pauldron("LeftArm", 0.05);
			pauldron("RightArm", -0.05);
			const thigh = (boneName) => {
				const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.076 * bulk, 0.28, 4, 8), clothMat);
				leg.position.set(0, 0.21, 0.008);
				leg.scale.set(1.02, 1, 0.9);
				wear(boneName, leg);
			};
			thigh("LeftUpLeg");
			thigh("RightUpLeg");
			const greave = (boneName) => {
				const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.046 * bulk, 0.28, 4, 8), plateMat);
				shin.position.set(0, 0.2, -0.008);
				const front = new THREE.Mesh(new THREE.BoxGeometry(0.068 * bulk, 0.22, 0.012), std("#3a4250", 0.42, 0.48));
				front.position.set(0, 0.2, -0.046);
				wear(boneName, shin);
				wear(boneName, front);
			};
			greave("LeftLeg");
			greave("RightLeg");
			const shoe = (boneName) => {
				const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.24), std("#14161c", 0.62, 0.16));
				boot.position.set(0, 0.04, -0.05);
				const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.09), std(GOLD, 0.4, 0.4));
				cuff.position.set(0, 0.07, 0.01);
				wear(boneName, boot);
				wear(boneName, cuff);
			};
			shoe("LeftFoot");
			shoe("RightFoot");
		} else if (slot === "necklace") {
			const n = new THREE.Mesh(new THREE.TorusGeometry(.07, .008, 6, 14), std(GOLD, .35, .7));
			n.rotation.x = Math.PI / 2;
			n.position.set(0, .08, .08);
			g.add(n);
		} else if (slot === "belt") {
			const b = new THREE.Mesh(new THREE.BoxGeometry(.26, .045, .15), std(GOLD, .4, .55));
			b.position.set(0, -.02, .02);
			g.add(b);
		} else if (slot === "boots") {
			g.userData.fitted = true;
			const shoe = (boneName) => {
				const sole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.24), std("#14161c", 0.65, 0.2));
				sole.position.set(0, 0.04, -0.04);
				const upper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.16), std(NIGHT, 0.5, 0.28));
				upper.position.set(0, 0.07, -0.02);
				wear(boneName, sole);
				wear(boneName, upper);
			};
			shoe("LeftFoot");
			shoe("RightFoot");
		} else if (slot === "gloves") {
			const wrap = new THREE.Mesh(new THREE.BoxGeometry(.07, .05, .08), std(NIGHT, .55, .25));
			wrap.position.set(0, .04, .02);
			g.add(wrap);
			const other = wrap.clone();
			g.userData.extra = other;
			model.getObjectByName("LeftHand")?.add(other);
		} else {
			const p = new THREE.Mesh(new THREE.SphereGeometry(.02, 8, 8), std(GOLD, .3, .7));
			p.position.set(.08, .08, .06);
			g.add(p);
		}
		return g;
	};
	Object.keys(equipped).forEach((slot) => {
		if (slot === "helmet") {
			if (store.helmet) store.helmet.visible = false;
			return;
		}
		const on = Boolean(equipped[slot]);
		const sig = on ? `${equipped[slot].id}:${equipped[slot].plus || 0}` : "";
		if (on && store[slot] && store[slot].userData.sig && store[slot].userData.sig !== sig) dropPiece(slot);
		const wearable = slot === "weapon" || slot === "armor" || slot === "boots";
		if (on && !store[slot] && !(model.userData.classMesh && !wearable)) {
			const piece = make(slot);
			if (!piece) return;
			piece.userData.sig = sig;
			store[slot] = piece;
			parentOf(slot)?.add(piece);
		}
		const piece = store[slot];
		if (piece) {
			let show = on && !(slot === "weapon" && style === "fist");
			if (slot === "boots" && equipped.armor) show = false;
			piece.visible = show;
			const parts = piece.userData.parts;
			if (parts) for (const part of parts) part.visible = show;
			const extra = piece.userData.extra;
			if (extra) extra.visible = show;
			if (show && on) {
				paintPlus(piece, equipped[slot].plus || 0);
				if (parts) for (const part of parts) paintPlus(part, equipped[slot].plus || 0);
			}
		}
	});
	if (store.offhand) store.offhand.visible = style === "dagger" && Boolean(equipped.weapon);
	const hide = new Set();
	if (equipped.armor) {
		hide.add("torso");
		hide.add("thigh");
		hide.add("shin");
		hide.add("foot");
	} else if (equipped.boots) hide.add("foot");
	model.traverse((obj) => {
		const slot = obj.userData && obj.userData.cover;
		if (!slot) return;
		obj.visible = !hide.has(slot);
	});
}
var _pin = new THREE.Vector3();
var _face = new THREE.Vector3();
export function stickGear(model) {
	const gear = model.userData.gear;
	if (!gear) return;
	const boots = gear.boots;
	if (boots?.visible && !boots.userData.fitted) {
		const L = boots.userData.L;
		const R = boots.userData.R;
		if (L && R) {
			const place = (mesh, boneName) => {
				const bone = model.getObjectByName(boneName);
				if (!bone) return;
				bone.getWorldPosition(_pin);
				model.getWorldDirection(_face);
				_pin.addScaledVector(_face, .07);
				_pin.y = .02;
				model.worldToLocal(_pin);
				mesh.position.copy(_pin);
				mesh.quaternion.identity();
			};
			place(L, "LeftFoot");
			place(R, "RightFoot");
		}
	}
	const armor = gear.armor;
	const pantsL = armor?.userData.pantsL;
	const pantsR = armor?.userData.pantsR;
	if (armor?.visible && pantsL && pantsR) {
		const pinLeg = (mesh, boneName, side) => {
			const bone = model.getObjectByName(boneName);
			if (!bone) return;
			if (mesh.parent !== model) model.add(mesh);
			bone.getWorldPosition(_pin);
			_pin.y -= .16;
			model.worldToLocal(_pin);
			mesh.position.copy(_pin);
			mesh.quaternion.identity();
			mesh.position.x += side * .02;
		};
		pinLeg(pantsL, "LeftUpLeg", -1);
		pinLeg(pantsR, "RightUpLeg", 1);
	}
}
export type Dummy = ReturnType<typeof adoptDummy>;
export type Vendor = ReturnType<typeof createVendor>;
export type Mentor = ReturnType<typeof createMentor>;
export type Beast = ReturnType<typeof createBeast>;
