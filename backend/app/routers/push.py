"""Web Push subscribe/unsubscribe + a test ping. The actual sending lives in app/push.py;
task-deadline pushes are fired by the scheduler sweep (app/scheduler.py). All endpoints are
no-ops/clear errors when push isn't configured on the server."""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import push
from ..auth import get_current_user
from ..database import get_db
from ..models import PushSubscription, User

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/config")
def push_config(user: User = Depends(get_current_user)):
    """What the app needs to subscribe: whether push is on, and the public key."""
    return {"enabled": push.push_enabled(), "public_key": push.public_key()}


@router.post("/subscribe", status_code=201)
def subscribe(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Register (or refresh) a browser push subscription for this user's device."""
    sub = payload.get("subscription") or payload
    endpoint = (sub.get("endpoint") or "").strip()
    keys = sub.get("keys") or {}
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        raise HTTPException(422, "Invalid push subscription")
    existing = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user.id, PushSubscription.endpoint == endpoint)
        .first()
    )
    if existing:
        existing.p256dh = keys["p256dh"]
        existing.auth = keys["auth"]
        existing.user_agent = (payload.get("user_agent") or "")[:255]
    else:
        db.add(PushSubscription(
            user_id=user.id, endpoint=endpoint,
            p256dh=keys["p256dh"], auth=keys["auth"],
            user_agent=(payload.get("user_agent") or "")[:255],
        ))
    db.commit()
    return {"ok": True}


@router.post("/unsubscribe")
def unsubscribe(payload: dict = Body(default={}), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Drop a device's subscription (or all of this user's, if no endpoint given)."""
    endpoint = (payload.get("endpoint") or "").strip()
    q = db.query(PushSubscription).filter(PushSubscription.user_id == user.id)
    if endpoint:
        q = q.filter(PushSubscription.endpoint == endpoint)
    removed = q.delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "removed": removed}


@router.post("/test")
def test_push(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Send a test notification to this user's devices — drives the Settings 'Send test'."""
    if not push.push_enabled():
        raise HTTPException(503, "Phone notifications aren't configured on the server yet.")
    sent = push.notify_user(
        db, user.id, "The Creatiste Command",
        "Notifications are on — you'll get a heads-up before a task is due.",
        url="/app/tasks", tag="cc-test",
    )
    if not sent:
        raise HTTPException(400, "No device is subscribed on this account yet. Turn the toggle on first.")
    return {"sent": sent}
