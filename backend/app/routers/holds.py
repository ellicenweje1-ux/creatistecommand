"""Date holds: a regular client reserves a personal chef date online for a small non-refundable deposit.

The chef marks a client as **regular / consulted** on their profile (Clients). That client signs in on the
chef's website with the same email as their invoices, picks a free date, and a hold is placed:

  * the hold is a Booking with status 'enquiry' and `date_hold` set; it counts as a booking in the diary, so the
    day is taken on the public calendar straight away (`diary.compute_days`);
  * the client pays the deposit (default £15) by bank transfer within DATE_HOLD_HOURS (default 12);
  * the chef marks the deposit received (a preview of the email first) → the booking becomes 'confirmed',
    `deposit_paid` is set, and the deposit is taken off the final invoice (Finance offers it as a credit line);
  * if the 12 hours pass first, the hold is released (status 'cancelled') and the client is told.

The deposit is non-refundable but can be moved to a later date on request. Personal chef bookings only.

Public (the chef's enquiry token + the customer's sign-in token, as for /public/customer):
  GET  /api/public/customer/{token}/holds   eligibility, the free dates, the client's holds
  POST /api/public/customer/{token}/hold    {date, service, note?}  → places a hold
Chef:
  GET  /api/holds                      holds awaiting their deposit (sweeps expired ones first)
  GET  /api/holds/{id}/paid-preview    the emails "deposit received" will send
  POST /api/holds/{id}/paid            confirm the booking + email the client
  POST /api/holds/{id}/release         let the date go
"""
import logging
import threading
import time
from datetime import date as _date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import config, mailer, ratelimit
from ..auth import require_active
from ..database import SessionLocal, get_db
from ..models import Booking, Client, User
from ..utils import get_owned, ws_id
from .customers import _owner, current_customer
from .diary import compute_days, kind_of, rules_for

log = logging.getLogger("creatiste.holds")
public_router = APIRouter(prefix="/public/customer", tags=["public"])
router = APIRouter(prefix="/holds", tags=["holds"])

SERVICES = ["Batchfully Made", "The Home Edit", "Sorted & Served"]  # the personal chef services (mirrors the site)


# ───────────────────────────── small helpers ─────────────────────────────
def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _money(n: float) -> str:
    return f"£{n:g}"


def _pretty_date(iso: str) -> str:
    try:
        return datetime.strptime(iso[:10], "%Y-%m-%d").strftime("%A %-d %B")
    except Exception:
        return iso or ""


def _local_time(iso_utc: str) -> str:
    """'9:15pm on Friday 14 November' in the business's timezone."""
    try:
        dt = datetime.fromisoformat(iso_utc).replace(tzinfo=timezone.utc).astimezone(ZoneInfo(config.ONBOARDING_TZ))
        return f"{dt.strftime('%I:%M%p').lstrip('0').lower()} on {dt.strftime('%A %-d %B')}"
    except Exception:
        return iso_utc


def _service_of(bk: Booking) -> str:
    return (bk.event_type or "").split("·", 1)[1].strip() if "·" in (bk.event_type or "") else (bk.event_type or "")


def _reference(name: str, iso: str) -> str:
    """What the client puts on the transfer: first name + the date, e.g. 'Eve 14Nov' (bank references are short)."""
    first = (name or "Client").split()[0][:10]
    try:
        d = datetime.strptime(iso[:10], "%Y-%m-%d")
        return f"{first} {d.day}{d.strftime('%b')}"
    except Exception:
        return first


def _bank_text(owner: User) -> str:
    parts = [owner.bank_account_name, owner.bank_name,
             f"Sort code {owner.bank_sort_code}" if owner.bank_sort_code else "",
             f"Account {owner.bank_account_number}" if owner.bank_account_number else ""]
    parts = [p for p in parts if p]
    return " · ".join(parts) if parts else "the bank details shown on our website"


def _biz(owner: User) -> str:
    return owner.business_name or owner.name or "us"


def regular_client(db: Session, owner_id: int, email: str) -> Client | None:
    """The chef's Client record for this email, if the chef has marked them regular / consulted."""
    return (db.query(Client).filter(Client.user_id == owner_id, func.lower(Client.email) == (email or "").lower(),
                                    Client.regular == True)  # noqa: E712
            .order_by(Client.id.asc()).first())


def hold_dict(bk: Booking, name: str = "") -> dict:
    return {"id": bk.id, "date": bk.date, "service": _service_of(bk), "status": bk.status, "paid": bool(bk.deposit_paid),
            "amount": bk.deposit_amount or config.DATE_HOLD_DEPOSIT,
            "expires_at": (bk.hold_expires_at + "Z") if (bk.hold_expires_at and not bk.deposit_paid) else "",
            "reference": _reference(name, bk.date)}


