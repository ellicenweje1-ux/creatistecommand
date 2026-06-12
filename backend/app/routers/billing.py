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
        "has_stripe_customer": bool(user.stripe_customer_id),
        "payments": [to_dict(p) for p in payments],
    }


def plan_info(db: Session, settings: PlatformSettings, plan_key: str) -> dict | None:
    """Resolve a plan's name/pricing: the standard tiers from settings.plans, plus the
    private founders membership (lifetime rate — never listed on public pages)."""
    if plan_key == "founders":
        from .founders import founders_config

        cfg = founders_config(db, settings)
        return {
            "name": cfg.get("name") or "Founders Membership",
            "monthly": cfg.get("monthly") or 0,
            "onboarding": cfg.get("onboarding") or 0,
        }
    return settings.plans.get(plan_key)


def _activate(db: Session, user: User, plan_key: str, provider: str, reference: str, settings: PlatformSettings):
    """Flip the account active and record the activation payments. Safe to call twice for
    the same checkout (webhook + redirect confirmation): payment rows are keyed on the
    Stripe reference, so duplicates are skipped."""
    plan = plan_info(db, settings, plan_key)
    if not plan:
        raise HTTPException(422, "Unknown plan")
    user.plan = plan_key
    user.subscription_status = "active"
    if reference and db.query(Payment).filter(
        Payment.user_id == user.id, Payment.reference == reference
    ).first():
        db.commit()
        return
    if not user.onboarding_paid:
        user.onboarding_paid = True
        if plan.get("onboarding"):  # founders have the fee waived — no zero-amount record
            db.add(Payment(
                user_id=user.id, kind="onboarding", amount=plan.get("onboarding", 0),
                currency=settings.currency, provider=provider, reference=reference,
                note=f"Onboarding fee — {plan.get('name', plan_key)}",
            ))
    db.add(Payment(
        user_id=user.id, kind="subscription", amount=plan.get("monthly", 0),
        currency=settings.currency, provider=provider, reference=reference,
        note=f"Monthly subscription — {plan.get('name', plan_key)}"
        + (" (lifetime founders rate)" if plan_key == "founders" else ""),
    ))
    db.commit()


