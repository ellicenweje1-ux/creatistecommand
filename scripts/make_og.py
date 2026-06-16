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

    <svg width="118" height="118" viewBox="0 0 24 24" fill="none" style="margin-bottom:18px">
      <path d="M11.2 21.6c-3.7-1.2-5.5-4.4-4.4-7.8.7-2.1 2.5-3.5 3.1-5.7.4-1.4.3-2.8-.2-4.3 2.9 1.4 4.6 3.7 4.7 6.3.1 2-1 3.5-1.1 5.2-.1 1.6.7 3 2.2 4.3-1.4.4-2.9.4-4.3 0Z" fill="#BFA987"/>
      <path d="M16.8 20.9c2-1 3-3 2.3-5-.4-1.3-1.4-2.2-1.7-3.7-1.3 1.1-1.9 2.4-1.7 3.8.2 1 .9 1.8.8 2.8-.1.8-.7 1.5-1.6 2 .7.2 1.3.2 1.9.1Z" fill="#FFFBF5"/>
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
