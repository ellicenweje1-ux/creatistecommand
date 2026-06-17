"""Platform-owner dashboard: manage chef accounts, subscriptions, pricing and payments."""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import config, mailer
from ..auth import hash_password, require_admin
from ..database import get_db
from ..models import (
    ActivityLog, Appointment, BlockedSlot, Booking, Client, ClientReview, Design, Expense,
    FounderFeedback, Idea, InventoryItem, Invoice, Menu, OnboardingSession, OnlineOrder, PackingList,
    Payment, Quote, RoutePlan, Recipe, Shift, ShoppingList, Supplier, SupplierPrice,
    SupportTicket, Task, User,
)
from ..utils import to_dict
from .billing import get_settings
from .founders import founders_config, founders_days_in, founders_taken
from .onboarding import _today_local, availability_grid, slot_times
from .public import _public_link

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

# Every table keyed to a user id. When a chef is deleted these are swept for the owner's
# id *and* their staff's ids, so nothing (quotes, suppliers, sessions, logs, tickets…)
# is left orphaned in the database.
PURGE_MODELS = (
    ActivityLog, Appointment, Booking, Client, ClientReview, Design, Expense, FounderFeedback,
    Idea, InventoryItem, Invoice, Menu, OnboardingSession, OnlineOrder, PackingList, Payment, Quote,
    RoutePlan, Recipe, Shift, ShoppingList, Supplier, SupplierPrice, SupportTicket, Task,
)

# Fields stripped from any chef record sent to the admin UI.
USER_EXCLUDE = ("password_hash", "reset_token", "reset_token_expires")


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    settings = get_settings(db)
    chefs = db.query(User).filter(User.role == "chef").all()
    by_status: dict[str, int] = {}
    mrr = 0.0
    for chef in chefs:
        by_status[chef.subscription_status] = by_status.get(chef.subscription_status, 0) + 1
        if chef.subscription_status == "active":
            if chef.plan == "founders":
                mrr += (settings.founders or {}).get("monthly", 0)
            elif chef.plan in settings.plans:
                mrr += settings.plans[chef.plan].get("monthly", 0)
    total_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
    onboarding_revenue = (
        db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.kind == "onboarding").scalar() or 0
    )
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    new_signups = db.query(func.count(User.id)).filter(User.role == "chef", User.created_at >= month_ago).scalar()
    recent_payments = db.query(Payment).order_by(Payment.created_at.desc()).limit(10).all()
    payment_users = {u.id: u.email for u in db.query(User).all()}
    return {
        "chefs_total": len(chefs),
        "by_status": by_status,
        "mrr": mrr,
        "total_revenue": total_revenue,
        "onboarding_revenue": onboarding_revenue,
        "new_signups_30d": new_signups,
        "currency": settings.currency,
        "recent_payments": [
            {**to_dict(p), "user_email": payment_users.get(p.user_id, "?")} for p in recent_payments
        ],
    }


