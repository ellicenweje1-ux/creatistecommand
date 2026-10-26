"""Reviews — public testimonials left on the chef's own website, approved before they show.

Public (no login, identified by the chef's enquiry token, like the enquiry form):
  POST /api/public/review/{token}   leave a review (honeypot + per-IP cap); lands as `pending`
  GET  /api/public/reviews/{token}  the approved reviews, for the chef's site to display
Chef:
  GET    /api/reviews               every review (public + chef-entered) with the client name
  PATCH  /api/reviews/{id}          {status: approved|hidden|pending|''}
  DELETE /api/reviews/{id}
"""
from datetime import date as _date

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config, mailer, ratelimit
from ..auth import get_current_user, require_plan
from ..database import get_db
from ..models import Client, ClientReview, User
from ..utils import EMAIL_RE, to_dict, ws_id

public_router = APIRouter(prefix="/public", tags=["public"])
router = APIRouter(prefix="/reviews", tags=["reviews"], dependencies=[Depends(require_plan(2))])

PUBLIC_FIELDS = ("id", "rating", "comment", "date", "reviewer_name", "event_name", "created_at")
STATUSES = ("", "pending", "approved", "hidden")


def _owner(db, token):
    owner = db.query(User).filter(User.enquiry_token == token, User.role.in_(["chef", "admin"])).first() if token else None
    if not owner:
        raise HTTPException(404, "Reviews are not available here.")
    return owner


def _public(r: ClientReview, client: Client | None = None):
    d = {k: getattr(r, k) for k in PUBLIC_FIELDS}
    d["created_at"] = r.created_at.isoformat() if r.created_at else ""
    if not d["reviewer_name"] and client:
        d["reviewer_name"] = client.name
    return d


@public_router.get("/reviews/{token}")
def public_reviews(token: str, db: Session = Depends(get_db)):
    owner = _owner(db, token)
    rows = (
        db.query(ClientReview, Client)
        .outerjoin(Client, Client.id == ClientReview.client_id)
        .filter(ClientReview.user_id == owner.id, ClientReview.status == "approved")
        .order_by(ClientReview.date.desc(), ClientReview.created_at.desc())
        .all()
    )
    return {"business": owner.business_name or owner.name or "", "reviews": [_public(r, c) for r, c in rows]}


@public_router.post("/review/{token}", status_code=201)
def leave_review(request: Request, token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"review:{ip}", config.ENQUIRY_RATE_WINDOW) >= config.ENQUIRY_RATE_MAX:
        raise HTTPException(429, "Thank you — that's a few reviews already. Please try again a little later.")
    # Honeypot: real people never see the "company" field.
    if (payload.get("company") or "").strip():
        ratelimit.record(f"review:{ip}", config.ENQUIRY_RATE_WINDOW)
        return {"ok": True, "message": "Thank you — your review has been sent for approval."}

    name = (payload.get("name") or "").strip()[:160]
    email = (payload.get("email") or "").strip().lower()[:255]
    comment = (payload.get("comment") or payload.get("text") or "").strip()[:1500]
    event_name = (payload.get("event") or payload.get("event_name") or "").strip()[:200]
    when = (payload.get("date") or "").strip()[:10]
    try:
        rating = int(payload.get("rating") or 0)
    except (TypeError, ValueError):
        rating = 0
    if not name:
        raise HTTPException(422, "Please give your name")
    if not comment:
        raise HTTPException(422, "Please write a few words")
    if rating < 1 or rating > 5:
        raise HTTPException(422, "Please pick a star rating")
    if email and not EMAIL_RE.match(email):
        raise HTTPException(422, "That email address doesn't look right")
    if when:
        try:
            _date.fromisoformat(when)
        except ValueError:
            when = ""
    # Only a submission that validates spends the per-IP allowance (a typo shouldn't lock someone out).
    ratelimit.record(f"review:{ip}", config.ENQUIRY_RATE_WINDOW)

    client = db.query(Client).filter(Client.user_id == owner.id, Client.email == email).first() if email else None
    if not client:
        client = Client(user_id=owner.id, name=name, email=email, tags=["review"])
        db.add(client)
        db.flush()
    review = ClientReview(
        user_id=owner.id, client_id=client.id, rating=rating, comment=comment, date=when,
        source="public", status="pending", reviewer_name=name, event_name=event_name, email=email,
    )
    db.add(review)
    db.commit()
    stars = "★" * rating + "☆" * (5 - rating)
    mailer.send_email(
        owner.email, f"New review from {name} ({rating}/5) — approve it to show it on your site",
        f"{stars}\n{name}{(' · ' + event_name) if event_name else ''}{(' · ' + when) if when else ''}\n\n{comment}\n\n"
        f"Approve or hide it under Reviews in The Creatiste Command. Reviews only appear on your site once approved.",
    )
    return {"ok": True, "message": "Thank you — your review has been sent for approval."}


@router.get("")
def list_reviews(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(ClientReview, Client)
        .outerjoin(Client, Client.id == ClientReview.client_id)
        .filter(ClientReview.user_id == ws_id(user))
        .order_by(ClientReview.created_at.desc())
        .all()
    )
    out = []
    for r, c in rows:
        d = to_dict(r)
        d["client_name"] = c.name if c else ""
        if not d.get("reviewer_name"):
            d["reviewer_name"] = d["client_name"]
        out.append(d)
    return out


@router.patch("/{review_id}")
def set_status(review_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.get(ClientReview, review_id)
    if not r or r.user_id != ws_id(user):
        raise HTTPException(404, "Review not found")
    status = (payload.get("status") or "").strip()
    if status not in STATUSES:
        raise HTTPException(422, "Unknown status")
    r.status = status
    db.commit()
    d = to_dict(r)
    return d


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.get(ClientReview, review_id)
    if not r or r.user_id != ws_id(user):
        raise HTTPException(404, "Review not found")
    db.delete(r)
    db.commit()
    return None
