"""Today: the one screen a chef opens in the morning.

What needs them (date requests to answer, deposits and orders waiting for money, reviews to approve, new enquiries,
invoices overdue), what is on today and for the next few days (jobs, their shop and prep, blocked-out time and dated
to-dos, business and personal), and the to-dos with no date. The same snapshot feeds the assistant's picture of the
business (routers/assistant.py) and the morning summary pop-up (jobs.run_reminders).
"""
from datetime import date as _date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import config
from ..auth import require_active
from ..database import get_db
from ..models import Booking, Client, ClientReview, Invoice, PreOrder, Task, User
from ..utils import ws_id

router = APIRouter(prefix="/today", tags=["today"])


def local_now() -> datetime:
    return datetime.now(ZoneInfo(config.ONBOARDING_TZ))


def local_today() -> _date:
    return local_now().date()


def pretty_day(iso: str, today: _date | None = None) -> str:
    """'Today', 'Tomorrow', or 'Tue 17 Nov'."""
    try:
        d = _date.fromisoformat(iso[:10])
    except ValueError:
        return iso or ""
    if today:
        if d == today:
            return "Today"
        if d == today + timedelta(days=1):
            return "Tomorrow"
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"


def pretty_time(t: str) -> str:
    try:
        h, m = (int(x) for x in t.split(":"))
    except ValueError:
        return t or ""
    suffix = "pm" if h >= 12 else "am"
    h12 = h % 12 or 12
    return f"{h12}:{m:02d}{suffix}" if m else f"{h12}{suffix}"


def money(n: float, owner: User | None = None) -> str:
    sym = {"GBP": "£", "USD": "$", "EUR": "€", "NGN": "₦", "AUD": "A$", "CAD": "C$"}.get(getattr(owner, "currency", None) or "GBP", "£")
    return f"{sym}{n:,.2f}".replace(".00", "")


def _invoice_total(inv: Invoice) -> float:
    from .finance import invoice_total

    return invoice_total(inv)


def unpaid_invoices(db: Session, uid: int, today: _date) -> list[dict]:
    """Invoices sent and not yet paid, oldest first, each marked overdue when its due date has passed."""
    names = {c.id: c.name for c in db.query(Client).filter(Client.user_id == uid).all()}
    rows = db.query(Invoice).filter(Invoice.user_id == uid, Invoice.status.in_(("sent", "overdue"))).order_by(Invoice.issue_date.asc()).all()
    out = []
    for inv in rows:
        late = inv.status == "overdue" or bool(inv.due_date and inv.due_date < today.isoformat())
        out.append({"id": inv.id, "number": inv.number, "client_id": inv.client_id, "client": names.get(inv.client_id, ""),
                    "total": _invoice_total(inv), "status": "overdue" if late else "sent", "issue_date": inv.issue_date,
                    "due_date": inv.due_date, "service_date": inv.service_date, "service_type": inv.service_type})
    return out


def needs(db: Session, owner: User, today: _date, *, finance: bool = True) -> list[dict]:
    """Things waiting for the chef, most pressing first. Each is one line with where to deal with it."""
    uid = owner.id
    names = {c.id: c.name for c in db.query(Client).filter(Client.user_id == uid).all()}
    out: list[dict] = []
    from .holds import _lapsed

    money_url = "/app/standing" if finance else "/app/calendar"   # Paid & booked is the owner's (Pro and up)
    holds = (db.query(Booking).filter(Booking.user_id == uid, Booking.date_hold == True,  # noqa: E712
                                      Booking.status.in_(("enquiry", "confirmed", "cancelled")), Booking.deposit_paid == False,  # noqa: E712
                                      Booking.date >= today.isoformat()).order_by(Booking.date.asc()).all())
    for h in holds:
        who = names.get(h.client_id) or "A client"
        svc = (h.event_type or "").split("·", 1)[1].strip() if "·" in (h.event_type or "") else (h.event_type or "")
        if h.status == "cancelled":
            if _lapsed(h):
                out.append({"kind": "lapsed", "text": f"{who}'s date on {pretty_day(h.date, today)} lapsed", "sub": f"{svc}. Put it back in your diary, or leave it.",
                            "url": money_url, "id": h.id})
        elif h.status == "enquiry" and (h.hold_stage or "") == "requested":
            out.append({"kind": "request", "text": f"{who} asked for {pretty_day(h.date, today)}", "sub": f"{svc}. Say if you're free.",
                        "url": "/app/calendar", "id": h.id})
        elif h.status == "enquiry" or (h.hold_stage or "") == "awaiting_deposit":
            # Accepted: it is in the diary as booked, and stays there. The deposit is simply still owed.
            out.append({"kind": "deposit", "text": f"{who} owes the deposit for {pretty_day(h.date, today)}",
                        "sub": f"{svc}. Tap “received” when the {money(h.deposit_amount or config.DATE_HOLD_DEPOSIT, owner)} lands.",
                        "url": money_url, "id": h.id})
    orders = (db.query(PreOrder).filter(PreOrder.user_id == uid, PreOrder.status == "pending_payment", PreOrder.pay_method == "bank",
                                        PreOrder.for_date >= today.isoformat()).order_by(PreOrder.for_date.asc()).all())
    if orders:
        who = ", ".join(sorted({o.customer_name.split()[0] for o in orders if o.customer_name})[:4])
        out.append({"kind": "order", "text": f"{len(orders)} order{'s' if len(orders) != 1 else ''} waiting for payment",
                    "sub": f"{who}. Mark paid when the transfer arrives." if who else "Mark paid when the transfer arrives.",
                    "url": "/app/preorders", "n": len(orders)})
    pending = db.query(ClientReview).filter(ClientReview.user_id == uid, ClientReview.status == "pending").count()
    if pending:
        out.append({"kind": "review", "text": f"{pending} review{'s' if pending != 1 else ''} waiting for your approval",
                    "sub": "Approve to show on your website.", "url": "/app/reviews", "n": pending})
    enquiries = (db.query(Booking).filter(Booking.user_id == uid, Booking.status == "enquiry",
                                          (Booking.date_hold == False) | (Booking.date_hold.is_(None)),  # noqa: E712
                                          (Booking.date == "") | (Booking.date >= today.isoformat())).count())
    if enquiries:
        out.append({"kind": "enquiry", "text": f"{enquiries} new enquir{'ies' if enquiries != 1 else 'y'} to answer",
                    "sub": "From your website.", "url": "/app/bookings?view=pipeline", "n": enquiries})
    if finance:
        unpaid = unpaid_invoices(db, uid, today)
        late = [i for i in unpaid if i["status"] == "overdue"]
        if late:
            out.append({"kind": "overdue", "text": f"{len(late)} invoice{'s' if len(late) != 1 else ''} overdue",
                        "sub": f"{money(sum(i['total'] for i in late), owner)} owed by {', '.join(sorted({i['client'] or 'a client' for i in late})[:4])}.",
                        "url": "/app/finance?tab=invoices", "n": len(late)})
    return out


