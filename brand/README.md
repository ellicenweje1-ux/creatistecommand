# Brand assets — drop the real submark here

The app currently ships a **code-drawn placeholder flame** as its icon (browser tab,
installed-app icon, Apple touch icon). To replace it with the actual brand submark:

1. Save the real icon as **`brand/submark.png`** in this folder (`.svg`, `.webp` or
   `.jpg` also work — first match wins). Ideally square, **at least 512×512**, on a
   **transparent background**; it gets centered on the signature near-black `#0C0A08`.
2. Run `backend/.venv/bin/python scripts/make_icons.py` — it regenerates every icon in
   `frontend/public/icons/` from it, plus a `favicon-64.png` for the browser tab.
3. Point the favicon at the PNG in `frontend/index.html`: replace the inline
   `data:image/svg+xml` `<link rel="icon" …>` with
   `<link rel="icon" type="image/png" href="/icons/favicon-64.png" />`.
4. Commit the submark, the regenerated icons and the index.html change together.
   (Consider re-running `scripts/make_og.py` too if the social card should carry the
   new mark, and updating the in-app `Flame` component in `frontend/src/ui.jsx`.)

Without a `submark.*` file here, `make_icons.py` keeps producing the placeholder flame —
nothing breaks.
