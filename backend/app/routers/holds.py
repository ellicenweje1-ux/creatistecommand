"""Date requests: a client holds the dates they need in advance; the chef confirms; the deposit locks them in.

Who can ask: a client the chef has marked **regular / already consulted**, or any client who has already paid an invoice
(no tagging needed: past paying clients are trusted automatically). They sign in on the chef's website with the email
on their invoices, choose the service, then tick one or more free dates on a calendar. Only dates that service genuinely
fits are offered (the Diary measures each day in shares of a day, so a morning of batch cooking leaves room for a Clean
Dream order, but an in-home day is the only booking).

The life of a request (a Booking with status 'enquiry', `date_hold` set, `hold_stage` saying where it is):

  requested          held the moment it is asked, so it vanishes from everyone else's calendar. Nothing to pay yet.
                     No clock runs: the chef confirms she is free, or says she can't.
  awaiting_deposit   the chef pressed Confirm. Now the client is told to send the deposit (default £15) by bank transfer
                     within DATE_HOLD_HOURS (default 12). If it doesn't arrive the date is released.
  confirmed          the chef marked the deposit received: the booking is confirmed, the deposit comes off the final invoice.

The deposit is non-refundable but can be moved to a later date. The deposit is per date.

Public (the chef's enquiry token + the customer's sign-in token, as for /public/customer):
  GET  /api/public/customer/{token}/holds   eligibility, the free dates per service, the client's requests
  POST /api/public/customer/{token}/hold    {dates: [..], service, note?} -> requests every date
Chef:
  GET  /api/holds                       requests waiting for her, and confirmed ones waiting for their deposit
  GET  /api/holds/{id}/confirm-preview  the email Confirm will send
  POST /api/holds/{id}/confirm          "I'm free that day": starts the deposit clock and emails the client
  POST /api/holds/{id}/decline          {reason?}: releases the date and tells the client
  GET  /api/holds/{id}/paid-preview     the email "deposit received" will send
  POST /api/holds/{id}/paid             deposit received: confirmed
  POST /api/holds/{id}/release          let the date go quietly
"""
import logging
import threading
import time
from datetime import date as _date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import calsync, config, mailer, notify, ratelimit
from ..auth import require_active
from ..database import SessionLocal, get_db
from ..models import Booking, Client, Invoice, User
from ..utils import get_owned, ws_id
from .customers import _owner, current_customer
from .diary import compute_days, kind_of, load_of, rules_for

log = logging.getLogger("creatiste.holds")
public_router = APIRouter(prefix="/public/customer", tags=["public"])
router = APIRouter(prefix="/holds", tags=["holds"])

def requestable(db: Session, owner: User) -> list[str]:
    """The services regular clients may request dates for: ticked under Calendar → Your services."""
    from .jobs import requestable_services
    return requestable_services(db, owner)


def requestable_setup(db: Session, owner: User) -> dict[str, dict]:
    """Those services by name, with their notice (days) and the weekdays they can be asked for (empty = any working day)."""
    from .jobs import requestable_setup as rs
    return {s["name"]: s for s in rs(db, owner)}


def request_label(svc: dict) -> str:
    """What a request is called in Bookings: 'Personal chef · Batchfully Made', 'Private catering · Corporate Curations'."""
    from .jobs import CATEGORY_PREFIX
    return f"{CATEGORY_PREFIX.get(svc.get('category'), 'Personal chef')} · {svc['name']}"


def request_load(rules: dict, svc: dict) -> tuple[float, float]:
    """(share of the day this request takes, the share to store on the booking or 0 when the Diary's kinds already know it)."""
    from .jobs import CATEGORY_LOAD
    probe = Booking(event_type=request_label(svc), title="Date request")
    if kind_of(rules["kinds"], probe):
        return load_of(rules, probe), 0.0
    own = CATEGORY_LOAD.get(svc.get("category"), rules["default_load"])
    return own, own


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


