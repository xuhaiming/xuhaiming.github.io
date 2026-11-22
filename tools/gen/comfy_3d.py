"""Image -> textured 3D prop (GLB) through the local ComfyUI server (Trellis 2 or Pixal3D).

usage:
    comfy_3d.py <image> <out.glb> [--model {trellis,pixal3d}] [--faces 30000] [--tex-size 2048]
                [--vertex-colors] [--use-alpha] [--crop x0,y0,x1,y1] [--upscale] [--seed N]

The background is removed with BiRefNet (or taken from the image's own alpha with --use-alpha), the
object is cropped to a 1024 square, and the mesh is generated in three stages (structure, shape,
colour). Default output: a low-poly mesh (--faces) with UVs and baked base colour / metallic-roughness /
normal / AO textures (--tex-size). --vertex-colors skips UVs and textures and writes vertex colours
instead (use a high --faces then, e.g. 300000; that is what glb_to_points.py wants).
Also writes <out>.crop.png (what the model actually saw - check it first when a result looks wrong)
and a sidecar <out>.json."""
import argparse, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comfy_api as api


def ks(model, seed, steps, cfg, sched, src):
    return {"class_type": "KSampler", "inputs": {"model": model, "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler", "scheduler": sched,
                                                 "positive": [src, 0], "negative": [src, 1], "latent_image": [src, 2], "denoise": 1}}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image"); ap.add_argument("out")
    ap.add_argument("--model", choices=["trellis", "pixal3d"], default="trellis")
    ap.add_argument("--faces", type=int, default=30000, help="target triangle count of the exported mesh")
    ap.add_argument("--tex-size", type=int, default=2048, help="baked texture size in px (512-4096)")
    ap.add_argument("--vertex-colors", action="store_true", help="no UVs/textures; colour per vertex")
    ap.add_argument("--no-normal-map", action="store_true", help="skip the normal + AO bakes (faster, smaller)")
    ap.add_argument("--use-alpha", action="store_true", help="input already has a transparent background: use its alpha instead of BiRefNet")
    ap.add_argument("--crop", help="x0,y0,x1,y1 crop applied to the input first")
    ap.add_argument("--upscale", action="store_true", help="4x upscale the input first (only for small/blurry photos; slow)")
    ap.add_argument("--fov", type=float, default=49.13, help="pixal3d only: horizontal field of view of the source photo, degrees")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--timeout", type=int, default=1800)
    a = ap.parse_args()

    def prep(im):
        if a.crop:
            im = im.crop(tuple(int(v) for v in a.crop.split(",")))
        return im if a.use_alpha else im.convert("RGB")
    name = api.stage_image(a.image, prep)
    tex = api.snap(min(max(a.tex_size, 512), 4096), 256)
    pix = a.model == "pixal3d"
    s = a.seed

    g = {
        "img": {"class_type": "LoadImage", "inputs": {"image": name}},
        "cv": {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": "dino_v3_L_naf_fp32.safetensors"}},
        "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "pixal3d_bf16.safetensors" if pix else "trellis_2_bf16.safetensors", "weight_dtype": "default"}},
        "vshape": {"class_type": "VAELoader", "inputs": {"vae_name": "trellis_2_shape_vae_bf16.safetensors"}},
        "vtex": {"class_type": "VAELoader", "inputs": {"vae_name": "trellis_2_texture_vae_bf16.safetensors"}},
    }
    src = ["img", 0]
    if a.upscale:
        g["upm"] = {"class_type": "UpscaleModelLoader", "inputs": {"model_name": "4xNomos8kHAT-L_otf.pth"}}
        g["up"] = {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["upm", 0], "image": src}}
        src = ["up", 0]
    if a.use_alpha:
        g["mask"] = {"class_type": "InvertMask", "inputs": {"mask": ["img", 1]}}  # LoadImage gives 1 - alpha
        if a.upscale:
            sys.exit("error: --upscale cannot be combined with --use-alpha")
    else:
        g["bgm"] = {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}}
        g["mask"] = {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["bgm", 0], "image": src}}
    g["crop"] = {"class_type": "ImageCropToMask", "inputs": {"images": src, "masks": ["mask", 0], "width": 1024, "height": 1024, "pad_factor": 1.1, "grow_mask": 0, "background": "#000000"}}
    g["prev"] = {"class_type": "SaveImage", "inputs": {"images": ["crop", 0], "filename_prefix": api.PREFIX + "_3d_crop"}}
    if pix:
        g["cond"] = {"class_type": "Pixal3DConditioning", "inputs": {"clip_vision_model": ["cv", 0], "image": ["crop", 0], "camera_angle_x": a.fov}}
    else:
        g["cond"] = {"class_type": "Trellis2Conditioning", "inputs": {"clip_vision_model": ["cv", 0], "image": ["crop", 0]}}
    g.update({
        # 1. coarse structure (CFG override + rescale reproduce the reference pipeline)
        "m1a": {"class_type": "CFGOverride", "inputs": {"model": ["unet", 0], "cfg": 1, "start_percent": 0.667, "end_percent": 1}},
        "m1b": {"class_type": "RescaleCFG", "inputs": {"model": ["m1a", 0], "multiplier": 0.7}},
        "m1c": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["m1b", 0], "shift": 5}},
        "l0": {"class_type": "EmptyTrellis2LatentStructure", "inputs": {"batch_size": 1}},
        "k1": {"class_type": "KSampler", "inputs": {"model": ["m1c", 0], "seed": s + 14, "steps": 12, "cfg": 7.5, "sampler_name": "euler", "scheduler": "normal",
                                                    "positive": ["cond", 0], "negative": ["cond", 1], "latent_image": ["l0", 0], "denoise": 1}},
        "vox": {"class_type": "VaeDecodeStructureTrellis2", "inputs": {"samples": ["k1", 0], "vae": ["vshape", 0], "resolution": "32"}},
        # 2. shape, then upsampled shape
        "s1": {"class_type": "Trellis2ShapeStage", "inputs": {"positive": ["cond", 0], "negative": ["cond", 1], "voxel": ["vox", 0]}},
        "m2a": {"class_type": "CFGOverride", "inputs": {"model": ["unet", 0], "cfg": 1, "start_percent": 0.769, "end_percent": 1}},
        "m2b": {"class_type": "RescaleCFG", "inputs": {"model": ["m2a", 0], "multiplier": 0.5}},
        "k2": ks(["m2b", 0], s, 20, 7.5, "normal", "s1"),
        "s2": {"class_type": "Trellis2UpsampleStage", "inputs": {"positive": ["s1", 0], "negative": ["s1", 1], "shape_latent": ["k2", 0], "vae": ["vshape", 0], "target_resolution": 1536}},
        "k3": ks(["m2b", 0], s, 12, 7.5, "simple", "s2"),
        "mesh": {"class_type": "VaeDecodeShapeTrellis", "inputs": {"samples": ["k3", 0], "vae": ["vshape", 0]}},
        # 3. colour
        "s3": {"class_type": "Trellis2TextureStage", "inputs": {"positive": ["s2", 0], "negative": ["s2", 1], "shape_latent": ["k3", 0]}},
        "k4": ks(["unet", 0], s + 1, 12, 1, "normal", "s3"),
        "cols": {"class_type": "VaeDecodeTextureTrellis", "inputs": {"samples": ["k4", 0], "vae": ["vtex", 0], "shape_subdivides": ["mesh", 1]}},
    })
    # watertight remesh of the raw (multi-million face, thin-shelled) mesh; decimating the raw mesh directly tears it
    g["remesh"] = {"class_type": "RemeshMesh", "inputs": {"mesh": ["mesh", 0], "resolution": 768, "sign_mode": "solid", "sign_mode.fill": 20.0, "sign_mode.qef": False,
                                                          "band": 1.0, "project_back": 0.0, "fix_poles": False, "smooth_iters": 20, "drop_small_components": 0.01,
                                                          "precluster_max_verts": 20000000}}
    g["dec"] = {"class_type": "DecimateMesh", "inputs": {"mesh": ["remesh", 0], "target_face_count": a.faces, "placement_mode": "midpoint"}}
    g["sm"] = {"class_type": "MeshSmoothNormals", "inputs": {"mesh": ["dec", 0], "crease_angle": 180}}
    if a.vertex_colors:
        g["final"] = {"class_type": "PaintMesh", "inputs": {"mesh": ["sm", 0], "voxel_colors": ["cols", 0]}}
    else:
        g.update({
            # UV unwrap the low-poly mesh, bake colour (and normal/AO from the dense remesh)
            "uv": {"class_type": "UnwrapMesh", "inputs": {"mesh": ["sm", 0], "segmenter": "pec", "resolution": tex, "padding": 1, "weld_distance": 0.0002}},
            "bake": {"class_type": "BakeTextureFromVoxel", "inputs": {"mesh": ["uv", 0], "voxel_colors": ["cols", 0], "reference_mesh": ["mesh", 0], "texture_size": tex}},
            "apply": {"class_type": "ApplyTextureToMesh", "inputs": {"mesh": ["uv", 0], "base_color": ["bake", 0], "metallic": ["bake", 1], "roughness": ["bake", 2]}},
            "final": {"class_type": "MeshSmoothNormals", "inputs": {"mesh": ["apply", 0], "crease_angle": 180}},
        })
        if not a.no_normal_map:
            g["nrm"] = {"class_type": "BakeNormalMapFromMesh", "inputs": {"low_poly": ["uv", 0], "high_poly": ["remesh", 0], "resolution": api.snap(min(tex, 2048), 64),
                                                                          "cage_distance": 0.05, "ignore_backfaces": True}}
            g["ao"] = {"class_type": "BakeAmbientOcclusion", "inputs": {"low_poly": ["uv", 0], "high_poly": ["remesh", 0], "resolution": 1024, "samples": 64,
                                                                        "max_distance": 0.71, "strength": 1.0, "bias": 0.01}}
            g["apply"]["inputs"]["normal_map"] = ["nrm", 0]
            g["apply"]["inputs"]["occlusion"] = ["ao", 0]
    g["save"] = {"class_type": "SaveGLB", "inputs": {"mesh": ["final", 0], "filename_prefix": "3d/" + api.PREFIX}}

    t0 = time.time()
    try:
        outs = api.run(g, timeout=a.timeout, label=f"3d {a.model}", poll=3)
    finally:
        api.cleanup_staged()
    glbs = api.output_files(outs, exts={".glb"})
    if not glbs:
        sys.exit("error: ComfyUI returned no GLB: " + str(outs)[:800])
    api.download(glbs[0], a.out)
    crops = api.output_files(outs, "prev")
    if crops:
        api.download(crops[0], a.out + ".crop.png")
    api.sidecar(a.out, source=os.path.basename(a.image), model=("pixal3d" if pix else "trellis_2") + " (local ComfyUI)", seed=s, faces=a.faces,
                textures=None if a.vertex_colors else tex, vertex_colors=a.vertex_colors, seconds=round(time.time() - t0, 1))
    print("wrote", a.out, f"({os.path.getsize(a.out) / 1e6:.1f} MB)")


main()