@router.post("/checkout")
def checkout(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    settings = get_settings(db)
    plan_key = payload.get("plan") or ""
    if plan_key == "founders" and not user.is_founder:
        raise HTTPException(403, "The founders membership is private — by invitation only.")
    plan = plan_info(db, settings, plan_key)
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
    subscription_data = {"metadata": {"user_id": str(user.id), "plan": plan_key}}
    # Subscribing mid-trial: take the card now, start billing when the trial ends —
    # the remaining free days stay free and renewal is automatic from then on.
    if user.subscription_status == "trialing" and user.trial_ends_at:
        remaining = (
            datetime.strptime(user.trial_ends_at, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            - datetime.now(timezone.utc)
        ).days + 1
        if remaining > 0:
            subscription_data["trial_period_days"] = remaining
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=line_items,
        customer_email=user.email if not user.stripe_customer_id else None,
        customer=user.stripe_customer_id or None,
        success_url=f"{config.APP_URL}/onboarding?paid=1&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{config.APP_URL}/onboarding?cancelled=1",
        metadata={"user_id": str(user.id), "plan": plan_key},
        subscription_data=subscription_data,
    )
    return {"url": session.url}


@router.post("/demo-activate")
def demo_activate(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if stripe_enabled():
        raise HTTPException(400, "Stripe is configured — use the checkout flow")
    plan_key = payload.get("plan") or ""
    if plan_key == "founders" and not user.is_founder:
        raise HTTPException(403, "The founders membership is private — by invitation only.")
    settings = get_settings(db)
    _activate(db, user, plan_key, "demo", "demo-checkout", settings)
    return {"ok": True, "subscription_status": user.subscription_status, "plan": user.plan}


@router.post("/confirm")
def confirm(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Called when the user lands back from Stripe Checkout (?paid=1&session_id=...).
    Verifies the session server-side and activates immediately — so activation works
    even before the webhook is configured, and without waiting for it to arrive."""
    if not stripe_enabled():
        raise HTTPException(400, "Stripe not configured")
    session_id = (payload.get("session_id") or "").strip()
    if not session_id:
        raise HTTPException(422, "session_id required")
    stripe = _stripe()
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        raise HTTPException(502, f"Stripe error: {exc}")
    if str((session.get("metadata") or {}).get("user_id") or "") != str(user.id):
        raise HTTPException(403, "This checkout session belongs to a different account")
    if session.get("payment_status") not in ("paid", "no_payment_required") or session.get("status") != "complete":
        return {"status": session.get("payment_status") or "incomplete"}
    user.stripe_customer_id = session.get("customer") or user.stripe_customer_id
    user.stripe_subscription_id = session.get("subscription") or user.stripe_subscription_id
    settings = get_settings(db)
    _activate(db, user, (session.get("metadata") or {}).get("plan") or user.plan, "stripe", session_id, settings)
    return {"status": "active"}


@router.post("/portal")
def portal(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Stripe customer portal: update card, view invoices, cancel — all self-serve."""
    if not stripe_enabled():
        raise HTTPException(400, "Stripe not configured — billing is in demo mode")
    if not user.stripe_customer_id:
        raise HTTPException(400, "No Stripe customer on this account yet — subscribe first")
    try:
        session = _stripe().billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=f"{config.APP_URL}/app/settings",
        )
    except Exception as exc:
        raise HTTPException(502, f"Stripe error: {exc}")
    return {"url": session.url}


@router.post("/cancel")
def cancel(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if stripe_enabled() and user.stripe_subscription_id:
        # Real subscription: cancel at period end — the chef keeps the access they've
        # paid for, and the webhook flips the account to canceled when Stripe ends it.
        try:
            sub = _stripe().Subscription.modify(user.stripe_subscription_id, cancel_at_period_end=True)
        except Exception as exc:  # surface Stripe errors as API errors
            raise HTTPException(502, f"Stripe error: {exc}")
        ends = sub.get("current_period_end")
        ends_at = datetime.fromtimestamp(ends, tz=timezone.utc).strftime("%Y-%m-%d") if ends else None
        return {"ok": True, "ends_at": ends_at}
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
    elif etype in ("invoice.paid", "invoice.payment_succeeded"):
        # Monthly renewals (and recovery after a failed payment): reactivate and record
        # the real charge. The first invoice of a subscription is skipped — checkout
        # activation already recorded it.
        sub_id = data.get("subscription")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first() if sub_id else None
        if user:
            if user.subscription_status in ("suspended", "pending", "trialing"):
                user.subscription_status = "active"
            amount = (data.get("amount_paid") or 0) / 100
            reference = data.get("id") or ""
            already = reference and db.query(Payment).filter(
                Payment.user_id == user.id, Payment.reference == reference
            ).first()
            if amount > 0 and not already and data.get("billing_reason") != "subscription_create":
                plan = plan_info(db, settings, user.plan) or {}
                db.add(Payment(
                    user_id=user.id, kind="subscription", amount=amount,
                    currency=(data.get("currency") or settings.currency).upper(),
                    provider="stripe", reference=reference,
                    note=f"Monthly subscription — {plan.get('name', user.plan)}",
                ))
            db.commit()
    elif etype == "invoice.payment_failed":
        sub_id = data.get("subscription")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first() if sub_id else None
        if user:
            user.subscription_status = "suspended"
            db.commit()
    elif etype == "customer.subscription.updated":
        user = db.query(User).filter(User.stripe_subscription_id == data.get("id")).first()
        if user:
            stripe_status = data.get("status")
            if stripe_status in ("past_due", "unpaid"):
                user.subscription_status = "suspended"
            elif stripe_status == "canceled":
                user.subscription_status = "canceled"
            elif stripe_status in ("active", "trialing") and user.subscription_status in ("suspended", "canceled", "pending"):
                user.subscription_status = "active"  # payment recovered / cancellation undone
            db.commit()
    elif etype == "customer.subscription.deleted":
        user = db.query(User).filter(User.stripe_subscription_id == data.get("id")).first()
        if user:
            user.subscription_status = "canceled"
            db.commit()
    return {"received": True, "at": datetime.now(timezone.utc).isoformat()}
