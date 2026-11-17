"""Paid & booked: where every client stands.

For each client with anything live: the dates they have, what they have paid and still owe, and anything that does not
match yet (paid with no date in the diary, a date with no invoice, a deposit owed, a request waiting for an answer).
Every mismatch has a one-tap fix on the page (frontend/src/pages/Standing.jsx) or can be fixed by telling the assistant.

The same findings feed Today's "to sort out" line (routers/today.py) and the assistant's picture of the business
(routers/assistant.py), so all three always agree.

Two flags let the owner say "nothing to match here": invoices.no_date (a product, a top-up, work already done) and
bookings.no_invoice (a favour, a free tasting).
"""
from datetime import date as _date, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config
from ..auth import require_owner
from ..database import get_db
from ..models import Booking, Client, Invoice, User
from ..utils import ws_id
from .today import local_today, money, pretty_day

router = APIRouter(prefix="/standing", tags=["standing"])

PAST_DAYS = 30        # jobs up to this many days back still show (done, not invoiced / not paid)
PAID_DAYS = 90        # paid invoices from this far back are listed under the client
PAID_NO_DATE_DAYS = 45   # a payment older than this with no date is taken as work already done
DRAFT_DAYS = 60       # drafts older than this are left to Finance
SOON_DAYS = 7         # "soon": a date this close makes a missing invoice or deposit pressing

LIVE = ("quoted", "confirmed", "in_prep", "completed")


def _service(bk: Booking) -> str:
    et = bk.event_type or ""
    return (et.split("·", 1)[1].strip() if "·" in et else et) or "Booking"


def _days_text(days: list[str], today: _date) -> str:
    return ", ".join(pretty_day(d, today) for d in days)


def _state(bk: Booking, lapsed: bool) -> str:
    if lapsed:
        return "lapsed"
    if bk.date_hold and not bk.deposit_paid:
        if bk.status == "enquiry" and (bk.hold_stage or "") == "requested":
            return "requested"
        return "deposit_owed"
    if bk.status == "quoted":
        return "pencilled"
    if bk.status == "completed":
        return "done"
    return "booked"


