"""Image edit / reference-guided generation with FLUX 3 Klein (distilled) through the local ComfyUI server.

usage:
    comfy_edit.py --image ref0.png [--image ref1.png] [--image ref2.png] --prompt "..." --out out.png
                  [--w W --h H] [--mp 1.0] [--seed N] [--n N] [--steps 16]

1-3 reference images + a prompt -> one image. In the prompt the references are <ref_image_0>,
<ref_image_1>, <ref_image_2> (in the order given). Write a full caption of the wanted result with
the change folded in, not a terse command.
Without --w/--h the output takes the size of the first reference scaled to --mp megapixels.
Writes <out> plus a sidecar <out>.json."""
import argparse, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comfy_api as api


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", action="append", required=True, help="reference image; repeat up to 3 times")
    ap.add_argument("--prompt", required=True, help="prompt text or path of a text file")
    ap.add_argument("--out", required=True)
    ap.add_argument("--w", type=int, help="output width (multiple of 16); default: follow first reference")
    ap.add_argument("--h", type=int, help="output height (multiple of 16)")
    ap.add_argument("--mp", type=float, default=1.0, help="megapixels each reference is scaled to (default 1.0)")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--n", type=int, default=1, help="number of variants (seeds seed..seed+n-1)")
    ap.add_argument("--steps", type=int, default=16)
    ap.add_argument("--timeout", type=int, default=900)
    a = ap.parse_args()
    if len(a.image) > 3:
        sys.exit("error: at most 3 reference images")
    if bool(a.w) != bool(a.h):
        sys.exit("error: give both --w and --h, or neither")

    prompt = api.read_prompt(a.prompt)
    seed = a.seed if a.seed is not None else random.randrange(2**48)
    names = [api.stage_image(p, lambda im: im.convert("RGB")) for p in a.image]
    stem, ext = os.path.splitext(a.out)
    try:
        for i in range(a.n):
            s = seed + i
            dest = a.out if a.n == 1 else f"{stem}_{i + 1:02d}{ext or '.png'}"
            g = {
                "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux3-image-klein-int8-convrot.safetensors", "weight_dtype": "default"}},
                "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_4b_int8_convrot.safetensors", "type": "flux3", "device": "default"}},
                "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
                "pos": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["clip", 0], "text": prompt}},
                "neg": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["pos", 0]}},
                "ref": {"class_type": "ReferenceMultiLatent", "inputs": {"positive": ["pos", 0], "negative": ["neg", 0], "vae": ["vae", 0],
                                                                         "resolution": "resize", "resolution.megapixels": a.mp}},
                "ks": {"class_type": "KSampler", "inputs": {"model": ["unet", 0], "seed": s, "steps": a.steps, "cfg": 1, "sampler_name": "euler", "scheduler": "simple",
                                                            "positive": ["ref", 0], "negative": ["ref", 1], "latent_image": ["ref", 2], "denoise": 1}},
                "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["ks", 0], "vae": ["vae", 0]}},
                "save": {"class_type": "SaveImage", "inputs": {"images": ["dec", 0], "filename_prefix": api.PREFIX + "_edit"}},
            }
            for k, name in enumerate(names):
                g[f"img{k}"] = {"class_type": "LoadImage", "inputs": {"image": name}}
                g["ref"]["inputs"][f"images.image{k}"] = [f"img{k}", 0]
            if a.w:
                g["lat"] = {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": api.snap(a.w, 16), "height": api.snap(a.h, 16), "batch_size": 1}}
                g["ks"]["inputs"]["latent_image"] = ["lat", 0]
            t0 = time.time()
            outs = api.run(g, timeout=a.timeout, label="edit klein")
            api.download(api.output_files(outs, "save")[0], dest)
            api.sidecar(dest, prompt=prompt, model="flux3_image_klein distilled edit (local ComfyUI)", seed=s, references=[os.path.basename(p) for p in a.image],
                        steps=a.steps, seconds=round(time.time() - t0, 1))
            print("wrote", dest, "seed", s)
    finally:
        api.cleanup_staged()


main()