# ───────────────────────────── which dates can be held ─────────────────────────────
def open_hold_dates(db: Session, owner: User, today: _date | None = None) -> list[str]:
    """Days a personal chef booking can still go on: not full, personal chef not at its own cap, on a personal
    chef weekday, at least DATE_HOLD_MIN_DAYS ahead and no further than DATE_HOLD_WINDOW_DAYS (30) out. Straight from the diary engine, so it matches the public calendar."""
    today = today or _date.today()
    rules = rules_for(owner)
    kind = kind_of(rules["kinds"], Booking(event_type="Personal chef", title="Date hold"))
    start = today + timedelta(days=config.DATE_HOLD_MIN_DAYS)
    end = today + timedelta(days=min(rules["horizon_days"], config.DATE_HOLD_WINDOW_DAYS))
    out = []
    for d in compute_days(db, owner.id, rules, start, end, detail=True):
        if d["state"] == "full" or _date.fromisoformat(d["date"]).weekday() not in config.DATE_HOLD_WEEKDAYS:
            continue
        if kind and d["counts"].get(kind["id"], 0) >= kind["max_per_day"]:
            continue
        out.append(d["date"])
    return out


# ───────────────────────────── the emails (pure: nothing is sent here) ─────────────────────────────
def hold_emails(owner: User, bk: Booking, client: Client) -> dict:
    """Sent when a hold is placed: the client's payment instructions, and a note to the chef."""
    amount, ref, when = _money(bk.deposit_amount), _reference(client.name, bk.date), _pretty_date(bk.date)
    hours = f"{config.DATE_HOLD_HOURS:g}"
    return {
        "customer": {
            "to": client.email, "subject": f"Your date is held: {when}",
            "body": (f"Hi {client.name.split()[0] if client.name else 'there'},\n\nWe are holding {when} for you ({_service_of(bk)}).\n\n"
                     f"To keep it, please send the {amount} deposit by bank transfer within {hours} hours, by {_local_time(bk.hold_expires_at)}.\n\n"
                     f"Pay to: {_bank_text(owner)}\nReference: {ref}\nAmount: {amount}\n\n"
                     f"Your date is confirmed once we have received it, and we will email you then. If it hasn't arrived in time, "
                     f"the date is released.\n\nThe deposit is non-refundable, but it can be moved to a later date if you need to change, "
                     f"and it is taken off your final invoice.\n\n{_biz(owner)}"),
        },
        "chef": {
            "to": owner.email, "subject": f"Date hold: {client.name} · {when} · awaiting {amount}",
            "body": (f"{client.name} ({client.email}) has held {when} for {_service_of(bk)}.\n\nThey have until {_local_time(bk.hold_expires_at)} "
                     f"to send {amount} (reference {ref}).\n\nWhen it lands, open Bookings in The Creatiste Command and press "
                     f"\"{amount} received\" on the hold; that confirms the date and emails them. If nothing arrives, the date is released automatically.\n\n"
                     f"— The Creatiste Command"),
        },
    }


def paid_emails(owner: User, bk: Booking, client: Client) -> dict:
    """Sent when the chef marks the deposit received."""
    amount, when = _money(bk.deposit_amount or config.DATE_HOLD_DEPOSIT), _pretty_date(bk.date)
    return {
        "customer": {
            "to": client.email, "subject": f"Deposit received: your date is confirmed for {when}",
            "body": (f"Hi {client.name.split()[0] if client.name else 'there'},\n\nThank you, we have received your {amount} deposit and "
                     f"your date is confirmed.\n\nDate: {when}\nService: {_service_of(bk)}\nDeposit received: {amount}\n\n"
                     f"The deposit is non-refundable, but it can be moved to a later date if you need to change (just message us). "
                     f"It will be taken off your final invoice.\n\nThis email is your receipt.\n\n{_biz(owner)}"),
        },
        "chef": {
            "to": owner.email, "subject": f"Date confirmed: {client.name} · {when}",
            "body": f"{client.name}'s {amount} deposit is marked received and {when} is confirmed on your diary.\n\nIt will be offered as a credit when you invoice this booking.\n\n— The Creatiste Command",
        },
    }


def expired_emails(owner: User, bk: Booking, client: Client | None) -> dict:
    when, amount = _pretty_date(bk.date), _money(bk.deposit_amount or config.DATE_HOLD_DEPOSIT)
    out = {"chef": {"to": owner.email, "subject": f"Date hold released: {(client.name if client else 'client')} · {when}",
                    "body": f"The {amount} deposit didn't arrive within {config.DATE_HOLD_HOURS:g} hours, so the hold on {when} has been released and the date is open again.\n\n— The Creatiste Command"}}
    if client and client.email:
        out["customer"] = {"to": client.email, "subject": f"Your date hold has been released: {when}",
                           "body": (f"Hi {client.name.split()[0] if client.name else 'there'},\n\nWe didn't receive the {amount} deposit within {config.DATE_HOLD_HOURS:g} hours, "
                                    f"so the hold on {when} has been released.\n\nIf you still want it and it's free, you can reserve it again from your account.\n\n{_biz(owner)}")}
    return out


