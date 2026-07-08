"""Generate the social-preview image (Open Graph / Twitter card) — frontend/public/og-image.png.

Renders an on-brand 1200x630 card in headless chromium (Playwright) and screenshots it —
no image libraries needed. Output is checked into git so deploys don't run this. Re-run
only if the brand/wording changes:

    backend/.venv/bin/python scripts/make_og.py

(Google Fonts are blocked in the sandbox, so this uses system serif/sans — close enough
to the Playfair/Outfit look for a share card.)
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "og-image.png"
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

W, H = 1200, 630

HTML = f"""
<body style="margin:0">
  <div id="card" style="
      width:{W}px;height:{H}px;box-sizing:border-box;
      background:radial-gradient(120% 120% at 50% 0%, #14110D 0%, #0C0A08 60%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font-family:Georgia,'Times New Roman',serif;color:#FFFBF5;position:relative;">
    <div style="position:absolute;inset:28px;border:1px solid rgba(191,169,135,0.30);border-radius:24px;"></div>

    <!-- Ellice's actual submark (vector trace — source: brand/submark.svg) -->
    <svg width="118" height="118" viewBox="316 10 414 888" fill="none" style="margin-bottom:18px">
      <path d="M545 20C558 120 602 208 608 292 612 385 558 462 505 542 455 618 418 692 402 778 355 700 326 628 344 552 364 466 480 368 508 284 531 205 542 112 545 20Z" fill="#BFA987"/>
      <path d="M688 462C720 560 698 668 625 762 590 810 570 848 563 888 546 810 558 722 602 652 652 578 681 518 688 462Z" fill="#FFFBF5"/>
    </svg>

    <div style="font-size:46px;font-weight:700;letter-spacing:18px;color:#BFA987;
                text-transform:uppercase;padding-left:18px;">The Creatiste</div>
    <div style="font-size:74px;font-style:italic;letter-spacing:8px;margin-top:2px;color:#FFFBF5;">command</div>

    <div style="width:90px;height:1px;background:rgba(191,169,135,0.5);margin:30px 0 26px;"></div>

    <div style="font-family:Helvetica,Arial,sans-serif;font-size:29px;color:rgba(255,251,245,0.72);
                letter-spacing:0.5px;text-align:center;max-width:900px;line-height:1.4;">
      The all-in-one command centre for private chefs &amp; caterers
    </div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;color:rgba(191,169,135,0.85);
                margin-top:18px;letter-spacing:2px;text-transform:uppercase;">
      Bookings · Recipes · Prep · Clients · Finances
    </div>
  </div>
</body>
"""


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM)
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        page.set_content(HTML)
        page.locator("#card").screenshot(path=str(OUT))
        browser.close()
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
