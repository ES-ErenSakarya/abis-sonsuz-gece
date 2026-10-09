#!/usr/bin/env python3
"""Turn a huge static Tripo/Sketchfab zip into a small Y-up GLB."""
import io
import json
import struct
import sys
import zipfile

import numpy as np
from PIL import Image

def read_accessor(doc, blob, index):
    acc = doc["accessors"][index]
    bv = doc["bufferViews"][acc["bufferView"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    dt = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[acc["componentType"]]
    stride = bv.get("byteStride", 0)
    item = np.dtype(dt).itemsize * ncomp
    if stride and stride != item:
        out = np.empty((count, ncomp), np.dtype(dt))
        for i in range(count):
            off = start + i * stride
            out[i] = np.frombuffer(blob[off : off + item], dt, count=ncomp)
        return out
    return np.frombuffer(blob[start : start + count * item], dt).reshape(count, ncomp).copy()

def load_mesh(path):
    z = zipfile.ZipFile(path)
    doc = json.loads(z.read("scene.gltf"))
    blob = z.read("scene.bin")
    positions = []
    uvs = []
    tris = []
    offset = 0
    for mesh in doc["meshes"]:
        for prim in mesh["primitives"]:
            if prim.get("mode", 4) != 4:
                continue
            pos = read_accessor(doc, blob, prim["attributes"]["POSITION"]).astype(np.float32)
            if "TEXCOORD_0" in prim["attributes"]:
                uv = read_accessor(doc, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float32)[:, :2]
            else:
                uv = np.zeros((len(pos), 2), np.float32)
            idx = read_accessor(doc, blob, prim["indices"]).reshape(-1).astype(np.int64)
            idx = idx[: len(idx) - (len(idx) % 3)]
            positions.append(pos)
            uvs.append(uv)
            tris.append(idx.reshape(-1, 3) + offset)
            offset += len(pos)
    pos = np.concatenate(positions, axis=0)
    uv = np.concatenate(uvs, axis=0)
    tri = np.concatenate(tris, axis=0)
    # Z-up -> Y-up. Old +Y (depth) becomes +Z so the face looks down +Z.
    turned = np.empty_like(pos)
    turned[:, 0] = pos[:, 0]
    turned[:, 1] = pos[:, 2]
    turned[:, 2] = -pos[:, 1]
    pos = turned
    lo = pos[:, 1].min()
    pos[:, 1] -= lo
    hi = float(np.quantile(pos[:, 1], 0.995))
    pos *= np.float32(1.72 / max(hi, 1e-4))
    pos[:, 0] -= (pos[:, 0].min() + pos[:, 0].max()) * 0.5
    pos[:, 2] -= (pos[:, 2].min() + pos[:, 2].max()) * 0.5
    tex = None
    for image in doc.get("images", []):
        uri = image.get("uri", "")
        if "baseColor" in uri or uri.lower().endswith((".jpg", ".jpeg")):
            tex = z.read(uri)
            break
    return pos, uv, tri, tex

def decimate(pos, uv, tri, voxel):
    q = np.round(pos / voxel).astype(np.int32)
    uniq, inv = np.unique(q, axis=0, return_inverse=True)
    acc_p = np.zeros((len(uniq), 3), np.float64)
    acc_u = np.zeros((len(uniq), 2), np.float64)
    acc_n = np.zeros(len(uniq), np.float64)
    np.add.at(acc_p, inv, pos)
    np.add.at(acc_u, inv, uv)
    np.add.at(acc_n, inv, 1)
    centers = (acc_p / acc_n[:, None]).astype(np.float32)
    uvs = (acc_u / acc_n[:, None]).astype(np.float32)
    faces = inv[tri]
    keep = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    faces = np.unique(faces[keep], axis=0)
    used = np.unique(faces.reshape(-1))
    remap = np.full(len(centers), -1, np.int32)
    remap[used] = np.arange(len(used), dtype=np.int32)
    return centers[used], uvs[used], remap[faces]

def write_glb(path, pos, uv, faces, jpeg):
    pos = np.ascontiguousarray(pos, np.float32)
    uv = np.ascontiguousarray(uv, np.float32)
    faces = np.ascontiguousarray(faces, np.uint32)
    blob = pos.tobytes() + uv.tobytes() + faces.tobytes() + jpeg
    def pad4(n):
        return (4 - (n % 4)) % 4
    p_off, p_len = 0, pos.nbytes
    u_off, u_len = p_len, uv.nbytes
    i_off, i_len = p_len + u_len, faces.nbytes
    j_off, j_len = p_len + u_len + i_len, len(jpeg)
    gltf = {
        "asset": {"version": "2.0", "generator": "abis-decimate"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Body"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0, "mode": 4}]}],
        "materials": [{"name": "body", "doubleSided": True, "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.15, "roughnessFactor": 0.72}}],
        "textures": [{"source": 0, "sampler": 0}],
        "images": [{"bufferView": 3, "mimeType": "image/jpeg"}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": p_off, "byteLength": p_len, "target": 34962},
            {"buffer": 0, "byteOffset": u_off, "byteLength": u_len, "target": 34962},
            {"buffer": 0, "byteOffset": i_off, "byteLength": i_len, "target": 34963},
            {"buffer": 0, "byteOffset": j_off, "byteLength": j_len},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
            {"bufferView": 1, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": 2, "componentType": 5125, "count": int(faces.size), "type": "SCALAR"},
        ],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * pad4(len(js))
    bin_pad = b"\x00" * pad4(len(blob))
    blob2 = blob + bin_pad
    total = 12 + 8 + len(js) + 8 + len(blob2)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js), 0x4E4F534A)
    out += js
    out += struct.pack("<II", len(blob2), 0x004E4942)
    out += blob2
    open(path, "wb").write(out)
    print(path, "verts", len(pos), "tris", len(faces), "bytes", len(out))

def preview(path, pos, uv, jpeg):
    im = Image.open(io.BytesIO(jpeg)).convert("RGB")
    arr = np.asarray(im)
    h, w = arr.shape[:2]
    canvas = np.zeros((420, 360, 3), np.uint8)
    canvas[:] = (30, 34, 38)
    # front: camera looks from +Z, x right, y up
    xs = pos[:, 0]
    ys = pos[:, 1]
    span = max(xs.max() - xs.min(), ys.max() - ys.min(), 0.01)
    def plot(px, py):
        sx = ((px - xs.min()) / span * 300 + 30).astype(np.int32)
        sy = (390 - (py - ys.min()) / span * 340).astype(np.int32)
        uu = np.clip((uv[:, 0] % 1) * (w - 1), 0, w - 1).astype(np.int32)
        vv = np.clip((1 - (uv[:, 1] % 1)) * (h - 1), 0, h - 1).astype(np.int32)
        col = arr[vv, uu]
        ok = (sx >= 0) & (sx < 360) & (sy >= 0) & (sy < 420)
        canvas[sy[ok], sx[ok]] = col[ok]
    plot(pos[:, 0], pos[:, 1])
    Image.fromarray(canvas).save(path)
    print("preview", path)

def main():
    src, dst, shot, voxel = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
    pos, uv, tri, tex = load_mesh(src)
    print("loaded", len(pos), len(tri), "tex", None if tex is None else len(tex))
    if tex is None:
        jpeg = io.BytesIO()
        Image.new("RGB", (8, 8), (80, 80, 80)).save(jpeg, "JPEG")
        jpeg = jpeg.getvalue()
    else:
        im = Image.open(io.BytesIO(tex)).convert("RGB")
        im.thumbnail((512, 512))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=80)
        jpeg = buf.getvalue()
    centers, uvs, faces = decimate(pos, uv, tri, voxel)
    # preview from original-ish decimated cloud
    preview(shot, centers, uvs, jpeg)
    write_glb(dst, centers, uvs, faces, jpeg)

if __name__ == "__main__":
    main()
