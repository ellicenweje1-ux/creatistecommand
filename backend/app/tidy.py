"""Tidy-up: the app finds doubles by itself and joins them, so nothing shows twice.

Run whenever the owner opens Today, the Calendar or Paid & booked (and so before the assistant looks at the business):

  * the same person entered as two clients (same email, same phone, or the same full name with nothing that conflicts)
    -> joined into one; everything they had (bookings, invoices, reviews, orders) follows;
  * two entries for the same client on the same day (a website date request and a booking typed in by hand, a
    pencilled day and an invoice) -> merged into one, keeping the invoice, the deposit and the furthest-on status;
  * a date that "lapsed" under the old 12-hour rule when the same client is in fact booked for that day -> closed off.

Nothing is emailed and no money document is ever changed or removed. What it cannot safely decide (two different
invoices for one day, a day with more work than fits) is pointed out on Paid & booked instead (routers/standing.py).
Every change is noted in a short log (users.job_setup["tidied"]) that Paid & booked shows for a week.
"""
import logging
import re
import threading
from datetime import date as _date, datetime, timedelta

from sqlalchemy.orm import Session

from .models import Appointment, Booking, Client, ClientReview, Invoice, PreOrder, Quote, SiteCustomer, User

log = logging.getLogger("creatiste.tidy")

LIVE = ("enquiry", "quoted", "confirmed", "in_prep", "completed")
RANK = {"enquiry": 0, "quoted": 1, "confirmed": 2, "in_prep": 3, "completed": 4}
MERGED_NOTE = "Double entry tidied up: merged into the other entry for this day."
LOOK_BACK_DAYS = 60
LOG_KEEP = 25


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _phone(s: str) -> str:
    d = re.sub(r"\D", "", s or "")
    if d.startswith("44"):
        d = "0" + d[2:]
    return d if len(d) >= 9 else ""


def _service(bk: Booking) -> str:
    et = bk.event_type or ""
    return _norm(et.split("·", 1)[1] if "·" in et else et)


def _svc_key(s: str) -> str:
    s = re.sub(r"^the ", "", _norm(s))
    return re.sub(r"[^a-z0-9]", "", s)


def same_service(a: str, b: str) -> bool:
    """'The Home Edit', 'Home edit' and 'Personal chef · The Home Edit' are one service; a blank one fits anything."""
    ka, kb = _svc_key(a), _svc_key(b)
    return not ka or not kb or ka in kb or kb in ka


def _first(name: str) -> str:
    toks = _norm(name).split()
    return re.sub(r"[^a-z]", "", toks[0]) if toks else ""


def same_person(a: Client, b: Client) -> bool:
    """A shared phone or email alone is not enough (a family, a PA, a company inbox): the first names must match too."""
    fa, fb = _first(a.name), _first(b.name)
    return bool(fa) and fa == fb


def _day(iso: str) -> str:
    try:
        d = _date.fromisoformat(iso[:10])
        return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"
    except ValueError:
        return iso or ""


# ───────────────────────────── clients ─────────────────────────────
def _join_clients(db: Session, owner: User, keep: Client, other: Client) -> None:
    for model in (Booking, Invoice, Quote, ClientReview, Appointment, PreOrder, SiteCustomer):
        db.query(model).filter(model.user_id == owner.id, model.client_id == other.id).update({"client_id": keep.id}, synchronize_session=False)
    for field in ("email", "phone", "company", "address"):
        if hasattr(keep, field) and not (getattr(keep, field) or "") and (getattr(other, field, "") or ""):
            setattr(keep, field, getattr(other, field))
    if getattr(other, "regular", False):
        keep.regular = True
    if (other.notes or "").strip() and _norm(other.notes) not in _norm(keep.notes or ""):
        keep.notes = ((keep.notes or "").rstrip() + "\n" + other.notes.strip()).strip()
    tags = list(dict.fromkeys([*(keep.tags or []), *(other.tags or [])])) if hasattr(keep, "tags") else None
    if tags is not None:
        keep.tags = tags
    try:
        from .recycle import snapshot_deletion

        snapshot_deletion(db, owner, other)      # recoverable from Settings → Recently deleted
    except Exception:  # the join matters more than the bin
        pass
    db.delete(other)