def eligible_client(db: Session, owner_id: int, email: str) -> Client | None:
    """The chef's Client record for this email, if that client may request dates: marked regular, or has paid an invoice."""
    em = (email or "").lower()
    if not em:
        return None
    clients = db.query(Client).filter(Client.user_id == owner_id, func.lower(Client.email) == em).order_by(Client.id.asc()).all()
    for c in clients:
        if c.regular:
            return c
    for c in clients:
        if db.query(Invoice.id).filter(Invoice.user_id == owner_id, Invoice.client_id == c.id, Invoice.status == "paid").first():
            return c
    return None


regular_client = eligible_client  # the old name


def stage_of(bk: Booking) -> str:
    if bk.deposit_paid:
        return "confirmed"
    if bk.status == "cancelled":
        return "cancelled"
    return bk.hold_stage or "awaiting_deposit"   # rows from before the stages existed were all waiting for a deposit


def hold_dict(bk: Booking, name: str = "") -> dict:
    stage = stage_of(bk)
    return {"id": bk.id, "date": bk.date, "service": _service_of(bk), "status": bk.status, "paid": bool(bk.deposit_paid), "stage": stage,
            "amount": bk.deposit_amount or config.DATE_HOLD_DEPOSIT,
            "expires_at": (bk.hold_expires_at + "Z") if (bk.hold_expires_at and stage == "awaiting_deposit") else "",
            "reference": _reference(name, bk.date)}


# ───────────────────────────── which dates can be requested ─────────────────────────────
def hold_calendar(db: Session, owner: User, today: _date | None = None) -> tuple[dict, list[dict]]:
    """The Diary's days from today to the end of the booking window, plus the rules they were measured under."""
    today = today or _date.today()
    rules = rules_for(owner)
    end = today + timedelta(days=min(rules["horizon_days"], config.DATE_HOLD_WINDOW_DAYS))
    return rules, compute_days(db, owner.id, rules, today, end, detail=True)


def _notice(svc: dict | None) -> int:
    return int((svc or {}).get("notice_days", config.DATE_HOLD_MIN_DAYS))


def first_date(svc: dict | None, today: _date | None = None) -> _date:
    """The earliest day a client may ask for this service: today plus the service's notice."""
    return (today or _date.today()) + timedelta(days=_notice(svc))


def dates_for_service(rules: dict, rows: list[dict], svc: dict | None, today: _date | None = None) -> list[str]:
    """Days this service still fits: far enough ahead, a day it runs, a working day, not full, and its share of the day free."""
    svc = svc or {"name": "", "category": "other"}
    add, _ = request_load(rules, svc)
    first = first_date(svc, today).isoformat()
    runs = set(svc.get("request_days") or [])
    return [d["date"] for d in rows if d["date"] >= first and d["workday"] and d["state"] != "full" and d["load"] + add <= 1.0001
            and (not runs or _date.fromisoformat(d["date"]).weekday() in runs)]


def open_hold_dates(db: Session, owner: User, service: str = "", today: _date | None = None) -> list[str]:
    rules, rows = hold_calendar(db, owner, today)
    return dates_for_service(rules, rows, requestable_setup(db, owner).get(service), today)


# ───────────────────────────── the emails (pure: nothing is sent here) ─────────────────────────────
def _first(client: Client | None) -> str:
    return client.name.split()[0] if client and client.name else "there"


def _dates_text(dates: list[str]) -> str:
    return "\n".join(f"  · {_pretty_date(d)}" for d in sorted(dates))


