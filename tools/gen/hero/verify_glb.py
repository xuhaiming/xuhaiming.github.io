"""Stage 7 check: read the exported GLB back (plain Python, no Blender) and print the contract facts.
usage: python verify_glb.py <hero.glb>"""
import json, struct, sys, os

path = sys.argv[1]
data = open(path, "rb").read()
jlen = struct.unpack_from("<I", data, 12)[0]
j = json.loads(data[20:20 + jlen])
acc = j["accessors"]
print("file", path, os.path.getsize(path), "bytes (%.2f MB)" % (os.path.getsize(path) / 1e6))
print("generator", j["asset"].get("generator"))
prims = [p for m in j["meshes"] for p in m["primitives"]]
print("meshes", len(j["meshes"]), "primitives", len(prims), "triangles", sum(acc[p["indices"]]["count"] // 3 for p in prims),
      "vertices", sum(acc[p["attributes"]["POSITION"]["count"] if False else p["attributes"]["POSITION"]]["count"] for p in prims))
for p in prims:
    a = acc[p["attributes"]["POSITION"]]
    print("bind-pose bounds min", [round(v, 4) for v in a["min"]], "max", [round(v, 4) for v in a["max"]], "attributes", sorted(p["attributes"]))
print("skins", len(j.get("skins", [])), "cameras", len(j.get("cameras", [])), "lights", "KHR_lights_punctual" in j.get("extensionsUsed", []))
for s in j.get("skins", []):
    names = [j["nodes"][i]["name"] for i in s["joints"]]
    print("joints", len(names)); print(" ", ", ".join(names))
print("images", [(i.get("mimeType"), j["bufferViews"][i["bufferView"]]["byteLength"]) for i in j.get("images", [])], "materials", [m["name"] for m in j.get("materials", [])])
for a in j.get("animations", []):
    t = max(acc[s["input"]]["max"][0] for s in a["samplers"]); n = max(acc[s["input"]]["count"] for s in a["samplers"])
    moved = sorted({j["nodes"][c["target"]["node"]]["name"] for c in a["channels"] if c["target"]["path"] == "translation"})
    print("clip %-6s %.3f s  %d keys  %d channels  translation on %s" % (a["name"], t, n, len(a["channels"]), moved))
roots = [j["nodes"][i] for i in j["scenes"][j.get("scene", 0)]["nodes"]]
print("scene roots", [(n["name"], {k: n[k] for k in ("translation", "rotation", "scale") if k in n}) for n in roots])
text = json.dumps(j).lower()
bad = [w for w in ("bin" + "ance", "block" + "chain", "cry" + "pto") if w in text]
print("forbidden words in JSON:", bad or "none")
