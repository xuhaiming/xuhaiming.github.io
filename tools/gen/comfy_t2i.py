"""Text-to-image through the local ComfyUI server.

usage (original form, still works):
    comfy_t2i.py <prompt.txt | "prompt text"> <out.png> [width] [height] [seed]
usage (options):
    comfy_t2i.py "prompt" out.png --model {qwen,zimage,krea,klein} --w 1664 --h 928 --seed 7 --n 4

Writes <out.png> and a sidecar <out.png>.json holding the exact prompt, model, seed and size.
With --n N it writes out_01.png .. out_NN.png using seeds seed, seed+1, ..."""
import argparse, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comfy_api as api

MODELS = {
    "qwen": "qwen_image_2.1_turbo (8 steps)",
    "zimage": "z_image_turbo (8 steps)",
    "krea": "krea2_turbo (8 steps)",
    "klein": "flux3_image_klein distilled (15 steps)",
}


def graph(model, prompt, w, h, seed, negative=""):
    if model == "qwen":
        return {
            "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_2.1_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
            "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_8b_int8_convrot.safetensors", "type": "qwen_image", "device": "default"}},
            "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"}},
            "4": {"class_type": "TextEncodeQwenImage21", "inputs": {"clip": ["2", 0], "prompt": prompt, "negative_prompt": negative, "resolution": 1024, "images": {}}},
            "5": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
            "6": {"class_type": "QwenImage21Cache", "inputs": {"model": ["1", 0], "device": "auto", "dtype": "default"}},
            "7": {"class_type": "CFGGuider", "inputs": {"model": ["6", 0], "positive": ["4", 0], "negative": ["4", 1], "cfg": 1}},
            "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
            "9": {"class_type": "ManualSigmas", "inputs": {"sigmas": "1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0"}},
            "10": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
            "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["10", 0], "guider": ["7", 0], "sampler": ["8", 0], "sigmas": ["9", 0], "latent_image": ["5", 0]}},
            "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
            "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": api.PREFIX + "_t2i"}},
        }
    # the other three share one shape: loaders -> CLIPTextEncode -> KSampler (cfg 1, zeroed negative)
    cfg = {
        "zimage": dict(unet="z_image_turbo_bf16.safetensors", clip="qwen_3_4b.safetensors", ctype="lumina2", vae="zimage-ae.safetensors",
                       latent="EmptySD3LatentImage", steps=8, sampler="res_multistep", shift=3.0),
        "krea": dict(unet="krea2_turbo_fp8_scaled.safetensors", clip="qwen3vl_4b_fp8_scaled.safetensors", ctype="krea2", vae="qwen_image_vae.safetensors",
                     latent="EmptyLatentImage", steps=8, sampler="euler", shift=None),
        "klein": dict(unet="flux3-image-klein-int8-convrot.safetensors", clip="qwen3vl_4b_int8_convrot.safetensors", ctype="flux3", vae="flux2-vae.safetensors",
                      latent="EmptyFlux2LatentImage", steps=15, sampler="er_sde", shift=None),
    }[model]
    g = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": cfg["unet"], "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": cfg["clip"], "type": cfg["ctype"], "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": cfg["vae"]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "4n": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "5": {"class_type": cfg["latent"], "inputs": {"width": w, "height": h, "batch_size": 1}},
        "11": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": cfg["steps"], "cfg": 1, "sampler_name": cfg["sampler"], "scheduler": "simple",
                                                    "positive": ["4", 0], "negative": ["4n", 0], "latent_image": ["5", 0], "denoise": 1}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": api.PREFIX + "_t2i"}},
    }
    if cfg["shift"]:
        g["1s"] = {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": cfg["shift"]}}
        g["11"]["inputs"]["model"] = ["1s", 0]
    return g


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("prompt", help="prompt text, or path of a UTF-8 text file holding it")
    ap.add_argument("out", help="output PNG path")
    ap.add_argument("pos_w", nargs="?", type=int, help=argparse.SUPPRESS)
    ap.add_argument("pos_h", nargs="?", type=int, help=argparse.SUPPRESS)
    ap.add_argument("pos_seed", nargs="?", type=int, help=argparse.SUPPRESS)
    ap.add_argument("--model", choices=list(MODELS), default="qwen")
    ap.add_argument("--w", type=int, help="width (default 1664), snapped to a multiple of 16")
    ap.add_argument("--h", type=int, help="height (default 928), snapped to a multiple of 16")
    ap.add_argument("--seed", type=int, help="default random")
    ap.add_argument("--n", type=int, default=1, help="number of images (seeds seed..seed+n-1)")
    ap.add_argument("--negative", default="", help="negative prompt (qwen only; the others run at cfg 1 and ignore it)")
    ap.add_argument("--timeout", type=int, default=900, help="seconds to wait per image, queue time included")
    a = ap.parse_args()

    prompt = api.read_prompt(a.prompt)
    w = api.snap(a.w or a.pos_w or 1664, 16)
    h = api.snap(a.h or a.pos_h or 928, 16)
    seed = a.seed if a.seed is not None else a.pos_seed if a.pos_seed is not None else random.randrange(2**48)
    stem, ext = os.path.splitext(a.out)
    ext = ext or ".png"
    for i in range(a.n):
        s = seed + i
        dest = a.out if a.n == 1 else f"{stem}_{i + 1:02d}{ext}"
        t0 = time.time()
        outs = api.run(graph(a.model, prompt, w, h, s, a.negative), timeout=a.timeout, label=f"t2i {a.model}")
        api.download(api.output_files(outs, "13")[0], dest)
        api.sidecar(dest, prompt=prompt, model=MODELS[a.model] + " (local ComfyUI)", seed=s, size=f"{w}x{h}", seconds=round(time.time() - t0, 1))
        print("wrote", dest, "seed", s)


main()