def requested_emails(owner: User, bks: list[Booking], client: Client) -> dict:
    """Sent when a client asks for dates: we are holding them; nothing to pay yet. And a nudge to the chef."""
    dates = [b.date for b in bks]
    svc = _service_of(bks[0])
    return {
        "customer": {
            "to": client.email, "subject": f"We're holding your {'dates' if len(dates) > 1 else 'date'}: {_pretty_date(dates[0]) if len(dates) == 1 else str(len(dates)) + ' dates'}",
            "body": (f"Hi {_first(client)},\n\nThank you. We are holding {'these dates' if len(dates) > 1 else 'this date'} for you ({svc}) while we check them:\n\n"
                     f"{_dates_text(dates)}\n\nThere is nothing to pay yet. As soon as we have confirmed we are free, we will email you the details to send your "
                     f"{_money(config.DATE_HOLD_DEPOSIT)} deposit for each date, and that locks it in. If we can't do one of them we will tell you straight away.\n\n{_biz(owner)}"),
        },
        "chef": {
            "to": owner.email, "subject": f"Date request: {client.name} · {len(dates)} date{'s' if len(dates) > 1 else ''} · {svc}",
            "body": (f"{client.name} ({client.email}) has asked for {svc} on:\n\n{_dates_text(dates)}\n\nThe dates are held on your diary and your website "
                     f"calendar already. Open Bookings in The Creatiste Command and press Confirm if you are free (that asks them for the deposit) or "
                     f"\"Can't do it\" to release the date.\n\n— The Creatiste Command"),
        },
    }


def confirm_emails(owner: User, bk: Booking, client: Client) -> dict:
    """Sent when the chef confirms she is free: pay the deposit now to lock the date in."""
    amount, ref, when = _money(bk.deposit_amount or config.DATE_HOLD_DEPOSIT), _reference(client.name, bk.date), _pretty_date(bk.date)
    hours = f"{config.DATE_HOLD_HOURS:g}"
    deadline = _local_time(bk.hold_expires_at) if bk.hold_expires_at else f"within {hours} hours"
    return {"customer": {
        "to": client.email, "subject": f"Good news, {when} is free: send your deposit to lock it in",
        "body": (f"Hi {_first(client)},\n\nWe are free on {when} ({_service_of(bk)}).\n\n"
                 f"To lock it in, please send the {amount} deposit by bank transfer within {hours} hours, by {deadline}.\n\n"
                 f"Pay to: {_bank_text(owner)}\nReference: {ref}\nAmount: {amount}\n\n"
                 f"Your date is confirmed once we have received it, and we will email you then. If it hasn't arrived in time the date is released.\n\n"
                 f"The deposit is non-refundable, but it can be moved to a later date if you need to change, and it is taken off your final invoice.\n\n{_biz(owner)}")}}


def declined_emails(owner: User, bk: Booking, client: Client | None, reason: str = "") -> dict:
    when = _pretty_date(bk.date)
    if not (client and client.email):
        return {}
    extra = f"\n\n{reason.strip()}" if reason.strip() else ""
    return {"customer": {"to": client.email, "subject": f"We can't do {when}",
                         "body": (f"Hi {_first(client)},\n\nI'm sorry, we can't do {when} after all, so we have released it.{extra}\n\n"
                                  f"You haven't paid anything. Please choose another date from your account and we will hold it for you, or message us and we'll sort it out together.\n\n{_biz(owner)}")}}


