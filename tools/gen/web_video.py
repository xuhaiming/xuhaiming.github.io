"""Turn a generated clip into web assets with ffmpeg (stdlib only; any python).

usage:
    python web_video.py <in.mp4> --out <stem> [--crf 23] [--max-width 1280] [--webm {vp9,av1}] [--webm-crf N]
                        [--poster SECONDS | --no-poster] [--loop {crossfade,pingpong}] [--fade 0.5]
                        [--start S] [--end S] [--fps N] [--keyint N] [--frames N [--sheet] [--sheet-width 480] [--cols C]]

Writes, next to each other:
    <stem>.mp4          H.264 high, yuv420p, +faststart, no audio            (always)
    <stem>.webm         VP9 or AV1, no audio                                 (--webm)
    <stem>.jpg          poster frame taken at --poster seconds (default 0)   (unless --no-poster)
    <stem>-sheet.webp   N frames tiled into one sprite sheet + <stem>-sheet.json (cols, rows, frame size, count)   (--frames N --sheet)
    <stem>-frames/0001.webp ...   N separate frames                          (--frames N without --sheet)

--loop crossfade  seamless loop: the last --fade seconds are cross-faded into the first --fade seconds,
                  so the result is --fade seconds shorter than the input and its last frame flows into its first.
--loop pingpong   plays forward then backward (twice as long; only looks right for motion that reads the same reversed).
--keyint N        keyframe interval in frames; use 1 (all-intra, bigger file) for a video scrubbed by scroll position.
Poster, WebM and the sprite sheet are all made from the processed (trimmed / looped / scaled) clip."""
import argparse, json, math, os, subprocess, sys


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if p.returncode != 0:
        sys.exit("error: ffmpeg failed:\n  " + " ".join(cmd) + "\n" + p.stderr[-3000:])
    return p.stdout


def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
               "stream=width,height,r_frame_rate,nb_read_frames", "-of", "json", path])
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return dict(w=int(s["width"]), h=int(s["height"]), fps=float(num) / float(den), frames=int(s["nb_read_frames"]))


