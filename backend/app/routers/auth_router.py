from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import PlatformSettings, User
from ..utils import EMAIL_RE, to_dict

router = APIRouter(prefix="/auth", tags=["auth"])

USER_EXCLUDE = ("password_hash",)


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

    settings = db.get(PlatformSettings, 1)
    trial_days = settings.trial_days if settings else 0
    user = User(
        email=email,
        password_hash=hash_password(password),
        name=(payload.get("name") or "").strip(),
        business_name=(payload.get("business_name") or "").strip(),
        phone=(payload.get("phone") or "").strip(),
        currency=settings.currency if settings else "GBP",
    )
    if trial_days > 0:
        user.subscription_status = "trialing"
        user.trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=trial_days)).strftime("%Y-%m-%d")
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
    return {"token": create_token(user), "user": user_payload(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_payload(user)


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