def paid_emails(owner: User, bk: Booking, client: Client) -> dict:
    """Sent when the chef marks the deposit received."""
    amount, when = _money(bk.deposit_amount or config.DATE_HOLD_DEPOSIT), _pretty_date(bk.date)
    return {
        "customer": {
            "to": client.email, "subject": f"Deposit received: your date is confirmed for {when}",
            "body": (f"Hi {_first(client)},\n\nThank you, we have received your {amount} deposit and "
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
    out = {"chef": {"to": owner.email, "subject": f"Date released: {(client.name if client else 'client')} · {when}",
                    "body": f"The {amount} deposit didn't arrive within {config.DATE_HOLD_HOURS:g} hours, so the hold on {when} has been released and the date is open again.\n\n— The Creatiste Command"}}
    if client and client.email:
        out["customer"] = {"to": client.email, "subject": f"Your date has been released: {when}",
                           "body": (f"Hi {_first(client)},\n\nWe didn't receive the {amount} deposit within {config.DATE_HOLD_HOURS:g} hours, "
                                    f"so {when} has been released.\n\nIf you still want it and it's free, you can request it again from your account.\n\n{_biz(owner)}")}
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
    """Release every confirmed-but-unpaid request whose deposit time is up (status -> cancelled, the day opens, everyone is told).
    A request still waiting for the chef has no clock and is never released here. Idempotent."""
    q = db.query(Booking).filter(Booking.date_hold == True, Booking.status == "enquiry",  # noqa: E712
                                 Booking.deposit_paid == False, Booking.hold_expires_at != "",  # noqa: E712
                                 Booking.hold_expires_at < _iso(_now()))
    if owner_id:
        q = q.filter(Booking.user_id == owner_id)
    rows = q.all()
    for bk in rows:
        bk.status = "cancelled"
        bk.notes = f"{bk.notes or ''}\nDate released: the deposit didn't arrive within {config.DATE_HOLD_HOURS:g} hours.".strip()
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
    client = eligible_client(db, owner.id, cus.email)
    clients = db.query(Client).filter(Client.user_id == owner.id, func.lower(Client.email) == cus.email.lower()).all()
    cids = [c.id for c in clients]
    mine = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id.in_(cids), Booking.date_hold == True,  # noqa: E712
                                     Booking.status.in_(["enquiry", "confirmed"]), Booking.date >= _date.today().isoformat())
            .order_by(Booking.date.asc()).all()) if cids else []
    setups = requestable_setup(db, owner)
    by_service: dict[str, list[str]] = {}
    rules = rules_for(owner)
    if client:
        rules, rows = hold_calendar(db, owner)
        mine_days = {b.date for b in mine}
        for name, svc in setups.items():
            by_service[name] = [d for d in dates_for_service(rules, rows, svc) if d not in mine_days]
    # Why a day can't be picked, so the website can say so: too soon (notice), a day the service doesn't run, or booked up.
    rules_by_service = {name: {"notice_days": _notice(svc), "first_date": first_date(svc).isoformat(),
                               "days": list(svc.get("request_days") or [])} for name, svc in setups.items()}
    return {"eligible": bool(client), "amount": config.DATE_HOLD_DEPOSIT, "hours": config.DATE_HOLD_HOURS,
            "min_days": min([r["notice_days"] for r in rules_by_service.values()] or [config.DATE_HOLD_MIN_DAYS]),
            "window_days": config.DATE_HOLD_WINDOW_DAYS, "max_dates": config.DATE_HOLD_MAX_PER_REQUEST,
            "work_days": rules["work_days"], "service_rules": rules_by_service,
            "services": list(setups), "dates_by_service": by_service,
            "holds": [hold_dict(b, cus.name or (client.name if client else "")) for b in mine]}


@public_router.post("/{token}/hold", status_code=201)
def place_hold(request: Request, token: str, payload: dict = Body(...), authorization: str = Header(default=""), db: Session = Depends(get_db)):
    owner = _owner(db, token)
    cus = current_customer(owner, db, authorization)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"hold:{ip}", 600) >= 8:
        raise HTTPException(429, "A few requests have been placed from here already. Please wait a little while.")
    ratelimit.record(f"hold:{ip}", 600)
    expire_holds(db, owner.id)
    if calsync.stale(owner, 300):  # a date just blocked in her main calendar shouldn't be requestable
        calsync.sync_user(db, owner)
    client = eligible_client(db, owner.id, cus.email)
    if not client:
        raise HTTPException(403, "Booking dates online is for regular and already-consulted clients. Please enquire and we'll be in touch.")
    raw = payload.get("dates")
    if raw is None and payload.get("date"):
        raw = [payload.get("date")]
    days = sorted({str(d).strip()[:10] for d in (raw or []) if str(d).strip()})
    service = (payload.get("service") or "").strip()
    svc = requestable_setup(db, owner).get(service)
    if not svc:
        raise HTTPException(422, "Choose which service these dates are for")
    if not days:
        raise HTTPException(422, "Choose at least one date")
    if len(days) > config.DATE_HOLD_MAX_PER_REQUEST:
        raise HTTPException(422, f"You can ask for up to {config.DATE_HOLD_MAX_PER_REQUEST} dates at a time")
    allowed = set(open_hold_dates(db, owner, service))
    bad = [d for d in days if d not in allowed]
    if bad:
        if bad[0] < first_date(svc).isoformat():
            n = _notice(svc)
            raise HTTPException(422, f"{_pretty_date(bad[0])} is too soon: {service} needs at least {n} day{'s' if n != 1 else ''}' notice. "
                                     f"The first date you can ask for is {_pretty_date(first_date(svc).isoformat())}. For anything sooner, please message us.")
        raise HTTPException(422, f"{_pretty_date(bad[0])} isn't available for that. Please pick from the dates shown.")
    cids = [c.id for c in db.query(Client).filter(Client.user_id == owner.id, func.lower(Client.email) == cus.email.lower()).all()]
    active = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id.in_(cids), Booking.date_hold == True,  # noqa: E712
                                       Booking.status == "enquiry", Booking.deposit_paid == False).all())  # noqa: E712
    if {b.date for b in active} & set(days):
        raise HTTPException(422, "You already have one of those dates held.")
    if len(active) + len(days) > config.DATE_HOLD_MAX_ACTIVE:
        raise HTTPException(422, f"You have {len(active)} dates waiting already. Please let us confirm those before asking for more.")
    note = (payload.get("note") or "").strip()[:500]
    _, own_load = request_load(rules_for(owner), svc)
    made = []
    for day in days:
        bk = Booking(
            user_id=owner.id, client_id=client.id, title=f"Date request · {client.name}", event_type=request_label(svc), day_load=own_load,
            status="enquiry", date=day, date_hold=True, hold_stage="requested", deposit_amount=config.DATE_HOLD_DEPOSIT, deposit_paid=False,
            hold_expires_at="",
            notes=f"Date requested online, held until confirmed. Deposit {_money(config.DATE_HOLD_DEPOSIT)} by bank transfer once confirmed, reference {_reference(client.name, day)}."
                  + (f"\nClient note: {note}" if note else ""),
        )
        db.add(bk)
        made.append(bk)
    db.commit()
    for bk in made:
        db.refresh(bk)
    _send(requested_emails(owner, made, client), "customer", "chef")
    notify.notify(db, owner, "requests", f"New date request from {client.name}",
                  f"{service}: " + ", ".join(_pretty_date(b.date) for b in made) + ". Tap to say if you're free.",
                  url="/app/calendar", tag=f"request-{made[0].id}")
    return {"holds": [hold_dict(b, client.name) for b in made],
            "bank": {"name": owner.bank_account_name, "bank": owner.bank_name, "sort": owner.bank_sort_code, "account": owner.bank_account_number}}


