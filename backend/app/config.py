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

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
ALLOWED_UPLOAD_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf"}

DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "GBP")

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
            "Online order tracking",
            "Prep-day route planner",
            "Setup design canvas",
            "Invoicing & expenses",
        ],
    },
    "elite": {
        "name": "Elite Kitchen",
        "monthly": 129,
        "onboarding": 399,
        "tagline": "For teams that want the full command centre.",
        "features": [
            "Everything in Pro Caterer",
            "AI sous-chef (menus, lists, prep plans)",
            "Finance reports & insights",
            "Priority onboarding & support",
        ],
    },
}
