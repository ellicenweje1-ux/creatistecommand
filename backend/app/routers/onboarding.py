"""Onboarding & check-in call booking — the integrated scheduling system.

Every new client books a video onboarding session as part of verification: until the
platform owner marks that call complete, the workspace stays locked, and the free
trial starts the moment it's completed. Founders book a second call on day 5 of the
trial to talk feedback in depth.

Video platform: Zoom when ZOOM_* credentials are configured (meetings are created
automatically through Zoom's server-to-server OAuth API); otherwise a private Jitsi
Meet room per session (free, no account needed) so the flow works out of the box.
MEETING_URL overrides both with one fixed link (e.g. a personal Zoom room)."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config, mailer
from ..auth import get_current_user
from ..database import get_db
from ..models import OnboardingSession, User
from ..utils import to_dict

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

KINDS = {"onboarding", "checkin"}
KIND_LABELS = {"onboarding": "Onboarding session", "checkin": "Founders day-5 check-in"}
MIN_LEAD_HOURS = 3  # earliest bookable slot is a few hours out


def _now():
    return datetime.now(timezone.utc)


def slot_times() -> list[str]:
    return [f"{h:02d}:00" for h in range(config.ONBOARDING_DAY_START, config.ONBOARDING_DAY_END)]


def _booked_set(db: Session) -> set[tuple[str, str]]:
    rows = (
        db.query(OnboardingSession.date, OnboardingSession.start_time)
        .filter(OnboardingSession.status == "booked")
        .all()
    )
    return {(r[0], r[1]) for r in rows}


def available_slots(db: Session) -> list[dict]:
    """Open slots over the booking horizon: Mon–Sat business hours minus taken slots."""
    taken = _booked_set(db)
    cutoff = _now() + timedelta(hours=MIN_LEAD_HOURS)
    days = []
    for offset in range(config.ONBOARDING_DAYS_AHEAD + 1):
        day = (_now() + timedelta(days=offset)).date()
        if day.weekday() not in config.ONBOARDING_WEEKDAYS:
            continue
        date_str = day.isoformat()
        times = [
            t for t in slot_times()
            if (date_str, t) not in taken
            and datetime.fromisoformat(f"{date_str}T{t}:00+00:00") >= cutoff
        ]
        if times:
            days.append({"date": date_str, "times": times})
    return days


def create_meeting(user: User, kind: str, date: str, start_time: str) -> tuple[str, str]:
    """Return (meeting_url, provider). Zoom API → fixed MEETING_URL → private Jitsi room."""
    if config.ZOOM_ACCOUNT_ID and config.ZOOM_CLIENT_ID and config.ZOOM_CLIENT_SECRET:
        try:
            import httpx

            token = httpx.post(
                "https://zoom.us/oauth/token",
                params={"grant_type": "account_credentials", "account_id": config.ZOOM_ACCOUNT_ID},
                auth=(config.ZOOM_CLIENT_ID, config.ZOOM_CLIENT_SECRET),
                timeout=15,
            ).json()["access_token"]
            meeting = httpx.post(
                "https://api.zoom.us/v2/users/me/meetings",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "topic": f"The Creatiste Command — {KIND_LABELS[kind]} with {user.name or user.email}",
                    "type": 2,  # scheduled
                    "start_time": f"{date}T{start_time}:00",
                    "duration": config.ONBOARDING_SLOT_MINUTES,
                    "settings": {"waiting_room": True, "join_before_host": False},
                },
                timeout=15,
            ).json()
            if meeting.get("join_url"):
                return meeting["join_url"], "zoom"
        except Exception:
            pass  # fall through — a broken Zoom config must never block a booking
    if config.MEETING_URL:
        return config.MEETING_URL, "custom"
    return f"https://meet.jit.si/creatiste-{kind}-{secrets.token_hex(5)}", "jitsi"


def book_session(db: Session, user: User, kind: str, date: str, start_time: str) -> OnboardingSession:
    """Shared booking logic (used here and by the founders check-in)."""
    open_days = {d["date"]: set(d["times"]) for d in available_slots(db)}
    if start_time not in open_days.get(date, set()):
        raise HTTPException(409, "That slot has just been taken — pick another.")
    # One live booking per kind: rebooking replaces the previous one.
    existing = (
        db.query(OnboardingSession)
        .filter(OnboardingSession.user_id == user.id, OnboardingSession.kind == kind,
                OnboardingSession.status == "booked")
        .first()
    )
    if existing:
        existing.status = "cancelled"
    url, provider = create_meeting(user, kind, date, start_time)
    session = OnboardingSession(
        user_id=user.id, kind=kind, date=date, start_time=start_time,
        duration_min=config.ONBOARDING_SLOT_MINUTES, meeting_url=url, provider=provider,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    label = KIND_LABELS[kind]
    when = f"{date} at {start_time}"
    mailer.send_email(
        user.email, f"Your {label.lower()} is booked — {when}",
        f"Hi {user.name or 'chef'},\n\nYour {label.lower()} is booked for {when} "
        f"({session.duration_min} minutes).\nJoin the video call here: {url}\n\n"
        f"Need to move it? Rebook from the app any time before the call.\n\n— The Creatiste Command",
    )
    mailer.send_email(
        config.SUPPORT_EMAIL, f"[{label}] {user.name or user.email} — {when}",
        f"{label} booked.\n\nClient: {user.name or '-'} <{user.email}>\n"
        f"Business: {user.business_name or '-'}\nPlan: {user.plan or 'undecided'}"
        f"{' · FOUNDING MEMBER #%s' % user.founder_number if user.is_founder else ''}\n"
        f"When: {when} ({session.duration_min} min)\nJoin link: {url}\n\n"
        f"Mark it complete in Admin → Onboarding after the call to unlock their trial.",
    )
    return session


@router.get("/slots")
def slots(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"days": available_slots(db), "duration_min": config.ONBOARDING_SLOT_MINUTES}


@router.get("/mine")
def my_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(OnboardingSession)
        .filter(OnboardingSession.user_id == user.id)
        .order_by(OnboardingSession.created_at.desc())
        .all()
    )
    return {
        "onboarded_at": user.onboarded_at,
        "sessions": [to_dict(s, exclude=("transcript", "ai_summary", "notes")) for s in rows],
    }


@router.post("/book", status_code=201)
def book(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    kind = payload.get("kind") or "onboarding"
    if kind not in KINDS:
        raise HTTPException(422, "Unknown session kind")
    if kind == "checkin" and not user.is_founder:
        raise HTTPException(403, "Check-in calls are part of the founders programme.")
    if kind == "onboarding" and user.onboarded_at:
        raise HTTPException(409, "You're already onboarded — your kitchen is unlocked.")
    date = (payload.get("date") or "").strip()
    start_time = (payload.get("start_time") or "").strip()
    session = book_session(db, user, kind, date, start_time)
    return to_dict(session, exclude=("transcript", "ai_summary", "notes"))


@router.post("/cancel/{session_id}")
def cancel(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.get(OnboardingSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404, "Session not found")
    if session.status != "booked":
        raise HTTPException(409, "Only booked sessions can be cancelled.")
    session.status = "cancelled"
    db.commit()
    mailer.send_email(
        config.SUPPORT_EMAIL, f"[{KIND_LABELS[session.kind]}] cancelled — {user.name or user.email}",
        f"{user.name or user.email} cancelled their {KIND_LABELS[session.kind].lower()} "
        f"that was booked for {session.date} at {session.start_time}.",
    )
    return {"ok": True}
