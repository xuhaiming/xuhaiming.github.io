"""Resize / convert an image into web formats, optionally cutting out the background first.
Run with the ComfyUI venv python (needs Pillow with WebP + AVIF; that one has both).

usage:
    web_image.py <in.png> --out <stem> [--widths 640,1280,1920] [--formats webp,avif,jpg]
                 [--quality 82] [--avif-quality 60] [--cutout] [--trim [--pad 0.04]] [--bg "#000000"]

Writes <stem>-<width>.<ext> for every width and format (widths larger than the source are skipped, the
source width is used instead; nothing is ever upscaled).
--cutout  remove the background with BiRefNet through the local ComfyUI server -> transparent layer.
          Also writes the full-size master <stem>-cutout.png. WebP and AVIF keep the alpha channel;
          JPG cannot, so it is flattened onto --bg.
--trim    crop to the non-transparent area (plus --pad as a fraction of the larger side) - for layers.
Input images that already have alpha are handled the same way without --cutout."""
import argparse, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageColor, features


def cutout(path, timeout):
    import comfy_api as api
    name = api.stage_image(path, lambda im: im.convert("RGB"))
    g = {
        "img": {"class_type": "LoadImage", "inputs": {"image": name}},
        "bgm": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}},
        "mask": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["bgm", 0], "image": ["img", 0]}},
        "inv": {"class_type": "InvertMask", "inputs": {"mask": ["mask", 0]}},
        "rgba": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["img", 0], "alpha": ["inv", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["rgba", 0], "filename_prefix": api.PREFIX + "_cutout"}},
    }
    try:
        outs = api.run(g, timeout=timeout, label="cutout birefnet")
    finally:
        api.cleanup_staged()
    return api.output_files(outs, "save")[0], api


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("--out", required=True, help="output path without extension, e.g. public/media/about-desk")
    ap.add_argument("--widths", default="640,1280,1920", help="comma-separated output widths in px")
    ap.add_argument("--formats", default="webp,jpg", help="comma-separated: webp, avif, jpg, png")
    ap.add_argument("--quality", type=int, default=82, help="WebP / JPG quality")
    ap.add_argument("--avif-quality", type=int, default=60)
    ap.add_argument("--cutout", action="store_true", help="remove the background (BiRefNet via ComfyUI)")
    ap.add_argument("--trim", action="store_true", help="crop to the opaque area")
    ap.add_argument("--pad", type=float, default=0.04, help="padding kept around a --trim crop, fraction of the larger side")
    ap.add_argument("--bg", default="#000000", help="colour used behind transparency for JPG output")
    ap.add_argument("--timeout", type=int, default=600, help="seconds to wait for the cut-out job")
    a = ap.parse_args()
    if not os.path.isfile(a.src):
        sys.exit(f"error: not found: {a.src}")
    formats = [f.strip().lower().replace("jpeg", "jpg") for f in a.formats.split(",") if f.strip()]
    for f in formats:
        if f not in ("webp", "avif", "jpg", "png"):
            sys.exit(f"error: unknown format {f}")
        if f in ("webp", "avif") and not features.check(f):
            sys.exit(f"error: this Pillow has no {f} support; run with C:\\projects\\ComfyUI\\.venv\\Scripts\\python.exe")
    widths = sorted({int(w) for w in a.widths.split(",") if w.strip()})
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)

    if a.cutout:
        desc, api = cutout(a.src, a.timeout)
        master = a.out + "-cutout.png"
        api.download(desc, master)
        im = Image.open(master)
        print("wrote", master)
    else:
        im = Image.open(a.src)
    im.load()
    has_alpha = im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info
    im = im.convert("RGBA" if has_alpha else "RGB")
    if has_alpha and im.getchannel("A").getextrema()[0] == 255:
        im, has_alpha = im.convert("RGB"), False
    if a.trim:
        if not has_alpha:
            sys.exit("error: --trim needs transparency (use --cutout or an RGBA input)")
        box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        if not box:
            sys.exit("error: the image is fully transparent after the cut-out")
        p = int(round(max(box[2] - box[0], box[3] - box[1]) * a.pad))
        im = im.crop((max(0, box[0] - p), max(0, box[1] - p), min(im.width, box[2] + p), min(im.height, box[3] + p)))
        if a.cutout:
            im.save(a.out + "-cutout.png")
    print(f"source {im.width}x{im.height} {'with alpha' if has_alpha else 'opaque'}")

    widths = sorted({min(w, im.width) for w in widths})
    for w in widths:
        h = max(1, round(im.height * w / im.width))
        r = im if w == im.width else im.resize((w, h), Image.LANCZOS)
        for f in formats:
            dest = f"{a.out}-{w}.{f}"
            if f == "webp":
                r.save(dest, "WEBP", quality=a.quality, method=6, exact=False)
            elif f == "avif":
                r.save(dest, "AVIF", quality=a.avif_quality, speed=4)
            elif f == "png":
                r.save(dest, "PNG", optimize=True)
            else:
                flat = r
                if has_alpha:
                    flat = Image.new("RGB", r.size, ImageColor.getrgb(a.bg)); flat.paste(r, mask=r.getchannel("A"))
                flat.save(dest, "JPEG", quality=a.quality, optimize=True, progressive=True)
            print(f"wrote {dest} {w}x{h} {os.path.getsize(dest) / 1024:.0f} KB")


main()