def build(db: Session, owner: User, today: _date | None = None) -> dict:
    """Every client with something live, the ones needing attention first."""
    from .finance import invoice_total
    from .holds import _lapsed
    from .jobs import plan_days

    today = today or local_today()
    t_iso = today.isoformat()
    lo = (today - timedelta(days=PAST_DAYS)).isoformat()
    paid_lo = (today - timedelta(days=PAID_DAYS)).isoformat()
    nodate_lo = (today - timedelta(days=PAID_NO_DATE_DAYS)).isoformat()
    draft_lo = (today - timedelta(days=DRAFT_DAYS)).isoformat()
    soon = (today + timedelta(days=SOON_DAYS)).isoformat()
    tomorrow = (today + timedelta(days=1)).isoformat()
    uid = owner.id

    clients = {c.id: c for c in db.query(Client).filter(Client.user_id == uid).all()}
    invoices = db.query(Invoice).filter(Invoice.user_id == uid, Invoice.status != "void").all()
    bookings = db.query(Booking).filter(Booking.user_id == uid, Booking.date >= lo).all()
    by_id = {b.id: b for b in bookings}
    # Older bookings are only needed to tell whether an invoice with no service day of its own still has a date.
    missing = sorted({i.booking_id for i in invoices if i.booking_id and not i.service_date} - set(by_id))
    for k in range(0, len(missing), 400):
        for b in db.query(Booking).filter(Booking.user_id == uid, Booking.id.in_(missing[k:k + 400])).all():
            by_id[b.id] = b

    def bk_live(b: Booking) -> bool:
        if (b.event_type or "") == "Pre-order" or not b.date or b.date < lo:
            return False
        if b.status == "cancelled":
            return _lapsed(b)
        if b.status == "enquiry":
            return bool(b.date_hold)          # a plain website enquiry is the pipeline's job, not a booked date
        return b.status in LIVE

    live_bk = {b.id: b for b in bookings if bk_live(b)}
    inv_of: dict[int, list[Invoice]] = {}
    for i in invoices:
        if i.booking_id:
            inv_of.setdefault(i.booking_id, []).append(i)

    def when_of(i: Invoice) -> str:
        return i.paid_date or i.issue_date or (i.created_at.date().isoformat() if i.created_at else "")

    def has_date(i: Invoice) -> bool:
        if i.service_date:
            return True
        b = by_id.get(i.booking_id) if i.booking_id else None
        return bool(b and b.date and b.status != "cancelled")

    def inv_live(i: Invoice) -> bool:
        if i.status in ("sent", "overdue"):
            return True
        if (i.service_date or "") >= lo and i.service_date:
            return True
        if i.booking_id in live_bk:
            return True
        if i.status == "draft":
            return when_of(i) >= draft_lo
        return when_of(i) >= paid_lo

    rows: dict[int, dict] = {}

    def row(cid) -> dict:
        cid = cid or 0
        if cid not in rows:
            c = clients.get(cid)
            rows[cid] = {"client_id": cid, "name": c.name if c else "No client set", "email": (c.email or "") if c else "",
                         "phone": (c.phone or "") if c else "", "dates": [], "invoices": [], "flags": [],
                         "paid_total": 0.0, "owed_total": 0.0}
        return rows[cid]

    def flag(r: dict, kind: str, level: str, text: str, **extra) -> None:
        r["flags"].append({"kind": kind, "level": level, "text": text, **extra})

    # ── dates ──
    for b in sorted(live_bk.values(), key=lambda x: (x.date, x.id)):
        r = row(b.client_id)
        lapsed = b.status == "cancelled"
        state = _state(b, lapsed)
        days = plan_days(b) or [b.date]
        invs = [i for i in inv_of.get(b.id, [])]
        past = days[-1] < t_iso
        svc = _service(b)
        dep = float(b.deposit_amount or 0) or (float(config.DATE_HOLD_DEPOSIT) if b.date_hold else 0)
        r["dates"].append({
            "booking_id": b.id, "date": b.date, "days": days, "service": svc, "state": state, "past": past, "no_invoice": bool(b.no_invoice),
            "invoices": [{"id": i.id, "number": i.number, "status": i.status, "total": invoice_total(i)} for i in invs],
            "deposit": ({"amount": dep, "paid": bool(b.deposit_paid), "applied": bool(b.deposit_applied)} if b.date_hold or b.deposit_paid else None),
        })
        when = _days_text(days, today)
        if state == "requested":
            flag(r, "request", "fix", f"Asked for {when} ({svc}). Waiting for your answer.", booking_id=b.id, date=b.date)
            continue
        if state == "lapsed":
            flag(r, "lapsed", "fix", f"{when} ({svc}) was let go by the old 12-hour rule. Put it back, or leave it.", booking_id=b.id, date=b.date)
            continue
        if state == "deposit_owed":
            flag(r, "deposit_owed", "fix" if b.date <= soon else "watch", f"{money(dep, owner)} deposit owed for {when}.", booking_id=b.id, date=b.date, amount=dep)
        if not invs and not b.no_invoice:
            if state == "deposit_owed" and b.date > soon:
                pass    # the invoice follows the deposit; no need to say it twice
            elif past:
                flag(r, "no_invoice", "fix", f"{when}, {svc}: done, with no invoice.", booking_id=b.id, date=b.date, service=svc)
            else:
                flag(r, "no_invoice", "fix" if b.date <= soon else "watch", f"{when}, {svc}: no invoice yet.", booking_id=b.id, date=b.date, service=svc)
        if b.deposit_paid and not b.deposit_applied and dep and any(i.status in ("draft", "sent", "overdue") for i in invs):
            i = next(i for i in invs if i.status in ("draft", "sent", "overdue"))
            flag(r, "deposit_unused", "watch", f"Their {money(dep, owner)} deposit is paid but not taken off invoice {i.number} yet.", invoice_id=i.id, booking_id=b.id)

    # ── money ──
    for i in sorted(invoices, key=lambda x: (when_of(x), x.id)):
        if not inv_live(i):
            continue
        r = row(i.client_id)
        total = invoice_total(i)
        dated = has_date(i)
        b = by_id.get(i.booking_id) if i.booking_id else None
        day = i.service_date or (b.date if b and b.status != "cancelled" else "")
        days = [d for d in (i.service_days or []) if d] or ([day] if day else [])
        r["invoices"].append({
            "id": i.id, "number": i.number, "status": i.status, "total": total, "issue_date": i.issue_date or "", "paid_date": i.paid_date or "",
            "due_date": i.due_date or "", "service_date": day, "service_days": days, "service_type": i.service_type or "",
            "booking_id": i.booking_id, "has_date": dated, "no_date": bool(i.no_date), "uploaded": bool(i.file_url),
        })
        tag = f"invoice {i.number}" if i.number else "an invoice"
        if not i.client_id:
            flag(r, "no_client", "fix", f"{tag.capitalize()} ({money(total, owner)}) has no client on it. Open it and choose one.", invoice_id=i.id)
        if i.status == "paid":
            r["paid_total"] += total
            if not dated and not i.no_date and i.client_id and when_of(i) >= nodate_lo:
                flag(r, "paid_no_date", "fix", f"Paid {money(total, owner)} ({tag}), but there is no date in your diary.", invoice_id=i.id, amount=total, service=i.service_type or "")
        elif i.status in ("sent", "overdue"):
            r["owed_total"] += total
            late = i.status == "overdue" or bool(i.due_date and i.due_date < t_iso)
            if not dated and not i.no_date and i.client_id:
                flag(r, "unpaid_no_date", "fix", f"{tag.capitalize()} for {money(total, owner)} is sent and not paid, with no date yet.", invoice_id=i.id, amount=total, service=i.service_type or "")
            elif late or (day and day <= tomorrow):
                why = "overdue" if late else (f"and the day was {pretty_day(day, today)}" if day < t_iso else f"and the day is {pretty_day(day, today)}")
                flag(r, "unpaid", "fix", f"{money(total, owner)} not paid yet ({tag}), {why}.", invoice_id=i.id, amount=total, date=day)
            else:
                flag(r, "unpaid", "watch", f"{money(total, owner)} to pay ({tag})" + (f" for {_days_text(days, today)}." if days else "."), invoice_id=i.id, amount=total, date=day)
        elif i.status == "draft":
            if day and day <= soon:
                flag(r, "draft", "fix", f"Draft {tag} ({money(total, owner)}) for {pretty_day(day, today)} has not been sent.", invoice_id=i.id, amount=total, date=day)
            else:
                flag(r, "draft", "watch", f"Draft {tag} ({money(total, owner)}) has not been sent" + (f"; it is for {_days_text(days, today)}." if days else ", and has no date yet."), invoice_id=i.id, amount=total, date=day)

    out = []
    for r in rows.values():
        if not r["dates"] and not r["invoices"]:
            continue
        r["paid_total"], r["owed_total"] = round(r["paid_total"], 2), round(r["owed_total"], 2)
        r["fix"] = len([f for f in r["flags"] if f["level"] == "fix"])
        r["watch"] = len([f for f in r["flags"] if f["level"] == "watch"])
        r["flags"].sort(key=lambda f: 0 if f["level"] == "fix" else 1)
        nxt = next((d["date"] for d in r["dates"] if not d["past"] and d["state"] != "lapsed"), "9999")
        r["next_date"] = "" if nxt == "9999" else nxt
        r["message"] = message_for(owner, r, today)
        r["_key"] = (0 if r["fix"] else 1 if r["watch"] else 2, nxt, r["name"].lower())
        out.append(r)
    out.sort(key=lambda r: r.pop("_key"))
    return {"today": t_iso, "clients": out,
            "counts": {"fix": sum(r["fix"] for r in out), "watch": sum(r["watch"] for r in out),
                       "clients": len(out), "clients_fix": len([r for r in out if r["fix"]]),
                       "matched": len([r for r in out if not r["fix"] and not r["watch"]])}}


