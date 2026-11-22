# Haiming Pages

Personal site of Xu Haiming. One page, one persistent WebGL scene.

## Run

```
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check, then build to dist/
```

Add `?shot` to the URL to skip the intro and show every section at once, for screenshots.

## How it is put together

- `index.html` holds all the copy, so the page reads without WebGL.
- `src/main.ts` maps scroll position to a "view" of the scene (where the core sits, how close the camera is, which node comes forward) and runs the intro and reveals.
- `src/scene/Stage.ts` is the scene: the core, glass shells, rings, orbiting nodes, dust, the portrait point cloud and the post-processing chain.
- `src/scene/shaders.ts` is the GLSL.
- `src/agent.ts` is the "Ask the site" demo. It is scripted; no model is called.

The scene picks one of three quality levels from the device, and steps down if early frames run long. With `prefers-reduced-motion` the scroll is native and the scene nearly holds still.

## Generated assets

Made locally, scripts in `tools/gen/`:

- `comfy_t2i.py`: layout studies with Qwen Image through ComfyUI.
- `comfy_bust.py`: photo to 3D bust with Trellis 2 through ComfyUI.
- `glb_to_points.py`: Blender script that samples the bust into `public/assets/bust.bin` (Int16 x, y, z, light).
