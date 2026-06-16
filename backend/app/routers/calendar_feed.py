"""Private, token-scoped iCalendar (.ics) feed of a chef's bookings + tastings.

No login — the secret token in the URL is the credential (like the public enquiry link),
so it can be pasted straight into Apple/Google/Outlook calendar "subscribe by URL". The
chef finds and can rotate the link in Settings → App & integrations.
"""
from fastapi import APIRouter, Depends, HTTPException
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


@router.get("/{token}.ics")
def calendar_feed(token: str, db: Session = Depends(get_db)):
    owner = db.query(User).filter(User.calendar_token == token).first() if token else None
    if not owner or not owner.calendar_token:
        raise HTTPException(404, "This calendar link is invalid or has been reset.")

    clients = {c.id: c.name for c in db.query(Client).filter(Client.user_id == owner.id).all()}
    events: list[list[str]] = []

    bookings = (
        db.query(Booking)
        .filter(Booking.user_id == owner.id, Booking.status != "cancelled", Booking.date != "")
        .all()
    )
    for b in bookings:
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
