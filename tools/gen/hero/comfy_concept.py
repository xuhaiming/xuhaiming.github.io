"""Stage 1: full-body concept image of the hero through the local ComfyUI server.
FLUX 3 Klein (distilled) image edit, with the owner photo as identity reference.
The photo only ever goes to the local server at 127.0.0.1.
usage: comfy_concept.py <photo.png> <prompt.txt> <out.png> [seed] [width] [height] [crop x0,y0,x1,y1]"""
import json, sys, time, os, random, urllib.request, urllib.parse
from PIL import Image

HOST = "http://127.0.0.1:8188"
COMFY_INPUT = r"C:\projects\ComfyUI\input"

def post(path, data):
    req = urllib.request.Request(HOST + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))

def get(path):
    return json.load(urllib.request.urlopen(HOST + path))

photo, prompt_file, out = sys.argv[1:4]
seed = int(sys.argv[4]) if len(sys.argv) > 4 else random.randrange(2**48)
w = int(sys.argv[5]) if len(sys.argv) > 5 else 896
h = int(sys.argv[6]) if len(sys.argv) > 6 else 1344
img = Image.open(photo).convert("RGB")
if len(sys.argv) > 7:
    img = img.crop(tuple(int(v) for v in sys.argv[7].split(",")))
name = "site_hero_ref.png"
img.save(os.path.join(COMFY_INPUT, name))
prompt = open(prompt_file, encoding="utf-8").read().strip()

g = {
    "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux3-image-klein-int8-convrot.safetensors", "weight_dtype": "default"}},
    "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_4b_int8_convrot.safetensors", "type": "flux3", "device": "default"}},
    "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
    "ref": {"class_type": "LoadImage", "inputs": {"image": name}},
    "pos": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["clip", 0], "text": prompt}},
    "neg": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["pos", 0]}},
    "rml": {"class_type": "ReferenceMultiLatent", "inputs": {"positive": ["pos", 0], "negative": ["neg", 0], "vae": ["vae", 0],
            "resolution": "resize", "resolution.megapixels": 1.0, "images.image0": ["ref", 0]}},
    "lat": {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
    "ks": {"class_type": "KSampler", "inputs": {"model": ["unet", 0], "seed": seed, "steps": 16, "cfg": 1, "sampler_name": "euler", "scheduler": "simple",
           "positive": ["rml", 0], "negative": ["rml", 1], "latent_image": ["lat", 0], "denoise": 1}},
    "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["ks", 0], "vae": ["vae", 0]}},
    "save": {"class_type": "SaveImage", "inputs": {"images": ["dec", 0], "filename_prefix": "site_hero_concept"}},
}
try:
    pid = post("/prompt", {"prompt": g})["prompt_id"]
except urllib.error.HTTPError as e:
    print(e.read().decode()[:3000]); sys.exit(1)
while True:
    hist = get("/history/" + pid)
    if pid in hist:
        break
    time.sleep(1)
entry = hist[pid]
if entry.get("status", {}).get("status_str") != "success":
    print(json.dumps(entry.get("status"))[:3000]); sys.exit(1)
im = entry["outputs"]["save"]["images"][0]
q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im["subfolder"], "type": im["type"]})
open(out, "wb").write(urllib.request.urlopen(HOST + "/view?" + q).read())
json.dump({"prompt": prompt, "model": "flux3 klein distilled, image edit (local ComfyUI)", "seed": seed, "size": f"{w}x{h}"}, open(out + ".json", "w", encoding="utf-8"), indent=2)
print("wrote", out, "seed", seed)
