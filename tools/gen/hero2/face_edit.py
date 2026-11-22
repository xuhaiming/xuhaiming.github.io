"""Local ComfyUI FLUX 3 Klein img2img + reference edit of a flat face render (keeps layout via partial denoise).
python face_edit.py <in.png> <out.png> <seed> <denoise> "<prompt>" [steps] [size]"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
def edit(inp, out, seed, denoise, prompt, steps=16, size=None, ref=True):
    im = Image.open(inp).convert("RGB")
    if size: im = im.resize((size, size), Image.LANCZOS)
    name = "face_in.png"; im.save(os.path.join(COMFY_INPUT, name))
    g = {
     "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux3-image-klein-int8-convrot.safetensors", "weight_dtype": "default"}},
     "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_4b_int8_convrot.safetensors", "type": "flux3", "device": "default"}},
     "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
     "img": {"class_type": "LoadImage", "inputs": {"image": name}},
     "pos": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["clip", 0], "text": prompt}},
     "neg": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["pos", 0]}},
     "rml": {"class_type": "ReferenceMultiLatent", "inputs": {"positive": ["pos", 0], "negative": ["neg", 0], "vae": ["vae", 0],
             "resolution": "resize", "resolution.megapixels": 1.0, "images.image0": ["img", 0]}},
     "enc": {"class_type": "VAEEncode", "inputs": {"pixels": ["img", 0], "vae": ["vae", 0]}},
     "ks": {"class_type": "KSampler", "inputs": {"model": ["unet", 0], "seed": seed, "steps": steps, "cfg": 1, "sampler_name": "euler", "scheduler": "simple",
            "positive": ["rml" if ref else "pos", 0], "negative": ["rml" if ref else "neg", 1 if ref else 0], "latent_image": ["enc", 0], "denoise": denoise}},
     "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["ks", 0], "vae": ["vae", 0]}},
     "save": {"class_type": "SaveImage", "inputs": {"images": ["dec", 0], "filename_prefix": "face_edit"}},
    }
    r = run_graph(g, "save"); r.save(out); return r
if __name__ == "__main__":
    a = sys.argv
    edit(a[1], a[2], int(a[3]), float(a[4]), a[5], int(a[6]) if len(a) > 6 else 16, int(a[7]) if len(a) > 7 else None)
    print("ok")
