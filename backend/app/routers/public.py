"""Unauthenticated, token-scoped endpoints: the client quote approval page and the
public enquiry form that feeds straight into the chef's bookings."""
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config, mailer, ratelimit
from ..database import get_db
from ..models import ActivityLog, Booking, Client, Quote, User
from ..utils import EMAIL_RE, to_dict

router = APIRouter(prefix="/public", tags=["public"])

QUOTE_PUBLIC_FIELDS = ("id", "number", "title", "items", "tax_rate", "discount", "notes", "status", "valid_until")


def _public_quote(db: Session, token: str) -> tuple[Quote, User]:
    quote = db.query(Quote).filter(Quote.public_token == token).first() if token else None
    if not quote or not quote.public_token:
        raise HTTPException(404, "This quote link is invalid or has been withdrawn.")
    owner = db.get(User, quote.user_id)
    if not owner:
        raise HTTPException(404, "This quote link is invalid.")
    return quote, owner


@router.get("/quote/{token}")
def view_quote(token: str, db: Session = Depends(get_db)):
    quote, owner = _public_quote(db, token)
    client = db.get(Client, quote.client_id) if quote.client_id else None
    return {
        "quote": {k: v for k, v in to_dict(quote).items() if k in QUOTE_PUBLIC_FIELDS},
        "business": owner.business_name or owner.name,
        "currency": owner.currency,
        "client_name": client.name if client and client.user_id == owner.id else "",
    }


