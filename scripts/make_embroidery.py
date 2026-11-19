"""Run: python3 scripts/make_embroidery.py site/public/brand/lockup-dark.png brand/embroidery  (needs: pip install pyembroidery numpy scipy pillow)

Turn The Creatiste Catering logo into machine embroidery (DST, plus PES for Brother and JEF for Janome), with a stitch preview.

Gold areas and ivory areas each become a tatami fill (0.4 mm rows, up to 3.5 mm stitches, staggered so no lines show), laid over
a sparse vertical underlay, with a little pull compensation and a minimum stitch width so the fine serifs survive. One colour stop
(gold first, then ivory).

Written so the machine runs smoothly:
  * every letter (every separate shape) is sewn in ONE continuous run: underlay and fill are joined by short running stitches
    routed inside the shape (preferring parts not yet filled, so the fill covers them), never by a cut;
  * there are NO trim commands at all, and the only moves are the hops from one letter to the next, each a single short jump
    (DST machines read three or more jumps in a row as "cut the thread", and some cut on every jump: this keeps that to one
    hop per letter);
  * the letters are visited in the order that keeps every hop shortest (worked out exactly, not guessed).
Each hop is tied off and tied in, so the little connecting threads can be snipped after sewing without anything unravelling."""
import heapq, math, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
import pyembroidery as pe

PX = 20                    # working resolution: pixels per mm
ROW = 0.4                  # top fill row spacing, mm
STITCH = 3.5               # longest top fill stitch, mm
MIN_W = 0.7                # thinnest stitched width, mm (hairlines are widened to this)
PULL = 0.12                # pull compensation, mm (shapes grow this much each side)
U_ROW, U_STITCH, U_INSET = 1.6, 3.0, 0.35   # underlay
TRAVEL = 2.2               # running stitch length for travel inside a shape, mm
CELL = 5                   # travel route grid: 5 px = 0.25 mm
SEWN_MID, SEWN_EDGE = 10.0, 3.0   # route cost over fill already sewn: through the middle (shows) vs along the outline (sinks in)
JUMP_MAX = 12.1            # longest move one DST jump record can make on each axis, mm
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
            out.append(clean(pts))
    return out


def clean(pts, min_len=0.25):
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) >= min_len:
            out.append(p)
    return out


