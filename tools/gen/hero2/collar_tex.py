"""Collar texture cleanup (plain Python): the black piping / stand-collar rim of the scan is ragged ("fur"). Median filter only on texels of
triangles around the collar (not head skin / hair); everything else is bit-identical.
usage: python hero2/collar_tex.py <in.png> <out.png> [size=9] [blend=1.0]"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from face_lib import *
Image.MAX_IMAGE_PIXELS = None
inp, outp = sys.argv[1], sys.argv[2]
size = int(sys.argv[3].split('=')[1]) if len(sys.argv) > 3 else 9
N = 4096
P, UV, reg = load_mesh()
cen = P.mean(1)
sel = np.where((cen[:, 1] > 1.36) & (cen[:, 1] < 1.64) & (np.abs(cen[:, 0]) < 0.17) & (reg != 3) & (reg != 1) & (reg < 4) & ((reg != 2) | (cen[:, 1] < 1.54)))[0]
uvp = UV.copy(); uvp[..., 1] = 1 - uvp[..., 1]; uvp *= N
_, mk, _ = raster(uvp[sel], np.zeros((len(sel), 3, 1), np.float32), (N, N))
mk = ndi.binary_erosion(mk, iterations=1)       # keep chart borders / padding untouched
a = np.asarray(Image.open(inp).convert('RGB'))
med = np.stack([ndi.median_filter(a[..., c], size=size) for c in range(3)], -1)
o = a.copy(); o[mk] = med[mk]
print('texels', int(mk.sum()), 'changed', int((np.abs(o.astype(int) - a.astype(int)).max(-1) > 8).sum()))
np.save(os.path.join(os.path.dirname(os.path.abspath(outp)), 'collar_mask.npy'), mk)
Image.fromarray(o).save(outp)
