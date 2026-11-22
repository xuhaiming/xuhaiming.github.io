"""MiniMax H3 image-to-video and first/last-frame-to-video through the local ComfyUI server.
Silent MP4 out (the audio the model generates is never decoded).

usage:
    comfy_video.py --image first.png [--last last.png] --prompt "..." --out clip.mp4
                   [--seconds 4] [--res 768 | --w W --h H] [--seed N] [--lora {4step,8step,none}] [--raw]

--prompt / --prompt-file  Describe the motion and camera in plain English ("[Shot 1] ..." body).
        The script wraps it in the H3 prompt structure (keyframe instruction line +
        integrated_multimodal_description + silent soundscape/music fields). If your text already
        contains "integrated_multimodal_description:" it is sent untouched; --raw also sends it untouched.
--res   short edge in px (default 768, the model's native size; 480-544 is ~2.5x faster for drafts).
        The long edge follows the first image's aspect ratio, capped at 1344, both snapped to 32.
        The images are centre-cropped to that aspect, never stretched.
--seconds  2-15. Snapped up to the model's frame grid (17k+5 frames at 24 fps): 3 s -> 73 frames, 4 s -> 107, 5 s -> 124.
Writes <out> (H.264 MP4, 24 fps, no audio track) and a sidecar <out>.json with the exact prompt sent."""
import argparse, os, random, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comfy_api as api

LORAS = {
    "4step": ("minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors", 4),
    "8step": ("minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors", 8),
    "none": (None, 20),
}
FPS = 24


def frame_length(seconds):
    n = max(5, round(seconds * FPS))
    return n + (5 - n % 17) % 17


def wrap_prompt(text, has_last, duration):
    if "integrated_multimodal_description" in text:
        return text
    body = text if text.lstrip().startswith("[Shot") else "[Shot 1] " + text
    if has_last:
        head = ("How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; "
                f"Picture 2 (from Shot 1) aligns with the {duration:.2f}-second mark of the target video.")
    else:
        head = "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced."
    return f"{head}\n\nintegrated_multimodal_description: {body}\n\noverall_soundscape: N/A\n\nnon_diegetic_music: N/A"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", required=True, help="first frame")
    ap.add_argument("--last", help="optional last frame (first/last-frame mode)")
    ap.add_argument("--prompt", help="prompt text")
    ap.add_argument("--prompt-file", help="UTF-8 text file with the prompt")
    ap.add_argument("--out", required=True, help="output .mp4")
    ap.add_argument("--seconds", type=float, default=4.0)
    ap.add_argument("--res", type=int, default=768, help="short edge in px")
    ap.add_argument("--w", type=int); ap.add_argument("--h", type=int)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--lora", choices=list(LORAS), default="4step", help="turbo LoRA: 4step (default, fast), 8step (better motion/detail), none (20 steps, slow)")
    ap.add_argument("--steps", type=int, help="override the step count implied by --lora")
    ap.add_argument("--raw", action="store_true", help="send the prompt exactly as given")
    ap.add_argument("--timeout", type=int, default=1800, help="seconds, queue time included (default 30 min)")
    a = ap.parse_args()
    if not (a.prompt or a.prompt_file):
        sys.exit("error: give --prompt or --prompt-file")
    if not 1 <= a.seconds <= 15:
        sys.exit("error: --seconds must be between 1 and 15")
    if bool(a.w) != bool(a.h):
        sys.exit("error: give both --w and --h, or neither")
    text = open(a.prompt_file, encoding="utf-8").read().strip() if a.prompt_file else a.prompt.strip()

    from PIL import Image, ImageOps
    if a.w:
        w, h = api.snap(a.w, 32), api.snap(a.h, 32)
    else:
        iw, ih = Image.open(a.image).size
        short = api.snap(a.res, 32)
        long_ = min(api.snap(short * max(iw, ih) / min(iw, ih), 32), max(1344, short))
        w, h = (long_, short) if iw >= ih else (short, long_)
    fit = lambda im: ImageOps.fit(im.convert("RGB"), (w, h), Image.LANCZOS)
    first = api.stage_image(a.image, fit)
    last = api.stage_image(a.last, fit) if a.last else None

    length = frame_length(a.seconds)
    prompt = text if a.raw else wrap_prompt(text, bool(last), length / FPS)
    seed = a.seed if a.seed is not None else random.randrange(2**48)
    lora, steps = LORAS[a.lora]
    steps = a.steps or steps
    print(f"{w}x{h}, {length} frames ({length / FPS:.2f}s), {steps} steps, lora {a.lora}, seed {seed}")

    g = {
        "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "minimax_h3_fl2va_pruned_int8_convrot.safetensors", "weight_dtype": "default"}},
        "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "type": "minimax", "device": "default"}},
        "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"}},
        "first": {"class_type": "LoadImage", "inputs": {"image": first}},
        "cond": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {"clip": ["clip", 0], "vae": ["vae", 0], "prompt": prompt, "width": w, "height": h, "length": length,
                                                                   "first_frame": ["first", 0]}},
        "sched": {"class_type": "BasicScheduler", "inputs": {"model": ["unet", 0], "scheduler": "simple", "steps": steps, "denoise": 1}},
        "guide": {"class_type": "BasicGuider", "inputs": {"model": ["unet", 0], "conditioning": ["cond", 0]}},
        "samp": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "noise": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "ks": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["noise", 0], "guider": ["guide", 0], "sampler": ["samp", 0], "sigmas": ["sched", 0], "latent_image": ["cond", 1]}},
        "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["ks", 0], "vae": ["vae", 0]}},
        "vid": {"class_type": "CreateVideo", "inputs": {"images": ["dec", 0], "fps": FPS}},
        "save": {"class_type": "SaveVideo", "inputs": {"video": ["vid", 0], "filename_prefix": "video/" + api.PREFIX, "format": "mp4", "format.codec": "h264"}},
    }
    if last:
        g["last"] = {"class_type": "LoadImage", "inputs": {"image": last}}
        g["cond"]["inputs"]["last_frame"] = ["last", 0]
    if lora:
        g["lora"] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["unet", 0], "lora_name": lora, "strength_model": 1}}
        g["sched"]["inputs"]["model"] = ["lora", 0]
        g["guide"]["inputs"]["model"] = ["lora", 0]

    t0 = time.time()
    try:
        outs = api.run(g, timeout=a.timeout, label="video h3", poll=3)
    finally:
        api.cleanup_staged()
    files = api.output_files(outs, "save")
    if not files:
        sys.exit("error: ComfyUI returned no video file: " + str(outs)[:800])
    tmp = a.out + ".tmp.mp4"
    api.download(files[0], tmp)
    # Guarantee a silent, plain file whatever the server muxed (drop any audio stream; no re-encode).
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-map", "0:v:0", "-c", "copy", "-an", "-movflags", "+faststart", a.out])
    if r.returncode == 0:
        os.remove(tmp)
    else:
        os.replace(tmp, a.out)
        print("warning: ffmpeg remux failed; kept the file as ComfyUI wrote it")
    api.sidecar(a.out, prompt=prompt, user_prompt=text, model=f"minimax_h3 fl2va + turbo lora {a.lora} (local ComfyUI)", seed=seed, size=f"{w}x{h}",
                frames=length, fps=FPS, steps=steps, first=os.path.basename(a.image), last=os.path.basename(a.last) if a.last else None,
                seconds=round(time.time() - t0, 1))
    print("wrote", a.out)


main()