def _send(mails: dict, *which):
    for k in which:
        m = mails.get(k)
        if m and m.get("to"):
            try:
                mailer.send_email(m["to"], m["subject"], m["body"])
            except Exception as exc:  # an email problem must never undo the hold
                log.warning("hold email failed: %s", exc)


# ───────────────────────────── expiry ─────────────────────────────
def expire_holds(db: Session, owner_id: int | None = None) -> int:
    """Release every unpaid hold whose time is up (status → cancelled, the day opens, everyone is told). Idempotent."""
    q = db.query(Booking).filter(Booking.date_hold == True, Booking.status == "enquiry",  # noqa: E712
                                 Booking.deposit_paid == False, Booking.hold_expires_at != "",  # noqa: E712
                                 Booking.hold_expires_at < _iso(_now()))
    if owner_id:
        q = q.filter(Booking.user_id == owner_id)
    rows = q.all()
    for bk in rows:
        bk.status = "cancelled"
        bk.notes = f"{bk.notes or ''}\nDate hold released: the deposit didn't arrive within {config.DATE_HOLD_HOURS:g} hours.".strip()
    if rows:
        db.commit()
    for bk in rows:
        owner, client = db.get(User, bk.user_id), (db.get(Client, bk.client_id) if bk.client_id else None)
        if owner:
            _send(expired_emails(owner, bk, client), "customer", "chef")
    return len(rows)


def start_expiry_loop():
    """A small daemon thread that releases lapsed holds every few minutes (the main scheduler only wakes every few hours)."""
    if not config.ENABLE_SCHEDULER:
        return

    def loop():
        while True:
            db = SessionLocal()
            try:
                expire_holds(db)
            except Exception as exc:
                log.warning("hold expiry sweep failed: %s", exc)
            finally:
                db.close()
            time.sleep(300)

    threading.Thread(target=loop, daemon=True, name="cc-holds").start()


# ───────────────────────────── public (the client's account) ─────────────────────────────
@public_router.get("/{token}/holds")
def my_holds(token: str, authorization: str = Header(default=""), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    cus = current_customer(owner, db, authorization)
    expire_holds(db, owner.id)
    client = regular_client(db, owner.id, cus.email)
    clients = db.query(Client).filter(Client.user_id == owner.id, func.lower(Client.email) == cus.email.lower()).all()
    cids = [c.id for c in clients]
    mine = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id.in_(cids), Booking.date_hold == True,  # noqa: E712
                                     Booking.status.in_(["enquiry", "confirmed"]), Booking.date >= _date.today().isoformat())
            .order_by(Booking.date.asc()).all()) if cids else []
    return {"eligible": bool(client), "amount": config.DATE_HOLD_DEPOSIT, "hours": config.DATE_HOLD_HOURS,
            "min_days": config.DATE_HOLD_MIN_DAYS, "window_days": config.DATE_HOLD_WINDOW_DAYS, "services": SERVICES,
            "dates": [d for d in open_hold_dates(db, owner) if d not in {b.date for b in mine}] if client else [],
            "holds": [hold_dict(b, cus.name or (client.name if client else "")) for b in mine]}


