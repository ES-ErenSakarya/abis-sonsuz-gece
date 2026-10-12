// @ts-nocheck
import * as THREE from "three";
import { trackProp } from "@/game/creative";
import { studioClimate } from "@/game/studio";
import { CHIMNEYS, DUNGEON_BOUND, FENCE_GATE, FENCE_R, FISHER_HUT, FISHER_YAW, HOUSES, LAKE, PIER, TREES, VEINS, VILLAGE_BOUND, addBlockCircle, groundY } from "@/game/world";

export type SmokePuff = { sprite: THREE.Sprite; base: number; life: number; speed: number };

var bin = [];
function keep(item) {
	bin.push(item);
	return item;
}
export function disposeScenery() {
	while (bin.length) bin.pop()?.dispose();
}
function repeatTex(base, rx, ry) {
	const tex = base.clone();
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(rx, ry);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 2;
	tex.needsUpdate = true;
	keep(tex);
	return tex;
}
function mat(tex, _rough = .92) {
	return keep(new THREE.MeshLambertMaterial({
		map: tex
	}));
}
function roofGeometry(w, d, rh) {
	const hw = w / 2 + .42;
	const hd = d / 2 + .38;
	const verts = [
		[
			-hw,
			0,
			-hd
		],
		[
			-hw,
			0,
			hd
		],
		[
			0,
			rh,
			hd
		],
		[
			-hw,
			0,
			-hd
		],
		[
			0,
			rh,
			hd
		],
		[
			0,
			rh,
			-hd
		],
		[
			hw,
			0,
			hd
		],
		[
			hw,
			0,
			-hd
		],
		[
			0,
			rh,
			-hd
		],
		[
			hw,
			0,
			hd
		],
		[
			0,
			rh,
			-hd
		],
		[
			0,
			rh,
			hd
		],
		[
			-hw,
			0,
			-hd
		],
		[
			0,
			rh,
			-hd
		],
		[
			hw,
			0,
			-hd
		],
		[
			hw,
			0,
			hd
		],
		[
			0,
			rh,
			hd
		],
		[
			-hw,
			0,
			hd
		]
	];
	const pos = new Float32Array(verts.length * 3);
	const uv = new Float32Array(verts.length * 2);
	for (let i = 0; i < verts.length; i++) {
		const v = verts[i];
		pos[i * 3] = v[0];
		pos[i * 3 + 1] = v[1];
		pos[i * 3 + 2] = v[2];
		uv[i * 2] = (v[0] + hw) / (hw * 2);
		uv[i * 2 + 1] = (v[2] + hd) / (hd * 2);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
	geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
	geo.computeVertexNormals();
	return keep(geo);
}
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(src));
		img.src = src;
	});
}
export async function composeGround() {
	const [grass] = await Promise.all([loadImage("/textures/grass.jpg")]);
	const S = 1024;
	const canvas = document.createElement("canvas");
	canvas.width = S;
	canvas.height = S;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas");
	const ppm = S / 110;
	const tile = Math.round(3.1 * ppm);
	for (let y = 0; y < S; y += tile) for (let x = 0; x < S; x += tile) ctx.drawImage(grass, x, y, 59, 59);
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 2;
	tex.needsUpdate = true;
	return keep(tex);
}
function smokeTexture() {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const g = canvas.getContext("2d");
	if (!g) return keep(new THREE.CanvasTexture(canvas));
	const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
	grd.addColorStop(0, "rgba(206,206,204,0.45)");
	grd.addColorStop(1, "rgba(206,206,204,0)");
	g.fillStyle = grd;
	g.fillRect(0, 0, 64, 64);
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	return keep(tex);
}
export function buildVillage(textures) {
	const root = new THREE.Group();
	for (const tex of [
		textures.stone,
		textures.wood,
		textures.thatch,
		textures.ground
	]) {
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 2;
	}
	textures.stone.wrapS = textures.stone.wrapT = THREE.RepeatWrapping;
	textures.wood.wrapS = textures.wood.wrapT = THREE.RepeatWrapping;
	textures.thatch.wrapS = textures.thatch.wrapT = THREE.RepeatWrapping;
	textures.ground.wrapS = textures.ground.wrapT = THREE.RepeatWrapping;
	textures.ground.repeat.set(8, 8);
	const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(2400, 2400)), keep(new THREE.MeshLambertMaterial({
		map: textures.ground
	})));
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -.02;
	ground.receiveShadow = true;
	ground.name = "season-ground";
	root.add(ground);
	const snowCanvas = document.createElement("canvas");
	snowCanvas.width = 128;
	snowCanvas.height = 128;
	const snowTex = keep(new THREE.CanvasTexture(snowCanvas));
	const blanket = new THREE.Mesh(keep(new THREE.PlaneGeometry(2400, 2400)), keep(new THREE.MeshLambertMaterial({
		color: "#f7fbff",
		transparent: true,
		opacity: 0.9,
		alphaMap: snowTex,
		depthWrite: false
	})));
	blanket.rotation.x = -Math.PI / 2;
	blanket.position.y = 0.03;
	blanket.name = "snow-blanket";
	blanket.visible = false;
	blanket.userData.canvas = snowCanvas;
	blanket.userData.tex = snowTex;
	blanket.receiveShadow = true;
	root.add(blanket);
	const stoneMat = (rx, ry) => mat(repeatTex(textures.stone, rx, ry), .9);
	const woodMat = (rx, ry) => mat(repeatTex(textures.wood, rx, ry), .78);
	const thatchMat = (rx, ry) => mat(repeatTex(textures.thatch, rx, ry), .95);
	function ringWall(cx, cz, radius, height, thick, segments, color) {
		const arc = (Math.PI * 2) / segments;
		const span = radius * arc * 1.14 + 0.55;
		const yawOf = (a) => Math.PI / 2 - a;
		const stone = keep(new THREE.BoxGeometry(1, 1, 1));
		const bodyMat = keep(new THREE.MeshLambertMaterial({ map: repeatTex(textures.stone, 2.2, 1.4), color }));
		const footMat = keep(new THREE.MeshLambertMaterial({ map: repeatTex(textures.stone, 1.4, 0.5), color: "#5a534b" }));
		const crenMat = keep(new THREE.MeshLambertMaterial({ map: repeatTex(textures.stone, 0.7, 0.8), color }));
		const body = new THREE.InstancedMesh(stone, bodyMat, segments);
		const foot = new THREE.InstancedMesh(stone, footMat, segments);
		const merlon = new THREE.InstancedMesh(stone, crenMat, segments * 2);
		body.castShadow = true;
		body.receiveShadow = true;
		foot.castShadow = true;
		foot.receiveShadow = true;
		merlon.castShadow = true;
		const dummy = new THREE.Object3D();
		const footH = 0.7;
		const bodyH = Math.max(2.2, height - footH);
		let cren = 0;
		for (let i = 0; i < segments; i++) {
			const a = i * arc;
			const px = cx + Math.cos(a) * radius;
			const pz = cz + Math.sin(a) * radius;
			const yaw = yawOf(a);
			dummy.position.set(px, footH / 2, pz);
			dummy.rotation.set(0, yaw, 0);
			dummy.scale.set(span, footH, thick * 1.55);
			dummy.updateMatrix();
			foot.setMatrixAt(i, dummy.matrix);
			dummy.position.set(px, footH + bodyH / 2, pz);
			dummy.rotation.set(0, yaw, 0);
			dummy.scale.set(span, bodyH, thick);
			dummy.updateMatrix();
			body.setMatrixAt(i, dummy.matrix);
			const tx = -Math.sin(a);
			const tz = Math.cos(a);
			for (const side of [-0.28, 0.28]) {
				dummy.position.set(px + tx * span * side, height + 0.42, pz + tz * span * side);
				dummy.rotation.set(0, yaw, 0);
				dummy.scale.set(span * 0.34, 0.84, thick * 0.92);
				dummy.updateMatrix();
				merlon.setMatrixAt(cren, dummy.matrix);
				cren += 1;
			}
		}
		body.instanceMatrix.needsUpdate = true;
		foot.instanceMatrix.needsUpdate = true;
		merlon.instanceMatrix.needsUpdate = true;
		const group = new THREE.Group();
		group.add(foot, body, merlon);
		return group;
	}
	const dark = keep(new THREE.MeshStandardMaterial({
		color: "#1a1613",
		roughness: .9
	}));
	const glow = keep(new THREE.MeshStandardMaterial({
		color: "#ffb27a",
		emissive: "#ff9a4a",
		emissiveIntensity: .7,
		roughness: .6
	}));
	for (const h of HOUSES) {
		const g = new THREE.Group();
		g.position.set(h.x, groundY(h.x, h.z), h.z);
		g.rotation.y = h.yaw;
		const walls = new THREE.Mesh(keep(new THREE.BoxGeometry(h.w, h.h, h.d)), stoneMat(h.w / 2.4, h.h / 1.8));
		walls.position.y = h.h / 2;
		walls.castShadow = true;
		walls.receiveShadow = true;
		g.add(walls);
		const roof = new THREE.Mesh(roofGeometry(h.w, h.d, h.rh), thatchMat(h.w / 2.2, 1.4));
		roof.position.y = h.h;
		roof.castShadow = true;
		roof.receiveShadow = true;
		roof.name = "season-roof";
		const cap = new THREE.Mesh(roofGeometry(h.w * 0.98, h.d * 0.98, h.rh * 0.72), keep(new THREE.MeshLambertMaterial({ color: "#f7fbff" })));
		cap.position.y = h.rh * 0.28;
		cap.scale.set(1, 1.15, 1);
		cap.name = "snow-cap";
		cap.visible = false;
		roof.add(cap);
		g.add(roof);
		const chimney = new THREE.Mesh(keep(new THREE.BoxGeometry(.55, 1.15, .55)), stoneMat(1, 2));
		chimney.position.set(h.w * .22, h.h + h.rh * .35, 0);
		chimney.castShadow = true;
		g.add(chimney);
		const doorW = Math.min(1.15, h.w * .28);
		const doorH = Math.min(2.05, h.h * .72);
		const door = new THREE.Mesh(keep(new THREE.BoxGeometry(doorW, doorH, .08)), woodMat(1, 2));
		door.castShadow = true;
		const winMat = glow;
		const win = new THREE.Mesh(keep(new THREE.BoxGeometry(.42, .5, .06)), winMat);
		const place = (obj, face, y, along) => {
			if (face === "pz") obj.position.set(along, y, h.d / 2 + .03);
			if (face === "nz") obj.position.set(along, y, -h.d / 2 - .03);
			if (face === "px") obj.position.set(h.w / 2 + .03, y, along);
			if (face === "nx") obj.position.set(-h.w / 2 - .03, y, along);
		};
		place(door, h.door, doorH / 2, 0);
		if (h.door === "px" || h.door === "nx") door.rotation.y = Math.PI / 2;
		g.add(door);
		const w1 = win.clone();
		const w2 = win.clone();
		place(w1, h.door, h.h * .62, doorW * .95);
		place(w2, h.door, h.h * .62, -doorW * .95);
		if (h.door === "px" || h.door === "nx") {
			w1.rotation.y = Math.PI / 2;
			w2.rotation.y = Math.PI / 2;
		}
		g.add(w1, w2);
		if (h.id === "forge") {
			const mouth = new THREE.Mesh(keep(new THREE.BoxGeometry(1.3, .7, .12)), dark);
			place(mouth, h.door, .7, 1.35);
			if (h.door === "px" || h.door === "nx") mouth.rotation.y = Math.PI / 2;
			const coal = new THREE.Mesh(keep(new THREE.BoxGeometry(.7, .12, .45)), keep(new THREE.MeshStandardMaterial({
				color: "#ff6a2a",
				emissive: "#ff4d12",
				emissiveIntensity: 1.4,
				roughness: .5
			})));
			coal.position.set(-.2, .45, -h.d / 2 - .7);
			const anvil = new THREE.Mesh(keep(new THREE.BoxGeometry(.45, .22, .22)), keep(new THREE.MeshStandardMaterial({
				color: "#2c3033",
				metalness: .8,
				roughness: .35
			})));
			anvil.position.set(1.55, .72, h.d / 2 + 1.15);
			anvil.castShadow = true;
			const stump = new THREE.Mesh(keep(new THREE.CylinderGeometry(.22, .26, .62, 10)), woodMat(1, 1));
			stump.position.set(1.55, .31, h.d / 2 + 1.15);
			stump.castShadow = true;
			g.add(mouth, coal, anvil, stump);
		}
		const houseName = { hall: "Salon", west: "Batı ev", east: "Doğu ev", forge: "Demirhane", barn: "Ahır", depot: "Depo binası" }[h.id] || h.id;
		trackProp({
			id: `house-${h.id}`,
			label: houseName,
			kind: "bina",
			object: g,
			base: { x: h.x, y: 0, z: h.z, yaw: h.yaw },
			houseId: h.id,
		});
		root.add(g);
	}
	const hutWood = woodMat(1, 1);
	const hut = new THREE.Group();
	hut.position.set(FISHER_HUT.x, groundY(FISHER_HUT.x, FISHER_HUT.z), FISHER_HUT.z);
	hut.rotation.y = FISHER_YAW;
	const hutWall = (w, h, d, x, y, z) => {
		const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), hutWood);
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		hut.add(mesh);
	};
	hutWall(4.5, 0.16, 3.6, 0, 0.08, 0);
	hutWall(0.16, 2.2, 3.6, -2.15, 1.22, 0);
	hutWall(0.16, 2.2, 3.6, 2.15, 1.22, 0);
	hutWall(4.5, 2.2, 0.16, 0, 1.22, -1.7);
	hutWall(1.35, 2.2, 0.16, -1.5, 1.22, 1.7);
	hutWall(1.35, 2.2, 0.16, 1.5, 1.22, 1.7);
	const hutRoof = new THREE.Mesh(roofGeometry(4.1, 3.2, 1.05), thatchMat(2, 1));
	hutRoof.position.y = 2.25;
	hutRoof.castShadow = true;
	hut.add(hutRoof);
	const lamp = new THREE.Mesh(keep(new THREE.BoxGeometry(0.16, 0.22, 0.16)), keep(new THREE.MeshStandardMaterial({
		color: "#ffb15a",
		emissive: "#ff8a2a",
		emissiveIntensity: 0.8
	})));
	lamp.position.set(0.7, 1.7, 1.85);
	hut.add(lamp);
	const barrel = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.28, 0.32, 0.55, 8)), hutWood);
	barrel.position.set(-1.85, 0.4, 2.15);
	barrel.castShadow = true;
	hut.add(barrel);
	const rack = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 0.06, 0.06)), hutWood);
	rack.position.set(1.7, 1.35, 2.25);
	hut.add(rack);
	const fishMat = keep(new THREE.MeshLambertMaterial({ color: "#8a93a0" }));
	for (const x of [-0.4, 0, 0.4]) {
		const fish = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.05, 0.22, 3, 5)), fishMat);
		fish.position.set(1.7 + x, 1.05, 2.25);
		fish.rotation.z = 0.4;
		hut.add(fish);
	}
	trackProp({
		id: "fisher-hut",
		label: "Balıkçı kulübesi",
		kind: "bina",
		object: hut,
		base: { x: FISHER_HUT.x, y: 0, z: FISHER_HUT.z, yaw: FISHER_YAW },
		hut: true,
	});
	root.add(hut);
	const plank = keep(new THREE.BoxGeometry(1, 1, 1));
	const plankMat = woodMat(2, 1);
	const pierLen = Math.hypot(PIER.x1 - PIER.x0, PIER.z1 - PIER.z0);
	const pier = new THREE.Group();
	pier.position.set((PIER.x0 + PIER.x1) / 2, 0, (PIER.z0 + PIER.z1) / 2);
	pier.rotation.y = FISHER_YAW;
	const pierDeck = new THREE.Mesh(plank, plankMat);
	pierDeck.scale.set(PIER.half * 2, 0.2, pierLen);
	pierDeck.position.y = 0.38;
	pierDeck.castShadow = true;
	pierDeck.receiveShadow = true;
	pier.add(pierDeck);
	for (let i = 0; i < 5; i++) {
		const z = -pierLen / 2 + (i + 0.5) * (pierLen / 5);
		for (const x of [-PIER.half + 0.08, PIER.half - 0.08]) {
			const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 6)), hutWood);
			post.position.set(x, 0.05, z);
			post.castShadow = true;
			pier.add(post);
		}
	}
	for (const x of [-PIER.half, PIER.half]) {
		const rail = new THREE.Mesh(plank, woodMat(1, 1));
		rail.scale.set(0.08, 0.22, pierLen - 0.4);
		rail.position.set(x, 0.78, 0);
		pier.add(rail);
	}
	const boat = new THREE.Group();
	boat.position.set(PIER.half + 0.85, 0.18, pierLen * 0.28);
	const hull = new THREE.Mesh(keep(new THREE.BoxGeometry(0.62, 0.2, 1.7)), hutWood);
	hull.castShadow = true;
	const bow = new THREE.Mesh(keep(new THREE.ConeGeometry(0.32, 0.45, 4)), hutWood);
	bow.rotation.x = Math.PI / 2;
	bow.position.z = 0.95;
	boat.add(hull, bow);
	pier.add(boat);
	trackProp({
		id: "pier",
		label: "İskele",
		kind: "bina",
		object: pier,
		base: { x: (PIER.x0 + PIER.x1) / 2, y: 0, z: (PIER.z0 + PIER.z1) / 2, yaw: FISHER_YAW },
		pier: { len: pierLen, half: PIER.half },
	});
	root.add(pier);
	const trunkGeo = keep(new THREE.CylinderGeometry(.18, .28, 1, 8));
	const trunkMat = woodMat(1, 2);
	const leafGeo = keep(new THREE.IcosahedronGeometry(1, 0));
	const leafColors = new Float32Array(leafGeo.attributes.position.count * 3);
	for (let i = 0; i < leafGeo.attributes.position.count; i++) {
		const n = Math.sin(i * 12.989) * 43758.5453 % 1;
		const f = n < 0 ? n + 1 : n;
		leafColors[i * 3] = .18 + f * .08;
		leafColors[i * 3 + 1] = .28 + f * .1;
		leafColors[i * 3 + 2] = .12 + f * .04;
	}
	leafGeo.setAttribute("color", new THREE.BufferAttribute(leafColors, 3));
	const leafMat = keep(new THREE.MeshLambertMaterial({
		vertexColors: true
	}));
	const ringTrees = TREES.slice();
	const treeRing = new THREE.Group();
	const lakeReach = Math.hypot(LAKE.x, LAKE.z) || 1;
	const fisherX = LAKE.x * (1 + 8.2 / lakeReach);
	const fisherZ = LAKE.z * (1 + 8.2 / lakeReach);
	const pierMidX = (PIER.x0 + PIER.x1) / 2;
	const pierMidZ = (PIER.z0 + PIER.z1) / 2;
	const byFisherWater = (x, z) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 9 || Math.hypot(x - fisherX, z - fisherZ) < 13 || Math.hypot(x - pierMidX, z - pierMidZ) < 9;
	for (let i = 0; i < 84; i++) {
		const a = (i / 84) * Math.PI * 2;
		const r = 52 + (i % 3) * 4.4;
		const x = Math.cos(a) * r;
		const z = Math.sin(a) * r;
		if (Math.min(Math.abs(x), Math.abs(z)) < 4.2) continue;
		if (byFisherWater(x, z)) continue;
		ringTrees.push({ x, z, s: 0.92 + (i % 5) * 0.06, seed: 40 + i });
	}
	const namedTrees = [];
	const ringList = [];
	for (const t of ringTrees) {
		if (byFisherWater(t.x, t.z)) continue;
		if (t.seed >= 40) ringList.push(t);
		else namedTrees.push(t);
	}
	const treeDummy = new THREE.Object3D();
	if (ringList.length) {
		const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, ringList.length);
		const clumps = [0, 1, 2, 3].map(() => new THREE.InstancedMesh(leafGeo, leafMat, ringList.length));
		for (let i = 0; i < ringList.length; i++) {
			const t = ringList[i];
			const y = groundY(t.x, t.z);
			treeDummy.position.set(t.x, y + 1.15 * t.s, t.z);
			treeDummy.rotation.set(0, t.seed * 0.17, 0);
			treeDummy.scale.set(t.s, 2.3 * t.s, t.s);
			treeDummy.updateMatrix();
			trunks.setMatrixAt(i, treeDummy.matrix);
			for (let c = 0; c < 4; c++) {
				const a = (c / 4) * Math.PI * 2 + t.seed;
				treeDummy.position.set(
					t.x + Math.cos(a) * 0.35 * t.s,
					y + (2.5 + (c % 2) * 0.45) * t.s,
					t.z + Math.sin(a) * 0.35 * t.s,
				);
				treeDummy.rotation.set(0, a, 0);
				treeDummy.scale.setScalar((1.15 + (c % 3) * 0.18) * t.s);
				treeDummy.updateMatrix();
				clumps[c].setMatrixAt(i, treeDummy.matrix);
			}
			addBlockCircle(t.x, t.z, 0.38 * t.s);
		}
		trunks.instanceMatrix.needsUpdate = true;
		for (const clump of clumps) clump.instanceMatrix.needsUpdate = true;
		treeRing.add(trunks, ...clumps);
	}
	for (const t of namedTrees) {
		const tree = new THREE.Group();
		tree.position.set(t.x, groundY(t.x, t.z), t.z);
		const trunk = new THREE.Mesh(trunkGeo, trunkMat);
		trunk.position.y = 1.15 * t.s;
		trunk.scale.set(t.s, 2.3 * t.s, t.s);
		trunk.castShadow = true;
		tree.add(trunk);
		for (let i = 0; i < 4; i++) {
			const leaf = new THREE.Mesh(leafGeo, leafMat);
			const a = (i / 4) * Math.PI * 2;
			leaf.position.set(Math.cos(a) * 0.35 * t.s, (2.5 + (i % 2) * 0.45) * t.s, Math.sin(a) * 0.35 * t.s);
			leaf.scale.setScalar((1.15 + (i % 3) * 0.18) * t.s);
			leaf.castShadow = false;
			tree.add(leaf);
		}
		const snowTop = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.85, 0)), keep(new THREE.MeshLambertMaterial({ color: "#f4f8fc" })));
		snowTop.position.y = 3.15 * t.s;
		snowTop.scale.setScalar(1.65 * t.s);
		snowTop.name = "snow-cap";
		snowTop.visible = false;
		tree.add(snowTop);
		trackProp({
			id: `tree-${t.seed}`,
			label: `Ağaç ${t.seed}`,
			kind: "ağaç",
			object: tree,
			base: { x: t.x, y: 0, z: t.z, yaw: 0 },
			treeIndex: TREES.findIndex((row) => row.seed === t.seed),
		});
		root.add(tree);
	}
	trackProp({ id: "tree-ring", label: "Köy ağaç halkası", kind: "ağaç", object: treeRing, base: { x: 0, y: 0, z: 0, yaw: 0 } });
	root.add(treeRing);
	const well = new THREE.Group();
	const outer = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.08, 1.18, 1.02, 28, 1, true)), stoneMat(3, 1));
	outer.position.y = 0.51;
	outer.castShadow = true;
	outer.receiveShadow = true;
	const innerMat = stoneMat(2.2, 1);
	innerMat.side = THREE.BackSide;
	const inner = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.84, 0.92, 0.98, 28, 1, true)), innerMat);
	inner.position.y = 0.52;
	const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(0.92, 28)), stoneMat(1.2, 1));
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = 0.08;
	const water = new THREE.Mesh(keep(new THREE.CircleGeometry(0.78, 32)), keep(new THREE.ShaderMaterial({
		uniforms: { uTime: { value: 0 } },
		vertexShader: `
			uniform float uTime;
			varying vec2 vUv;
			void main() {
				vUv = uv;
				vec3 p = position;
				p.z += sin(p.x * 6.0 + uTime * 2.2) * 0.035 + cos(p.y * 7.0 - uTime * 1.6) * 0.025;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
			}
		`,
		fragmentShader: `
			uniform float uTime;
			varying vec2 vUv;
			void main() {
				float ripple = sin(vUv.x * 40.0 + uTime * 2.4) * 0.5 + 0.5;
				float cross = cos(vUv.y * 28.0 - uTime * 1.7) * 0.5 + 0.5;
				vec3 deep = vec3(0.04, 0.16, 0.18);
				vec3 shine = vec3(0.45, 0.72, 0.74);
				gl_FragColor = vec4(mix(deep, shine, ripple * 0.45 + cross * 0.2), 1.0);
			}
		`
	})));
	water.name = "well-water";
	water.rotation.x = -Math.PI / 2;
	water.position.y = 0.28;
	const lip = new THREE.Mesh(keep(new THREE.TorusGeometry(1.02, 0.09, 10, 28)), stoneMat(2, 1));
	lip.rotation.x = Math.PI / 2;
	lip.position.y = 1.02;
	const postGeo = keep(new THREE.CylinderGeometry(.08, .09, 1.85, 10));
	const postMat = woodMat(1, 2);
	const postL = new THREE.Mesh(postGeo, postMat);
	postL.position.set(-.78, 1.7, 0);
	const postR = postL.clone();
	postR.position.x = .78;
	const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(.065, .065, 1.75, 8)), postMat);
	beam.rotation.z = Math.PI / 2;
	beam.position.y = 2.55;
	const littleRoof = new THREE.Mesh(roofGeometry(2.05, 1.15, .5), thatchMat(1.2, 1));
	littleRoof.position.y = 2.42;
	postL.castShadow = postR.castShadow = beam.castShadow = true;
	well.add(outer, inner, floor, water, lip, postL, postR, beam, littleRoof);
	trackProp({ id: "well", label: "Kuyu", kind: "bina", object: well, base: { x: 0, y: 0, z: 0, yaw: 0 }, well: true });
	root.add(well);
	const ORE_COLOR = ["#3c4148", "#b87333", "#d9dde3", "#d4af37"];
	VEINS.forEach((vein, index) => {
		const oreMat = keep(new THREE.MeshStandardMaterial({
			color: ORE_COLOR[index % 4],
			roughness: index % 4 === 3 ? 0.32 : 0.48,
			metalness: 0.62,
			emissive: ORE_COLOR[index % 4],
			emissiveIntensity: index % 4 === 0 ? 0.04 : 0.12,
		}));
		const rock = new THREE.Mesh(keep(new THREE.DodecahedronGeometry(0.55, 0)), oreMat);
		rock.name = `vein-rock-${index}`;
		const gy = groundY(vein.x, vein.z);
		rock.position.set(vein.x, gy + 0.28, vein.z);
		rock.castShadow = true;
		trackProp({
			id: `vein-${index}`,
			label: `Maden ${index + 1}`,
			kind: "maden",
			object: rock,
			base: { x: vein.x, y: 0.35, z: vein.z, yaw: 0 },
			veinIndex: index,
		});
		root.add(rock);
	});
	const plazaMat = keep(new THREE.MeshStandardMaterial({
		map: repeatTex(textures.stone, 2.4, 2.4),
		roughness: 0.78,
		metalness: 0.04,
		color: "#d9d3c8"
	}));
	const plaza = new THREE.Group();
	const plazaDisc = new THREE.Mesh(keep(new THREE.CircleGeometry(16.5, 96)), plazaMat);
	plazaDisc.rotation.x = -Math.PI / 2;
	plazaDisc.position.y = 0.018;
	plazaDisc.receiveShadow = true;
	const curb = new THREE.Mesh(keep(new THREE.RingGeometry(16.15, 16.62, 96)), stoneMat(3, 0.4));
	curb.rotation.x = -Math.PI / 2;
	curb.position.y = 0.028;
	plaza.add(plazaDisc, curb);
	trackProp({ id: "plaza", label: "Köy meydanı", kind: "zemin", object: plaza, base: { x: 0, y: 0, z: 0, yaw: 0 } });
	root.add(plaza);
	const pathMat = plazaMat;
	const pathY = 0.03;
	const pathLen = 64;
	const pathW = 4.4;
	const paths = new THREE.Group();
	for (const sign of [1, -1]) {
		const ns = new THREE.Mesh(keep(new THREE.BoxGeometry(pathW, 0.05, pathLen)), pathMat);
		ns.position.set(0, pathY, sign * (16.4 + pathLen / 2));
		ns.receiveShadow = true;
		const ew = new THREE.Mesh(keep(new THREE.BoxGeometry(pathLen, 0.05, pathW)), pathMat);
		ew.position.set(sign * (16.4 + pathLen / 2), pathY, 0);
		ew.receiveShadow = true;
		paths.add(ns, ew);
	}
	trackProp({ id: "paths", label: "Taş patikalar", kind: "zemin", object: paths, base: { x: 0, y: 0, z: 0, yaw: 0 } });
	root.add(paths);
	const outpost = (id, label, ox, oz, tint, realmId) => {
		const host = new THREE.Group();
		const floorMat = keep(new THREE.MeshLambertMaterial({ map: repeatTex(textures.stone, 5, 5), color: tint }));
		const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(DUNGEON_BOUND - 0.2, 72)), floorMat);
		floor.rotation.x = -Math.PI / 2;
		floor.position.set(ox, 0.04, oz);
		floor.receiveShadow = true;
		const pad = new THREE.Mesh(keep(new THREE.CircleGeometry(6.2, 28)), pathMat);
		pad.rotation.x = -Math.PI / 2;
		pad.position.set(ox, 0.06, oz);
		pad.receiveShadow = true;
		const wall = ringWall(ox, oz, DUNGEON_BOUND, 7.4, 1.55, 96, "#4e4942");
		host.add(floor, pad, wall);
		const columnGeo = keep(new THREE.CylinderGeometry(0.42, 0.5, 4.4, 8));
		const columnMat = stoneMat(1, 2);
		for (const radius of [22, 58, 104]) {
			for (let i = 0; i < 8; i++) {
				const a = (i / 8) * Math.PI * 2 + radius * 0.01;
				const col = new THREE.Mesh(columnGeo, columnMat);
				col.position.set(ox + Math.cos(a) * radius, 2.2, oz + Math.sin(a) * radius);
				col.castShadow = true;
				host.add(col);
			}
		}
		const bowlGeo = keep(new THREE.CylinderGeometry(0.34, 0.26, 0.24, 8));
		const bowlMat = keep(new THREE.MeshLambertMaterial({ color: "#2c2824" }));
		const fireMat = keep(new THREE.MeshBasicMaterial({ color: "#ff7a2a" }));
		const fireGeo = keep(new THREE.SphereGeometry(0.2, 8, 6));
		for (const radius of [14, 40, 82]) {
			for (let i = 0; i < 6; i++) {
				const a = (i / 6) * Math.PI * 2 + 0.3;
				const bx = ox + Math.cos(a) * radius;
				const bz = oz + Math.sin(a) * radius;
				const bowl = new THREE.Mesh(bowlGeo, bowlMat);
				bowl.position.set(bx, 0.55, bz);
				const fire = new THREE.Mesh(fireGeo, fireMat);
				fire.position.set(bx, 0.82, bz);
				host.add(bowl, fire);
			}
		}
		trackProp({ id, label, kind: "harita", object: host, base: { x: 0, y: 0, z: 0, yaw: 0 }, realmId, realmAt: { x: ox, z: oz } });
		root.add(host);
	};
	outpost("out-koy2", "İkinci Köy alanı", 0, 420, "#6a7a4a", "koy2");
	outpost("out-dolunay", "Dolunay alanı", 420, 0, "#3d4e68", "dolunay");
	outpost("out-ay", "Sonsuz Ay alanı", -420, 0, "#2a2438", "ay");
	const lake = new THREE.Mesh(
		keep(new THREE.CircleGeometry(LAKE.r, 40)),
		keep(new THREE.MeshStandardMaterial({ color: "#1a6e78", roughness: 0.22, metalness: 0.35, transparent: true, opacity: 0.92 })),
	);
	lake.rotation.x = -Math.PI / 2;
	lake.position.set(LAKE.x, 0.05, LAKE.z);
	lake.name = "fisher-lake";
	trackProp({ id: "lake", label: "Balıkçı gölü", kind: "bina", object: lake, base: { x: LAKE.x, y: 0.05, z: LAKE.z, yaw: 0 }, lake: true });
	root.add(lake);
	const fence = new THREE.Group();
	fence.name = "village-fence";
	const pine = document.createElement("canvas");
	pine.width = 64;
	pine.height = 256;
	const pg = pine.getContext("2d");
	if (pg) {
		pg.fillStyle = "#c88845";
		pg.fillRect(0, 0, 64, 256);
		for (let i = 0; i < 36; i++) {
			const x = (i * 19) % 64;
			pg.strokeStyle = i % 3 === 0 ? "rgba(92,44,16,0.22)" : "rgba(255,214,150,0.16)";
			pg.lineWidth = 1;
			pg.beginPath();
			pg.moveTo(x, 0);
			pg.lineTo(x + Math.sin(i * 1.7) * 2.4, 256);
			pg.stroke();
		}
		pg.fillStyle = "rgba(120,62,24,0.28)";
		pg.beginPath();
		pg.ellipse(30, 78, 5, 7, 0.3, 0, Math.PI * 2);
		pg.fill();
		pg.beginPath();
		pg.ellipse(18, 190, 3.5, 5, -0.2, 0, Math.PI * 2);
		pg.fill();
	}
	const pineTex = keep(new THREE.CanvasTexture(pine));
	pineTex.colorSpace = THREE.SRGBColorSpace;
	pineTex.wrapS = pineTex.wrapT = THREE.RepeatWrapping;
	pineTex.anisotropy = 4;
	const fenceMat = keep(new THREE.MeshStandardMaterial({
		map: pineTex,
		color: "#e2a15c",
		roughness: 0.74,
		metalness: 0.02,
	}));
	const picketShape = new THREE.Shape();
	picketShape.moveTo(-0.065, 0);
	picketShape.lineTo(0.065, 0);
	picketShape.lineTo(0.065, 1.02);
	picketShape.lineTo(0, 1.24);
	picketShape.lineTo(-0.065, 1.02);
	picketShape.closePath();
	const picketGeo = keep(new THREE.ExtrudeGeometry(picketShape, {
		depth: 0.046,
		bevelEnabled: true,
		bevelThickness: 0.004,
		bevelSize: 0.003,
		bevelSegments: 1,
		curveSegments: 1,
	}));
	picketGeo.translate(0, 0, -0.023);
	const boards = 200;
	const arc = (Math.PI * 2) / boards;
	const picks = [];
	for (let i = 0; i < boards; i++) {
		const a = i * arc;
		const x = Math.cos(a) * FENCE_R;
		const z = Math.sin(a) * FENCE_R;
		if (Math.min(Math.abs(x), Math.abs(z)) < FENCE_GATE) continue;
		picks.push({ a, x, z });
	}
	const pairs = [];
	for (let i = 0; i < picks.length; i++) {
		const p = picks[i];
		const q = picks[(i + 1) % picks.length];
		let d = Math.abs(p.a - q.a);
		if (d > Math.PI) d = Math.PI * 2 - d;
		if (d < arc * 1.6) pairs.push([p, q]);
	}
	const pickets = new THREE.InstancedMesh(picketGeo, fenceMat, picks.length);
	const railGeo = keep(new THREE.BoxGeometry(1, 0.07, 0.04));
	const rails = new THREE.InstancedMesh(railGeo, fenceMat, pairs.length * 2);
	const fillGeo = keep(new THREE.BoxGeometry(1, 1, 1));
	const fills = new THREE.InstancedMesh(fillGeo, fenceMat, pairs.length);
	const fenceDummy = new THREE.Object3D();
	const fenceColor = new THREE.Color();
	for (let i = 0; i < picks.length; i++) {
		const p = picks[i];
		fenceDummy.position.set(p.x, 0, p.z);
		fenceDummy.rotation.set(0, Math.PI / 2 - p.a, 0);
		fenceDummy.scale.set(1.35, 1, 1);
		fenceDummy.updateMatrix();
		pickets.setMatrixAt(i, fenceDummy.matrix);
		const warm = 0.92 + ((i * 13) % 5) * 0.03;
		fenceColor.setRGB(warm, warm * 0.96, warm * 0.9);
		pickets.setColorAt(i, fenceColor);
	}
	let railN = 0;
	for (const [p, q] of pairs) {
		const dx = q.x - p.x;
		const dz = q.z - p.z;
		const len = Math.hypot(dx, dz) + 0.2;
		const yaw = Math.atan2(-dz, dx);
		const mx = (p.x + q.x) / 2;
		const mz = (p.z + q.z) / 2;
		const radial = Math.hypot(mx, mz) || 1;
		const ix = mx - (mx / radial) * 0.02;
		const iz = mz - (mz / radial) * 0.02;
		fenceDummy.position.set(ix, 0.52, iz);
		fenceDummy.rotation.set(0, yaw, 0);
		fenceDummy.scale.set(len, 1.02, 0.045);
		fenceDummy.updateMatrix();
		fills.setMatrixAt(railN, fenceDummy.matrix);
		fills.setColorAt(railN, fenceColor.setRGB(0.9, 0.86, 0.78));
		for (const [slot, y] of [[0, 0.28], [1, 0.78]] as [number, number][]) {
			fenceDummy.position.set(ix, y, iz);
			fenceDummy.rotation.set(0, yaw, 0);
			fenceDummy.scale.set(len, 1, 1.2);
			fenceDummy.updateMatrix();
			rails.setMatrixAt(railN * 2 + slot, fenceDummy.matrix);
			rails.setColorAt(railN * 2 + slot, fenceColor.setRGB(0.94, 0.9, 0.84));
		}
		railN += 1;
	}
	pickets.instanceMatrix.needsUpdate = true;
	rails.instanceMatrix.needsUpdate = true;
	fills.instanceMatrix.needsUpdate = true;
	if (pickets.instanceColor) pickets.instanceColor.needsUpdate = true;
	if (rails.instanceColor) rails.instanceColor.needsUpdate = true;
	if (fills.instanceColor) fills.instanceColor.needsUpdate = true;
	pickets.receiveShadow = true;
	rails.receiveShadow = true;
	fills.receiveShadow = true;
	fence.add(pickets, rails, fills);
	trackProp({ id: "fence", label: "Köy çiti", kind: "bina", object: fence, base: { x: 0, y: 0, z: 0, yaw: 0 }, fence: true });
	root.add(fence);
	const villageWall = ringWall(0, 0, VILLAGE_BOUND, 8.2, 1.65, 128, "#7d756c");
	villageWall.name = "village-bound";
	root.add(villageWall);
	const dress = (_ox: number, _oz: number, _inner: number, _hill: string, _peak: string, _maxR: number) => {
		return new THREE.Group();
	};
	const lands = [
		["land-koy", "Ana köy arazisi", 0, 0, 70, "#6d7a48", "#8d8678", VILLAGE_BOUND - 10],
		["land-koy2", "İkinci Köy arazisi", 0, 420, 18, "#5f7344", "#7d8a62", DUNGEON_BOUND - 6],
		["land-dolunay", "Dolunay arazisi", 420, 0, 18, "#4a5c72", "#9aa4b0", DUNGEON_BOUND - 6],
		["land-ay", "Sonsuz Ay arazisi", -420, 0, 18, "#3a3348", "#6a6278", DUNGEON_BOUND - 6],
	];
	for (const row of lands) {
		const host = dress(Number(row[2]), Number(row[3]), Number(row[4]), String(row[5]), String(row[6]), Number(row[7]));
		trackProp({ id: row[0], label: row[1], kind: "arazi", object: host, base: { x: 0, y: 0, z: 0, yaw: 0 } });
		root.add(host);
	}

	const puffs = [];
	const puffTex = smokeTexture();
	for (const cny of CHIMNEYS) for (let i = 0; i < 5; i++) {
		const material = keep(new THREE.SpriteMaterial({
			map: puffTex,
			transparent: true,
			depthWrite: false,
			opacity: .2
		}));
		const sprite = new THREE.Sprite(material);
		const life = i / 5;
		sprite.position.set(cny.x, cny.y + life * 2.1, cny.z);
		root.add(sprite);
		puffs.push({
			sprite,
			base: cny.y,
			life,
			speed: .12 + i % 3 * .02
		});
	}
	const forgeLight = new THREE.PointLight("#ff6a2a", 6, 8, 2);
	forgeLight.position.set(-14.2, 1.2, 17.2);
	root.add(forgeLight);
	root.add(makeGrass());
	return {
		root,
		puffs,
		forgeLight,
		dummy: null
	};
}
var grassTime = { value: 0 };
function makeDummy() {
	const root = new THREE.Group();
	root.position.set(4.2, 0, 12.4);
	root.rotation.y = Math.PI * .15;
	const wood = keep(new THREE.MeshStandardMaterial({
		color: "#6b4a2e",
		roughness: .86
	}));
	const sack = keep(new THREE.MeshStandardMaterial({
		color: "#c2a36a",
		roughness: .92
	}));
	const rope = keep(new THREE.MeshStandardMaterial({
		color: "#8a6a3c",
		roughness: .95
	}));
	const straw = keep(new THREE.MeshStandardMaterial({
		color: "#d2b15a",
		roughness: 1
	}));
	const paint = keep(new THREE.MeshStandardMaterial({
		color: "#9a1c1c",
		roughness: .7
	}));
	const ring = keep(new THREE.MeshStandardMaterial({
		color: "#b9b4aa",
		roughness: .35,
		metalness: .6
	}));
	const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(.09, .11, 1.15, 8)), wood);
	post.position.y = .55;
	post.castShadow = true;
	const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(.045, .045, 1.35, 6)), wood);
	beam.rotation.z = Math.PI / 2;
	beam.position.y = 1.28;
	beam.castShadow = true;
	const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(.28, .34, .72, 10)), sack);
	body.position.y = 1.22;
	body.castShadow = true;
	const head = new THREE.Mesh(keep(new THREE.SphereGeometry(.2, 12, 10)), sack);
	head.position.y = 1.78;
	head.castShadow = true;
	const band = new THREE.Mesh(keep(new THREE.TorusGeometry(.16, .018, 6, 16)), ring);
	band.rotation.x = Math.PI / 2;
	band.position.y = 1.86;
	const armGeo = keep(new THREE.CylinderGeometry(.07, .08, .42, 7));
	const armL = new THREE.Mesh(armGeo, sack);
	armL.rotation.z = Math.PI / 2;
	armL.position.set(-.48, 1.32, 0);
	const armR = armL.clone();
	armR.position.x = .48;
	armL.castShadow = armR.castShadow = true;
	const tuftGeo = keep(new THREE.ConeGeometry(.05, .16, 5));
	const tufts = [];
	for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
		const tuft = new THREE.Mesh(tuftGeo, straw);
		tuft.position.set(side * (.66 + i % 2 * .04), 1.32 + (i - 2) * .035, (i - 2) * .02);
		tuft.rotation.z = side * 1.2;
		tufts.push(tuft);
	}
	const ropeBand = new THREE.Mesh(keep(new THREE.TorusGeometry(.3, .018, 5, 14)), rope);
	ropeBand.rotation.x = Math.PI / 2;
	ropeBand.position.y = 1.05;
	const target = new THREE.Mesh(keep(new THREE.CircleGeometry(.16, 16)), paint);
	target.position.set(0, 1.24, .33);
	const inner = new THREE.Mesh(keep(new THREE.RingGeometry(.05, .09, 16)), keep(new THREE.MeshStandardMaterial({
		color: "#f2efe6",
		roughness: .6
	})));
	inner.position.set(0, 1.24, .335);
	const sackBody = body;
	const sackGroup = new THREE.Group();
	sackGroup.add(sackBody, head, band, armL, armR, ropeBand, target, inner, ...tufts);
	root.add(post, beam, sackGroup);
	root.userData.body = sackGroup;
	return root;
}
function makeGrass() {
	const geo = new THREE.PlaneGeometry(.07, .32, 1, 3);
	geo.translate(0, .11, 0);
	const mat = new THREE.MeshLambertMaterial({
		color: "#3f6b32",
		side: THREE.DoubleSide
	});
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = grassTime;
		shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float h = clamp(position.y * 4.2, 0.0, 1.0);
        float gust = sin(uTime * 1.15 + ip.x * 0.55 + ip.z * 0.41);
        transformed.x += gust * 0.035 * h * h;
        transformed.z += cos(uTime * 0.9 + ip.z * 0.48) * 0.02 * h * h;`);
	};
	const count = 1500;
	const mesh = new THREE.InstancedMesh(geo, mat, count);
	mesh.castShadow = false;
	mesh.receiveShadow = false;
	const dummy = new THREE.Object3D();
	const color = new THREE.Color();
	let placed = 0;
	const cluster = (cx, cz, n, spread) => {
		for (let k = 0; k < n && placed < count; k++) {
			const a = Math.random() * Math.PI * 2;
			const r = Math.sqrt(Math.random()) * spread;
			const x = cx + Math.cos(a) * r;
			const z = cz + Math.sin(a) * r;
			if (Math.hypot(x, z) < 16.8) continue;
			dummy.position.set(x, 0, z);
			dummy.rotation.y = Math.random() * Math.PI;
			dummy.rotation.z = (Math.random() - .5) * .18;
			const s = .65 + Math.random() * .55;
			dummy.scale.set(s * (.7 + Math.random() * .5), .55 + Math.random() * .7, 1);
			dummy.updateMatrix();
			mesh.setMatrixAt(placed, dummy.matrix);
			color.setHSL(.28 + Math.random() * .06, .42 + Math.random() * .22, .16 + Math.random() * .1);
			mesh.setColorAt(placed, color);
			placed++;
		}
	};
	for (let i = 0; i < 90 && placed < count; i++) {
		const ring = 18 + Math.random() * 140;
		const a = Math.random() * Math.PI * 2;
		cluster(Math.cos(a) * ring, Math.sin(a) * ring, 18 + Math.floor(Math.random() * 24), 2.4 + Math.random() * 3.2);
	}
	while (placed < count) {
		const ring = 18 + Math.random() * 140;
		const a = Math.random() * Math.PI * 2;
		cluster(Math.cos(a) * ring, Math.sin(a) * ring, 1, 0);
	}
	mesh.instanceMatrix.needsUpdate = true;
	if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	mesh.count = placed;
	mesh.name = "season-grass";
	return mesh;
}
export function tickGrass(dt) {
	grassTime.value += dt;
}
export function tickSmoke(puffs, dt) {
	for (let i = 0; i < puffs.length; i++) {
		const p = puffs[i];
		p.life += dt * p.speed;
		if (p.life > 1) p.life -= 1;
		p.sprite.position.y = p.base + p.life * 2.3;
		p.sprite.position.x += Math.sin(p.life * 6 + i) * dt * .05;
		const mat = p.sprite.material;
		mat.opacity = Math.sin(p.life * Math.PI) * .28;
		const s = .45 + p.life * 1.15;
		p.sprite.scale.set(s, s, s);
	}
}

export function createWeather(scene: THREE.Scene) {
	const root = new THREE.Group();
	const puffMat = new THREE.MeshLambertMaterial({
		color: "#f4f1ea",
	});
	const clouds: THREE.Group[] = [];
	for (let i = 0; i < 14; i++) {
		const cloud = new THREE.Group();
		const n = 4;
		for (let k = 0; k < n; k++) {
			const blob = new THREE.Mesh(new THREE.SphereGeometry(3.4, 6, 4), puffMat);
			blob.position.set((k - 1.5) * 3.6, 0, (k % 2) * 1.4);
			blob.scale.y = 0.42;
			cloud.add(blob);
		}
		cloud.userData.base = i * 28;
		cloud.userData.speed = 1.1 + (i % 4) * 0.35;
		cloud.userData.z = (i - 7) * 16;
		cloud.userData.y = 16 + (i % 5) * 3.2;
		root.add(cloud);
		clouds.push(cloud);
	}
	const sun = new THREE.Mesh(
		new THREE.SphereGeometry(1.7, 18, 14),
		new THREE.MeshBasicMaterial({ color: "#ffe7b0" }),
	);
	const glow = new THREE.Mesh(
		new THREE.SphereGeometry(3.4, 16, 12),
		new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true, opacity: 0.28, depthWrite: false }),
	);
	root.add(sun, glow);
	const count = 2600;
	const rainSpan = 560;
	const rainPos = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		rainPos[i * 3] = (Math.random() - 0.5) * rainSpan;
		rainPos[i * 3 + 1] = Math.random() * 22;
		rainPos[i * 3 + 2] = (Math.random() - 0.5) * rainSpan;
	}
	const rainGeo = new THREE.BufferGeometry();
	rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
	const rain = new THREE.Points(
		rainGeo,
		new THREE.PointsMaterial({ color: "#d5e2ee", size: 0.16, transparent: true, opacity: 0.72, depthWrite: false }),
	);
	rain.visible = false;
	root.add(rain);
	const flash = new THREE.PointLight("#e7f1ff", 0, 240, 1.4);
	flash.name = "storm-flash";
	flash.position.set(0, 24, 0);
	root.add(flash);
	const leafGeo = new THREE.PlaneGeometry(0.16, 0.09);
	const leafMat = new THREE.MeshLambertMaterial({ color: "#d86a22", side: THREE.DoubleSide });
	const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 280);
	const flowerMat = new THREE.MeshLambertMaterial({ color: "#f2d2e6" });
	const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 5, 4), flowerMat, 220);
	const dummy = new THREE.Object3D();
	const tint = new THREE.Color();
	const leafSpots: { x: number; z: number; ry: number; s: number }[] = [];
	const flowerSpots: { x: number; z: number; ry: number; s: number }[] = [];
	for (let i = 0; i < 280; i++) {
		const a = Math.random() * Math.PI * 2;
		const r = 18 + Math.random() * 138;
		const spot = { x: Math.cos(a) * r, z: Math.sin(a) * r, ry: Math.random() * Math.PI, s: 0.8 + Math.random() * 1.1 };
		leafSpots.push(spot);
		dummy.position.set(spot.x, -4, spot.z);
		dummy.rotation.set(-Math.PI / 2, 0, spot.ry);
		dummy.scale.setScalar(0);
		dummy.updateMatrix();
		leaves.setMatrixAt(i, dummy.matrix);
		tint.setHSL(0.07 + Math.random() * 0.06, 0.7, 0.38 + Math.random() * 0.12);
		leaves.setColorAt(i, tint);
	}
	for (let i = 0; i < 220; i++) {
		const a = Math.random() * Math.PI * 2;
		const r = 18 + Math.random() * 138;
		const spot = { x: Math.cos(a) * r, z: Math.sin(a) * r, ry: Math.random() * Math.PI, s: 0.7 + Math.random() * 1 };
		flowerSpots.push(spot);
		dummy.position.set(spot.x, -4, spot.z);
		dummy.rotation.set(0, spot.ry, 0);
		dummy.scale.setScalar(0);
		dummy.updateMatrix();
		flowers.setMatrixAt(i, dummy.matrix);
		const hue = Math.random() < 0.5 ? 0.95 : Math.random() < 0.5 ? 0.14 : 0.55;
		tint.setHSL(hue, 0.55, 0.62);
		flowers.setColorAt(i, tint);
	}
	leaves.instanceMatrix.needsUpdate = true;
	flowers.instanceMatrix.needsUpdate = true;
	if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
	if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
	leaves.visible = false;
	flowers.visible = false;
	const snowCount = 3200;
	const snowSpan = 400;
	const snowPos = new Float32Array(snowCount * 3);
	for (let i = 0; i < snowCount; i++) {
		snowPos[i * 3] = (Math.random() - 0.5) * snowSpan;
		snowPos[i * 3 + 1] = Math.random() * 22;
		snowPos[i * 3 + 2] = (Math.random() - 0.5) * snowSpan;
	}
	const snowGeo = new THREE.BufferGeometry();
	snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
	const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: "#f7fbff", size: 0.28, transparent: true, opacity: 0.95, depthWrite: false }));
	snow.visible = false;
	root.add(leaves, flowers, snow);
	scene.add(root);
	let snowCaps: THREE.Object3D[] | null = null;
	const seasonColor = new THREE.Color();
	const nextColor = new THREE.Color();
	let painted = -1;
	let dressed = -1;
	return {
		update(dt: number, t: number, x: number, z: number) {
			const climate = studioClimate();
			const season = Math.floor(Date.now() / 3600000) % 4;
			const frac = (Date.now() % 3600000) / 3600000;
			const ground = scene.getObjectByName("season-ground") as THREE.Mesh | undefined;
			const gmat = ground?.material as THREE.MeshLambertMaterial | undefined;
			if (gmat) {
				const palette = ["#8fbf62", "#d7e2b8", "#c9843a", "#b7c3a8"];
				seasonColor.set(palette[season] ?? "#8fbf62");
				nextColor.set(palette[(season + 1) % 4] ?? "#8fbf62");
				gmat.color.copy(seasonColor.lerp(nextColor, frac * 0.35));
			}
			const blanket = scene.getObjectByName("snow-blanket") as THREE.Mesh | undefined;
			if (blanket && painted !== season) {
				painted = season;
				const canvas = blanket.userData.canvas as HTMLCanvasElement | undefined;
				const tex = blanket.userData.tex as THREE.Texture | undefined;
				const ctx = canvas?.getContext("2d");
				if (canvas && ctx && tex) {
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					if (season === 3) {
						ctx.fillStyle = "rgba(255,255,255,0.9)";
						ctx.fillRect(0, 0, canvas.width, canvas.height);
					}
					tex.needsUpdate = true;
				}
				blanket.visible = season === 3;
			}
			const moat = scene.getObjectByName("moat") as THREE.Mesh | undefined;
			const lakeClock = moat?.material && (moat.material as THREE.Material).userData?.uTime as { value: number } | undefined;
			if (lakeClock) lakeClock.value += dt;
			const wellWater = scene.getObjectByName("well-water") as THREE.Mesh | undefined;
			const wellMat = wellWater?.material as THREE.ShaderMaterial | undefined;
			if (wellMat?.uniforms?.uTime) wellMat.uniforms.uTime.value += dt;
			if (!snowCaps || snowCaps.length === 0) {
				snowCaps = [];
				scene.traverse((obj) => {
					if (obj.name === "snow-cap") snowCaps!.push(obj);
				});
			}
			for (const cap of snowCaps) cap.visible = season === 3;
			const grass = scene.getObjectByName("season-grass") as THREE.Mesh | undefined;
			const grassMat = grass?.material as THREE.MeshLambertMaterial | undefined;
			if (grassMat) {
				const grassTone = ["#7dba62", "#d2c56a", "#d07a32", "#c5d0dc"];
				grassMat.color.set(grassTone[season] ?? "#7dba62");
			}
			const paintSpread = (mesh: THREE.InstancedMesh, spots: { x: number; z: number; ry: number; s: number }[], _salt: number, y: number, flat: boolean, onSeason: boolean) => {
				mesh.visible = onSeason;
				for (let i = 0; i < spots.length; i++) {
					const spot = spots[i]!;
					const on = onSeason && Math.hypot(spot.x, spot.z) > 17;
					dummy.position.set(spot.x, on ? y : -6, spot.z);
					dummy.rotation.set(flat ? -Math.PI / 2 : 0, flat ? 0 : spot.ry, flat ? spot.ry : 0);
					dummy.scale.setScalar(on ? spot.s : 0.001);
					dummy.updateMatrix();
					mesh.setMatrixAt(i, dummy.matrix);
				}
				mesh.instanceMatrix.needsUpdate = true;
			};
			if (dressed !== season) {
				dressed = season;
				paintSpread(leaves, leafSpots, 2, 0.03, true, season === 2);
				paintSpread(flowers, flowerSpots, season === 1 ? 1 : 0, 0.05, false, season === 0 || season === 1);
			}
			for (const cloud of clouds) {
				const span = 260;
				const drift = (cloud.userData.base as number) + t * (cloud.userData.speed as number);
				const wrapped = ((drift % span) + span) % span - span / 2;
				cloud.position.set(x + wrapped, cloud.userData.y as number, z + (cloud.userData.z as number));
			}
			sun.position.set(x + (season === 1 ? 10 : 16), season === 1 ? 22 : 14, z - 18);
			glow.position.copy(sun.position);
			sun.visible = season === 1 || season === 0;
			glow.visible = sun.visible;
			if (climate.hour != null) {
				const h = ((climate.hour % 24) + 24) % 24;
				const ang = ((h - 6) / 12) * Math.PI;
				sun.position.set(x + Math.cos(ang) * 28, Math.sin(ang) * 22, z - 12);
				sun.visible = Math.sin(ang) > 0.08;
				glow.visible = sun.visible;
			}
			rain.visible = season === 2;
			snow.visible = season === 3;
			rain.position.set(x, 0, z);
			snow.position.set(x, 0, z);
			if (season === 2) {
				const arr = rainGeo.attributes.position as THREE.BufferAttribute;
				const storm = Math.sin(t * 0.7) > 0.12;
				const fall = storm ? 26 : 14;
				for (let i = 0; i < count; i++) {
					let px = arr.getX(i);
					let py = arr.getY(i) - dt * fall;
					let pz = arr.getZ(i) + dt * (storm ? 6 : 2.2);
					if (py < 0.15 || Math.abs(px) > rainSpan * 0.5 || Math.abs(pz) > rainSpan * 0.5) {
						px = (Math.random() - 0.5) * rainSpan;
						pz = (Math.random() - 0.5) * rainSpan;
						py = 8 + Math.random() * 16;
					}
					arr.setXYZ(i, px, py, pz);
				}
				arr.needsUpdate = true;
				if (storm && Math.random() < dt * 0.55) {
					flash.intensity = 14 + Math.random() * 12;
					flash.position.set(x + (Math.random() - 0.5) * 160, 28, z + (Math.random() - 0.5) * 160);
				}
			}
			if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 42);
			if (scene.fog) scene.fog = null;
			if (season === 3) {
				const arr = snowGeo.attributes.position as THREE.BufferAttribute;
				for (let i = 0; i < snowCount; i++) {
					let px = arr.getX(i);
					let py = arr.getY(i) - dt * 3.2;
					let pz = arr.getZ(i);
					if (py < 0.2 || Math.abs(px) > snowSpan * 0.5 || Math.abs(pz) > snowSpan * 0.5) {
						px = (Math.random() - 0.5) * snowSpan;
						pz = (Math.random() - 0.5) * snowSpan;
						py = 6 + Math.random() * 16;
					}
					arr.setXYZ(i, px, py, pz);
				}
				arr.needsUpdate = true;
			}
		},
		dispose() {
			scene.remove(root);
		},
	};
}
