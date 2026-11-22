"""Shared helpers for the comfy_*.py scripts (stdlib only, PIL optional).
Talks to the already-running local ComfyUI server. Never clears the queue; on timeout or Ctrl-C it
removes / interrupts only the job this process submitted."""
import json, os, shutil, sys, time, uuid, urllib.request, urllib.parse, urllib.error

HOST = os.environ.get("COMFY_HOST", "http://127.0.0.1:8188")
COMFY_INPUT = os.environ.get("COMFY_INPUT", r"C:\projects\ComfyUI\input")
PREFIX = "site_gen"  # every file we put in ComfyUI's input/output dirs starts with this


def post(path, data):
    req = urllib.request.Request(HOST + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
    return json.loads(body) if body.strip() else {}


def get(path):
    with urllib.request.urlopen(HOST + path, timeout=60) as r:
        return json.load(r)


def read_prompt(arg):
    """A prompt argument is either literal text or the path of a UTF-8 text file."""
    if arg and len(arg) < 260 and os.path.isfile(arg):
        return open(arg, encoding="utf-8").read().strip()
    return arg.strip()


def stage_image(path, prepare=None):
    """Copy an image into ComfyUI's input dir under a unique name and return that name.
    prepare: optional callable(PIL.Image) -> PIL.Image applied first (saved as PNG)."""
    if not os.path.isfile(path):
        sys.exit(f"error: input image not found: {path}")
    uid = uuid.uuid4().hex[:8]
    if prepare is None:
        name = f"{PREFIX}_{uid}{os.path.splitext(path)[1].lower() or '.png'}"
        shutil.copyfile(path, os.path.join(COMFY_INPUT, name))
    else:
        from PIL import Image
        name = f"{PREFIX}_{uid}.png"
        prepare(Image.open(path)).save(os.path.join(COMFY_INPUT, name))
    _staged.append(name)
    return name


_staged = []


def cleanup_staged():
    for name in _staged:
        try:
            os.remove(os.path.join(COMFY_INPUT, name))
        except OSError:
            pass
    _staged.clear()


def _cancel(pid):
    """Drop our own job: remove it if still pending, interrupt it only if it is the one running."""
    try:
        post("/queue", {"delete": [pid]})
        q = get("/queue")
        if any(item[1] == pid for item in q.get("queue_running", [])):
            post("/interrupt", {"prompt_id": pid})
    except Exception as e:  # noqa
        print("warning: could not cancel job:", e)


def run(graph, timeout=600, label="job", poll=2.0):
    """Submit an API-format graph, wait for it, return the history entry's outputs dict.
    Prints queue position / elapsed time. Exits the process with a message on any failure."""
    try:
        pid = post("/prompt", {"prompt": graph, "client_id": PREFIX})["prompt_id"]
    except urllib.error.HTTPError as e:
        cleanup_staged()
        sys.exit(f"error: ComfyUI rejected the {label} graph:\n" + e.read().decode(errors="replace")[:4000])
    except urllib.error.URLError as e:
        cleanup_staged()
        sys.exit(f"error: cannot reach ComfyUI at {HOST} ({e.reason}). It must already be running.")
    t0 = time.time(); started = None; last = 0.0
    print(f"[{label}] queued {pid}", flush=True)
    try:
        while True:
            hist = get("/history/" + pid)
            if pid in hist:
                break
            now = time.time()
            if now - t0 > timeout:
                _cancel(pid); cleanup_staged()
                sys.exit(f"error: {label} timed out after {timeout}s (job cancelled). Raise --timeout if the queue is busy.")
            if now - last >= 10:
                last = now
                q = get("/queue")
                if any(item[1] == pid for item in q.get("queue_running", [])):
                    started = started or now
                    print(f"[{label}] running {now - started:.0f}s (total wait {now - t0:.0f}s)", flush=True)
                else:
                    ahead = sum(1 for item in q.get("queue_pending", []) if item[1] != pid and item[0] < next((i[0] for i in q.get("queue_pending", []) if i[1] == pid), 1e18))
                    ahead += len(q.get("queue_running", []))
                    print(f"[{label}] waiting in queue, {ahead} job(s) ahead ({now - t0:.0f}s)", flush=True)
            time.sleep(poll)
    except KeyboardInterrupt:
        _cancel(pid); cleanup_staged()
        sys.exit("interrupted (job cancelled)")
    entry = hist[pid]
    status = entry.get("status", {})
    if status.get("status_str") != "success":
        cleanup_staged()
        msgs = [m for m in status.get("messages", []) if m and m[0] in ("execution_error", "execution_interrupted")]
        detail = json.dumps(msgs or status, indent=1)[:4000]
        sys.exit(f"error: {label} failed in ComfyUI:\n{detail}")
    # execution time as measured by the server (excludes queue wait)
    ts = {m[0]: m[1].get("timestamp") for m in status.get("messages", []) if isinstance(m, list) and len(m) > 1 and isinstance(m[1], dict)}
    exec_s = (ts["execution_success"] - ts["execution_start"]) / 1000 if ts.get("execution_success") and ts.get("execution_start") else None
    print(f"[{label}] done: {exec_s:.1f}s on GPU, {time.time() - t0:.1f}s including queue" if exec_s else f"[{label}] done in {time.time() - t0:.1f}s", flush=True)
    return entry.get("outputs", {})


def output_files(outputs, node=None, exts=None):
    """List of file descriptors ({filename, subfolder, type}) in a history outputs dict."""
    found = []
    for nid, o in outputs.items():
        if node is not None and nid != node:
            continue
        for items in o.values():
            for it in items if isinstance(items, list) else []:
                if isinstance(it, dict) and "filename" in it:
                    if exts is None or os.path.splitext(it["filename"])[1].lower() in exts:
                        found.append(it)
    return found


def download(desc, dest):
    q = urllib.parse.urlencode({"filename": desc["filename"], "subfolder": desc.get("subfolder", ""), "type": desc.get("type", "output")})
    os.makedirs(os.path.dirname(os.path.abspath(dest)) or ".", exist_ok=True)
    with urllib.request.urlopen(HOST + "/view?" + q, timeout=300) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    return dest


def sidecar(dest, **meta):
    """Write <dest>.json describing how the asset was made (prompt, model, seed...)."""
    with open(dest + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def snap(v, m):
    return max(m, int(round(v / m)) * m)
