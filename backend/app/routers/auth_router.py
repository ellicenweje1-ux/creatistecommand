import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config, mailer, ratelimit
from ..auth import create_token, get_current_user, hash_password, plan_level, verify_password, workspace_owner
from ..database import get_db
from ..models import PlatformSettings, User
from ..utils import EMAIL_RE, to_dict

router = APIRouter(prefix="/auth", tags=["auth"])

# Never leak the secrets a user payload happens to carry.
USER_EXCLUDE = ("password_hash", "reset_token", "reset_token_expires")

RESET_TOKEN_TTL_HOURS = 2


def user_payload(user: User):
    return to_dict(user, exclude=USER_EXCLUDE)


def enriched_user(db: Session, user: User) -> dict:
    """The full client-facing user object: base fields + the workspace overlays the
    frontend relies on (plan_level, is_staff, the owner's business_name + services)."""
    data = user_payload(user)
    owner = workspace_owner(db, user)
    data["plan"] = owner.plan
    data["plan_level"] = plan_level(owner)
    data["subscription_status"] = owner.subscription_status if user.role == "staff" else user.subscription_status
    data["business_name"] = owner.business_name or data.get("business_name")
    data["is_staff"] = user.role == "staff"
    data["services"] = owner.services or []  # owner's service types power the New-Booking dropdown
    data["contact_template"] = owner.contact_template or ""   # business-level contact defaults
    data["contact_channel"] = owner.contact_channel or "both"
    data["ai_enabled"] = bool(config.ANTHROPIC_API_KEY)  # so the UI hides Mise when it's off
    return data


@router.post("/register", status_code=201)
def register(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address")
    if len(password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "An account with this email already exists")

    # Founders programme: a valid secret invite code claims a founding seat.
    founder_cfg = None
    founders_code = (payload.get("founders_code") or "").strip()
    if founders_code:
        from .founders import founders_config, founders_taken

        founder_cfg = founders_config(db)
        if (
            founders_code != founder_cfg.get("code")
            or not founder_cfg.get("enabled")
            or founders_taken(db) >= int(founder_cfg.get("spots") or 0)
        ):
            raise HTTPException(410, "The founders programme has closed — you can still join on a standard plan.")

    settings = db.get(PlatformSettings, 1)
    user = User(
        email=email,
        password_hash=hash_password(password),
        name=(payload.get("name") or "").strip(),
        business_name=(payload.get("business_name") or "").strip(),
        phone=(payload.get("phone") or "").strip(),
        currency=settings.currency if settings else "GBP",
        # Mint the per-account links now so they work immediately (not only after the
        # next startup): the public enquiry form and the private calendar feed.
        enquiry_token=secrets.token_hex(16),
        calendar_token=secrets.token_hex(16),
    )
    if founder_cfg:
        from .founders import founders_taken

        user.is_founder = True
        user.founder_number = founders_taken(db) + 1
        user.founder_since = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        user.plan = "founders"  # full Elite access at the lifetime founders rate
    # Accounts start "pending": every client books an onboarding call first, and the
    # free trial only starts once the admin marks that session complete (see
    # routers/admin.py) — verification before access.
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    # Tell the platform owner a new chef has joined (best-effort; no-op without email).
    mailer.notify_admin(
        f"New chef signed up — {user.business_name or user.name or user.email}",
        f"A new chef has created an account.\n\n"
        f"Name: {user.name or '—'}\n"
        f"Business: {user.business_name or '—'}\n"
        f"Email: {user.email}\n"
        f"Phone: {user.phone or '—'}\n"
        + (f"Founders seat #{user.founder_number} claimed.\n" if user.is_founder else "")
        + "\nThey'll book their onboarding call next. See Admin → Chefs.",
    )
    return {"token": create_token(user), "user": user_payload(user)}


@router.post("/login")
def login(request: Request, payload: dict = Body(...), db: Session = Depends(get_db)):
    # Throttle brute-force guessing: too many failed sign-ins from one IP and we stop
    # checking for a few minutes. Only failures count, so normal repeat logins (or a
    # shared office IP) aren't penalised for getting it right.
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"login:{ip}", config.LOGIN_RATE_WINDOW) >= config.LOGIN_RATE_MAX:
        raise HTTPException(429, "Too many sign-in attempts. Please wait a few minutes and try again.")
    email = (payload.get("email") or "").strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.get("password") or "", user.password_hash):
        ratelimit.record(f"login:{ip}", config.LOGIN_RATE_WINDOW)
        raise HTTPException(401, "Incorrect email or password")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return {"token": create_token(user), "user": enriched_user(db, user)}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return enriched_user(db, user)