STATE_WORDS = {"requested": "requested, I will confirm shortly", "pencilled": "pencilled in", "booked": "booked", "done": "done"}


def message_for(owner: User, r: dict, today: _date) -> str:
    """A plain update the owner can send the client: their dates, what is paid, what is still to pay."""
    first = r["name"].split()[0] if r["client_id"] and r["name"] else ""
    out = [f"Hi {first}," if first else "Hi,", "", "Here is where we are:"]
    up = [d for d in r["dates"] if not d["past"] and d["state"] != "lapsed"]
    if up:
        out += ["", "Your dates"]
        for d in up:
            if d["state"] == "deposit_owed":
                word = f"booked, {money(d['deposit']['amount'], owner)} deposit to pay"
            else:
                word = STATE_WORDS.get(d["state"], "booked")
            out.append(f"• {_days_text(d['days'], today)}: {d['service']} ({word})")
    paid = [i for i in r["invoices"] if i["status"] == "paid"]
    owed = [i for i in r["invoices"] if i["status"] in ("sent", "overdue")]
    deposits = [d for d in r["dates"] if d["deposit"] and d["deposit"]["paid"] and not d["deposit"]["applied"]]
    if paid or owed or deposits:
        out.append("")
    if paid:
        out.append("Paid: " + ", ".join(f"{money(i['total'], owner)} (invoice {i['number']})" for i in paid[-4:]))
    for d in deposits:
        out.append(f"Deposit paid: {money(d['deposit']['amount'], owner)} for {pretty_day(d['date'], today)} (it comes off your invoice)")
    for i in owed:
        out.append(f"Still to pay: {money(i['total'], owner)} (invoice {i['number']})" + (f", due {pretty_day(i['due_date'], today)}" if i["due_date"] else ""))
    need = [f for f in r["flags"] if f["kind"] in ("paid_no_date", "unpaid_no_date")]
    if need:
        out += ["", "I do not have your date" + ("s" if len(need) > 1 or not up else "") + " for "
                + ", ".join(f"the {money(f['amount'], owner)} " + ("you paid" if f["kind"] == "paid_no_date" else "invoice") for f in need)
                + ". Which day would you like? Let me know and I will lock it in."]
    if not up and not need and not owed:
        out += ["", "Nothing is booked in at the moment. Let me know when you would like your next date."]
    out += ["", "If anything looks different on your side, just say.", owner.business_name or owner.name or ""]
    return "\n".join(out).strip()


