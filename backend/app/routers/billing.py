"""Onboarding fees + subscriptions. With STRIPE_SECRET_KEY set, real Stripe Checkout is used;
without it the platform runs in demo billing mode so the full flow stays testable."""
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config
from ..auth import get_current_user
from ..database import get_db
from ..models import Payment, PlatformSettings, User
from ..utils import to_dict

router = APIRouter(prefix="/billing", tags=["billing"])

CURRENCY_SYMBOLS = {"GBP": "£", "USD": "$", "EUR": "€", "NGN": "₦", "AUD": "A$", "CAD": "C$"}


def get_settings(db: Session) -> PlatformSettings:
    settings = db.get(PlatformSettings, 1)
    if not settings:
        settings = PlatformSettings(id=1, currency=config.DEFAULT_CURRENCY, trial_days=0, plans=config.DEFAULT_PLANS)
        db.add(settings)
        db.commit()
    return settings


def stripe_enabled() -> bool:
    return bool(config.STRIPE_SECRET_KEY)


def _stripe():
    import stripe

    stripe.api_key = config.STRIPE_SECRET_KEY
    return stripe


@router.get("/plans")
def plans(db: Session = Depends(get_db)):
    settings = get_settings(db)
    return {
        "plans": settings.plans,
        "currency": settings.currency,
        "symbol": CURRENCY_SYMBOLS.get(settings.currency, settings.currency + " "),
        "trial_days": settings.trial_days,
        "stripe_enabled": stripe_enabled(),
    }


@router.get("/status")
def status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payments = (
        db.query(Payment).filter(Payment.user_id == user.id).order_by(Payment.created_at.desc()).all()
    )
    return {
        "subscription_status": user.subscription_status,
        "plan": user.plan,
        "onboarding_paid": user.onboarding_paid,
        "trial_ends_at": user.trial_ends_at,
        "stripe_enabled": stripe_enabled(),
        "payments": [to_dict(p) for p in payments],
    }


def _activate(db: Session, user: User, plan_key: str, provider: str, reference: str, settings: PlatformSettings):
    plan = settings.plans.get(plan_key)
    if not plan:
        raise HTTPException(422, "Unknown plan")
    user.plan = plan_key
    user.subscription_status = "active"
    if not user.onboarding_paid:
        user.onboarding_paid = True
        db.add(Payment(
            user_id=user.id, kind="onboarding", amount=plan.get("onboarding", 0),
            currency=settings.currency, provider=provider, reference=reference,
            note=f"Onboarding fee — {plan.get('name', plan_key)}",
        ))
    db.add(Payment(
        user_id=user.id, kind="subscription", amount=plan.get("monthly", 0),
        currency=settings.currency, provider=provider, reference=reference,
        note=f"Monthly subscription — {plan.get('name', plan_key)}",
    ))
    db.commit()


@router.post("/checkout")
def checkout(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    settings = get_settings(db)
    plan_key = payload.get("plan") or ""
    plan = settings.plans.get(plan_key)
    if not plan:
        raise HTTPException(422, "Unknown plan")
    if not stripe_enabled():
        return {"demo": True}

    stripe = _stripe()
    currency = settings.currency.lower()
    line_items = [{
        "price_data": {
            "currency": currency,
            "product_data": {"name": f"The Creatiste Command — {plan['name']} (monthly)"},
            "unit_amount": int(round(plan["monthly"] * 100)),
            "recurring": {"interval": "month"},
        },
        "quantity": 1,
    }]
    if not user.onboarding_paid and plan.get("onboarding"):
        line_items.append({
            "price_data": {
                "currency": currency,
                "product_data": {"name": f"The Creatiste Command — {plan['name']} onboarding & setup"},
                "unit_amount": int(round(plan["onboarding"] * 100)),
            },
            "quantity": 1,
        })
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=line_items,
        customer_email=user.email if not user.stripe_customer_id else None,
        customer=user.stripe_customer_id or None,
        success_url=f"{config.APP_URL}/onboarding?paid=1",
        cancel_url=f"{config.APP_URL}/onboarding?cancelled=1",
        metadata={"user_id": str(user.id), "plan": plan_key},
        subscription_data={"metadata": {"user_id": str(user.id), "plan": plan_key}},
    )
    return {"url": session.url}


@router.post("/demo-activate")
def demo_activate(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if stripe_enabled():
        raise HTTPException(400, "Stripe is configured — use the checkout flow")
    settings = get_settings(db)
    _activate(db, user, payload.get("plan") or "", "demo", "demo-checkout", settings)
    return {"ok": True, "subscription_status": user.subscription_status, "plan": user.plan}


@router.post("/cancel")
def cancel(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if stripe_enabled() and user.stripe_subscription_id:
        try:
            _stripe().Subscription.modify(user.stripe_subscription_id, cancel_at_period_end=True)
        except Exception as exc:  # surface Stripe errors as API errors
            raise HTTPException(502, f"Stripe error: {exc}")
    user.subscription_status = "canceled"
    db.commit()
    return {"ok": True}


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    if not stripe_enabled():
        raise HTTPException(400, "Stripe not configured")
    stripe = _stripe()
    if config.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                body, request.headers.get("stripe-signature", ""), config.STRIPE_WEBHOOK_SECRET
            )
        except Exception:
            raise HTTPException(400, "Invalid webhook signature")
    else:
        import json

        event = json.loads(body)

    etype = event["type"]
    data = event["data"]["object"]
    settings = get_settings(db)

    if etype == "checkout.session.completed":
        user = db.get(User, int(data.get("metadata", {}).get("user_id") or 0))
        if user:
            user.stripe_customer_id = data.get("customer") or user.stripe_customer_id
            user.stripe_subscription_id = data.get("subscription") or user.stripe_subscription_id
            _activate(db, user, data.get("metadata", {}).get("plan") or user.plan, "stripe", data.get("id", ""), settings)
    elif etype == "invoice.payment_failed":
        sub_id = data.get("subscription")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first() if sub_id else None
        if user:
            user.subscription_status = "suspended"
            db.commit()
    elif etype == "customer.subscription.deleted":
        user = db.query(User).filter(User.stripe_subscription_id == data.get("id")).first()
        if user:
            user.subscription_status = "canceled"
            db.commit()
    return {"received": True, "at": datetime.now(timezone.utc).isoformat()}
