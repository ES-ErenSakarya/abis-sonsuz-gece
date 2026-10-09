#!/usr/bin/env python3
"""Repack the dragon with a small eye texture and no ground plane."""
import io
import json
import shutil
import zipfile
from pathlib import Path

from PIL import Image

src = "/workspace/attachments/black_dragon_with_idle_animation.zip"
out = Path("/workspace/public/models/dragon")
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)
(out / "textures").mkdir()

z = zipfile.ZipFile(src)
doc = json.loads(z.read("scene.gltf"))
(out / "scene.bin").write_bytes(z.read("scene.bin"))

# Drop the scaled ground plane from the hierarchy. Keep node ids stable.
for node in doc["nodes"]:
    kids = node.get("children")
    if not kids:
        continue
    node["children"] = [k for k in kids if doc["nodes"][k].get("name") != "Plane"]

eye = Image.open(io.BytesIO(z.read("textures/EYES_baseColor.jpeg"))).convert("RGB")
eye.thumbnail((256, 256))
eye.save(out / "textures" / "eyes.jpg", "JPEG", quality=80)

# Materials: body is a dark hide, eyes keep a small glow map.
doc["images"] = [{"uri": "textures/eyes.jpg"}]
doc["textures"] = [{"sampler": 0, "source": 0}]
doc["samplers"] = [{"magFilter": 9729, "minFilter": 9987}]
doc["materials"] = [
    {
        "name": "hide",
        "doubleSided": True,
        "pbrMetallicRoughness": {"baseColorFactor": [0.16, 0.15, 0.14, 1], "metallicFactor": 0.35, "roughnessFactor": 0.62},
    },
    {
        "name": "eyes",
        "doubleSided": True,
        "emissiveFactor": [1, 0.85, 0.45],
        "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "baseColorFactor": [1, 0.9, 0.6, 1], "metallicFactor": 0, "roughnessFactor": 0.35},
    },
]
# mesh 0 plane, 1 eyes, 2 wings/body, 3 body
for mesh in doc["meshes"]:
    name = mesh.get("name") or ""
    mat = 1 if "EYES" in name or "eye" in name.lower() else 0
    for prim in mesh["primitives"]:
        prim["material"] = mat
        prim.pop("extensions", None)
doc.pop("extensionsUsed", None)
doc.pop("extensionsRequired", None)
(out / "scene.gltf").write_text(json.dumps(doc, separators=(",", ":")))
print("dragon", (out / "scene.gltf").stat().st_size, (out / "scene.bin").stat().st_size, (out / "textures" / "eyes.jpg").stat().st_size)
