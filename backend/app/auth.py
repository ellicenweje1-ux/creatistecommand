"""Password hashing (bcrypt), JWT issuing/verification and FastAPI auth dependencies."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .models import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], password_hash.encode())
    except ValueError:
        return False


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(days=config.TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "User no longer exists")
    return user


def _trial_expired(user: User) -> bool:
    if user.subscription_status != "trialing" or not user.trial_ends_at:
        return False
    return user.trial_ends_at < datetime.now(timezone.utc).strftime("%Y-%m-%d")


def require_active(user: User = Depends(get_current_user)) -> User:
    """Gate for chef workspace endpoints: subscription must be active (or in trial)."""
    if user.role == "admin":
        return user
    if user.subscription_status == "active":
        return user
    if user.subscription_status == "trialing" and not _trial_expired(user):
        return user
    raise HTTPException(402, "Subscription required. Complete onboarding to activate your account.")


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user