def size(path):
    return f"{os.path.getsize(path) / 1024:.0f} KB"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("--out", required=True, help="output path without extension, e.g. public/media/hero-loop")
    ap.add_argument("--crf", type=int, default=23, help="H.264 quality, lower = better (18 visually lossless, 23 default, 28 small)")
    ap.add_argument("--max-width", type=int, default=1280, help="downscale to at most this width (never upscales)")
    ap.add_argument("--webm", choices=["vp9", "av1"])
    ap.add_argument("--webm-crf", type=int, help="default 33 for vp9, 36 for av1")
    ap.add_argument("--poster", type=float, default=0.0, help="time in seconds of the poster frame in the processed clip")
    ap.add_argument("--no-poster", action="store_true")
    ap.add_argument("--loop", choices=["crossfade", "pingpong"])
    ap.add_argument("--fade", type=float, default=0.5, help="cross-fade length in seconds for --loop crossfade")
    ap.add_argument("--start", type=float, help="trim: start time in seconds")
    ap.add_argument("--end", type=float, help="trim: end time in seconds")
    ap.add_argument("--fps", type=float, help="resample to this frame rate")
    ap.add_argument("--keyint", type=int, help="keyframe interval in frames (1 = all-intra, for scroll scrubbing)")
    ap.add_argument("--frames", type=int, help="export N evenly spaced frames")
    ap.add_argument("--sheet", action="store_true", help="with --frames: tile them into one WebP sprite sheet")
    ap.add_argument("--sheet-width", type=int, default=480, help="width of one frame in the sheet / frame export")
    ap.add_argument("--cols", type=int, help="sprite sheet columns (default: near-square)")
    ap.add_argument("--sheet-quality", type=int, default=80)
    a = ap.parse_args()
    if not os.path.isfile(a.src):
        sys.exit(f"error: not found: {a.src}")
    if a.sheet and not a.frames:
        sys.exit("error: --sheet needs --frames N")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    ff = ["ffmpeg", "-y", "-v", "error"]

    # 1. master: trim -> fps -> loop -> scale, stored losslessly so every output derives from the same frames
    info = probe(a.src)
    fps = a.fps or info["fps"]
    pre = []
    if a.start is not None or a.end is not None:
        t = ["start=%g" % a.start] if a.start is not None else []
        t += ["end=%g" % a.end] if a.end is not None else []
        pre.append("trim=" + ":".join(t)); pre.append("setpts=PTS-STARTPTS")
    pre.append(f"fps={fps:g}")
    master = a.out + ".master.tmp.mkv"
    lossless = ["-an", "-c:v", "ffv1", "-pix_fmt", "yuv444p"]
    scale = f"scale=w='trunc(min({a.max_width},iw)/2)*2':h=-2:flags=lanczos"
    if a.loop:
        # frame-exact work needs the trimmed/resampled clip first
        stage = a.out + ".stage.tmp.mkv"
        run(ff + ["-i", a.src, "-vf", ",".join(pre)] + lossless + [stage])
        n = probe(stage)["frames"]
        if a.loop == "crossfade":
            f = int(round(a.fade * fps))
            if f < 1 or n < 3 * f:
                os.remove(stage)
                sys.exit(f"error: clip too short ({n} frames) for a {a.fade}s cross-fade; use a smaller --fade")
            norm = f"setpts=PTS-STARTPTS,fps={fps:g},settb=AVTB,format=yuv444p"
            fc = (f"[0:v]split=3[a][b][c];"
                  f"[a]trim=start_frame={f}:end_frame={n - f},{norm}[body];"
                  f"[b]trim=start_frame={n - f}:end_frame={n},{norm}[tail];"
                  f"[c]trim=start_frame=0:end_frame={f},{norm}[head];"
                  f"[tail][head]xfade=transition=fade:duration={f / fps:.6f}:offset=0,{norm}[x];"
                  f"[body][x]concat=n=2:v=1:a=0,{scale}[v]")
        else:
            if n < 3:
                os.remove(stage); sys.exit("error: clip too short for a ping-pong loop")
            fc = (f"[0:v]split=2[a][b];[b]reverse,trim=start_frame=1:end_frame={n - 1},setpts=PTS-STARTPTS[r];"
                  f"[a][r]concat=n=2:v=1:a=0,{scale}[v]")
        run(ff + ["-i", stage, "-filter_complex", fc, "-map", "[v]"] + lossless + [master])
        os.remove(stage)
    else:
        run(ff + ["-i", a.src, "-vf", ",".join(pre + [scale])] + lossless + [master])
    m = probe(master)
    dur = m["frames"] / m["fps"]
    print(f"source {info['w']}x{info['h']} {info['frames']} frames @ {info['fps']:g} fps -> {m['w']}x{m['h']} {m['frames']} frames ({dur:.2f}s)"
          + (f", loop: {a.loop}" if a.loop else ""))

    try:
        # 2. MP4
        mp4 = a.out + ".mp4"
        gop = ["-g", str(a.keyint), "-keyint_min", str(a.keyint)] if a.keyint else []
        run(ff + ["-i", master, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf), "-pix_fmt", "yuv420p", "-profile:v", "high"]
            + gop + ["-movflags", "+faststart", mp4])
        print("wrote", mp4, size(mp4))
        # 3. WebM
        if a.webm:
            webm = a.out + ".webm"
            if a.webm == "vp9":
                enc = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(a.webm_crf or 33), "-row-mt", "1", "-deadline", "good", "-cpu-used", "2"]
            else:
                enc = ["-c:v", "libsvtav1", "-crf", str(a.webm_crf or 36), "-preset", "6"]
            run(ff + ["-i", master, "-an"] + enc + ["-pix_fmt", "yuv420p"] + gop + [webm])
            print("wrote", webm, size(webm))
        # 4. poster
        if not a.no_poster:
            jpg = a.out + ".jpg"
            idx = min(max(int(round(a.poster * m["fps"])), 0), m["frames"] - 1)
            run(ff + ["-i", master, "-vf", f"select='eq(n,{idx})'", "-frames:v", "1", "-update", "1", "-q:v", "3", "-pix_fmt", "yuvj420p", jpg])
            print("wrote", jpg, size(jpg), f"(frame {idx})")
        # 5. frames / sprite sheet
        if a.frames:
            count = min(a.frames, m["frames"])
            idxs = [min(m["frames"] - 1, (i * m["frames"]) // count) for i in range(count)]
            fw = min(a.sheet_width, m["w"]); fw -= fw % 2
            fh = int(round(fw * m["h"] / m["w"] / 2)) * 2
            sel = "select='" + "+".join(f"eq(n,{i})" for i in idxs) + f"',scale={fw}:{fh}:flags=lanczos"
            if a.sheet:
                cols = a.cols or math.ceil(math.sqrt(count * fh / fw))
                rows = math.ceil(count / cols)
                if cols * fw > 16383 or rows * fh > 16383:
                    sys.exit(f"error: sheet would be {cols * fw}x{rows * fh}px; WebP allows 16383 per side. Lower --frames or --sheet-width.")
                sheet = a.out + "-sheet.webp"
                run(ff + ["-i", master, "-vf", f"{sel},tile={cols}x{rows}", "-frames:v", "1", "-update", "1", "-c:v", "libwebp",
                          "-quality", str(a.sheet_quality), "-compression_level", "6", sheet])
                meta = dict(image=os.path.basename(sheet), frames=count, cols=cols, rows=rows, frameWidth=fw, frameHeight=fh,
                            width=cols * fw, height=rows * fh, sourceFrames=idxs, duration=round(dur, 3))
                with open(a.out + "-sheet.json", "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2)
                print("wrote", sheet, size(sheet), f"{count} frames, {cols}x{rows} grid of {fw}x{fh} (+ {os.path.basename(a.out)}-sheet.json)")
            else:
                d = a.out + "-frames"
                os.makedirs(d, exist_ok=True)
                run(ff + ["-i", master, "-vf", sel, "-fps_mode", "vfr", "-c:v", "libwebp", "-quality", str(a.sheet_quality), os.path.join(d, "%04d.webp")])
                print("wrote", d, f"{count} frames of {fw}x{fh}")
    finally:
        if os.path.exists(master):
            os.remove(master)


main()
