"""Run: python3 scripts/make_embroidery.py site/public/brand/lockup-dark.png brand/embroidery  (needs: pip install pyembroidery numpy scipy pillow)

Turn The Creatiste Catering logo into machine embroidery (DST), with a stitch preview.

Gold areas and ivory areas each become a tatami fill (0.4 mm rows, up to 3.5 mm stitches, staggered so no lines show), laid
over a sparse vertical underlay, with a little pull compensation, a minimum stitch width so the fine serifs survive, tie-ins,
tie-offs and trims between separate shapes, and one colour stop (gold first, then ivory)."""
import math, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
import pyembroidery as pe

PX = 20                    # working resolution: pixels per mm
ROW = 0.4                  # top fill row spacing, mm
STITCH = 3.5               # longest top fill stitch, mm
MIN_W = 0.7                # thinnest stitched width, mm (hairlines are widened to this)
PULL = 0.12                # pull compensation, mm (shapes grow this much each side)
U_ROW, U_STITCH, U_INSET = 1.6, 3.0, 0.35   # underlay
TRAVEL_MAX = 6.0           # longest hidden travel stitch run inside a shape, mm
GOLD, IVORY = (0xBF, 0xA9, 0x87), (0xFF, 0xFB, 0xF5)


def disk(r_px):
    r = max(1, int(round(r_px)))
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def load_layers(src, crop=None):
    """Gold and ivory coverage (0..255) from the logo PNG (un-premultiplied colour + alpha), cropped to the artwork."""
    a = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
    if crop:
        x0, y0, x1, y1 = crop
        a = a[y0:y1, x0:x1]
    r, b, al = a[..., 0], a[..., 2], a[..., 3]
    goldhue = (r - b) > 40
    gold = np.where(goldhue, al, 0)
    ivory = np.where(~goldhue, al, 0)
    ys, xs = np.nonzero(al > 64)
    sl = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    return gold[sl], ivory[sl]


def to_mask(layer, width_px, height_px):
    im = Image.fromarray(layer.astype(np.float32), mode='F').resize((width_px, height_px), Image.BILINEAR)
    return np.array(im) > 127


def runs_of(line):
    d = np.diff(np.concatenate([[0], line.astype(np.int8), [0]]))
    return list(zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]))   # [start, end)


def scan_blocks(mask, spacing_px):
    """Split a shape into blocks a single zig-zag can cover: consecutive scan rows with one run each, overlapping the last."""
    H = mask.shape[0]
    done, active = [], []
    for y in np.arange(spacing_px / 2, H, spacing_px):
        yi = min(H - 1, int(round(y)))
        runs = runs_of(mask[yi])
        ov = [[i for i, blk in enumerate(active) if s <= blk[-1][2] and e - 1 >= blk[-1][1]] for s, e in runs]
        per_block = {i: sum(1 for o in ov if i in o) for i in range(len(active))}
        nxt, used = [], set()
        for (s, e), o in zip(runs, ov):
            if len(o) == 1 and per_block[o[0]] == 1:
                active[o[0]].append((float(y), float(s), float(e)))
                nxt.append(active[o[0]]); used.add(o[0])
            else:
                nxt.append([(float(y), float(s), float(e))])
        done += [blk for i, blk in enumerate(active) if i not in used]
        active = nxt
    return done + active


def row_points(y, x0, x1, row_idx, step, min_w, go_right):
    """Stitch points along one row (mm), staggered by row so needle holes don't line up."""
    if x1 - x0 < min_w:
        c = (x0 + x1) / 2
        x0, x1 = c - min_w / 2, c + min_w / 2
    off = (row_idx % 3) * step / 3
    inner = [x for x in np.arange(off + math.floor(x0 / step) * step, x1, step) if x0 + 0.6 < x < x1 - 0.6]
    xs = [x0] + inner + [x1]
    if not go_right:
        xs = xs[::-1]
    return [(x, y) for x in xs]


def block_paths(block, step, min_w, row_mm, transpose=False):
    """The four ways to sew a block (start top or bottom, first row left or right), as point lists in mm."""
    rows = [(y / PX, x0 / PX, x1 / PX) for y, x0, x1 in block]
    out = []
    for rev in (False, True):
        seq = rows[::-1] if rev else rows
        for first_right in (True, False):
            pts = []
            for k, (y, x0, x1) in enumerate(seq):
                pts += row_points(y, x0, x1, int(round(y / row_mm)), step, min_w, first_right if k % 2 == 0 else not first_right)
            if transpose:
                pts = [(b, a) for a, b in pts]
            out.append(pts)
    return out


def clean(pts, min_len=0.25):
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) >= min_len:
            out.append(p)
    return out


