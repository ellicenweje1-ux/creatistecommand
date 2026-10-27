"""Site customers — a visitor's account on the chef's own website, signed in with a code sent by email.

No passwords: the visitor types their email, we email a six-digit code (15 minutes, five tries), and a
long-lived signed token comes back. Everything the account shows is matched by email: the Client record,
the enquiries (bookings) under it, the pre-orders placed with that email and the reviews they left.

Public (identified by the chef's enquiry token, like the enquiry form):
  POST /api/public/customer/{token}/login    {email, name?}      → emails a code
  POST /api/public/customer/{token}/verify   {email, code}       → {token, customer}
  GET  /api/public/customer/{token}/me       Bearer <token>      → profile + enquiries + orders + reviews
  PATCH /api/public/customer/{token}/me      {name, phone}
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config, mailer, ratelimit
from ..database import get_db
from ..models import Booking, Client, ClientReview, PreOrder, SiteCustomer, User
from ..utils import EMAIL_RE

public_router = APIRouter(prefix="/public/customer", tags=["public"])

CODE_TTL_MINUTES = 15
MAX_ATTEMPTS = 5
TOKEN_DAYS = 90


def _owner(db: Session, token: str) -> User:
    owner = db.query(User).filter(User.enquiry_token == token, User.role.in_(["chef", "admin"])).first() if token else None
    if not owner:
        raise HTTPException(404, "Accounts are not available here.")
    return owner


def _hash(code: str) -> str:
    return hashlib.sha256(f"{config.SECRET_KEY}:{code}".encode()).hexdigest()


def _profile(c: SiteCustomer) -> dict:
    return {"id": c.id, "email": c.email, "name": c.name, "phone": c.phone,
            "last_login": c.last_login.isoformat() if c.last_login else None}


def issue_token(c: SiteCustomer) -> str:
    payload = {"cus": c.id, "own": c.user_id, "typ": "customer",
               "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def current_customer(owner: User, db: Session, authorization: str) -> SiteCustomer:
    tok = (authorization or "").removeprefix("Bearer ").strip()
    if not tok:
        raise HTTPException(401, "Please sign in")
    try:
        payload = jwt.decode(tok, config.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your sign-in has expired. Please sign in again.")
    if payload.get("typ") != "customer" or payload.get("own") != owner.id:
        raise HTTPException(401, "Please sign in")
    c = db.get(SiteCustomer, payload.get("cus"))
    if not c or c.user_id != owner.id:
        raise HTTPException(401, "Please sign in")
    return c


@public_router.post("/{token}/login")
def login(request: Request, token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"cuslogin:{ip}", 600) >= 6:
        raise HTTPException(429, "A few sign-in codes have been requested from here. Please wait a few minutes.")
    if (payload.get("company") or "").strip():  # honeypot
        return {"ok": True, "sent": True}
    email = (payload.get("email") or "").strip().lower()[:255]
    if not email or not EMAIL_RE.match(email):
        raise HTTPException(422, "Please give a valid email address")
    if not mailer.email_enabled():
        raise HTTPException(503, "Sign-in by email isn't available right now. Please enquire or order as a guest.")
    ratelimit.record(f"cuslogin:{ip}", 600)
    cus = db.query(SiteCustomer).filter(SiteCustomer.user_id == owner.id, SiteCustomer.email == email).first()
    if not cus:
        name = (payload.get("name") or "").strip()[:160]
        client = db.query(Client).filter(Client.user_id == owner.id, Client.email == email).first()
        cus = SiteCustomer(user_id=owner.id, email=email, name=name or (client.name if client else ""),
                           phone=(client.phone if client else ""), client_id=client.id if client else None)
        db.add(cus)
    code = f"{secrets.randbelow(1_000_000):06d}"
    cus.login_code_hash = _hash(code)
    cus.login_code_expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=CODE_TTL_MINUTES)
    cus.login_attempts = 0
    db.commit()
    biz = owner.business_name or owner.name or "us"
    mailer.send_email(
        email, f"{code} is your sign-in code for {biz}",
        f"Hi{(' ' + cus.name) if cus.name else ''},\n\nYour sign-in code is {code}. It works for {CODE_TTL_MINUTES} minutes.\n\n"
        f"If you didn't ask for this, you can ignore this email.\n\n{biz}",
    )
    return {"ok": True, "sent": True}


@public_router.post("/{token}/verify")
def verify(request: Request, token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    email = (payload.get("email") or "").strip().lower()[:255]
    code = "".join(ch for ch in str(payload.get("code") or "") if ch.isdigit())
    cus = db.query(SiteCustomer).filter(SiteCustomer.user_id == owner.id, SiteCustomer.email == email).first() if email else None
    if not cus or not cus.login_code_hash:
        raise HTTPException(401, "That code isn't right. Ask for a new one.")
    if not cus.login_code_expires or cus.login_code_expires < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(401, "That code has expired. Ask for a new one.")
    if cus.login_attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many tries. Ask for a new code.")
    if not secrets.compare_digest(cus.login_code_hash, _hash(code)):
        cus.login_attempts += 1
        db.commit()
        raise HTTPException(401, "That code isn't right. Check the email and try again.")
    cus.login_code_hash = ""
    cus.login_code_expires = None
    cus.login_attempts = 0
    cus.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
    client = db.query(Client).filter(Client.user_id == owner.id, Client.email == email).first()
    if client:
        cus.client_id = client.id
        if not cus.name:
            cus.name = client.name
        if not cus.phone:
            cus.phone = client.phone
    db.commit()
    return {"token": issue_token(cus), "customer": _profile(cus)}


@public_router.get("/{token}/me")
def me(token: str, authorization: str = Header(default=""), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    cus = current_customer(owner, db, authorization)
    clients = db.query(Client).filter(Client.user_id == owner.id, Client.email == cus.email).all()
    cids = [c.id for c in clients]
    bookings = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id.in_(cids)).order_by(Booking.date.desc()).all()
                if cids else [])
    enquiries = [{"id": b.id, "title": b.title, "event_type": b.event_type, "date": b.date, "status": b.status,
                  "guest_count": b.guest_count, "venue_name": b.venue_name,
                  "created_at": b.created_at.isoformat() if b.created_at else ""}
                 for b in bookings if b.event_type != "Pre-order"]
    orders = (db.query(PreOrder).filter(PreOrder.user_id == owner.id, PreOrder.email == cus.email)
              .order_by(PreOrder.for_date.desc(), PreOrder.created_at.desc()).limit(50).all())
    reviews = (db.query(ClientReview).filter(ClientReview.user_id == owner.id, ClientReview.email == cus.email)
               .order_by(ClientReview.created_at.desc()).all())
    return {
        "customer": _profile(cus),
        "enquiries": enquiries,
        "orders": [{"public_id": o.public_id, "title": o.offer_title, "date": o.for_date, "status": o.status,
                    "pay_method": o.pay_method or "stripe", "fulfilment": o.fulfilment, "slot": o.slot_label,
                    "delivery_address": o.delivery_address, "total": o.subtotal, "allergies": o.allergies, "note": o.note,
                    "boxes": [{"for": b.get("for"), "item": b.get("item"), "item_id": b.get("item_id"), "summary": b.get("summary"),
                               "choices": b.get("choices") or {}, "note": b.get("note") or "", "price": b.get("price")} for b in o.boxes or []]}
                   for o in orders],
        "reviews": [{"id": r.id, "rating": r.rating, "comment": r.comment, "date": r.date, "event_name": r.event_name,
                     "status": r.status or "private"} for r in reviews],
    }


@public_router.patch("/{token}/me")
def update_me(token: str, payload: dict = Body(...), authorization: str = Header(default=""), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    cus = current_customer(owner, db, authorization)
    if "name" in payload:
        cus.name = (payload.get("name") or "").strip()[:160]
    if "phone" in payload:
        cus.phone = (payload.get("phone") or "").strip()[:40]
    client = db.get(Client, cus.client_id) if cus.client_id else None
    if client and client.user_id == owner.id:
        if cus.name:
            client.name = cus.name
        if cus.phone:
            client.phone = cus.phone
    db.commit()
    return _profile(cus)