@public_router.post("/{token}/hold", status_code=201)
def place_hold(request: Request, token: str, payload: dict = Body(...), authorization: str = Header(default=""), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    cus = current_customer(owner, db, authorization)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"hold:{ip}", 600) >= 8:
        raise HTTPException(429, "A few holds have been placed from here already. Please wait a little while.")
    ratelimit.record(f"hold:{ip}", 600)
    expire_holds(db, owner.id)
    client = regular_client(db, owner.id, cus.email)
    if not client:
        raise HTTPException(403, "Reserving a date online is for regular and already-consulted clients. Please enquire and we'll be in touch.")
    day = (payload.get("date") or "").strip()[:10]
    service = (payload.get("service") or "").strip()
    if service not in SERVICES:
        raise HTTPException(422, "Choose which personal chef service this is for")
    if day not in open_hold_dates(db, owner):
        raise HTTPException(422, "That date isn't available to hold. Please pick one of the dates shown.")
    cids = [c.id for c in db.query(Client).filter(Client.user_id == owner.id, func.lower(Client.email) == cus.email.lower()).all()]
    active = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id.in_(cids), Booking.date_hold == True,  # noqa: E712
                                       Booking.status == "enquiry", Booking.deposit_paid == False).all())  # noqa: E712
    if any(b.date == day for b in active) or (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id.in_(cids), Booking.date_hold == True,  # noqa: E712
                                                                      Booking.status == "confirmed", Booking.date == day).first()):
        raise HTTPException(422, "You already have that date held.")
    if len(active) >= config.DATE_HOLD_MAX_ACTIVE:
        raise HTTPException(422, f"You have {len(active)} holds waiting for their deposit. Please pay or let them lapse before holding more.")
    note = (payload.get("note") or "").strip()[:500]
    bk = Booking(
        user_id=owner.id, client_id=client.id, title=f"Date hold · {client.name}", event_type=f"Personal chef · {service}",
        status="enquiry", date=day, date_hold=True, deposit_amount=config.DATE_HOLD_DEPOSIT, deposit_paid=False,
        hold_expires_at=_iso(_now() + timedelta(hours=config.DATE_HOLD_HOURS)),
        notes=f"Date hold placed online. Deposit {_money(config.DATE_HOLD_DEPOSIT)} by bank transfer, reference {_reference(client.name, day)}."
              + (f"\nClient note: {note}" if note else ""),
    )
    db.add(bk)
    db.commit()
    db.refresh(bk)
    _send(hold_emails(owner, bk, client), "customer", "chef")
    return {"hold": hold_dict(bk, client.name), "bank": {"name": owner.bank_account_name, "bank": owner.bank_name,
                                                          "sort": owner.bank_sort_code, "account": owner.bank_account_number}}


# ───────────────────────────── chef ─────────────────────────────
def _hold(db: Session, user, hold_id: int) -> Booking:
    bk = get_owned(db, Booking, hold_id, ws_id(user))
    if not bk.date_hold:
        raise HTTPException(404, "That booking isn't a date hold")
    return bk


@router.get("")
def list_holds(db: Session = Depends(get_db), user: User = Depends(require_active)):
    expire_holds(db, ws_id(user))
    rows = (db.query(Booking).filter(Booking.user_id == ws_id(user), Booking.date_hold == True, Booking.status == "enquiry",  # noqa: E712
                                     Booking.deposit_paid == False).order_by(Booking.hold_expires_at.asc()).all())  # noqa: E712
    out = []
    for b in rows:
        c = db.get(Client, b.client_id) if b.client_id else None
        out.append({**hold_dict(b, c.name if c else ""), "client_id": b.client_id, "client_name": c.name if c else "",
                    "email": c.email if c else "", "phone": c.phone if c else ""})
    return out


@router.get("/{hold_id}/paid-preview")
def paid_preview(hold_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    bk = _hold(db, user, hold_id)
    owner, client = db.get(User, ws_id(user)), db.get(Client, bk.client_id)
    if not client:
        raise HTTPException(422, "This hold has no client attached")
    return {"status": bk.status, **paid_emails(owner, bk, client)}


@router.post("/{hold_id}/paid")
def mark_received(hold_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    bk = _hold(db, user, hold_id)
    owner, client = db.get(User, ws_id(user)), (db.get(Client, bk.client_id) if bk.client_id else None)
    if bk.deposit_paid:
        return {"ok": True, "already": True}
    if bk.status == "cancelled":
        # The money arrived after the hold lapsed: confirm it only if nobody has taken the day since.
        rules = rules_for(owner)
        day = compute_days(db, owner.id, rules, _date.fromisoformat(bk.date), _date.fromisoformat(bk.date), detail=False)
        if not day or day[0]["state"] == "full":
            raise HTTPException(409, "That date has been taken since the hold lapsed. Offer the client another date (their deposit can move).")
    bk.status, bk.deposit_paid, bk.hold_expires_at = "confirmed", True, ""
    bk.deposit_amount = bk.deposit_amount or config.DATE_HOLD_DEPOSIT
    bk.notes = f"{bk.notes or ''}\n{_money(bk.deposit_amount)} deposit received {_date.today().isoformat()}: non-refundable, can move to a later date, comes off the final invoice.".strip()
    db.commit()
    if client:
        _send(paid_emails(owner, bk, client), "customer", "chef")
    return {"ok": True, "booking_id": bk.id}


@router.post("/{hold_id}/release")
def release(hold_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    bk = _hold(db, user, hold_id)
    if bk.deposit_paid:
        raise HTTPException(422, "The deposit has been received, so this is a confirmed booking. Cancel or move it from Bookings.")
    bk.status = "cancelled"
    bk.notes = f"{bk.notes or ''}\nDate hold released by the chef.".strip()
    db.commit()
    return {"ok": True}
