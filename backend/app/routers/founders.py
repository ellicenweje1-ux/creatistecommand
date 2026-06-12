"""Founders Membership — the private launch programme for the platform's first chefs.

Invite-only: the offer lives behind a secret link (shared by hand from Admin →
Founders) and never appears on public pages. Founding seats are limited; closing
the programme — or filling every seat — kills the link for good. Founding members
keep their lifetime rate and their number forever."""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import config, mailer
from ..auth import get_current_user
from ..database import get_db
from ..models import FounderFeedback, PlatformSettings, User
from .billing import CURRENCY_SYMBOLS, get_settings

router = APIRouter(prefix="/founders", tags=["founders"])

# "Once the client has used the programme for 5 days, we will speak again."
CHECK_IN_AFTER_DAYS = 5


def founders_config(db: Session, settings: PlatformSettings | None = None) -> dict:
    """Current founders-programme config; initialises defaults + the secret code once.
    Always assigns a fresh dict — JSON columns must never be mutated in place."""
    settings = settings or get_settings(db)
    cfg = settings.founders or {}
    if not cfg.get("code"):
        cfg = {**config.DEFAULT_FOUNDERS, **cfg, "code": uuid.uuid4().hex[:12]}
        settings.founders = cfg
        db.commit()
    return cfg


def founders_taken(db: Session) -> int:
    return db.query(func.count(User.id)).filter(User.is_founder == True).scalar() or 0  # noqa: E712


def founders_days_in(user: User) -> int:
    if not user.founder_since:
        return 0
    try:
        return max(0, (datetime.now(timezone.utc).date() - date.fromisoformat(user.founder_since)).days)
    except ValueError:
        return 0


@router.get("/offer/{code}")
def offer(code: str, db: Session = Depends(get_db)):
    """Public: what the secret invite link shows. A wrong code and a closed
    programme are indistinguishable on purpose — the offer simply isn't there."""
    settings = get_settings(db)
    cfg = founders_config(db, settings)
    taken = founders_taken(db)
    if code != cfg.get("code") or not cfg.get("enabled") or taken >= int(cfg.get("spots") or 0):
        raise HTTPException(404, "The founders programme has closed.")
    elite = (settings.plans or {}).get("elite", {})
    return {
        "name": cfg.get("name") or "Founders Membership",
        "tagline": cfg.get("tagline") or "",
        "monthly": cfg.get("monthly") or 0,
        "onboarding": cfg.get("onboarding") or 0,
        "perks": cfg.get("perks") or [],
        "spots": int(cfg.get("spots") or 0),
        "spots_left": max(0, int(cfg.get("spots") or 0) - taken),
        "currency": settings.currency,
        "symbol": CURRENCY_SYMBOLS.get(settings.currency, settings.currency + " "),
        "trial_days": settings.trial_days,
        "compare_name": elite.get("name") or "Elite Kitchen",
        "compare_monthly": elite.get("monthly") or 0,
        "compare_onboarding": elite.get("onboarding") or 0,
    }


@router.get("/status")
def status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The founder's own view: rate, perks, walkthrough state and the day-5 check-in."""
    if not user.is_founder:
        return {"is_founder": False}
    settings = get_settings(db)
    cfg = founders_config(db, settings)
    feedback = db.query(FounderFeedback).filter(FounderFeedback.user_id == user.id).first()
    days_in = founders_days_in(user)
    return {
        "is_founder": True,
        "founder_number": user.founder_number,
        "founder_since": user.founder_since,
        "days_in": days_in,
        "check_in_after_days": CHECK_IN_AFTER_DAYS,
        "tour_done": bool(user.tour_done),
        "feedback_submitted": bool(feedback),
        "check_in_due": days_in >= CHECK_IN_AFTER_DAYS and not feedback,
        "name": cfg.get("name") or "Founders Membership",
        "monthly": cfg.get("monthly") or 0,
        "onboarding": cfg.get("onboarding") or 0,
        "perks": cfg.get("perks") or [],
        "currency": settings.currency,
        "symbol": CURRENCY_SYMBOLS.get(settings.currency, settings.currency + " "),
    }


@router.post("/tour-done")
def finish_tour(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.tour_done = True
    db.commit()
    return {"ok": True}


@router.post("/feedback", status_code=201)
def submit_feedback(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Day-5 check-in answers — stored for Admin → Founders and emailed to the founder."""
    if not user.is_founder:
        raise HTTPException(403, "The founders check-in is for founding members.")
    thoughts = (payload.get("thoughts") or "").strip()[:5000]
    benefits = (payload.get("benefits") or "").strip()[:5000]
    changes = (payload.get("changes") or "").strip()[:5000]
    if not (thoughts or benefits or changes):
        raise HTTPException(422, "Share at least one thought — that's the point of the check-in!")
    feedback = db.query(FounderFeedback).filter(FounderFeedback.user_id == user.id).first()
    if not feedback:
        feedback = FounderFeedback(user_id=user.id)
        db.add(feedback)
    feedback.thoughts, feedback.benefits, feedback.changes = thoughts, benefits, changes
    db.commit()
    mailer.send_email(
        config.SUPPORT_EMAIL,
        f"[Founders check-in] #{user.founder_number} — {user.name or user.email}",
        f"Founding member #{user.founder_number}: {user.name or '-'} <{user.email}> ({user.business_name or '-'})\n"
        f"Day {founders_days_in(user)} of the programme.\n\n"
        f"Thoughts on the programme:\n{thoughts or '—'}\n\n"
        f"How it has benefited them:\n{benefits or '—'}\n\n"
        f"What they'd change / like to see:\n{changes or '—'}\n\n"
        f"— The Creatiste Command founders programme",
    )
    return {"ok": True}
