# Brand assets

**`submark.svg` is the actual brand submark** — a vector trace of the icon Ellice supplied
(2026-07-08; gold flame + ivory leaf, brand gold `#BFA987` / ivory `#FFFBF5`). It drives
every generated icon, and the same paths are mirrored in the in-app `Flame` component
(`frontend/src/ui.jsx`) and the social card (`scripts/make_og.py`) — if the mark ever
changes, update all three.

To swap in a new/updated submark:

1. Replace **`brand/submark.svg`** (or drop a `submark.png` / `.webp` / `.jpg` — `.svg`
   wins when both exist). Ideally square or cropped to the mark, **at least 512×512**,
   on a **transparent background**; it gets centered on the signature near-black `#0C0A08`.
2. Run `backend/.venv/bin/python scripts/make_icons.py` — it regenerates every icon in
   `frontend/public/icons/` from it, plus `favicon-64.png` for the browser tab.
3. Run `backend/.venv/bin/python scripts/make_og.py` and update the `Flame` paths in
   `frontend/src/ui.jsx` if the shapes changed (see the note above).
4. Commit the submark and every regenerated file together.

Without a `submark.*` file here, `make_icons.py` falls back to the old code-drawn
placeholder flame — nothing breaks.