class Shape:
    """One separate shape (a letter, the flame, the leaf): its pixels, a coarse grid for routing travel, and what is sewn."""
    def __init__(self, comp):
        self.comp = comp
        H, W = comp.shape
        h, w = -(-H // CELL), -(-W // CELL)
        pad = np.zeros((h * CELL, w * CELL), bool); pad[:H, :W] = comp
        cover = pad.reshape(h, CELL, w, CELL).mean(axis=(1, 3))
        core = ndi.binary_erosion(pad, structure=disk(0.25 * PX)).reshape(h, CELL, w, CELL).mean(axis=(1, 3))
        self.cells = cover >= 0.5                       # cells travel may use
        self.edge = self.cells & (core < 0.5)           # cells close to the outline (dearer, so routes keep to the middle)
        self.sewn = np.zeros_like(self.cells)           # cells already covered by top fill
        ys, xs = np.nonzero(comp)
        self.pts_mm = np.column_stack([xs / PX, ys / PX])
        self.tree = cKDTree(self.pts_mm)

    def inside(self, a, b):
        d = math.dist(a, b)
        n = int(d / 0.15) + 2
        for i in range(n + 1):
            t = i / n
            xi = int(round((a[0] + (b[0] - a[0]) * t) * PX)); yi = int(round((a[1] + (b[1] - a[1]) * t) * PX))
            if not (0 <= yi < self.comp.shape[0] and 0 <= xi < self.comp.shape[1] and self.comp[yi, xi]):
                return False
        return True

    def nearest(self, p):
        return tuple(self.pts_mm[self.tree.query(p)[1]])

    def cell_of(self, p):
        cy = min(self.cells.shape[0] - 1, max(0, int(p[1] * PX // CELL)))
        cx = min(self.cells.shape[1] - 1, max(0, int(p[0] * PX // CELL)))
        if self.cells[cy, cx]:
            return cy, cx
        ys, xs = np.nonzero(self.cells)                 # the point sits on a sliver: use the nearest usable cell
        k = np.argmin((ys - cy) ** 2 + (xs - cx) ** 2)
        return int(ys[k]), int(xs[k])

    def step_cost(self, ny, nx, avoid_sewn):
        if avoid_sewn and self.sewn[ny, nx]:
            return SEWN_EDGE if self.edge[ny, nx] else SEWN_MID
        return 1.3 if self.edge[ny, nx] else 1.0

    def search(self, a, avoid_sewn, goal=None):
        """Dijkstra from point a over the shape's grid: cheapest cost to each cell and the way back. Stops early at `goal`."""
        s = self.cell_of(a)
        H, W = self.cells.shape
        best = {s: 0.0}; came = {}
        heap = [(0.0, s)]
        steps = [(dy, dx, math.hypot(dy, dx)) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
        while heap:
            c, cur = heapq.heappop(heap)
            if c > best.get(cur, 1e18):
                continue
            if cur == goal:
                break
            for dy, dx, ln in steps:
                ny, nx = cur[0] + dy, cur[1] + dx
                if not (0 <= ny < H and 0 <= nx < W) or not self.cells[ny, nx]:
                    continue
                nc = c + ln * self.step_cost(ny, nx, avoid_sewn)
                if nc < best.get((ny, nx), 1e18):
                    best[(ny, nx)] = nc; came[(ny, nx)] = cur
                    heapq.heappush(heap, (nc, (ny, nx)))
        return s, best, came

    def path_from(self, found, a, b):
        s, best, came = found
        g = self.cell_of(b)
        if g == s:
            return [a, b]
        if g not in best:
            return None
        cells = [g]
        while cells[-1] != s:
            cells.append(came[cells[-1]])
        cells.reverse()
        mid = [((cx + 0.5) * CELL / PX, (cy + 0.5) * CELL / PX) for cy, cx in cells[1:-1]]
        return [a] + mid + [b]

    def route(self, a, b, avoid_sewn):
        return self.path_from(self.search(a, avoid_sewn, goal=self.cell_of(b)), a, b)

    def mark_sewn(self, block):
        half = ROW * PX / 2
        for y, s, e in block:
            y0, y1 = int((y - half) // CELL), int((y + half) // CELL)
            self.sewn[max(0, y0):y1 + 1, int(s // CELL):int((e - 1) // CELL) + 1] = True


class Sewer:
    """Builds the stitch list (mm): stitches, single jumps between shapes with ties either side, one colour change."""
    def __init__(self):
        self.ops = []          # (kind, x, y): stitch | jump | color
        self.pos = (0.0, 0.0)
        self.sewing = False
        self.visible_travel = 0.0   # travel running stitches laid over fill that is already sewn, mm
        self.visible_mid = 0.0      # ...of which away from the outline (the part that could show)
        self.fallback_hops = 0      # times a shape was cut off inside and needed a hop

    def stitch_to(self, p, max_len=3.5):
        d = math.dist(self.pos, p)
        n = max(1, math.ceil(d / max_len))
        for i in range(1, n + 1):
            q = (self.pos[0] + (p[0] - self.pos[0]) * i / n, self.pos[1] + (p[1] - self.pos[1]) * i / n)
            self.ops.append(('stitch', *q))
        self.pos = p

    def tie(self, toward):
        """Tiny stitches back and forth so the thread can't pull out when the hop thread is snipped."""
        d = math.dist(self.pos, toward) or 1
        t = (self.pos[0] + (toward[0] - self.pos[0]) * 0.4 / d, self.pos[1] + (toward[1] - self.pos[1]) * 0.4 / d)
        here = self.pos
        for q in (t, here, t, here):
            self.ops.append(('stitch', *q))

    def hop(self, p, toward):
        """Tie off, one jump to p, tie in."""
        if self.sewing:
            prev = next(((x, y) for k, x, y in reversed(self.ops[:-1]) if k == 'stitch' and math.dist((x, y), self.pos) > 0.2), self.pos)
            self.tie(prev)
        self.ops.append(('jump', *p)); self.pos = p
        self.sewing = True
        self.tie(toward)

    def travel(self, shape, to, avoid_sewn, path=None):
        """Running stitches inside the shape from the needle to `to`."""
        if math.dist(self.pos, to) < 0.3:
            self.stitch_to(to, TRAVEL); return
        if path is None:
            path = shape.route(self.pos, to, avoid_sewn)
        if path is None:
            self.fallback_hops += 1
            self.hop(to, to); return
        i, n = 0, len(path) - 1
        while i < n:
            j = i + 1
            while j + 1 <= n and math.dist(path[i], path[j + 1]) <= TRAVEL and shape.inside(path[i], path[j + 1]):
                j += 1
            seg_a, seg_b = path[i], path[j]
            if avoid_sewn:
                L = math.dist(seg_a, seg_b); k = max(1, int(L / 0.1))
                for t in range(k):
                    q = (seg_a[0] + (seg_b[0] - seg_a[0]) * (t + 0.5) / k, seg_a[1] + (seg_b[1] - seg_a[1]) * (t + 0.5) / k)
                    cy = min(shape.sewn.shape[0] - 1, int(q[1] * PX // CELL)); cx = min(shape.sewn.shape[1] - 1, int(q[0] * PX // CELL))
                    if shape.sewn[cy, cx]:
                        self.visible_travel += L / k
                        if not shape.edge[cy, cx]:
                            self.visible_mid += L / k
            self.stitch_to(seg_b, TRAVEL)
            i = j

    def run(self, pts):
        for p in pts[1:]:
            self.stitch_to(p, 4.0)

    def color_change(self):
        if self.sewing:
            prev = next(((x, y) for k, x, y in reversed(self.ops[:-1]) if k == 'stitch' and math.dist((x, y), self.pos) > 0.2), self.pos)
            self.tie(prev)
        self.ops.append(('color', *self.pos))
        self.sewing = False


def jump_records(a, b):
    return max(1, math.ceil(abs(b[0] - a[0]) / JUMP_MAX), math.ceil(abs(b[1] - a[1]) / JUMP_MAX))


def plan_order(shapes):
    """Exact shortest open tour over the shapes (Held-Karp): the cost of a hop is its length, plus a heavy charge for every
    extra jump record it would need, so hops stay single records wherever the layout allows."""
    n = len(shapes)
    if n == 1:
        return [0]
    D = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            d, k = shapes[j].tree.query(shapes[i].pts_mm[::7])
            a = shapes[i].pts_mm[::7][int(np.argmin(d))]; b = shapes[j].pts_mm[k[int(np.argmin(d))]]
            D[i, j] = D[j, i] = float(d.min()) + 40.0 * (jump_records(a, b) - 1)
    INF = float('inf')
    dp = [[INF] * n for _ in range(1 << n)]; par = [[-1] * n for _ in range(1 << n)]
    for j in range(n):
        dp[1 << j][j] = 0.0
    for m in range(1 << n):
        for j in range(n):
            c = dp[m][j]
            if c == INF:
                continue
            for k in range(n):
                if m >> k & 1:
                    continue
                nm = m | 1 << k
                if c + D[j, k] < dp[nm][k]:
                    dp[nm][k] = c + D[j, k]; par[nm][k] = j
    full = (1 << n) - 1
    j = min(range(n), key=lambda k: dp[full][k])
    order, m = [], full
    while j != -1:
        order.append(j); pj = par[m][j]; m ^= 1 << j; j = pj
    return order[::-1]


def sew_shape(sewer, shape, exit_toward, last_pick=None):
    """Underlay then tatami for one shape, all in one run. `last_pick` = the fill block to sew last (or None)."""
    entry = shape.nearest(sewer.pos)
    comp = shape.comp
    inner = ndi.binary_erosion(comp, structure=disk(U_INSET * PX))
    ublocks = [b for b in scan_blocks(inner.T, U_ROW * PX) if max(e - s for _, s, e in b) >= 1.0 * PX]
    uopts = [block_paths(b, U_STITCH, 0.0, U_ROW, transpose=True) for b in ublocks]
    tblocks = scan_blocks(comp, ROW * PX)
    topts = [block_paths(b, STITCH, MIN_W, ROW) for b in tblocks]

    first = (uopts[0][0][0] if uopts else topts[0][0][0])
    sewer.hop(entry, first)
    # underlay: nearest block next, joined by hidden travel (no top fill yet, so nothing shows)
    left = list(range(len(uopts)))
    while left:
        _, i, pts = min(((math.dist(sewer.pos, o[0]), i, o) for i in left for o in uopts[i] if o), key=lambda t: t[0])
        left.remove(i)
        sewer.travel(shape, pts[0], avoid_sewn=False)
        sewer.run(pts)
    # top: next block = the one cheapest to reach along the real route (through parts not yet filled, so it stays hidden);
    # the block nearest the next shape is kept for last so the hop out stays short
    left = list(range(len(topts)))
    last = last_pick if last_pick is not None and len(left) > 1 else None
    if last is not None:
        left.remove(last)
    while left or last is not None:
        found = shape.search(sewer.pos, avoid_sewn=True)
        _, best, _ = found
        cost = lambda o: best.get(shape.cell_of(o[0]), 1e9) + 0.4 * math.dist(sewer.pos, o[0])
        if left:
            c, i, pts = min(((cost(o), i, o) for i in left for o in topts[i] if o), key=lambda t: t[0])
            left.remove(i)
        else:
            i = last; last = None
            pts = min((o for o in topts[i] if o), key=lambda o: cost(o) + (1.5 * math.dist(o[-1], exit_toward) if exit_toward else 0))
        sewer.travel(shape, pts[0], avoid_sewn=True, path=shape.path_from(found, sewer.pos, pts[0]))
        sewer.run(pts)
        shape.mark_sewn(tblocks[i])


def fill_blocks_near(shape, point, k):
    blocks = scan_blocks(shape.comp, ROW * PX)
    ranked = sorted(range(len(blocks)), key=lambda i: min(math.dist(point, (x / PX, y / PX)) for y, s, e in blocks[i] for x in (s, e)))
    return ranked[:k]


def sew_shape_best(sewer, shape, nxt):
    """Try a few endings for this shape (no fixed last block, or one of the blocks nearest the next shape) on a scratch copy,
    and keep the one that leaves the least travel showing over finished fill while the hop out stays one short jump."""
    exit_toward = None
    picks = [None]
    if nxt is not None:
        d, _ = nxt.tree.query(shape.pts_mm[::5])
        exit_toward = tuple(shape.pts_mm[::5][int(np.argmin(d))])
        picks += fill_blocks_near(shape, exit_toward, 5)
    best = None
    for pick in picks:
        trial = Sewer(); trial.pos, trial.sewing, trial.ops = sewer.pos, sewer.sewing, list(sewer.ops[-8:])
        shape.sewn[:] = False
        sew_shape(trial, shape, exit_toward, pick)
        score = 3 * trial.visible_mid + (trial.visible_travel - trial.visible_mid) + 0.02 * len(trial.ops)
        if nxt is not None:
            end = trial.pos; to = nxt.nearest(end)
            score += 300 * (jump_records(end, to) - 1) + math.dist(end, to)
        if best is None or score < best[0]:
            best = (score, pick)
    shape.sewn[:] = False
    sew_shape(sewer, shape, exit_toward, best[1])


def sew_colour(sewer, mask):
    mask = ndi.binary_dilation(mask, structure=disk(PULL * PX))
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    shapes = [Shape(lab == i + 1) for i, s in enumerate(sizes) if s >= 0.3 * PX * PX]     # drop specks under 0.3 mm²
    order = plan_order(shapes)
    for k, i in enumerate(order):
        sew_shape_best(sewer, shapes[i], shapes[order[k + 1]] if k + 1 < len(order) else None)


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
    sewer.color_change()                                 # ties off the last stitch; the END below replaces this stop

    cx, cy = round(wpx / PX / 2, 1), round(hpx / PX / 2, 1)   # on the 0.1 mm grid, so every row stays exactly 0.4 mm apart
    p = pe.EmbPattern()
    p.add_thread(pe.EmbThread(thread='#BFA987')); p.threadlist[-1].description = 'Gold'
    p.add_thread(pe.EmbThread(thread='#FFFBF5')); p.threadlist[-1].description = 'Ivory'
    p.metadata('name', label)
    ops = sewer.ops[:-1]                                 # drop the trailing colour stop
    for kind, x, y in ops:
        X, Y = round((x - cx) * 10), round((y - cy) * 10)        # pyembroidery units are 0.1 mm, design centred on the hoop centre
        if kind == 'stitch':
            p.add_stitch_absolute(pe.STITCH, X, Y)
        elif kind == 'jump':
            p.add_stitch_absolute(pe.JUMP, X, Y)
        elif kind == 'color':
            p.add_command(pe.COLOR_CHANGE)
    p.add_command(pe.END)
    pe.write_dst(p, out_base + '.dst', {'extended header': True})
    pe.write_pes(p, out_base + '.pes')
    pe.write_jef(p, out_base + '.jef')
    return p, sewer


def dst_records(path):
    """Read the raw DST records back: stitches, jump records, colour stops, and how long each run of jumps is."""
    b = open(path, 'rb').read()[512:]
    st = jumps = stops = 0; runs = []; run = 0
    for i in range(0, len(b) - 2, 3):
        b2 = b[i + 2]
        if b[i] == 0 and b[i + 1] == 0 and b2 == 0xF3:
            break
        if b2 & 0x40 and b2 & 0x80:
            stops += 1; continue
        if b2 & 0x80:
            jumps += 1; run += 1
        else:
            st += 1
            if run:
                runs.append(run); run = 0
    return {'stitch_records': st, 'jump_records': jumps, 'colour_stops': stops, 'hops': len(runs),
            'longest_jump_run': max(runs) if runs else 0, 'runs_of_3_or_more': sum(1 for r in runs if r >= 3)}


def preview(pattern_path, out_png, fabric=(12, 10, 8), scale=14, colours=(GOLD, IVORY), pad_mm=6, hops=False):
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
    jump_from = None
    for x, y, cmd in p.stitches:
        c = cmd & pe.COMMAND_MASK
        pt = ((x - minx) * k + pad_mm * scale * ss, (y - miny) * k + pad_mm * scale * ss)
        if c == pe.STITCH:
            if hops and jump_from is not None:
                d.line([jump_from, pt], fill=(220, 60, 60), width=max(1, width // 2))
            jump_from = None
            if last is not None:
                col = colours[min(ci, len(colours) - 1)]
                d.line([last, pt], fill=col, width=width)
            last = pt
        elif c == pe.COLOR_CHANGE:
            ci += 1; last = None
        elif c == pe.JUMP:
            if jump_from is None:
                jump_from = last
            last = pt
        else:
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
    return {'stitches': cnt.get(pe.STITCH, 0), 'trims': cnt.get(pe.TRIM, 0), 'colour_stops': cnt.get(pe.COLOR_CHANGE, 0),
            'width_mm': round((max(xs) - min(xs)) / 10, 1), 'height_mm': round((max(ys) - min(ys)) / 10, 1),
            'longest_stitch_mm': round(longest / 10, 2)}


if __name__ == '__main__':
    src, outdir = sys.argv[1], sys.argv[2]
    jobs = [('creatiste-catering-logo-95mm', 95, 'CREATISTE', None),
            ('creatiste-flame-50mm', None, 'FLAME', (930, 15, 1105, 322))]
    for name, width, label, crop in jobs:
        if width is None:   # the flame mark alone, sized by height
            g, i = load_layers(src, crop)
            width = 50 * g.shape[1] / g.shape[0]
        _, sewer = build(src, width, f'{outdir}/{name}', label, crop)
        preview(f'{outdir}/{name}.dst', f'{outdir}/{name}-preview.png')
        info = report(f'{outdir}/{name}.dst'); info.update(dst_records(f'{outdir}/{name}.dst'))
        info.update({'travel_over_fill_mm': round(sewer.visible_travel, 1), 'of_which_mid_fill_mm': round(sewer.visible_mid, 1), 'cut_off_hops': sewer.fallback_hops})
        print(name, info)
