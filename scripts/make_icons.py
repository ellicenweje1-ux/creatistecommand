"""Generate the PWA app icons (PNG) from the brand flame mark.

Renders the SVG in headless chromium (Playwright) and screenshots it at each size —
no image libraries needed. Output: frontend/public/icons/*.png (checked into git so
deploys don't need this script). Re-run only if the brand mark changes:

    backend/.venv/bin/python scripts/make_icons.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "icons"
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

# The brand flame (gold + ivory) from the favicon, on the signature near-black
MARK = """
<g transform="translate({pad} {pad}) scale({scale})">
  <path d="M11.2 21.6c-3.7-1.2-5.5-4.4-4.4-7.8.7-2.1 2.5-3.5 3.1-5.7.4-1.4.3-2.8-.2-4.3 2.9 1.4 4.6 3.7 4.7 6.3.1 2-1 3.5-1.1 5.2-.1 1.6.7 3 2.2 4.3-1.4.4-2.9.4-4.3 0Z" fill="#BFA987"/>
  <path d="M16.8 20.9c2-1 3-3 2.3-5-.4-1.3-1.4-2.2-1.7-3.7-1.3 1.1-1.9 2.4-1.7 3.8.2 1 .9 1.8.8 2.8-.1.8-.7 1.5-1.6 2 .7.2 1.3.2 1.9.1Z" fill="#FFFBF5"/>
</g>
"""


def svg(size: int, mark_ratio: float) -> str:
    mark_px = size * mark_ratio
    scale = mark_px / 24  # the paths live in a 24x24 viewBox
    pad = (size - mark_px) / 2
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}">'
        f'<rect width="{size}" height="{size}" fill="#0C0A08"/>'
        + MARK.format(pad=pad, scale=scale)
        + "</svg>"
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
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM)
        page = browser.new_page(viewport={"width": 600, "height": 600})
        for name, size, ratio in jobs:
            page.set_content(
                f"<body style='margin:0'><div id='i' style='width:{size}px;height:{size}px'>{svg(size, ratio)}</div></body>"
            )
            page.locator("#i").screenshot(path=str(OUT / name))
            print(f"wrote {OUT / name}")
        browser.close()


if __name__ == "__main__":
    main()