def sort_summary(db: Session, owner: User, today: _date | None = None, data: dict | None = None) -> dict:
    """The short version for Today: how many things do not match, and the first few in plain words."""
    data = data or build(db, owner, today)
    top = []
    for r in data["clients"]:
        for f in r["flags"]:
            if f["level"] == "fix":
                top.append({"client": r["name"], "client_id": r["client_id"], "kind": f["kind"], "text": f["text"]})
    return {"fix": data["counts"]["fix"], "watch": data["counts"]["watch"], "clients": data["counts"]["clients_fix"], "top": top[:5]}


def lines_for_assistant(db: Session, owner: User, today: _date) -> list[str]:
    """What does not match, with ids, for the assistant's picture of the business."""
    data = build(db, owner, today)
    out = []
    for r in data["clients"]:
        for f in r["flags"]:
            ref = []
            if f.get("invoice_id"):
                ref.append(f"invoice id {f['invoice_id']}")
            if f.get("booking_id"):
                ref.append(f"job {f['booking_id']}")
            out.append(f"- {r['name']}: {f['text']}" + (f" [{', '.join(ref)}]" if ref else ""))
    return out


@router.get("")
def standing(db: Session = Depends(get_db), user: User = Depends(require_owner)):
    if not (user.role == "admin" or user.workspace_plan_level >= 2):
        raise HTTPException(403, "Paid & booked is part of the Pro Caterer plan.")
    owner = db.get(User, ws_id(user))
    return build(db, owner)


@router.post("/settle")
def settle(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_owner)):
    """Say "nothing to match here": {invoice_ids: [...]} = no date needed, {booking_ids: [...]} = no invoice needed.
    {undo: true} brings them back."""
    if not (user.role == "admin" or user.workspace_plan_level >= 2):
        raise HTTPException(403, "Paid & booked is part of the Pro Caterer plan.")
    uid = ws_id(user)
    value = not payload.get("undo")
    n = 0
    for raw in (payload.get("invoice_ids") or [])[:200]:
        try:
            inv = db.get(Invoice, int(raw))
        except (TypeError, ValueError):
            inv = None
        if inv and inv.user_id == uid:
            inv.no_date = value
            n += 1
    for raw in (payload.get("booking_ids") or [])[:200]:
        try:
            bk = db.get(Booking, int(raw))
        except (TypeError, ValueError):
            bk = None
        if bk and bk.user_id == uid:
            bk.no_invoice = value
            n += 1
    db.commit()
    return {"ok": True, "changed": n}
