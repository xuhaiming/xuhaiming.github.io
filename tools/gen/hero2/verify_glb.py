"""Read a stage-1 GLB back (plain Python, no Blender) and print the facts the next stages rely on.
usage: python hero2/verify_glb.py <hero_mesh.glb>"""
import json, struct, sys

d = open(sys.argv[1], "rb").read()
jl = struct.unpack_from("<I", d, 12)[0]
j = json.loads(d[20:20 + jl])
print("file MiB        %.2f" % (len(d) / 2 ** 20))
print("nodes          ", [(n.get("name"), {k: n[k] for k in ("translation", "rotation", "scale", "matrix") if k in n}) for n in j["nodes"]])
print("meshes         ", [(m["name"], len(m["primitives"])) for m in j["meshes"]], "materials", [m["name"] for m in j["materials"]])
p = j["meshes"][0]["primitives"][0]
acc = j["accessors"]
pos = acc[p["attributes"]["POSITION"]]
print("attributes     ", sorted(p["attributes"]))
print("vertices        %d   triangles %d" % (pos["count"], acc[p["indices"]]["count"] // 3))
print("bounds min     ", [round(v, 4) for v in pos["min"]])
print("bounds max     ", [round(v, 4) for v in pos["max"]])
print("height          %.4f   feet y %.4f   x centre %.4f" % (pos["max"][1] - pos["min"][1], pos["min"][1], (pos["max"][0] + pos["min"][0]) / 2))
m = j["materials"][0]
tex = {"baseColor": m["pbrMetallicRoughness"].get("baseColorTexture"), "metallicRoughness": m["pbrMetallicRoughness"].get("metallicRoughnessTexture"), "normal": m.get("normalTexture")}
for k, t in tex.items():
    if not t: print("texture %-18s MISSING" % k); continue
    img = j["images"][j["textures"][t["index"]]["source"]]
    bv = j["bufferViews"][img["bufferView"]]
    b0 = 20 + jl + 8 + bv.get("byteOffset", 0)
    blob = d[b0:b0 + bv["byteLength"]]
    size = "?"
    if img["mimeType"] == "image/png":
        size = "%dx%d" % struct.unpack(">II", blob[16:24])
    else:                                    # JPEG: find the SOF marker
        i = 2
        while i < len(blob):
            mk, ln = blob[i + 1], struct.unpack(">H", blob[i + 2:i + 4])[0]
            if 0xC0 <= mk <= 0xC3:
                h, w = struct.unpack(">HH", blob[i + 5:i + 9]); size = "%dx%d" % (w, h); break
            i += 2 + ln
    print("texture %-18s %s %s %d KiB" % (k, img["mimeType"], size, bv["byteLength"] // 1024))
print("skins", len(j.get("skins", [])), "animations", len(j.get("animations", [])), "cameras", len(j.get("cameras", [])))