def join_clients(db: Session, owner: User) -> list[str]:
    rows = db.query(Client).filter(Client.user_id == owner.id).order_by(Client.id.asc()).all()
    # A client brought back from Recently deleted after a join was brought back on purpose: never join it again.
    apart = set((owner.job_setup or {}).get("tidy_apart") or [])
    rows = [c for c in rows if c.id not in apart]
    if len(rows) < 2:
        return []
    parent = {c.id: c.id for c in rows}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    seen: dict[tuple, list[Client]] = {}
    for c in rows:
        keys = []
        if _norm(c.email):
            keys.append(("e", _norm(c.email)))
        if _phone(c.phone):
            keys.append(("p", _phone(c.phone)))
        for k in keys:
            for other in seen.get(k, []):
                if same_person(other, c):
                    union(other.id, c.id)
            seen.setdefault(k, []).append(c)
    # The same full name (two words or more), as long as nothing about the two disagrees.
    by_name: dict[str, list[Client]] = {}
    for c in rows:
        n = _norm(c.name)
        if len(n.split()) >= 2:
            by_name.setdefault(n, []).append(c)
    for same in by_name.values():
        first = same[0]
        for c in same[1:]:
            emails = {_norm(x.email) for x in (first, c) if _norm(x.email)}
            phones = {_phone(x.phone) for x in (first, c) if _phone(x.phone)}
            if len(emails) <= 1 and len(phones) <= 1:
                union(first.id, c.id)

    groups: dict[int, list[Client]] = {}
    for c in rows:
        groups.setdefault(find(c.id), []).append(c)
    out, gone = [], []
    for root, same in groups.items():
        if len(same) < 2:
            continue
        keep = next(c for c in same if c.id == root)
        for other in same:
            if other.id != keep.id:
                gone.append(other.id)
                _join_clients(db, owner, keep, other)
        out.append(f"{keep.name} was in your clients {len(same)} times, so they were joined into one.")
    if gone:
        setup = dict(owner.job_setup or {})
        setup["tidy_apart"] = list(dict.fromkeys([*(setup.get("tidy_apart") or []), *gone]))[-500:]
        owner.job_setup = setup
        db.flush()
    return out


# ───────────────────────────── bookings ─────────────────────────────
def _merge_booking(keep: Booking, other: Booking, moved: list[Invoice]) -> None:
    for inv in moved:
        inv.booking_id = keep.id
    if other.deposit_paid and not keep.deposit_paid:
        keep.deposit_paid, keep.date_hold = True, True
        keep.deposit_amount = other.deposit_amount or keep.deposit_amount
        keep.deposit_applied = bool(other.deposit_applied)
        keep.hold_stage = ""
    elif other.date_hold and not other.deposit_paid and (other.hold_stage or "awaiting_deposit") == "awaiting_deposit" and not keep.date_hold:
        keep.date_hold, keep.hold_stage = True, "awaiting_deposit"      # accepted, deposit still owed
        keep.deposit_amount = other.deposit_amount or keep.deposit_amount
    if RANK.get(other.status, 0) > RANK.get(keep.status, 0):
        keep.status = other.status
    if keep.status != "enquiry" and keep.date_hold and not keep.deposit_paid and (keep.hold_stage or "") == "requested":
        keep.hold_stage = "awaiting_deposit"        # it is booked, so the request has been answered
    for field in ("start_time", "end_time", "event_type", "venue_name", "venue_address", "menu_type"):
        if not (getattr(keep, field) or "") and (getattr(other, field) or ""):
            setattr(keep, field, getattr(other, field))
    if not keep.guest_count and other.guest_count:
        keep.guest_count = other.guest_count
    if not keep.quoted_price and other.quoted_price:
        keep.quoted_price = other.quoted_price
    extra = (other.notes or "").strip()
    if extra and _norm(extra) not in _norm(keep.notes or "") and extra not in ("Created from an invoice.", "Pencilled in."):
        keep.notes = ((keep.notes or "").rstrip() + "\n" + extra).strip()[:6000]
    other.status, other.hold_stage, other.hold_expires_at = "cancelled", "", ""
    other.notes = ((other.notes or "").rstrip() + "\n" + MERGED_NOTE).strip()