@router.put("/me")
def update_me(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    old_avatar = user.avatar_url
    for field in ("name", "business_name", "phone", "currency", "avatar_url",
                  "business_description", "business_email", "contact_channel", "contact_template"):
        if field in payload:
            setattr(user, field, payload[field] or "")
    # Structured business-profile fields. Assign fresh objects (don't mutate in place)
    # so SQLAlchemy detects the JSON change and actually persists it.
    if isinstance(payload.get("services"), list):
        user.services = [str(s).strip() for s in payload["services"] if str(s).strip()][:40]
    if isinstance(payload.get("gallery"), list):
        user.gallery = [str(u) for u in payload["gallery"] if str(u).strip()][:30]
    if isinstance(payload.get("socials"), dict):
        user.socials = {k: str(v).strip() for k, v in payload["socials"].items() if str(v).strip()}
    # Document number prefixes + format templates (Settings → Business). Stripped + capped;
    # the generator falls back gracefully if left blank.
    for field in ("invoice_prefix", "quote_prefix"):
        if field in payload:
            setattr(user, field, str(payload[field] or "").strip()[:12])
    for field in ("invoice_format", "quote_format"):
        if field in payload:
            setattr(user, field, str(payload[field] or "").strip()[:40])
    if "invoice_app_url" in payload:
        user.invoice_app_url = str(payload["invoice_app_url"] or "").strip()[:500]
    if "invoice_accent" in payload:
        user.invoice_accent = str(payload["invoice_accent"] or "").strip()[:20]
    # Payment details (bank / how-to-pay) + a customisable footer line, both shown on invoices.
    if "invoice_payment_details" in payload:
        user.invoice_payment_details = str(payload["invoice_payment_details"] or "").strip()[:1000]
    if "invoice_footer" in payload:
        user.invoice_footer = str(payload["invoice_footer"] or "").strip()[:300]
    # Structured bank presets + an alternative "pay online" link, and per-invoice defaults.
    for field in ("bank_account_name", "bank_name", "bank_sort_code", "bank_account_number",
                  "invoice_payment_link", "invoice_payment_link_label"):
        if field in payload:
            setattr(user, field, str(payload[field] or "").strip()[:500])
    if "invoice_notes_default" in payload:
        user.invoice_notes_default = str(payload["invoice_notes_default"] or "").strip()[:2000]
    if "invoice_deposit_percent" in payload:
        try:
            user.invoice_deposit_percent = max(0, min(100, int(payload["invoice_deposit_percent"] or 0)))
        except (TypeError, ValueError):
            user.invoice_deposit_percent = 0
    # Reusable service charges (delivery/mileage/service fee) for quotes & invoices.
    if isinstance(payload.get("service_charges"), list):
        cleaned = []
        for c in payload["service_charges"]:
            label = str((c or {}).get("label") or "").strip()[:60]
            if not label:
                continue
            cleaned.append({
                "id": str(c.get("id") or uuid.uuid4().hex[:8]),
                "label": label,
                "rate": round(float(c.get("rate") or 0), 2),
                "per": str(c.get("per") or "").strip()[:20],
            })
        user.service_charges = cleaned[:30]
    # Worked-example cards the user has dismissed (page keys; "all" hides everything).
    # Assign a fresh list so SQLAlchemy detects the JSON change.
    if isinstance(payload.get("examples_hidden"), list):
        user.examples_hidden = [str(k).strip()[:30] for k in payload["examples_hidden"] if str(k).strip()][:60]
    # Changing the logo on a live public listing sends it back for re-approval.
    if user.feature_publicly and user.feature_status == "approved" and user.avatar_url != old_avatar:
        user.feature_status = "pending"
    db.commit()
    db.refresh(user)
    return enriched_user(db, user)


@router.post("/feature-request")
def feature_request(payload: dict = Body(default={}), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Chef asks to be featured on the public site. Saves their testimonial and marks the
    listing 'pending' — it does NOT go live until the platform owner approves it."""
    if user.role == "staff":
        raise HTTPException(403, "Only the business owner can manage this.")
    user.testimonial = (payload.get("testimonial") or "").strip()[:600]
    try:
        user.testimonial_rating = max(0, min(5, int(payload.get("rating") or 0)))
    except (TypeError, ValueError):
        user.testimonial_rating = 0
    user.feature_publicly = True
    user.feature_status = "pending"
    db.commit()
    db.refresh(user)
    return enriched_user(db, user)


@router.post("/feature-withdraw")
def feature_withdraw(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Chef removes their business from the public site."""
    if user.role == "staff":
        raise HTTPException(403, "Only the business owner can manage this.")
    user.feature_publicly = False
    user.feature_status = "none"
    db.commit()
    db.refresh(user)
    return enriched_user(db, user)


@router.put("/password")
def change_password(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.get("current") or "", user.password_hash):
        raise HTTPException(401, "Current password is incorrect")
    new = payload.get("new") or ""
    if len(new) < 8:
        raise HTTPException(422, "New password must be at least 8 characters")
    user.password_hash = hash_password(new)
    db.commit()
    return {"ok": True}


@router.get("/config")
def public_config():
    """Tiny public bootstrap so the forgot-password and legal pages know how to reach
    support and whether reset emails can be sent yet."""
    return {"email_enabled": mailer.email_enabled(), "support_email": config.SUPPORT_EMAIL}


@router.post("/forgot-password")
def forgot_password(request: Request, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Start a password reset. Responds identically whether or not the email is on file
    (so the form can't be used to discover who has an account). When SMTP is configured
    the user gets a reset link; otherwise they're told to contact support."""
    # Unauthenticated and it fires off an email — cap per IP so it can't be used to
    # bomb an inbox or burn through our send quota. (IP-only, so it leaks nothing.)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"forgot:{ip}", config.FORGOT_RATE_WINDOW) >= config.FORGOT_RATE_MAX:
        raise HTTPException(429, "Too many reset requests. Please wait a little while and try again.")
    ratelimit.record(f"forgot:{ip}", config.FORGOT_RATE_WINDOW)
    email = (payload.get("email") or "").strip().lower()
    user = db.query(User).filter(User.email == email).first() if EMAIL_RE.match(email) else None
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = (
            datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_TTL_HOURS)
        ).replace(microsecond=0).isoformat()
        db.commit()
        link = f"{config.APP_URL.rstrip('/')}/reset-password?token={token}"
        mailer.send_email(
            user.email, "Reset your Creatiste Command password",
            f"Hi {user.name or 'chef'},\n\nSomeone asked to reset the password for your "
            f"Creatiste Command account. If that was you, set a new one here (the link lasts "
            f"{RESET_TOKEN_TTL_HOURS} hours):\n\n{link}\n\nIf it wasn't you, just ignore this "
            f"email — your password won't change.\n\n— The Creatiste Command",
        )
    return {"ok": True, "email_enabled": mailer.email_enabled(), "support_email": config.SUPPORT_EMAIL}


@router.post("/reset-password")
def reset_password(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Finish a password reset using the emailed token."""
    token = (payload.get("token") or "").strip()
    new = payload.get("password") or ""
    if len(new) < 8:
        raise HTTPException(422, "Password must be at least 8 characters")
    user = db.query(User).filter(User.reset_token == token).first() if token else None
    if not user or not user.reset_token_expires:
        raise HTTPException(400, "This reset link is invalid. Request a new one.")
    try:
        expires = datetime.fromisoformat(user.reset_token_expires)
    except ValueError:
        expires = None
    if not expires or expires < datetime.now(timezone.utc):
        user.reset_token = ""
        user.reset_token_expires = ""
        db.commit()
        raise HTTPException(400, "This reset link has expired. Request a new one.")
    user.password_hash = hash_password(new)
    user.reset_token = ""
    user.reset_token_expires = ""
    db.commit()
    return {"ok": True}
