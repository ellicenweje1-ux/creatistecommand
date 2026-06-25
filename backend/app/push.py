"""Web Push notifications — phone alerts for tasks about to time out.

Inert until the VAPID keys are configured (see config). Without them push_enabled() is
False, the Settings toggle shows "not configured", and nothing is ever sent — the same
graceful-degradation pattern as Stripe / email / Zoom.

Generate a keypair once and set the three env vars it prints:

    python -m app.push --gen

On iOS, web push only reaches the app once it's been *added to the Home Screen* (a PWA) —
that's an Apple platform rule, not a limitation here.
"""
import json
import logging

from sqlalchemy.orm import Session

from . import config
from .models import PushSubscription

log = logging.getLogger("push")
_vapid_cache = None


def _available() -> bool:
    try:
        import pywebpush  # noqa: F401
        return True
    except Exception:
        return False


def push_enabled() -> bool:
    """True when the server can actually send pushes (keys set + library present)."""
    return bool(config.VAPID_PUBLIC_KEY and config.VAPID_PRIVATE_KEY) and _available()


def public_key() -> str:
    """The applicationServerKey the browser needs to subscribe (base64url)."""
    return config.VAPID_PUBLIC_KEY


def _vapid():
    global _vapid_cache
    if _vapid_cache is None:
        from py_vapid import Vapid01
        _vapid_cache = Vapid01.from_string(private_key=config.VAPID_PRIVATE_KEY)
    return _vapid_cache


def _sub_info(sub: PushSubscription) -> dict:
    return {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}


def send_one(sub_info: dict, payload: dict, ttl: int = 86400):
    """Send a single push. Raises WebPushException on failure (caller decides what to do)."""
    from pywebpush import webpush
    return webpush(
        subscription_info=sub_info,
        data=json.dumps(payload),
        vapid_private_key=_vapid(),
        vapid_claims={"sub": config.VAPID_SUBJECT},
        ttl=ttl,
    )


def notify_user(db: Session, user_id: int, title: str, body: str, url: str | None = None, tag: str | None = None) -> int:
    """Push a notification to every device a user has registered. Dead subscriptions
    (the browser unsubscribed / endpoint gone — 404/410) are pruned. Returns how many
    were delivered. No-op (returns 0) when push isn't configured."""
    if not push_enabled():
        return 0
    payload = {"title": title, "body": body, "url": url or "/app/tasks", "tag": tag or "cc"}
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    sent, stale = 0, []
    for sub in subs:
        try:
            send_one(_sub_info(sub), payload)
            sent += 1
        except Exception as exc:  # pywebpush raises WebPushException; never crash the sweep
            code = getattr(getattr(exc, "response", None), "status_code", None)
            if code in (404, 410):
                stale.append(sub)
            else:
                log.warning("push to user %s failed: %s", user_id, exc)
    for sub in stale:
        db.delete(sub)
    if stale:
        db.commit()
    return sent


def _generate_and_print():
    """Print a fresh VAPID keypair + the env vars to set."""
    import base64

    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid01

    v = Vapid01()
    v.generate_keys()
    raw_pub = v.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    raw_priv = v.private_key.private_numbers().private_value.to_bytes(32, "big")
    pub = base64.urlsafe_b64encode(raw_pub).rstrip(b"=").decode()
    priv = base64.urlsafe_b64encode(raw_priv).rstrip(b"=").decode()
    print("# Set these on the server (Render → Environment), then redeploy:\n")
    print(f"VAPID_PUBLIC_KEY={pub}")
    print(f"VAPID_PRIVATE_KEY={priv}")
    print("VAPID_SUBJECT=mailto:command@thecreatistecatering.com")


if __name__ == "__main__":
    import sys

    if "--gen" in sys.argv:
        _generate_and_print()
    else:
        print("Usage: python -m app.push --gen   # generate a VAPID keypair")