class Sewer:
    """Builds the stitch list (mm) with ties, trims and jumps, then hands it to pyembroidery."""
    def __init__(self):
        self.ops = []          # (kind, x, y): stitch | jump | trim | color
        self.pos = (0.0, 0.0)
        self.sewing = False

    def stitch_to(self, p, max_len=3.5):
        d = math.dist(self.pos, p)
        n = max(1, math.ceil(d / max_len))
        for i in range(1, n + 1):
            q = (self.pos[0] + (p[0] - self.pos[0]) * i / n, self.pos[1] + (p[1] - self.pos[1]) * i / n)
            self.ops.append(('stitch', *q))
        self.pos = p

    def tie(self, toward):
        """Three tiny stitches back and forth so the thread can't pull out."""
        d = math.dist(self.pos, toward) or 1
        t = (self.pos[0] + (toward[0] - self.pos[0]) * 0.4 / d, self.pos[1] + (toward[1] - self.pos[1]) * 0.4 / d)
        here = self.pos
        for q in (t, here, t, here):
            self.ops.append(('stitch', *q))

    def end_run(self):
        if self.sewing:
            prev = next(((x, y) for k, x, y in reversed(self.ops[:-1]) if k == 'stitch' and math.dist((x, y), self.pos) > 0.2), self.pos)
            self.tie(prev)
            self.ops.append(('trim', *self.pos))
            self.sewing = False

    def sew(self, pts, travel_ok=None):
        pts = clean(pts)
        if not pts:
            return
        start = pts[0]
        if self.sewing and travel_ok and travel_ok(self.pos, start):
            self.stitch_to(start, 2.5)
        else:
            self.end_run()
            self.ops.append(('jump', *start)); self.pos = start
            self.sewing = True
            self.tie(pts[1] if len(pts) > 1 else start)
        for p in pts[1:]:
            self.stitch_to(p, 4.0)

    def color_change(self):
        self.end_run()
        self.ops.append(('color', *self.pos))


def inside_checker(mask):
    def ok(a, b):
        d = math.dist(a, b)
        if d > TRAVEL_MAX:
            return False
        for i in range(int(d / 0.2) + 2):
            t = i / (int(d / 0.2) + 1)
            x, y = (a[0] + (b[0] - a[0]) * t) * PX, (a[1] + (b[1] - a[1]) * t) * PX
            xi, yi = int(round(x)), int(round(y))
            if not (0 <= yi < mask.shape[0] and 0 <= xi < mask.shape[1] and mask[yi, xi]):
                return False
        return True
    return ok


def nearest_first(paths_per_block, pos):
    """Greedy order: always sew the block whose best starting corner is closest to where the needle is."""
    left = list(range(len(paths_per_block)))
    order = []
    while left:
        best = min(((math.dist(pos, opts[0]), i, opts) for i in left for opts in paths_per_block[i] if opts), key=lambda t: t[0])
        _, i, pts = best
        order.append(pts); pos = pts[-1]; left.remove(i)
    return order


def sew_colour(sewer, mask):
    mask = ndi.binary_dilation(mask, structure=disk(PULL * PX))
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    comps = [i + 1 for i, s in enumerate(sizes) if s >= 0.3 * PX * PX]     # drop specks under 0.3 mm²
    # sew shapes left to right, top to bottom
    cents = {c: ndi.center_of_mass(lab == c) for c in comps}
    pos = sewer.pos
    remaining = set(comps)
    while remaining:
        c = min(remaining, key=lambda k: math.dist(pos, (cents[k][1] / PX, cents[k][0] / PX)) + cents[k][1] / PX * 0.15)
        remaining.discard(c)
        comp = lab == c
        ok = inside_checker(comp)
        # underlay: vertical rows on a slightly shrunk shape, only where it is wide enough
        inner = ndi.binary_erosion(comp, structure=disk(U_INSET * PX))
        ublocks = [b for b in scan_blocks(inner.T, U_ROW * PX) if len(b) >= 1 and max(e - s for _, s, e in b) >= 1.0 * PX]
        uopts = [block_paths(b, U_STITCH, 0.0, U_ROW, transpose=True) for b in ublocks]
        for pts in nearest_first(uopts, sewer.pos):
            sewer.sew(pts, travel_ok=ok)
        # top: horizontal tatami
        topts = [block_paths(b, STITCH, MIN_W, ROW) for b in scan_blocks(comp, ROW * PX)]
        first = True
        for pts in nearest_first(topts, sewer.pos):
            sewer.sew(pts, travel_ok=ok if first else (lambda a, b: math.dist(a, b) <= 1.0 and ok(a, b)))
            first = False
        pos = sewer.pos


