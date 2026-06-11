"""Platform-owner dashboard: manage chef accounts, subscriptions, pricing and payments."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import (
    Booking, Client, ClientReview, Design, Expense, Idea, InventoryItem, Invoice,
    OnlineOrder, Payment, RoutePlan, Recipe, ShoppingList, SupportTicket, Task, User,
)
from ..utils import to_dict
from .billing import get_settings

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
        if chef.subscription_status == "active" and chef.plan in settings.plans:
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
