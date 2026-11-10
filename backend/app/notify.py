"""Pop-up phone notifications for the things a business needs to see or act on.

Sent through Web Push (app/push.py), so they appear as banners like any app once the chef has added Command to their
phone's Home Screen and switched notifications on (Settings → App & integrations, or Calendar → Phone & notifications).
Each business chooses which kinds it gets in users.notify_prefs; everything defaults to on. Sending never raises:
a failed push must not break the request that triggered it (a client placing an order, leaving a review...).
"""
import logging

from sqlalchemy.orm import Session

from . import push
from .models import User

log = logging.getLogger("creatiste.notify")

TYPES = {
    "requests": "Date requests from your website",
    "orders": "New pre-orders",
    "reviews": "New reviews waiting for approval",
    "enquiries": "New enquiries",
    "reminders": "Reminders for shop, prep and job times",
}
LEAD_CHOICES = (0, 15, 30, 60, 90, 120)
DEFAULTS = {**{k: True for k in TYPES}, "lead_minutes": 60}


def prefs(owner: User | None) -> dict:
    p = dict(DEFAULTS)
    for k, v in ((owner.notify_prefs if owner else None) or {}).items():
        if k in TYPES:
            p[k] = bool(v)
        elif k == "lead_minutes":
            try:
                p[k] = int(v) if int(v) in LEAD_CHOICES else DEFAULTS[k]
            except (TypeError, ValueError):
                pass
    return p


def clean_prefs(raw: dict) -> dict:
    out = {}
    for k in TYPES:
        if k in (raw or {}):
            out[k] = bool(raw[k])
    if "lead_minutes" in (raw or {}):
        try:
            n = int(raw["lead_minutes"])
            if n in LEAD_CHOICES:
                out["lead_minutes"] = n
        except (TypeError, ValueError):
            pass
    return out


def notify(db: Session, owner: User | None, kind: str, title: str, body: str, url: str = "/app", tag: str | None = None) -> int:
    """Push one notification to the business owner's devices if they want this kind. Returns devices reached (0 when off)."""
    try:
        if not owner or not prefs(owner).get(kind, True):
            return 0
        return push.notify_user(db, owner.id, title[:120], body[:240], url=url, tag=tag or kind)
    except Exception as exc:  # never let a notification break the request that caused it
        log.warning("notification (%s) for user %s failed: %s", kind, getattr(owner, "id", "?"), exc)
        return 0
