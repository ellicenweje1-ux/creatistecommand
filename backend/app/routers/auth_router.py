import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config, mailer
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
    return {"token": create_token(user), "user": user_payload(user)}


@router.post("/login")
def login(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.get("password") or "", user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    data = user_payload(user)
    owner = workspace_owner(db, user)
    data["plan"] = owner.plan
    data["plan_level"] = plan_level(owner)
    data["subscription_status"] = owner.subscription_status if user.role == "staff" else user.subscription_status
    data["business_name"] = owner.business_name or data.get("business_name")
    data["is_staff"] = user.role == "staff"
    return {"token": create_token(user), "user": data}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = user_payload(user)
    owner = workspace_owner(db, user)
    data["plan"] = owner.plan
    data["plan_level"] = plan_level(owner)
    data["subscription_status"] = owner.subscription_status if user.role == "staff" else user.subscription_status
    data["business_name"] = owner.business_name or data.get("business_name")
    data["is_staff"] = user.role == "staff"
    return data


@router.put("/me")
def update_me(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for field in ("name", "business_name", "phone", "currency", "avatar_url"):
        if field in payload:
            setattr(user, field, payload[field] or "")
    db.commit()
    db.refresh(user)
    return user_payload(user)


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
def forgot_password(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Start a password reset. Responds identically whether or not the email is on file
    (so the form can't be used to discover who has an account). When SMTP is configured
    the user gets a reset link; otherwise they're told to contact support."""
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
