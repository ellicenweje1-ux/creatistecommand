"""Application settings, read from environment variables (.env supported via shell)."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", DATA_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Frontend build output served by FastAPI when present
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))


def _secret_key() -> str:
    """Use SECRET_KEY from env; otherwise persist a generated one so tokens survive restarts."""
    env = os.getenv("SECRET_KEY")
    if env:
        return env
    keyfile = DATA_DIR / ".secret_key"
    if keyfile.exists():
        return keyfile.read_text().strip()
    key = secrets.token_hex(32)
    keyfile.write_text(key)
    return key


SECRET_KEY = _secret_key()
TOKEN_TTL_DAYS = int(os.getenv("TOKEN_TTL_DAYS", "7"))

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'creatiste.db'}")

# Public URL of the app (used for Stripe redirect URLs)
APP_URL = os.getenv("APP_URL", "http://localhost:8000")

# AI — Anthropic Claude. EMERGENT_LLM_KEY accepted as an alias for convenience.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("EMERGENT_LLM_KEY") or ""
AI_MODEL = os.getenv("AI_MODEL", "claude-opus-4-8")

# Stripe — when unset the app runs in "demo billing" mode (payments simulated).
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Bootstrap platform admin (created on first startup)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@creatistecommand.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Platform Admin")

# Where support requests are sent. Defaults to the admin email — point this at
# your own domain's inbox later (e.g. support@thecreatiste.com) without code changes.
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "") or ADMIN_EMAIL

# New chefs get this many free-trial days. The trial clock starts when their
# onboarding session is marked complete (verification-first), not at signup.
DEFAULT_TRIAL_DAYS = int(os.getenv("DEFAULT_TRIAL_DAYS", "5"))

# Onboarding & check-in video calls -----------------------------------------------------------
# Bookable slots offered to clients (times are local to the business day, kept naive
# like every other date/time in the app).
ONBOARDING_SLOT_MINUTES = int(os.getenv("ONBOARDING_SLOT_MINUTES", "45"))
ONBOARDING_DAY_START = int(os.getenv("ONBOARDING_DAY_START", "9"))    # first slot 09:00
ONBOARDING_DAY_END = int(os.getenv("ONBOARDING_DAY_END", "18"))       # last slot starts 17:00
ONBOARDING_DAYS_AHEAD = int(os.getenv("ONBOARDING_DAYS_AHEAD", "14"))  # booking horizon
ONBOARDING_WEEKDAYS = {0, 1, 2, 3, 4, 5}  # Mon–Sat (datetime.weekday numbers)

# Zoom (preferred video platform) — set all three to auto-create real Zoom meetings
# via the server-to-server OAuth app. Without them the platform generates a private
# Jitsi Meet room per session (free, no account, works in any browser) so the whole
# flow stays testable in demo mode. MEETING_URL overrides both (e.g. your personal
# Zoom room link) — every session then uses that one link.
ZOOM_ACCOUNT_ID = os.getenv("ZOOM_ACCOUNT_ID", "")
ZOOM_CLIENT_ID = os.getenv("ZOOM_CLIENT_ID", "")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET", "")
MEETING_URL = os.getenv("MEETING_URL", "")

# Email notifications (optional — silently disabled when unset)
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "The Creatiste Command <no-reply@creatistecommand.com>")
# Resend HTTP API. Preferred on hosts that block outbound SMTP ports (e.g. Render): when
# set, app email goes out over HTTPS (port 443) via Resend instead of SMTP. Uses SMTP_FROM
# as the sender. Falls back to SMTP when unset.
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
ALLOWED_UPLOAD_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf"}

DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "GBP")

# Founders Membership — the private launch programme for the platform's first chefs.
# Joined only through the secret invite link (Admin → Founders); never shown on public
# pages. All values editable live from the admin. Once the programme is closed (or every
# seat is taken) the link dies for good — existing founders keep their lifetime rate.
DEFAULT_FOUNDERS = {
    "enabled": True,
    "name": "Founders Membership",
    "tagline": "A private launch membership for the first chefs on the platform — once the founding seats are gone, it's gone.",
    "monthly": 59,      # lifetime rate — never rises while the membership stays active
    "onboarding": 0,    # 0 = onboarding fee waived for founders
    "spots": 10,        # maximum number of founding members
    # Structured "badge" perks shown on the invite page (icon names from frontend ui.jsx).
    # Frontend also accepts plain strings for backwards compatibility.
    "perks": [
        {"icon": "coins", "title": "Lifetime discount",
         "text": "Full Elite Kitchen access at the founders rate — locked for as long as you stay, no matter what prices do later."},
        {"icon": "sparkle", "title": "Onboarding fee waived",
         "text": "Your one-time setup fee is waived, and your onboarding session is a personal video call to get you started."},
        {"icon": "phone", "title": "Direct access to the founder",
         "text": "A direct line for anything you need — your requests jump the queue, founder to founder."},
        {"icon": "bulb", "title": "Influence over future features",
         "text": "A real say in the roadmap: your day-5 feedback call and ongoing input shape what gets built next."},
        {"icon": "star", "title": "Early adopter recognition",
         "text": "A numbered founding-member badge on your account — your place in the story, forever."},
        {"icon": "external", "title": "Testimonial spotlight",
         "text": "Your logo featured on our site with a direct link to your business — free advertising as a founding kitchen."},
    ],
}

PLANS_VERSION = 2
DEFAULT_PLANS = {
    "starter": {
        "name": "Solo Chef",
        "monthly": 39,
        "onboarding": 99,
        "tagline": "For private chefs running their own diary.",
        "features": [
            "Bookings & event calendar",
            "Recipe master sheets",
            "Inventory with shelf-life alerts",
            "Shopping lists & prep tasks",
            "Packing checklists",
            "Allergen matrix generator",
            "Idea capture",
        ],
    },
    "pro": {
        "name": "Pro Caterer",
        "monthly": 69,
        "onboarding": 199,
        "tagline": "For caterers juggling multiple events a week.",
        "features": [
            "Everything in Solo Chef",
            "Client portfolio & reviews",
            "Tastings & consultations diary",
            "Online order tracking",
            "Prep-day route planner",
            "Design studio with drawing tools",
            "Supplier price book",
            "Public enquiry form → bookings",
            "Invoicing, expenses & email notifications",
        ],
    },
    "elite": {
        "name": "Elite Kitchen",
        "monthly": 129,
        "onboarding": 399,
        "tagline": "For teams that want the full command centre.",
        "features": [
            "Everything in Pro Caterer",
            "Mise — your AI sous-chef",
            "Staff logins, rotas & assignments",
            "Owner oversight: full activity trail",
            "Client quote approval links",
            "Finance reports & insights",
            "Priority onboarding & support",
        ],
    },
}
