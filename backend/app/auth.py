"""Password hashing (bcrypt), JWT issuing/verification and FastAPI auth dependencies.

Roles: admin (platform owner), chef (business owner / workspace owner), staff
(belongs to a chef's workspace via owner_id — works on the owner's data)."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .models import User

# founders = the private launch membership: full Elite access at a lifetime rate
PLAN_LEVELS = {"starter": 1, "pro": 2, "elite": 3, "founders": 3}


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


def workspace_owner(db: Session, user: User) -> User:
    """The chef account whose data this user works on (self unless staff)."""
    if user.role == "staff" and user.owner_id:
        owner = db.get(User, user.owner_id)
        if owner:
            return owner
    return user


def plan_level(owner: User) -> int:
    if owner.role == "admin":
        return 3
    return PLAN_LEVELS.get(owner.plan, 3 if owner.subscription_status == "trialing" else 1)


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
    # staff accounts can be deactivated by their owner
    if user.role == "staff" and user.subscription_status == "suspended":
        raise HTTPException(403, "Your staff account has been deactivated — speak to the business owner.")
    return user


def _trial_expired(user: User) -> bool:
    if user.subscription_status != "trialing" or not user.trial_ends_at:
        return False
    return user.trial_ends_at < datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _owner_active(owner: User) -> bool:
    if owner.role == "admin":
        return True
    # Verification gate: nobody uses the platform before their onboarding session
    # is marked complete — regardless of trial or payment state.
    if not owner.onboarded_at:
        return False
    if owner.subscription_status == "active":
        return True
    return owner.subscription_status == "trialing" and not _trial_expired(owner)


def require_active(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    """Gate for workspace endpoints: the workspace owner must be onboarded (verified
    on a call with the platform owner) and their subscription active or in trial."""
    owner = workspace_owner(db, user)
    if _owner_active(owner):
        user.workspace_id = owner.id
        user.workspace_plan_level = plan_level(owner)
        return user
    if user.role == "staff":
        raise HTTPException(403, "The business owner's subscription is inactive.")
    if not owner.onboarded_at:
        raise HTTPException(402, "Book your onboarding session to unlock your kitchen — your free trial starts right after the call.")
    raise HTTPException(402, "Subscription required. Complete onboarding to activate your account.")


def require_owner(user: User = Depends(require_active)) -> User:
    """Owner-only areas (finance, quotes, team management, billing actions)."""
    if user.role == "staff":
        raise HTTPException(403, "This area is for the business owner.")
    return user


def require_plan(min_level: int):
    """Feature gate by subscription tier (1=Solo, 2=Pro, 3=Elite)."""

    def dep(user: User = Depends(require_active)) -> User:
        if user.workspace_plan_level < min_level:
            names = {2: "Pro Caterer", 3: "Elite Kitchen"}
            raise HTTPException(403, f"This feature is part of the {names.get(min_level, 'higher')} plan — upgrade to unlock it.")
        return user

    return dep


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user
