"""Platform-owner dashboard: manage chef accounts, subscriptions, pricing and payments."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import (
    Booking, Client, ClientReview, Design, Expense, FounderFeedback, Idea, InventoryItem,
    Invoice, OnlineOrder, Payment, RoutePlan, Recipe, ShoppingList, SupportTicket, Task, User,
)
from ..utils import to_dict
from .billing import get_settings
from .founders import founders_config, founders_days_in, founders_taken

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

OWNED_MODELS = (
    Booking, Client, ClientReview, Design, Expense, Idea, InventoryItem,
    Invoice, OnlineOrder, Payment, Recipe, RoutePlan, ShoppingList, Task,
)


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
        {**to_dict(u, exclude=("password_hash",)), "bookings_count": booking_counts.get(u.id, 0)}
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
    return to_dict(user, exclude=("password_hash",))


@router.delete("/chefs/{user_id}", status_code=204)
def delete_chef(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or user.role != "chef":
        raise HTTPException(404, "Chef not found")
    for model in OWNED_MODELS:
        db.query(model).filter(model.user_id == user_id).delete()
    db.delete(user)
    db.commit()


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