def merge_bookings(db: Session, owner: User, today: _date) -> list[str]:
    lo = (today - timedelta(days=LOOK_BACK_DAYS)).isoformat()
    rows = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.date >= lo, Booking.status.in_(LIVE),
                                     Booking.client_id.isnot(None)).order_by(Booking.id.asc()).all())
    rows = [b for b in rows if (b.event_type or "") != "Pre-order" and b.client_id and not (b.status == "enquiry" and not b.date_hold)]
    groups: dict[tuple, list[Booking]] = {}
    for b in rows:
        groups.setdefault((b.client_id, b.date), []).append(b)
    doubles = {k: v for k, v in groups.items() if len(v) > 1}
    if not doubles:
        return []
    ids = [b.id for v in doubles.values() for b in v]
    inv_of: dict[int, list[Invoice]] = {}
    for inv in db.query(Invoice).filter(Invoice.user_id == owner.id, Invoice.booking_id.in_(ids), Invoice.status != "void").all():
        inv_of.setdefault(inv.booking_id, []).append(inv)
    names = {c.id: c.name for c in db.query(Client).filter(Client.user_id == owner.id).all()}
    out = []
    for (cid, day), same in doubles.items():
        keep = max(same, key=lambda b: (bool(inv_of.get(b.id)), RANK.get(b.status, 0), bool(b.deposit_paid), -b.id))
        merged = 0
        for other in same:
            if other.id == keep.id:
                continue
            if inv_of.get(other.id) and inv_of.get(keep.id):
                continue        # two invoiced jobs on one day: money is hers to decide (Paid & booked points it out)
            if not same_service(_service(other), _service(keep)):
                continue        # two different services for one client on one day may well be real
            _merge_booking(keep, other, inv_of.get(other.id, []))
            inv_of.setdefault(keep.id, []).extend(inv_of.pop(other.id, []))
            merged += 1
        if merged:
            # the plan (days, shop, prep) is rebuilt from what is now one job the next time the calendar reads it
            out.append(f"{names.get(cid, 'A client')} was down {merged + 1} times for {_day(day)}, so the entries were merged into one.")
    if out:
        db.flush()
    return out


def close_superseded_lapses(db: Session, owner: User, today: _date) -> list[str]:
    """A date the old 12-hour rule let go, when that client is booked on that day anyway: nothing left to decide."""
    marker = "Date released: the deposit didn't arrive"
    rows = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.status == "cancelled", Booking.date_hold == True,  # noqa: E712
                                     Booking.deposit_paid == False, Booking.date >= today.isoformat(),  # noqa: E712
                                     Booking.notes.contains(marker)).all())
    out = []
    for b in rows:
        if "released by the chef" in (b.notes or ""):
            continue
        live = (db.query(Booking.id).filter(Booking.user_id == owner.id, Booking.client_id == b.client_id, Booking.date == b.date,
                                            Booking.id != b.id, Booking.status.in_(("quoted", "confirmed", "in_prep", "completed"))).first())
        if live:
            b.notes = (b.notes or "").rstrip() + "\nAlready booked on this day, so this was released by the chef's tidy-up."
            out.append(f"A lapsed date on {_day(b.date)} was closed off: that client is already booked that day.")
    if out:
        db.flush()
    return out


_locks: dict[int, threading.Lock] = {}
_guard = threading.Lock()


def _lock(uid: int) -> threading.Lock:
    with _guard:
        return _locks.setdefault(uid, threading.Lock())


def run(db: Session, owner: User, today: _date | None = None) -> list[str]:
    """Join every double it can. Safe to call often: with nothing to do it is three small queries.

    Several screens load at once (Paid & booked asks for its clients and its date requests together), so one business is
    tidied by one request at a time, and each starts from what the last one saved."""
    today = today or _date.today()
    db.commit()             # start from what is saved now (nothing is pending at the callers)
    with _lock(owner.id):
        db.expire_all()
        try:
            lines = join_clients(db, owner) + merge_bookings(db, owner, today) + close_superseded_lapses(db, owner, today)
            if lines:
                setup = dict(owner.job_setup or {})
                stamp = datetime.utcnow().replace(microsecond=0).isoformat()
                setup["tidied"] = ([{"at": stamp, "text": t} for t in lines] + list(setup.get("tidied") or []))[:LOG_KEEP]
                owner.job_setup = setup
            db.commit()
        except Exception:   # tidying must never take a page down
            db.rollback()
            log.exception("tidy failed for user %s", owner.id)
            return []
    return lines


def recent(owner: User, days: int = 7) -> list[dict]:
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()
    return [t for t in ((owner.job_setup or {}).get("tidied") or []) if isinstance(t, dict) and (t.get("at") or "") >= since]
