"""Private, token-scoped iCalendar (.ics) feed of a chef's bookings + tastings.

No login — the secret token in the URL is the credential (like the public enquiry link),
so it can be pasted straight into Apple/Google/Outlook calendar "subscribe by URL". The
chef finds and can rotate the link in Settings → App & integrations.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import ics
from ..database import get_db
from ..models import Appointment, Booking, Client, User

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Map our statuses onto the three iCal event states.
_BOOKING_ICAL = {
    "enquiry": "TENTATIVE", "quoted": "TENTATIVE", "confirmed": "CONFIRMED",
    "in_prep": "CONFIRMED", "completed": "CONFIRMED",
}
_APPT_ICAL = {"scheduled": "TENTATIVE", "completed": "CONFIRMED"}
_APPT_LABEL = {"tasting": "Tasting", "consultation": "Consultation", "site_visit": "Site visit", "call": "Call"}


def device_of(user_agent: str) -> str:
    """Which calendar app is collecting the feed, from its User-Agent (a browser opening the link doesn't count)."""
    ua = (user_agent or "").lower()
    if "dataaccessd" in ua or ua.startswith("ios/") or ua.startswith("ipados/"):
        return "iPhone or iPad"
    if "calendaragent" in ua or ua.startswith("macos/"):
        return "Mac Calendar"
    if "google" in ua:
        return "Google Calendar"
    if "microsoft" in ua or "outlook" in ua:
        return "Outlook"
    if "mozilla" in ua:
        return "browser"
    return "a calendar app"


def _note_fetch(db: Session, owner: User, user_agent: str) -> None:
    """Remember when a calendar app last collected this feed, so the chef can see the link is working."""
    device = device_of(user_agent)
    if device == "browser":
        return
    rules = dict(owner.diary_rules or {})
    feed = dict(rules.get("feed") or {})
    now = datetime.utcnow().replace(microsecond=0)
    try:
        recent = feed.get("last") and (now - datetime.fromisoformat(feed["last"].rstrip("Z"))).total_seconds() < 300
    except ValueError:
        recent = False
    if recent and feed.get("device") == device:
        return
    seen = [d for d in feed.get("devices") or [] if d != device][-3:] + [device]
    rules["feed"] = {"last": now.isoformat() + "Z", "device": device, "devices": seen}
    owner.diary_rules = rules
    db.commit()


@router.get("/{token}.ics")
def calendar_feed(token: str, request: Request, db: Session = Depends(get_db)):
    owner = db.query(User).filter(User.calendar_token == token).first() if token else None
    if not owner or not owner.calendar_token:
        raise HTTPException(404, "This calendar link is invalid or has been reset.")
    try:
        _note_fetch(db, owner, request.headers.get("user-agent", ""))
    except Exception:  # never let bookkeeping break the feed itself
        db.rollback()

    clients = {c.id: c.name for c in db.query(Client).filter(Client.user_id == owner.id).all()}
    events: list[list[str]] = []

    # Planned jobs (the invoice-first calendar): each day of the job plus its shop / prep sessions.
    from .jobs import feed_events

    planned, covered = feed_events(db, owner)
    for e in planned:
        events.append(ics.event(
            uid=f"{e['uid']}@creatistecommand", summary=e["summary"], date_str=e["date"], start_time=e["start"],
            end_time=e["end"], location=e["location"], description=e["desc"], status=e["status"], stamp=e["stamp"],
        ))

    bookings = (
        db.query(Booking)
        .filter(Booking.user_id == owner.id, Booking.status != "cancelled", Booking.date != "")
        .all()
    )
    for b in bookings:
        if b.id in covered or (b.status == "enquiry" and not b.date_hold):
            continue  # planned jobs are above; plain website enquiries stay off the phone until they're a job
        client = clients.get(b.client_id)
        desc = " · ".join(filter(None, [
            f"{b.guest_count} guests" if b.guest_count else "",
            client or "",
            (b.event_type or "").strip(),
            f"Status: {b.status.replace('_', ' ')}" if b.status else "",
        ]))
        events.append(ics.event(
            uid=f"booking-{b.id}@creatistecommand",
            summary=b.title or "Booking",
            date_str=b.date, start_time=b.start_time, end_time=b.end_time,
            location=(b.venue_name or b.venue_address or "").strip(),
            description=desc, status=_BOOKING_ICAL.get(b.status, "TENTATIVE"),
            stamp=b.updated_at,
        ))

    appts = (
        db.query(Appointment)
        .filter(Appointment.user_id == owner.id, Appointment.status != "cancelled", Appointment.date != "")
        .all()
    )
    for a in appts:
        client = clients.get(a.client_id)
        label = _APPT_LABEL.get(a.kind, "Appointment")
        events.append(ics.event(
            uid=f"appointment-{a.id}@creatistecommand",
            summary=f"{label}: {a.title}" if a.title else label,
            date_str=a.date, start_time=a.start_time, end_time=a.end_time,
            location=(a.location or "").strip(),
            description=" · ".join(filter(None, [client or "", (a.notes or "").strip()])),
            status=_APPT_ICAL.get(a.status, "TENTATIVE"),
            stamp=a.updated_at,
        ))

    name = f"{owner.business_name or owner.name or 'Creatiste'} — events & tastings"
    body = ics.calendar(name, [e for e in events if e])
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="creatiste-calendar.ics"'},
    )