def build(src, width_mm, out_base, label, crop=None):
    gold_l, ivory_l = load_layers(src, crop)
    h0, w0 = gold_l.shape
    wpx = int(round(width_mm * PX)); hpx = int(round(h0 * wpx / w0))
    gold, ivory = to_mask(gold_l, wpx, hpx), to_mask(ivory_l, wpx, hpx)
    sewer = Sewer()
    sewer.pos = (wpx / PX / 2, hpx / PX / 2)            # needle starts at the centre of the design
    sew_colour(sewer, gold)
    sewer.color_change()
    sew_colour(sewer, ivory)
    sewer.end_run()

    cx, cy = round(wpx / PX / 2, 1), round(hpx / PX / 2, 1)   # on the 0.1 mm grid, so every row stays exactly 0.4 mm apart
    p = pe.EmbPattern()
    p.add_thread(pe.EmbThread(thread='#BFA987')); p.threadlist[-1].description = 'Gold'
    p.add_thread(pe.EmbThread(thread='#FFFBF5')); p.threadlist[-1].description = 'Ivory'
    p.metadata('name', label)
    for kind, x, y in sewer.ops:
        X, Y = round((x - cx) * 10), round((y - cy) * 10)        # pyembroidery units are 0.1 mm, design centred on the hoop centre
        if kind == 'stitch':
            p.add_stitch_absolute(pe.STITCH, X, Y)
        elif kind == 'jump':
            p.add_stitch_absolute(pe.JUMP, X, Y)
        elif kind == 'trim':
            p.add_command(pe.TRIM)
        elif kind == 'color':
            p.add_command(pe.COLOR_CHANGE)
    p.add_command(pe.END)
    pe.write_dst(p, out_base + '.dst', {'extended header': True})
    return p, (wpx / PX, hpx / PX)


def preview(pattern_path, out_png, fabric=(12, 10, 8), scale=14, colours=(GOLD, IVORY), pad_mm=6):
    """Draw the stitches as they will sew, read back from the DST file itself (so this is what the machine gets)."""
    p = pe.read(pattern_path)
    xs = [s[0] for s in p.stitches]; ys = [s[1] for s in p.stitches]
    minx, miny, maxx, maxy = min(xs), min(ys), max(xs), max(ys)
    ss = 2
    k = scale * ss / 10
    W = int((maxx - minx) * k + 2 * pad_mm * scale * ss); H = int((maxy - miny) * k + 2 * pad_mm * scale * ss)
    im = Image.new('RGB', (W, H), fabric)
    d = ImageDraw.Draw(im)
    ci, last, width = 0, None, max(2, int(0.5 * scale * ss))
    for x, y, cmd in p.stitches:
        c = cmd & pe.COMMAND_MASK
        pt = ((x - minx) * k + pad_mm * scale * ss, (y - miny) * k + pad_mm * scale * ss)
        if c == pe.STITCH:
            if last is not None:
                col = colours[min(ci, len(colours) - 1)]
                d.line([last, pt], fill=col, width=width)
            last = pt
        elif c == pe.COLOR_CHANGE:
            ci += 1; last = None
        else:
            last = pt if c == pe.JUMP else None
            if c == pe.TRIM:
                last = None
    im = im.resize((W // ss, H // ss), Image.LANCZOS)
    im.save(out_png)


def report(path):
    p = pe.read(path)
    cnt = {}
    for x, y, c in p.stitches:
        cnt[c & pe.COMMAND_MASK] = cnt.get(c & pe.COMMAND_MASK, 0) + 1
    xs = [s[0] for s in p.stitches]; ys = [s[1] for s in p.stitches]
    longest = 0; prev = None
    for x, y, c in p.stitches:
        if (c & pe.COMMAND_MASK) == pe.STITCH and prev is not None:
            longest = max(longest, math.dist(prev, (x, y)))
        prev = (x, y) if (c & pe.COMMAND_MASK) in (pe.STITCH, pe.JUMP) else None
    return {'stitches': cnt.get(pe.STITCH, 0), 'jumps': cnt.get(pe.JUMP, 0), 'trims': cnt.get(pe.TRIM, 0),
            'colour_stops': cnt.get(pe.COLOR_CHANGE, 0), 'width_mm': round((max(xs) - min(xs)) / 10, 1),
            'height_mm': round((max(ys) - min(ys)) / 10, 1), 'longest_stitch_mm': round(longest / 10, 2)}


if __name__ == '__main__':
    src, outdir = sys.argv[1], sys.argv[2]
    jobs = [('creatiste-catering-logo-95mm', 95, 'CREATISTE', None),
            ('creatiste-flame-50mm', None, 'FLAME', (930, 15, 1105, 322))]
    for name, width, label, crop in jobs:
        if width is None:   # the flame mark alone, sized by height
            g, i = load_layers(src, crop)
            width = 50 * g.shape[1] / g.shape[0]
        build(src, width, f'{outdir}/{name}', label, crop)
        preview(f'{outdir}/{name}.dst', f'{outdir}/{name}-preview.png')
        print(name, report(f'{outdir}/{name}.dst'))