# ───────────────────────────── chef ─────────────────────────────
def _hold(db: Session, user, hold_id: int) -> Booking:
    bk = get_owned(db, Booking, hold_id, ws_id(user))
    if not bk.date_hold:
        raise HTTPException(404, "That booking isn't a date request")
    return bk


def _client_of(db: Session, bk: Booking) -> Client | None:
    return db.get(Client, bk.client_id) if bk.client_id else None


@router.get("")
def list_holds(db: Session = Depends(get_db), user: User = Depends(require_active)):
    expire_holds(db, ws_id(user))
    rows = (db.query(Booking).filter(Booking.user_id == ws_id(user), Booking.date_hold == True, Booking.status == "enquiry",  # noqa: E712
                                     Booking.deposit_paid == False).order_by(Booking.date.asc()).all())  # noqa: E712
    out = []
    for b in rows:
        c = _client_of(db, b)
        out.append({**hold_dict(b, c.name if c else ""), "client_id": b.client_id, "client_name": c.name if c else "",
                    "email": c.email if c else "", "phone": c.phone if c else "", "notes": b.notes or ""})
    return out


@router.get("/{hold_id}/confirm-preview")
def confirm_preview(hold_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    bk = _hold(db, user, hold_id)
    owner, client = db.get(User, ws_id(user)), _client_of(db, bk)
    if not client:
        raise HTTPException(422, "This request has no client attached")
    probe = Booking(date=bk.date, event_type=bk.event_type, deposit_amount=bk.deposit_amount,
                    hold_expires_at=_iso(_now() + timedelta(hours=config.DATE_HOLD_HOURS)))
    return {"stage": stage_of(bk), **confirm_emails(owner, probe, client)}


@router.post("/{hold_id}/confirm")
def confirm_available(hold_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    """The chef is free that day: ask the client for the deposit and start its clock."""
    bk = _hold(db, user, hold_id)
    if bk.deposit_paid or bk.status != "enquiry":
        raise HTTPException(422, "This one is already settled")
    owner, client = db.get(User, ws_id(user)), _client_of(db, bk)
    bk.hold_stage = "awaiting_deposit"
    bk.hold_expires_at = _iso(_now() + timedelta(hours=config.DATE_HOLD_HOURS))
    db.commit()
    if client:
        _send(confirm_emails(owner, bk, client), "customer")
    return {"ok": True, "expires_at": bk.hold_expires_at + "Z"}


@router.post("/{hold_id}/decline")
def decline(hold_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db), user: User = Depends(require_active)):
    bk = _hold(db, user, hold_id)
    if bk.deposit_paid:
        raise HTTPException(422, "The deposit has been received, so this is a confirmed booking. Cancel or move it from Bookings.")
    owner, client = db.get(User, ws_id(user)), _client_of(db, bk)
    bk.status, bk.hold_stage = "cancelled", ""
    bk.notes = f"{bk.notes or ''}\nDeclined by the chef.".strip()
    db.commit()
    _send(declined_emails(owner, bk, client, (payload or {}).get("reason") or ""), "customer")
    return {"ok": True}


@router.get("/{hold_id}/paid-preview")
def paid_preview(hold_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    bk = _hold(db, user, hold_id)
    owner, client = db.get(User, ws_id(user)), _client_of(db, bk)
    if not client:
        raise HTTPException(422, "This request has no client attached")
    return {"status": bk.status, **paid_emails(owner, bk, client)}


@router.post("/{hold_id}/paid")
def mark_received(hold_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    bk = _hold(db, user, hold_id)
    owner, client = db.get(User, ws_id(user)), _client_of(db, bk)
    if bk.deposit_paid:
        return {"ok": True, "already": True}
    if bk.status == "cancelled":
        # The money arrived after the hold lapsed: confirm it only if nobody has taken the day since.
        rules = rules_for(owner)
        day = compute_days(db, owner.id, rules, _date.fromisoformat(bk.date), _date.fromisoformat(bk.date), detail=True)
        add = load_of(rules, bk)
        if not day or day[0]["state"] == "full" or day[0]["load"] + add > 1.0001:
            raise HTTPException(409, "That date has been taken since the hold lapsed. Offer the client another date (their deposit can move).")
    bk.status, bk.deposit_paid, bk.hold_expires_at, bk.hold_stage = "confirmed", True, "", ""
    bk.deposit_amount = bk.deposit_amount or config.DATE_HOLD_DEPOSIT
    bk.title = (bk.title or "").replace("Date request ·", "Booking ·", 1)
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
    bk.status, bk.hold_stage = "cancelled", ""
    bk.notes = f"{bk.notes or ''}\nDate released by the chef.".strip()
    db.commit()
    return {"ok": True}