def snapshot(db: Session, owner: User, *, today: _date | None = None, days: int = 7, personal: bool = True, finance: bool = True) -> dict:
    from .jobs import calendar_days

    today = today or local_today()
    cal = calendar_days(db, owner, today, today + timedelta(days=days - 1), today=today, personal=personal)
    undated = (db.query(Task).filter(Task.user_id == owner.id, Task.status != "done", Task.due_date == "")
               .order_by(Task.created_at.desc()).limit(60).all())
    undated = [t for t in undated if personal or (t.category or "") != "personal"]
    unpaid = unpaid_invoices(db, owner.id, today) if finance else []
    drafts = (db.query(Invoice).filter(Invoice.user_id == owner.id, Invoice.status == "draft").count()) if finance else 0
    return {
        "today": today.isoformat(),
        "needs": needs(db, owner, today, finance=finance),
        "days": cal["days"],
        "undated": [{"task_id": t.id, "title": t.title, "personal": (t.category or "") == "personal", "priority": t.priority or ""} for t in undated],
        "money": {"unpaid": len(unpaid), "unpaid_total": round(sum(i["total"] for i in unpaid), 2),
                  "overdue": len([i for i in unpaid if i["status"] == "overdue"]), "drafts": drafts},
        # What does not match between money and dates (Paid & booked has the detail and the one-tap fixes).
        "sort": _sort(db, owner, today) if finance else None,
    }


def _sort(db: Session, owner: User, today: _date) -> dict:
    from .standing import sort_summary

    return sort_summary(db, owner, today)


def brief_text(snap: dict, owner: User | None = None) -> tuple[str, str]:
    """The morning summary as (title, body): what is on today, then what is waiting."""
    today = _date.fromisoformat(snap["today"])
    entries = (snap["days"][0]["entries"] if snap["days"] else [])
    bits, todos = [], 0
    for e in entries:
        if e["kind"] == "todo":
            todos += 0 if e.get("done") else 1
            continue
        if e["kind"] in ("calendar", "block", "held"):
            continue
        t = f" {pretty_time(e['time'])}" if e.get("time") else ""
        bits.append(f"{e['label']} · {e['who']}{t}")
    if todos:
        bits.append(f"{todos} to-do{'s' if todos != 1 else ''}")
    waiting = len(snap["needs"])
    title = f"Today, {today.strftime('%A')} {today.day} {today.strftime('%B')}"
    body = "; ".join(bits) if bits else "Nothing in the diary today"
    if waiting:
        body += f". {waiting} thing{'s' if waiting != 1 else ''} waiting for you"
    m = snap.get("money") or {}
    if m.get("overdue"):
        body += f". {m['overdue']} invoice{'s' if m['overdue'] != 1 else ''} overdue"
    return title, body + "."


@router.get("")
def today_view(db: Session = Depends(get_db), user: User = Depends(require_active)):
    from .assistant import status_for

    owner = db.get(User, ws_id(user))
    from .. import tidy

    tidy.run(db, owner, local_today())
    staff = user.role == "staff"
    finance = (not staff) and (user.workspace_plan_level >= 2 or user.role == "admin")
    snap = snapshot(db, owner, personal=not staff, finance=finance)
    first = (user.name or "").split()[0] if user.name else ""
    if first.lower() in ("platform", "admin"):      # the owner account's placeholder name is not a name to greet
        first = ""
    return {**snap, "assistant": status_for(user), "first_name": first}
