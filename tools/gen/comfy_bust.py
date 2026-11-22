"""Photo -> textured 3D bust (GLB) through the local ComfyUI server, with Trellis 2.
usage: comfy_bust.py <photo.png> <out.glb> [crop x0,y0,x1,y1]"""
import json, sys, time, shutil, urllib.request, urllib.parse, os
from PIL import Image

HOST = "http://127.0.0.1:8188"
COMFY_INPUT = r"C:\projects\ComfyUI\input"

def post(path, data):
    req = urllib.request.Request(HOST + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))

def get(path):
    return json.load(urllib.request.urlopen(HOST + path))

src, out = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGB")
if len(sys.argv) > 3:
    img = img.crop(tuple(int(v) for v in sys.argv[3].split(",")))
name = "site_bust_src.png"
img.save(os.path.join(COMFY_INPUT, name))

def ks(model, seed, steps, cfg, sched, pos, neg, lat):
    return {"class_type": "KSampler", "inputs": {"model": model, "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler", "scheduler": sched, "positive": pos, "negative": neg, "latent_image": lat, "denoise": 1}}

g = {
    "img": {"class_type": "LoadImage", "inputs": {"image": name}},
    "upm": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": "4xNomos8kHAT-L_otf.pth"}},
    "up": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["upm", 0], "image": ["img", 0]}},
    "bgm": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}},
    "mask": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["bgm", 0], "image": ["up", 0]}},
    "crop": {"class_type": "ImageCropToMask", "inputs": {"images": ["up", 0], "masks": ["mask", 0], "width": 1024, "height": 1024, "pad_factor": 1.1, "grow_mask": 0, "background": "#000000"}},
    "prev": {"class_type": "SaveImage", "inputs": {"images": ["crop", 0], "filename_prefix": "site_bust_crop"}},
    "cv": {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": "dino_v3_L_naf_fp32.safetensors"}},
    "cond": {"class_type": "Trellis2Conditioning", "inputs": {"clip_vision_model": ["cv", 0], "image": ["crop", 0]}},
    "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "trellis_2_bf16.safetensors", "weight_dtype": "default"}},
    "vshape": {"class_type": "VAELoader", "inputs": {"vae_name": "trellis_2_shape_vae_bf16.safetensors"}},
    "vtex": {"class_type": "VAELoader", "inputs": {"vae_name": "trellis_2_texture_vae_bf16.safetensors"}},
    # structure
    "m1a": {"class_type": "CFGOverride", "inputs": {"model": ["unet", 0], "cfg": 1, "start_percent": 0.667, "end_percent": 1}},
    "m1b": {"class_type": "RescaleCFG", "inputs": {"model": ["m1a", 0], "multiplier": 0.7}},
    "m1c": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["m1b", 0], "shift": 5}},
    "l0": {"class_type": "EmptyTrellis2LatentStructure", "inputs": {"batch_size": 1}},
    "k1": ks(["m1c", 0], 56, 12, 7.5, "normal", ["cond", 0], ["cond", 1], ["l0", 0]),
    "vox": {"class_type": "VaeDecodeStructureTrellis2", "inputs": {"samples": ["k1", 0], "vae": ["vshape", 0], "resolution": "32"}},
    # shape
    "s1": {"class_type": "Trellis2ShapeStage", "inputs": {"positive": ["cond", 0], "negative": ["cond", 1], "voxel": ["vox", 0]}},
    "m2a": {"class_type": "CFGOverride", "inputs": {"model": ["unet", 0], "cfg": 1, "start_percent": 0.769, "end_percent": 1}},
    "m2b": {"class_type": "RescaleCFG", "inputs": {"model": ["m2a", 0], "multiplier": 0.5}},
    "k2": ks(["m2b", 0], 42, 20, 7.5, "normal", ["s1", 0], ["s1", 1], ["s1", 2]),
    "s2": {"class_type": "Trellis2UpsampleStage", "inputs": {"positive": ["s1", 0], "negative": ["s1", 1], "shape_latent": ["k2", 0], "vae": ["vshape", 0], "target_resolution": 1536}},
    "k3": ks(["m2b", 0], 42, 12, 7.5, "simple", ["s2", 0], ["s2", 1], ["s2", 2]),
    "mesh": {"class_type": "VaeDecodeShapeTrellis", "inputs": {"samples": ["k3", 0], "vae": ["vshape", 0]}},
    # colour
    "s3": {"class_type": "Trellis2TextureStage", "inputs": {"positive": ["s2", 0], "negative": ["s2", 1], "shape_latent": ["k3", 0]}},
    "k4": ks(["unet", 0], 43, 12, 1, "normal", ["s3", 0], ["s3", 1], ["s3", 2]),
    "cols": {"class_type": "VaeDecodeTextureTrellis", "inputs": {"samples": ["k4", 0], "vae": ["vtex", 0], "shape_subdivides": ["mesh", 1]}},
    "dec": {"class_type": "DecimateMesh", "inputs": {"mesh": ["mesh", 0], "target_face_count": 500000, "placement_mode": "midpoint"}},
    "sm": {"class_type": "MeshSmoothNormals", "inputs": {"mesh": ["dec", 0], "crease_angle": 180}},
    "paint": {"class_type": "PaintMesh", "inputs": {"mesh": ["sm", 0], "voxel_colors": ["cols", 0]}},
    "save": {"class_type": "SaveGLB", "inputs": {"mesh": ["paint", 0], "filename_prefix": "3d/site_bust"}},
}
try:
    pid = post("/prompt", {"prompt": g})["prompt_id"]
except urllib.error.HTTPError as e:
    print(e.read().decode()[:4000]); sys.exit(1)
while True:
    hist = get("/history/" + pid)
    if pid in hist:
        break
    time.sleep(2)
entry = hist[pid]
if entry.get("status", {}).get("status_str") != "success":
    print(json.dumps(entry.get("status"))[:4000]); sys.exit(1)
print(json.dumps(entry["outputs"])[:1500])
for node, o in entry["outputs"].items():
    for key, items in o.items():
        for it in items if isinstance(items, list) else []:
            if isinstance(it, dict) and str(it.get("filename", "")).endswith(".glb"):
                q = urllib.parse.urlencode({"filename": it["filename"], "subfolder": it.get("subfolder", ""), "type": it.get("type", "output")})
                open(out, "wb").write(urllib.request.urlopen(HOST + "/view?" + q).read())
                print("wrote", out)
