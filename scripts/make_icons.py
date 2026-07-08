"""Generate the app icons (PNG) — favicon + PWA set — from the brand submark.

TWO SOURCES, picked automatically:
  1. Ellice's actual icon, if present: drop it in as  brand/submark.png  (or .svg /
     .webp / .jpg) at the repo root — ideally square, at least 512x512, on a
     transparent background. It is centered on the signature near-black and every
     icon (incl. a favicon-64.png for index.html) is rendered from it.
  2. Fallback: the code-drawn gold/ivory flame (the original placeholder mark),
     used only when no brand/submark file exists.

Renders in headless chromium (Playwright) and screenshots at each size — no image
libraries needed. Output: frontend/public/icons/*.png (+ favicon-64.png when a
custom submark is used); all checked into git so deploys don't need this script.
Re-run whenever the brand mark changes:

    backend/.venv/bin/python scripts/make_icons.py

After the FIRST run with a custom submark, also point the favicon at the PNG in
frontend/index.html (replace the inline data:image/svg favicon):
    <link rel="icon" type="image/png" href="/icons/favicon-64.png" />
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "icons"
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BG = "#0C0A08"  # signature near-black

# Ellice's actual icon, when supplied (first match wins)
CUSTOM = next(
    (p for ext in ("svg", "png", "webp", "jpg", "jpeg") if (p := ROOT / "brand" / f"submark.{ext}").exists()),
    None,
)

# The placeholder brand flame (gold + ivory) from the favicon, on the signature near-black
MARK = """
<g transform="translate({pad} {pad}) scale({scale})">
  <path d="M11.2 21.6c-3.7-1.2-5.5-4.4-4.4-7.8.7-2.1 2.5-3.5 3.1-5.7.4-1.4.3-2.8-.2-4.3 2.9 1.4 4.6 3.7 4.7 6.3.1 2-1 3.5-1.1 5.2-.1 1.6.7 3 2.2 4.3-1.4.4-2.9.4-4.3 0Z" fill="#BFA987"/>
  <path d="M16.8 20.9c2-1 3-3 2.3-5-.4-1.3-1.4-2.2-1.7-3.7-1.3 1.1-1.9 2.4-1.7 3.8.2 1 .9 1.8.8 2.8-.1.8-.7 1.5-1.6 2 .7.2 1.3.2 1.9.1Z" fill="#FFFBF5"/>
</g>
"""


def flame_svg(size: int, mark_ratio: float) -> str:
    mark_px = size * mark_ratio
    scale = mark_px / 24  # the paths live in a 24x24 viewBox
    pad = (size - mark_px) / 2
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}">'
        f'<rect width="{size}" height="{size}" fill="{BG}"/>'
        + MARK.format(pad=pad, scale=scale)
        + "</svg>"
    )


def custom_html(size: int, mark_ratio: float) -> str:
    # The submark image centered on the brand near-black, contained to the safe area.
    # Embedded as a data: URI — chromium blocks file:// subresources from set_content pages.
    import base64
    mime = {"svg": "image/svg+xml", "png": "image/png", "webp": "image/webp",
            "jpg": "image/jpeg", "jpeg": "image/jpeg"}[CUSTOM.suffix.lstrip(".").lower()]
    data = base64.b64encode(CUSTOM.read_bytes()).decode()
    mark_px = round(size * mark_ratio)
    return (
        f"<div id='i' style='width:{size}px;height:{size}px;background:{BG};"
        f"display:flex;align-items:center;justify-content:center'>"
        f"<img src='data:{mime};base64,{data}' style='width:{mark_px}px;height:{mark_px}px;object-fit:contain'/></div>"
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # maskable needs the mark inside the central 80% "safe zone" → smaller ratio
    jobs = [
        ("icon-192.png", 192, 0.78),
        ("icon-512.png", 512, 0.78),
        ("apple-touch-icon.png", 180, 0.74),
        ("maskable-512.png", 512, 0.58),
    ]
    if CUSTOM:
        jobs.append(("favicon-64.png", 64, 0.84))  # browser-tab icon for index.html
        print(f"using custom submark: {CUSTOM.relative_to(ROOT)}")
    else:
        print("no brand/submark.* found — using the drawn flame fallback")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM)
        page = browser.new_page(viewport={"width": 600, "height": 600})
        for name, size, ratio in jobs:
            content = custom_html(size, ratio) if CUSTOM else f"<div id='i' style='width:{size}px;height:{size}px'>{flame_svg(size, ratio)}</div>"
            page.set_content(f"<body style='margin:0'>{content}</body>")
            page.wait_for_timeout(150)  # let the <img> decode before the shot
            page.locator("#i").screenshot(path=str(OUT / name))
            print(f"wrote {OUT / name}")
        browser.close()


if __name__ == "__main__":
    main()