@router.get("/chefs")
def chefs(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(User).filter(User.role == "chef")
    if q:
        like = f"%{q}%"
        query = query.filter((User.email.ilike(like)) | (User.name.ilike(like)) | (User.business_name.ilike(like)))
    users = query.order_by(User.created_at.desc()).all()
    booking_counts = dict(
        db.query(Booking.user_id, func.count(Booking.id)).group_by(Booking.user_id).all()
    )
    return [
        {**to_dict(u, exclude=USER_EXCLUDE), "bookings_count": booking_counts.get(u.id, 0)}
        for u in users
    ]


@router.patch("/chefs/{user_id}")
def update_chef(user_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or user.role != "chef":
        raise HTTPException(404, "Chef not found")
    for field in ("subscription_status", "plan", "admin_notes", "trial_ends_at", "onboarding_paid"):
        if field in payload:
            setattr(user, field, payload[field])
    # Hand-activating a chef counts as verification — don't leave them locked out.
    if payload.get("subscription_status") in ("active", "trialing") and not user.onboarded_at:
        user.onboarded_at = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Granting founder status by hand (e.g. grandfathering an early chef into the programme)
    if payload.get("is_founder") and not user.is_founder:
        user.is_founder = True
        user.founder_number = user.founder_number or founders_taken(db) + 1
        user.founder_since = user.founder_since or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        user.plan = "founders"
    elif payload.get("is_founder") is False and user.is_founder:
        user.is_founder = False
        if user.plan == "founders":
            user.plan = "elite"  # keep their access level until a plan is chosen
    db.commit()
    db.refresh(user)
    return to_dict(user, exclude=USER_EXCLUDE)


@router.post("/chefs/{user_id}/set-password")
def set_chef_password(user_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Manually set (or generate) a chef's password — the recovery path for a locked-out
    chef until email resets are switched on. Returns the new password once so the admin can
    pass it on securely; the chef should change it in Settings after they log in."""
    user = db.get(User, user_id)
    if not user or user.role != "chef":
        raise HTTPException(404, "Chef not found")
    supplied = (payload.get("password") or "").strip()
    if supplied:
        if len(supplied) < 8:
            raise HTTPException(422, "Password must be at least 8 characters")
        new_password, generated = supplied, False
    else:
        new_password, generated = secrets.token_urlsafe(9), True  # ~12 chars
    user.password_hash = hash_password(new_password)
    user.reset_token = ""
    user.reset_token_expires = ""
    db.commit()
    return {"ok": True, "password": new_password, "generated": generated}


@router.delete("/chefs/{user_id}", status_code=204)
def delete_chef(user_id: int, db: Session = Depends(get_db)):
    """Delete a chef and everything in their workspace — including their staff logins —
    leaving no orphaned rows behind."""
    user = db.get(User, user_id)
    if not user or user.role != "chef":
        raise HTTPException(404, "Chef not found")
    # Staff accounts belong to this owner; clear their rows too (a staff member could
    # hold e.g. a support ticket under their own id).
    staff_ids = [r[0] for r in db.query(User.id).filter(User.owner_id == user_id).all()]
    ids = [user_id, *staff_ids]
    for model in PURGE_MODELS:
        db.query(model).filter(model.user_id.in_(ids)).delete(synchronize_session=False)
    db.query(User).filter(User.owner_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()


@router.get("/backup")
def backup_database():
    """Download a consistent snapshot of the SQLite database (one .db file). The free
    Render tier wipes the disk on every deploy, so until the persistent disk is added
    this is the only safety net — take one before every deploy. Uses SQLite's online
    backup API so it's safe to run while the app is live."""
    import os
    import sqlite3
    import tempfile
    from datetime import datetime as _dt

    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask

    if not config.DATABASE_URL.startswith("sqlite"):
        raise HTTPException(400, "Backup download is only available for SQLite databases.")
    src_path = config.DATABASE_URL.replace("sqlite:///", "", 1)
    if not os.path.exists(src_path):
        raise HTTPException(404, "Database file not found.")

    fd, tmp_path = tempfile.mkstemp(suffix=".db", prefix="creatiste-backup-")
    os.close(fd)
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(tmp_path)
    try:
        with dst:
            src.backup(dst)
    finally:
        src.close()
        dst.close()
    filename = f"creatiste-backup-{_dt.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.db"
    return FileResponse(
        tmp_path, media_type="application/octet-stream", filename=filename,
        background=BackgroundTask(os.unlink, tmp_path),
    )


@router.get("/payments")
def payments(db: Session = Depends(get_db)):
    rows = db.query(Payment).order_by(Payment.created_at.desc()).limit(200).all()
    users = {u.id: u.email for u in db.query(User).all()}
    return [{**to_dict(p), "user_email": users.get(p.user_id, "?")} for p in rows]


@router.post("/payments", status_code=201)
def record_payment(payload: dict = Body(...), db: Session = Depends(get_db)):
    user = db.get(User, int(payload.get("user_id") or 0))
    if not user:
        raise HTTPException(404, "User not found")
    payment = Payment(
        user_id=user.id,
        kind=payload.get("kind") or "manual",
        amount=float(payload.get("amount") or 0),
        currency=payload.get("currency") or get_settings(db).currency,
        provider="manual",
        note=payload.get("note") or "",
    )
    db.add(payment)
    db.commit()
    return to_dict(payment)


@router.get("/settings")
def read_settings(db: Session = Depends(get_db)):
    settings = get_settings(db)
    return {"currency": settings.currency, "trial_days": settings.trial_days, "plans": settings.plans}


@router.put("/settings")
def write_settings(payload: dict = Body(...), db: Session = Depends(get_db)):
    settings = get_settings(db)
    if "currency" in payload:
        settings.currency = payload["currency"]
    if "trial_days" in payload:
        settings.trial_days = int(payload["trial_days"])
    if "plans" in payload and isinstance(payload["plans"], dict):
        settings.plans = payload["plans"]
    db.commit()
    return {"currency": settings.currency, "trial_days": settings.trial_days, "plans": settings.plans}


def _founders_payload(db: Session) -> dict:
    settings = get_settings(db)
    cfg = founders_config(db, settings)
    members = (
        db.query(User).filter(User.is_founder == True).order_by(User.founder_number).all()  # noqa: E712
    )
    feedback = {f.user_id: f for f in db.query(FounderFeedback).all()}
    rows = [
        {
            "id": m.id, "email": m.email, "name": m.name, "business_name": m.business_name,
            "founder_number": m.founder_number, "founder_since": m.founder_since,
            "days_in": founders_days_in(m), "subscription_status": m.subscription_status,
            "tour_done": bool(m.tour_done),
            "feedback": to_dict(feedback[m.id]) if m.id in feedback else None,
        }
        for m in members
    ]
    return {
        "config": cfg,
        "spots_taken": len(members),
        "invite_path": f"/founders/{cfg.get('code')}",
        "currency": settings.currency,
        "members": rows,
    }


@router.get("/founders")
def founders_admin(db: Session = Depends(get_db)):
    """The founders programme: config, the secret invite link, members and their check-ins."""
    return _founders_payload(db)


@router.put("/founders")
def update_founders(payload: dict = Body(...), db: Session = Depends(get_db)):
    settings = get_settings(db)
    cfg = dict(founders_config(db, settings))  # fresh dict — JSON columns are never mutated in place
    if "enabled" in payload:
        cfg["enabled"] = bool(payload["enabled"])
    if "monthly" in payload:
        cfg["monthly"] = float(payload["monthly"]) or 0
    if "onboarding" in payload:
        cfg["onboarding"] = float(payload["onboarding"]) or 0
    if "spots" in payload:
        cfg["spots"] = max(0, int(payload["spots"]))
    if "tagline" in payload:
        cfg["tagline"] = str(payload["tagline"])
    if isinstance(payload.get("perks"), list):
        cfg["perks"] = [str(p).strip() for p in payload["perks"] if str(p).strip()]
    if payload.get("new_code"):  # rotate the secret link; the old one dies immediately
        cfg["code"] = uuid.uuid4().hex[:12]
    settings.founders = cfg
    db.commit()
    return _founders_payload(db)


def _mark_onboarded(db: Session, user: User):
    """The verification moment: unlock the workspace and start the free trial."""
    today = datetime.now(timezone.utc)
    if not user.onboarded_at:
        user.onboarded_at = today.strftime("%Y-%m-%d")
    if user.subscription_status == "pending":
        trial_days = get_settings(db).trial_days
        if trial_days > 0:
            user.subscription_status = "trialing"
            user.trial_ends_at = (today + timedelta(days=trial_days)).strftime("%Y-%m-%d")


@router.get("/onboarding")
def onboarding_sessions(db: Session = Depends(get_db)):
    """Ellice's call calendar: every onboarding & founders check-in session."""
    rows = (
        db.query(OnboardingSession)
        .order_by(OnboardingSession.date.desc(), OnboardingSession.start_time.desc())
        .limit(300)
        .all()
    )
    users = {u.id: u for u in db.query(User).all()}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out = []
    for s in rows:
        u = users.get(s.user_id)
        out.append({
            **to_dict(s),
            "user_email": u.email if u else "?",
            "user_name": (u.business_name or u.name) if u else "?",
            "user_plan": u.plan if u else "",
            "is_founder": bool(u.is_founder) if u else False,
            "founder_number": u.founder_number if u else None,
            "user_onboarded": bool(u.onboarded_at) if u else False,
        })
    upcoming = sorted(
        [s for s in out if s["status"] == "booked" and s["date"] >= today],
        key=lambda s: (s["date"], s["start_time"]),
    )
    past = [s for s in out if s not in upcoming]
    return {"upcoming": upcoming, "past": past, "today": today}


# --- Availability / time off -------------------------------------------------------------
# Ellice's bookable grid: block out holidays and days off so those slots vanish from the
# client booking page. Slot times are Europe/London-local (see routers/onboarding.py).

@router.get("/availability")
def availability(days: int | None = None, db: Session = Depends(get_db)):
    return availability_grid(db, days)


@router.post("/availability/block", status_code=201)
def block_time(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Block a whole day off (omit start_time) or a single slot (HH:MM). Returns the
    refreshed availability so the admin grid updates in one round-trip."""
    date = (payload.get("date") or "").strip()
    start_time = (payload.get("start_time") or "").strip()
    note = (payload.get("note") or "").strip()[:200]
    if len(date) != 10 or date[4] != "-" or date[7] != "-":
        raise HTTPException(422, "A valid date (YYYY-MM-DD) is required.")
    if date < _today_local().isoformat():
        raise HTTPException(422, "That day has already passed.")
    if start_time and start_time not in slot_times():
        raise HTTPException(422, "That isn't a bookable slot time.")
    if not start_time:
        # A whole day off supersedes any single-slot blocks already set for that day.
        db.query(BlockedSlot).filter(
            BlockedSlot.date == date, BlockedSlot.start_time != ""
        ).delete(synchronize_session=False)
    already = (
        db.query(BlockedSlot)
        .filter(BlockedSlot.date == date, BlockedSlot.start_time == start_time)
        .first()
    )
    if not already:
        db.add(BlockedSlot(date=date, start_time=start_time, note=note))
    db.commit()
    return availability_grid(db)


@router.delete("/availability/block/{block_id}")
def unblock_time(block_id: int, db: Session = Depends(get_db)):
    """Lift a block (a day off or a single slot). Idempotent — a missing id just returns
    the current state."""
    block = db.get(BlockedSlot, block_id)
    if block:
        db.delete(block)
        db.commit()
    return availability_grid(db)


@router.patch("/onboarding/{session_id}")
def update_session(session_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    session = db.get(OnboardingSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    for field in ("notes", "transcript"):
        if field in payload:
            setattr(session, field, str(payload[field] or ""))
    status = payload.get("status")
    if status in ("booked", "completed", "cancelled", "no_show"):
        session.status = status
        if status == "completed" and session.kind == "onboarding":
            user = db.get(User, session.user_id)
            if user:
                _mark_onboarded(db, user)
                mailer.send_email(
                    user.email, "You're in — your kitchen is unlocked",
                    f"Hi {user.name or 'chef'},\n\nGreat speaking with you! Your onboarding is complete and "
                    f"your kitchen is now unlocked.\nYour {get_settings(db).trial_days}-day free trial starts "
                    f"today{' — your founders rate is waiting at activation' if user.is_founder else ''}.\n\n"
                    f"Log in and start commanding: {config.APP_URL}\n\n— Ellice, The Creatiste Command",
                )
    db.commit()
    db.refresh(session)
    return to_dict(session)


@router.post("/onboarding/{session_id}/summarize")
def summarize_session(session_id: int, db: Session = Depends(get_db)):
    """AI key points from the call: paste the transcript (or rough notes), get a
    structured summary saved on the session."""
    from .ai import ask_json

    session = db.get(OnboardingSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    source = (session.transcript or session.notes or "").strip()
    if not source:
        raise HTTPException(422, "Paste the call transcript (or notes) first, then summarise.")
    user = db.get(User, session.user_id)
    result = ask_json(
        f"Summarise this {KINDS_LABEL.get(session.kind, 'onboarding')} video call between the founder of a "
        f"chef-management SaaS platform and a client chef ({user.name or user.email if user else 'client'}, "
        f"business: {user.business_name or '-' if user else '-'}).\n\n"
        f"CALL TRANSCRIPT / NOTES:\n---\n{source[:24000]}\n---\n\n"
        "Return JSON: {\"summary\": str (3-4 sentences), \"key_points\": [str], "
        "\"action_items\": [str (each prefixed 'Ellice:' or 'Client:')], "
        "\"feature_requests\": [str], \"sentiment\": str (one line on how the client feels)}",
        max_tokens=4000,
    )
    lines = [result.get("summary", "").strip(), ""]
    for title, key in (("Key points", "key_points"), ("Action items", "action_items"), ("Feature requests", "feature_requests")):
        items = [i for i in (result.get(key) or []) if str(i).strip()]
        if items:
            lines.append(f"{title}:")
            lines.extend(f"• {i}" for i in items)
            lines.append("")
    if result.get("sentiment"):
        lines.append(f"Sentiment: {result['sentiment']}")
    session.ai_summary = "\n".join(lines).strip()
    db.commit()
    return {"ai_summary": session.ai_summary}


KINDS_LABEL = {"onboarding": "onboarding", "checkin": "founders day-5 feedback"}


@router.get("/support")
def support_tickets(db: Session = Depends(get_db)):
    rows = db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(200).all()
    return [to_dict(t) for t in rows]


@router.patch("/support/{ticket_id}")
def update_ticket(ticket_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if payload.get("status") in ("open", "closed"):
        ticket.status = payload["status"]
    db.commit()
    return to_dict(ticket)


# --- Public "Showcase": review feature requests before they go live -----------------------
@router.get("/feature-requests")
def feature_requests(db: Session = Depends(get_db)):
    """Chefs who've asked to be featured on the public site, for the owner to review."""
    rows = db.query(User).filter(User.feature_publicly.is_(True)).all()
    order = {"pending": 0, "approved": 1, "rejected": 2}
    rows.sort(key=lambda u: (order.get(u.feature_status, 9), u.id))
    return [{
        "id": u.id,
        "business_name": u.business_name or u.name or "",
        "email": u.email,
        "logo": u.avatar_url or "",
        "link": _public_link(u.socials or {}),
        "testimonial": (u.testimonial or "").strip(),
        "status": u.feature_status or "none",
        "is_founder": bool(u.is_founder),
    } for u in rows]


@router.post("/feature-requests/{user_id}/approve")
def approve_feature(user_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    """Approve a listing so it shows publicly. An edited testimonial can be passed to fix
    spelling/wording before it goes live."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    if "testimonial" in payload:
        u.testimonial = (payload.get("testimonial") or "").strip()[:600]
    u.feature_publicly = True
    u.feature_status = "approved"
    db.commit()
    return {"ok": True, "status": u.feature_status}


@router.post("/feature-requests/{user_id}/reject")
def reject_feature(user_id: int, db: Session = Depends(get_db)):
    """Keep a listing off the public site (the chef can edit and resubmit)."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    u.feature_status = "rejected"
    db.commit()
    return {"ok": True, "status": u.feature_status}
