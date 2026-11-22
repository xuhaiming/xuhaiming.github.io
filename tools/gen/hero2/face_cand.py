"""Round 2 candidates: beautify the v2 front render crop with Klein (local ComfyUI) and Qwen Image Edit 2.1.
python face_cand.py            -> face/w3/cand_<name>.png + face/w3/cand_sheet.jpg"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
from face_edit import edit
BOX = [380, 450, 1680, 1750]
HANDSOME = ("Professional portrait retouch of this same man into his most handsome, refined version while staying clearly recognisable as the same person: "
 "identical face shape, identical eye shape and openness, nose, ears, mouth position and hairline. Well-groomed, slightly thicker, cleaner eyebrows with a confident shape; "
 "bright clear eyes with defined eyelids and lashes, natural off-white sclera, deep dark brown irises with fine detail; clean healthy even warm skin with natural fine texture, "
 "no dark circles, no redness, softened under-eye bags and nasolabial folds; subtle sculpted cheekbones, jaw and nose bridge by very soft tone only; "
 "defined natural lips with a soft confident slight closed-mouth smile; light tidy stubble shadow; neat short black hair. "
 "Flat even soft lighting, no cast shadows, no specular highlights, no makeup look.")
def qwen(inp, out, seed, denoise, prompt, steps=8, size=1024):
    im = Image.open(inp).convert("RGB").resize((size, size), Image.LANCZOS); name = "face_in_q.png"; im.save(os.path.join(COMFY_INPUT, name))
    g = {
     "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_2.1_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
     "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_8b_int8_convrot.safetensors", "type": "qwen_image", "device": "default"}},
     "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"}},
     "img": {"class_type": "LoadImage", "inputs": {"image": name}},
     "enc": {"class_type": "TextEncodeQwenImage21", "inputs": {"clip": ["clip", 0], "prompt": prompt, "negative_prompt": "", "resolution": size, "vae": ["vae", 0], "images.image_1": ["img", 0]}},
     "lat": {"class_type": "VAEEncode", "inputs": {"pixels": ["img", 0], "vae": ["vae", 0]}},
     "ks": {"class_type": "KSampler", "inputs": {"model": ["unet", 0], "seed": seed, "steps": steps, "cfg": 1, "sampler_name": "euler", "scheduler": "simple",
            "positive": ["enc", 0], "negative": ["enc", 1], "latent_image": ["lat" if denoise < 1 else "enc", 0 if denoise < 1 else 2], "denoise": denoise}},
     "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["ks", 0], "vae": ["vae", 0]}},
     "save": {"class_type": "SaveImage", "inputs": {"images": ["dec", 0], "filename_prefix": "face_q"}}}
    r = run_graph(g, "save"); r.save(out); return r
if __name__ == "__main__":
    v2 = np.asarray(Image.open(os.path.join(F, "w3", "front_v2r.png")).convert("RGB"))
    crop = os.path.join(F, "w3", "crop_v2.png"); Image.fromarray(v2[BOX[1]:BOX[3], BOX[0]:BOX[2]]).save(crop)
    which = sys.argv[1:] or ["k3", "k5", "k8", "q1", "q2"]
    outs = []
    for w in which:
        o = os.path.join(F, "w3", f"cand_{w}.png"); outs.append(o)
        if os.path.exists(o): continue
        seed = int(w[1:].split("_")[0]); dn = float(w.split("_")[1]) if "_" in w else (0.7 if w[0] == "k" else 0.65)
        print(w, seed, dn, flush=True)
        (edit(crop, o, seed, dn, HANDSOME, 16, 1280) if w[0] == "k" else qwen(crop, o, seed, dn, HANDSOME))
BACK = ("Professional retouch of this same man's head seen from behind and the side: identical shape, ears, neck and hairline in exactly the same positions. "
 "Clean healthy even warm skin on the ears and the neck with natural fine skin texture, no redness, no blotches, neat short natural black hair with fine individual strands. "
 "Flat even soft lighting, no cast shadows, no specular highlights.")