@router.post("/quote/{token}/respond")
def respond_quote(token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    quote, owner = _public_quote(db, token)
    if quote.status in ("approved", "declined"):
        raise HTTPException(409, "This quote has already been responded to.")
    action = payload.get("action")
    if action not in ("approve", "decline"):
        raise HTTPException(422, "Action must be approve or decline")
    quote.status = "approved" if action == "approve" else "declined"
    quote.responded_at = datetime.now(timezone.utc)
    quote.responder_name = (payload.get("name") or "").strip()[:160]
    quote.client_comment = (payload.get("comment") or "").strip()[:2000]
    db.add(ActivityLog(
        user_id=owner.id, actor_id=None, actor_name=quote.responder_name or "Client",
        actor_role="client", action=quote.status, entity_type="Quote", entity_id=quote.id,
        summary=f"Quote {quote.number or quote.id} {quote.status} via client link",
    ))
    db.commit()
    mailer.send_email(
        owner.email, f"Quote {quote.number} {quote.status} by {quote.responder_name or 'your client'}",
        f"Quote {quote.number} ({quote.title}) was {quote.status}.\n"
        f"Comment: {quote.client_comment or '—'}\n\n— The Creatiste Command",
    )
    return {"status": quote.status}


@router.get("/enquiry/{token}")
def enquiry_info(token: str, db: Session = Depends(get_db)):
    owner = db.query(User).filter(User.enquiry_token == token, User.role.in_(["chef", "admin"])).first() if token else None
    if not owner:
        raise HTTPException(404, "This enquiry form is not available.")
    return {"business": owner.business_name or owner.name or "Private chef"}


@router.post("/enquiry/{token}", status_code=201)
def submit_enquiry(request: Request, token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    owner = db.query(User).filter(User.enquiry_token == token, User.role.in_(["chef", "admin"])).first() if token else None
    if not owner:
        raise HTTPException(404, "This enquiry form is not available.")

    # This endpoint creates a booking and emails the chef with no login — a spam target
    # once the link is in a bio. Cap submissions per IP …
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"enquiry:{ip}", config.ENQUIRY_RATE_WINDOW) >= config.ENQUIRY_RATE_MAX:
        raise HTTPException(429, "You've sent a few enquiries already — please wait a little while before sending another.")
    ratelimit.record(f"enquiry:{ip}", config.ENQUIRY_RATE_WINDOW)

    # … and a honeypot: real users never see the "company" field, so anything that fills
    # it is a bot. Pretend it worked (don't tip the bot off) but create nothing.
    if (payload.get("company") or "").strip():
        return {"ok": True, "message": "Thank you — your enquiry has been sent."}

    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    if not name:
        raise HTTPException(422, "Please give your name")
    if email and not EMAIL_RE.match(email):
        raise HTTPException(422, "That email address doesn't look right")

    client = db.query(Client).filter(Client.user_id == owner.id, Client.email == email).first() if email else None
    if not client:
        client = Client(user_id=owner.id, name=name, email=email, phone=(payload.get("phone") or "").strip(), tags=["enquiry"])
        db.add(client)
        db.flush()

    details = "\n".join(filter(None, [
        f"Contact: {name} · {email or 'no email'} · {payload.get('phone') or 'no phone'}",
        f"Budget: {payload.get('budget')}" if payload.get("budget") else "",
        f"Message: {payload.get('message')}" if payload.get("message") else "",
        "— received via the public enquiry form",
    ]))
    booking = Booking(
        user_id=owner.id, client_id=client.id, status="enquiry",
        title=f"Enquiry — {name}" + (f" ({payload.get('event_type')})" if payload.get("event_type") else ""),
        event_type=(payload.get("event_type") or "").strip(),
        date=(payload.get("date") or "").strip()[:10],
        guest_count=int(payload.get("guest_count") or 0),
        venue_address=(payload.get("location") or "").strip(),
        notes=details,
    )
    db.add(booking)
    db.flush()
    db.add(ActivityLog(
        user_id=owner.id, actor_id=None, actor_name=name, actor_role="client",
        action="created", entity_type="Enquiry", entity_id=booking.id,
        summary=f"New enquiry from {name} — {booking.date or 'date TBC'}",
    ))
    db.commit()
    mailer.send_email(
        owner.email, f"New enquiry from {name}",
        f"{details}\n\nDate: {booking.date or 'TBC'} · Guests: {booking.guest_count or '?'}\n"
        f"It's waiting in your Bookings as an enquiry.\n\n— The Creatiste Command",
    )
    return {"ok": True, "message": "Thank you — your enquiry has been sent."}


def _public_link(socials: dict) -> str:
    """Best public URL for a featured business, from their saved socials. Returns a safe
    absolute https URL or '' — so we never render a broken or non-http link on the site."""
    bases = {
        "instagram": "https://instagram.com/", "facebook": "https://facebook.com/",
        "tiktok": "https://tiktok.com/@", "youtube": "https://youtube.com/@", "x": "https://x.com/",
    }
    for key in ("website", "instagram", "facebook", "tiktok", "youtube", "x"):
        v = (socials.get(key) or "").strip()
        if not v:
            continue
        if v.startswith(("http://", "https://")):
            return v
        if key == "website":
            return "https://" + v.lstrip("/") if ("." in v and " " not in v) else ""
        handle = v.lstrip("@").strip()
        if handle and " " not in handle:
            return bases[key] + handle
    return ""


@router.get("/featured")
def featured_businesses(db: Session = Depends(get_db)):
    """Opted-in businesses for the public landing 'featured kitchens' wall. Consent-based:
    a chef turns this on in Settings → Business; only their business name, logo, link and
    (optional) testimonial are exposed here — never anything private."""
    rows = (
        db.query(User)
        .filter(User.feature_publicly.is_(True), User.feature_status == "approved", User.role.in_(["chef", "admin"]))
        .all()
    )
    # Founders first (by their numbered seat), then everyone else.
    rows.sort(key=lambda u: (u.founder_number is None, u.founder_number or 0, u.id))
    out = []
    for u in rows:
        name = (u.business_name or u.name or "").strip()
        if not name:
            continue
        out.append({
            "business_name": name,
            "logo": u.avatar_url or "",
            "link": _public_link(u.socials or {}),
            "testimonial": (u.testimonial or "").strip(),
            "rating": int(u.testimonial_rating or 0),
            "is_founder": bool(u.is_founder),
        })
    return {"featured": out[:24]}
