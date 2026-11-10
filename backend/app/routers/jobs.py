"""Jobs: the invoice-first calendar.

Every job starts from an invoice (or a website pre-order / date request). Saving an invoice with a client and a day keeps one
booking in step with it (routers/finance.py sync-booking); this module gives that booking a *plan*:

  * the day(s) itself: one day, or several when a package covers more than one (e.g. three days a week);
  * the work before it, from the chef's service setup: e.g. "Shop, any day from 7 days before to the day before".
    Each step starts with one unplanned session; the chef picks the day and types the time (and can add more runs).

How each service runs lives in users.job_setup (Calendar → Your services). Any chef can change it; unsaved services get a
starting template from a few generic categories (meal prep delivered, in-home cooking, events & catering, same-day orders).
Changing a service's setup affects new jobs; plans already made are left as they are.

The same plan feeds the chef's phone calendar (routers/calendar_feed.py) and the reminder pushes (run_reminders below).
"""
import logging
import re
import threading
import time
from datetime import date as _date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import config, notify
from ..auth import require_active
from ..database import SessionLocal, get_db
from ..models import Booking, Client, DiaryBlock, Invoice, PushSubscription, User
from ..utils import get_owned, ws_id

log = logging.getLogger("creatiste.jobs")
router = APIRouter(prefix="/jobs", tags=["jobs"])

JOB_STATUSES = ("quoted", "confirmed", "in_prep", "completed")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_BEFORE = 30


def _step(kind: str, name: str, on: bool, frm: int, to: int) -> dict:
    return {"kind": kind, "name": name, "on": on, "from": frm, "to": to}


# Starting templates. Generic words only: a chef's own service names are matched through their saved setup.
CATEGORIES = {
    "sameday": {"label": "Same-day orders", "day_label": "Deliver",
                "match": ["pre-order", "preorder", "lunch", "pop-up", "popup", "same day", "same-day"],
                "steps": [_step("shop", "Shop", True, 0, 0), _step("prep", "Prep", False, 1, 1)]},
    "delivered": {"label": "Meal prep, delivered", "day_label": "Cook & deliver",
                  "match": ["meal prep", "meal-prep", "batch", "delivered", "delivery", "drop-off", "drop off", "weekly meals"],
                  "steps": [_step("shop", "Shop", True, 2, 1), _step("prep", "Prep", True, 2, 1)]},
    "inhome": {"label": "In-home cooking", "day_label": "Cook at the client's home",
               "match": ["in-home", "in home", "at home", "house", "private chef", "personal chef"],
               "steps": [_step("shop", "Shop", True, 1, 0), _step("prep", "Prep", False, 1, 1)]},
    "event": {"label": "Events & catering", "day_label": "Event",
              "match": ["catering", "event", "wedding", "party", "corporate", "buffet", "canap", "celebration", "birthday",
                        "festival", "christening", "funeral", "private dining"],
              "steps": [_step("shop", "Shop", True, 7, 1), _step("prep", "Prep", True, 4, 1)]},
    "other": {"label": "Other", "day_label": "On the day", "match": [],
              "steps": [_step("shop", "Shop", True, 2, 1), _step("prep", "Prep", True, 1, 1)]},
}
CATEGORY_ORDER = ("sameday", "delivered", "inhome", "event")


# ───────────────────────────── the business owner's own setup ─────────────────────────────
# Pre-loaded once on the platform owner's account (The Creatiste Catering), and on nobody else's. Ellice can change any of it
# under Calendar → Your services; it is only applied while that account has no saved setup.
def _svc(name, category, steps, day_label=None, packages=(), requestable=False, usual=("", "")):
    return {"id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), "name": name, "category": category,
            "day_label": day_label or CATEGORIES[category]["day_label"], "usual_start": usual[0], "usual_end": usual[1],
            "requestable": requestable,
            "steps": [{"id": f"{s['kind']}-{i}", **s} for i, s in enumerate(steps)],
            "packages": [{"id": re.sub(r"[^a-z0-9]+", "-", p[0].lower()).strip("-"), "name": p[0], "days": p[1], "hours": p[2]} for p in packages]}


OWNER_PRESET_ID = "creatiste-catering-1"
OWNER_PRESET = {
    "services": [
        _svc("Batchfully Made", "delivered", [_step("shop", "Shop", True, 2, 1), _step("prep", "Prep", True, 2, 1)], requestable=True),
        _svc("Sorted & Served", "delivered", [_step("shop", "Shop", False, 2, 1), _step("prep", "Prep", True, 2, 1)], requestable=True),
        _svc("The Home Edit", "inhome", [_step("shop", "Shop", True, 1, 0), _step("prep", "Prep", False, 1, 1)],
             day_label="Cook at client's home", requestable=True,
             packages=[("The Full Table", 5, 6), ("The Daily Dinner", 5, 2.5), ("The Half Week", 3, 4), ("The Prep Day", 1, 8)]),
        _svc("Corporate Curations", "event", [_step("shop", "Shop", True, 7, 1), _step("prep", "Prep", True, 4, 1)]),
        _svc("Private & Personal", "event", [_step("shop", "Shop", True, 7, 1), _step("prep", "Prep", True, 4, 1)]),
        _svc("The Loaded Bar", "event", [_step("shop", "Shop", True, 7, 1), _step("prep", "Prep", True, 4, 1)]),
        _svc("The Creatiste Table", "event", [_step("shop", "Shop", True, 7, 1), _step("prep", "Prep", True, 4, 1)], day_label="Dinner"),
        _svc("Clean Dream", "sameday", [_step("shop", "Shop", True, 0, 0), _step("prep", "Prep", False, 1, 1)],
             day_label="Deliver", usual=("13:00", "16:00")),
    ],
    "remind_unplanned": True,
}


def apply_owner_preset(db: Session) -> bool:
    """Load The Creatiste Catering's service setup on the platform owner's account, once, if it has none yet."""
    owner = db.query(User).filter(User.email == config.ADMIN_EMAIL.lower(), User.role == "admin").first()
    if not owner or owner.job_setup:
        return False
    owner.job_setup = {**OWNER_PRESET, "preset": OWNER_PRESET_ID}
    db.commit()
    return True


# ───────────────────────────── setup: cleaning + defaults ─────────────────────────────
def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:40] or "x"


def _clean_time(v) -> str:
    v = str(v or "").strip()[:5]
    return v if TIME_RE.match(v) else ""


def _int(v, lo, hi, default):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return default


def category_for(text: str) -> str:
    t = (text or "").lower()
    for cid in CATEGORY_ORDER:
        if any(w in t for w in CATEGORIES[cid]["match"]):
            return cid
    return "other"


def default_service(name: str, category: str | None = None) -> dict:
    cid = category if category in CATEGORIES else category_for(name)
    cat = CATEGORIES[cid]
    return {"id": "new-" + _slug(name), "name": name, "category": cid, "day_label": cat["day_label"], "usual_start": "",
            "usual_end": "", "requestable": False, "steps": [{"id": f"{s['kind']}-{i}", **s} for i, s in enumerate(cat["steps"])],
            "packages": []}


def clean_service(raw: dict) -> dict | None:
    name = str((raw or {}).get("name") or "").strip()[:80]
    if not name:
        return None
    cat = raw.get("category") if raw.get("category") in CATEGORIES else category_for(name)
    steps = []
    for i, st in enumerate((raw.get("steps") or [])[:8]):
        kind = st.get("kind") if st.get("kind") in ("shop", "prep", "custom") else "custom"
        frm = _int(st.get("from"), 0, MAX_BEFORE, 1)
        steps.append({"id": str(st.get("id") or f"{kind}-{i}")[:40], "kind": kind,
                      "name": (str(st.get("name") or "").strip()[:40] or {"shop": "Shop", "prep": "Prep"}.get(kind, "Step")),
                      "on": bool(st.get("on", True)), "from": frm, "to": _int(st.get("to"), 0, frm, min(1, frm))})
    packages = []
    for p in (raw.get("packages") or [])[:12]:
        pname = str(p.get("name") or "").strip()[:60]
        if not pname:
            continue
        try:
            hours = round(max(0.25, min(16.0, float(p.get("hours") or 0))), 2)
        except (TypeError, ValueError):
            hours = 1.0
        packages.append({"id": str(p.get("id") or _slug(pname))[:40], "name": pname, "days": _int(p.get("days"), 1, 7, 1), "hours": hours})
    return {"id": str(raw.get("id") or _slug(name))[:40], "name": name, "category": cat,
            "day_label": str(raw.get("day_label") or CATEGORIES[cat]["day_label"]).strip()[:60],
            "usual_start": _clean_time(raw.get("usual_start")), "usual_end": _clean_time(raw.get("usual_end")),
            "requestable": bool(raw.get("requestable")), "steps": steps, "packages": packages}


def clean_setup(raw: dict) -> dict:
    services, seen = [], set()
    for r in ((raw or {}).get("services") or [])[:40]:
        s = clean_service(r)
        if s and s["name"].lower() not in seen:
            seen.add(s["name"].lower())
            services.append(s)
    return {"services": services, "remind_unplanned": bool((raw or {}).get("remind_unplanned", True))}


def _known_names(db: Session, owner: User) -> list[tuple[str, str | None]]:
    """Service names this business already uses, so a chef who never opened the setup still gets sensible steps."""
    out: list[tuple[str, str | None]] = [(str(s).strip(), None) for s in (owner.services or []) if str(s).strip()]
    out += [(r[0].strip(), None) for r in db.query(Invoice.service_type).filter(Invoice.user_id == owner.id, Invoice.service_type != "")
            .distinct().all() if r[0] and r[0].strip()]
    offer = owner.preorder_offer or {}
    if offer.get("title"):
        out.append((str(offer["title"]).strip(), "sameday"))
    return out


def setup_for(db: Session, owner: User) -> dict:
    saved = clean_setup(owner.job_setup or {})
    services = list(saved["services"])
    have = {s["name"].lower() for s in services}
    for name, cat in _known_names(db, owner):
        if name and name.lower() not in have:
            services.append(default_service(name, cat))
            have.add(name.lower())
    return {"services": services, "remind_unplanned": saved["remind_unplanned"], "saved": bool(owner.job_setup),
            "categories": [{"id": k, "label": v["label"], "day_label": v["day_label"], "steps": v["steps"]} for k, v in CATEGORIES.items()]}


def requestable_services(db: Session, owner: User) -> list[str]:
    """Services regular clients may ask dates for on the chef's website (Your services → "Clients can request dates")."""
    return [s["name"] for s in setup_for(db, owner)["services"] if s.get("requestable")]


def match_service(services: list[dict], *texts: str) -> dict | None:
    for t in texts:
        tl = (t or "").strip().lower()
        if tl:
            for s in services:
                if s["name"].lower() == tl:
                    return s
    joined = " ".join(t or "" for t in texts).lower()
    best = None
    for s in services:
        n = s["name"].lower()
        if n and n in joined and (best is None or len(n) > len(best["name"])):
            best = s
    return best


def service_of(setup: dict, bk: Booking, service: str | None = None) -> dict:
    plan = bk.job_plan or {}
    want = service if service is not None else (plan.get("service") or "")
    found = match_service(setup["services"], want, bk.event_type or "", bk.title or "")
    if found:
        return found
    return default_service(want or (bk.event_type or "").strip() or "Job",
                           category_for(" ".join([want, bk.event_type or "", bk.title or ""])))


def package_of(svc: dict, name: str) -> dict | None:
    n = (name or "").strip().lower()
    return next((p for p in svc.get("packages") or [] if p["name"].lower() == n), None) if n else None


# ───────────────────────────── plans ─────────────────────────────
def _valid_day(d) -> bool:
    try:
        _date.fromisoformat(str(d)[:10])
        return len(str(d)) == 10
    except ValueError:
        return False


def window(anchor: str, st: dict) -> tuple[str, str]:
    a = _date.fromisoformat(anchor)
    return (a - timedelta(days=int(st.get("from") or 0))).isoformat(), (a - timedelta(days=int(st.get("to") or 0))).isoformat()


def plan_days(bk: Booking) -> list[str]:
    days = [d for d in (bk.job_plan or {}).get("days") or [] if _valid_day(d)]
    return days or ([bk.date] if _valid_day(bk.date) else [])


def add_hours(start: str, hours: float) -> str:
    if not TIME_RE.match(start or "") or not hours:
        return ""
    h, m = (int(x) for x in start.split(":"))
    mins = min(h * 60 + m + int(round(float(hours) * 60)), 23 * 60 + 59)
    return f"{mins // 60:02d}:{mins % 60:02d}"


def ensure_plan(db: Session, owner: User, bk: Booking, setup: dict | None = None, *, service: str | None = None,
                package: str | None = None, days: list[str] | None = None) -> dict:
    """Give a booking its plan, or bring it in step with its day(s) and service. Returns {changed, cleared}.

    A planned shop / prep session that no longer fits its window (the day moved) goes back to unplanned."""
    if not _valid_day(bk.date):
        return {"changed": False, "cleared": 0}
    setup = setup or setup_for(db, owner)
    plan = dict(bk.job_plan or {})
    svc = service_of(setup, bk, service)
    if days:
        new_days = sorted({d for d in days if _valid_day(d)}) or [bk.date]
    else:
        new_days = [d for d in plan.get("days") or [] if _valid_day(d)] or [bk.date]
        if new_days[0] != bk.date:  # the booking was moved somewhere else: the other package days move with it
            delta = _date.fromisoformat(bk.date) - _date.fromisoformat(new_days[0])
            new_days = [(_date.fromisoformat(d) + delta).isoformat() for d in new_days]
    rebuild = not plan.get("built") or svc["name"].lower() != (plan.get("service") or "").lower()
    if rebuild:
        old = plan.get("steps") or []
        steps = []
        for s in svc["steps"]:
            if not s.get("on"):
                continue
            prev = next((o for o in old if o.get("kind") == s["kind"] and o.get("name") == s["name"]), None)
            sessions = [dict(x) for x in (prev or {}).get("sessions") or []] or [{"day": "", "time": ""}]
            steps.append({"kind": s["kind"], "name": s["name"], "from": s["from"], "to": s["to"], "sessions": sessions})
    else:
        steps = [{**st, "sessions": [dict(x) for x in st.get("sessions") or []] or [{"day": "", "time": ""}]} for st in plan.get("steps") or []]
    cleared = 0
    for st in steps:
        a, b = window(new_days[0], st)
        for s in st["sessions"]:
            if s.get("day") and not (a <= s["day"] <= b):
                s.update(day="", time="")
                s.pop("sent", None)
                cleared += 1
    new = {"service": svc["name"], "package": package if package is not None else plan.get("package", ""), "days": new_days,
           "steps": steps, "built": True, "sent": list(plan.get("sent") or [])}
    if new != plan:
        bk.job_plan = new
        return {"changed": True, "cleared": cleared}
    return {"changed": False, "cleared": cleared}


def apply_invoice(db: Session, owner: User, bk: Booking, inv: Invoice) -> None:
    """Called from invoice sync: the invoice's service, package, day(s) and start time decide the job's plan."""
    setup = setup_for(db, owner)
    svc = service_of(setup, bk, inv.service_type or None)
    pkg = package_of(svc, inv.service_package)
    days = [inv.service_date] if _valid_day(inv.service_date) else []
    if pkg and pkg["days"] > 1:
        extra = sorted({d for d in (inv.service_days or []) if _valid_day(d)})
        if extra:
            days = sorted(set(extra) | set(days))
    if days:
        bk.date = days[0]
    if TIME_RE.match(inv.service_time or ""):
        bk.start_time = inv.service_time
        if pkg:
            bk.end_time = add_hours(inv.service_time, pkg["hours"])
        elif bk.end_time and bk.end_time <= bk.start_time:
            bk.end_time = ""
    ensure_plan(db, owner, bk, setup, service=inv.service_type or None, package=inv.service_package or "", days=days or None)


# ───────────────────────────── reading jobs ─────────────────────────────
def _names(db: Session, uid: int) -> dict[int, str]:
    return {c.id: c.name for c in db.query(Client).filter(Client.user_id == uid).all()}


def who_of(bk: Booking, names: dict[int, str]) -> str:
    if bk.event_type == "Pre-order":
        return bk.title or "Pre-orders"
    return names.get(bk.client_id) or bk.title or "Job"


def sub_of(svc: dict, bk: Booking) -> str:
    plan = bk.job_plan or {}
    bits = [svc["name"]]
    if plan.get("package"):
        bits.append(plan["package"])
    if bk.event_type == "Pre-order" and bk.guest_count:
        bits.append(f"{bk.guest_count} order{'s' if bk.guest_count != 1 else ''}")
    return " · ".join(bits)


def _times(svc: dict, bk: Booking) -> tuple[str, str]:
    start = bk.start_time if TIME_RE.match(bk.start_time or "") else svc.get("usual_start", "")
    end = bk.end_time if TIME_RE.match(bk.end_time or "") else (svc.get("usual_end", "") if not bk.start_time else "")
    return start, end


def _live_holds(db: Session, uid: int, lo: str, hi: str) -> list[Booking]:
    now_iso = datetime.utcnow().replace(microsecond=0).isoformat()
    return (db.query(Booking).filter(Booking.user_id == uid, Booking.date_hold == True, Booking.status == "enquiry",  # noqa: E712
                                     Booking.deposit_paid == False, Booking.date >= lo, Booking.date <= hi,  # noqa: E712
                                     or_(Booking.hold_stage == "requested", Booking.hold_expires_at > now_iso)).all())


def _jobs_between(db: Session, uid: int, lo: str, hi: str) -> list[Booking]:
    return (db.query(Booking).filter(Booking.user_id == uid, Booking.status.in_(JOB_STATUSES), Booking.date >= lo, Booking.date <= hi)
            .order_by(Booking.date.asc()).all())


def invoice_for(db: Session, uid: int, bk: Booking) -> Invoice | None:
    return (db.query(Invoice).filter(Invoice.user_id == uid, Invoice.booking_id == bk.id, Invoice.status != "void")
            .order_by(Invoice.id.desc()).first())


def job_detail(db: Session, owner: User, bk: Booking, setup: dict | None = None) -> dict:
    from .diary import rules_for
    from .finance import invoice_total  # local: finance imports this module

    setup = setup or setup_for(db, owner)
    ensure_plan(db, owner, bk, setup)
    plan = bk.job_plan or {}
    svc = service_of(setup, bk)
    days = plan_days(bk)
    names = _names(db, owner.id)
    client = db.get(Client, bk.client_id) if bk.client_id else None
    inv = invoice_for(db, owner.id, bk)
    start, end = _times(svc, bk)
    steps = []
    for st in plan.get("steps") or []:
        a, b = window(days[0], st)
        steps.append({"kind": st["kind"], "name": st["name"], "from": st["from"], "to": st["to"], "window": [a, b],
                      "sessions": [{"day": s.get("day", ""), "time": s.get("time", "")} for s in st.get("sessions") or []]})
    pkg = package_of(svc, plan.get("package", ""))
    return {
        "id": bk.id, "title": bk.title, "who": who_of(bk, names), "status": bk.status, "date": bk.date, "days": days,
        "start_time": start, "end_time": end, "service": svc["name"], "category": svc["category"], "day_label": svc["day_label"],
        "package": plan.get("package", ""), "package_days": pkg["days"] if pkg else 1, "sub": sub_of(svc, bk), "steps": steps,
        "preorder": bk.event_type == "Pre-order", "event_type": bk.event_type, "guest_count": bk.guest_count,
        "deposit_paid": bool(bk.deposit_paid), "date_hold": bool(bk.date_hold), "deposit_amount": bk.deposit_amount or 0,
        "client": {"id": client.id, "name": client.name, "phone": client.phone, "email": client.email} if client else None,
        "invoice": {"id": inv.id, "number": inv.number, "status": inv.status, "total": invoice_total(inv)} if inv else None,
        "work_days": rules_for(owner)["work_days"],
    }


def _parse_day(s: str, fallback: _date) -> _date:
    try:
        return _date.fromisoformat((s or "")[:10])
    except ValueError:
        return fallback


@router.get("/calendar")
def calendar(from_date: str = "", to_date: str = "", db: Session = Depends(get_db), user: User = Depends(require_active)):
    from .diary import _block_on, _is_work, rules_for

    uid = ws_id(user)
    owner = db.get(User, uid)
    today = _date.today()
    start = _parse_day(from_date, today - timedelta(days=today.weekday()))
    end = _parse_day(to_date, start + timedelta(days=6))
    if end < start or (end - start).days > 62:
        end = start + timedelta(days=6)
    setup = setup_for(db, owner)
    rules = rules_for(owner)
    names = _names(db, uid)
    jobs = _jobs_between(db, uid, (start - timedelta(days=7)).isoformat(), (end + timedelta(days=MAX_BEFORE + 1)).isoformat())
    upcoming = _jobs_between(db, uid, today.isoformat(), (today + timedelta(days=120)).isoformat())
    seen = {}
    for bk in jobs + upcoming:
        if bk.id not in seen:
            seen[bk.id] = bk
            ensure_plan(db, owner, bk, setup)
    db.commit()
    svc_of = {bid: service_of(setup, bk) for bid, bk in seen.items()}
    holds = _live_holds(db, uid, start.isoformat(), end.isoformat())
    blocks = db.query(DiaryBlock).filter(DiaryBlock.user_id == uid).all()

    days_out = []
    for i in range((end - start).days + 1):
        day = start + timedelta(days=i)
        iso = day.isoformat()
        entries = []
        for bk in jobs:
            svc = svc_of[bk.id]
            who = who_of(bk, names)
            if iso in plan_days(bk):
                s, e = _times(svc, bk)
                entries.append({"kind": "day", "time": s, "end": e, "label": svc["day_label"], "who": who, "sub": sub_of(svc, bk),
                                "job_id": bk.id, "status": bk.status})
            for si, st in enumerate((bk.job_plan or {}).get("steps") or []):
                for ii, se in enumerate(st.get("sessions") or []):
                    if se.get("day") == iso:
                        entries.append({"kind": st["kind"], "time": se.get("time", ""), "end": "", "label": st["name"], "who": who,
                                        "sub": svc["name"], "job_id": bk.id, "si": si, "ii": ii})
        for b in blocks:
            if _block_on(b, day):
                entries.append({"kind": "calendar" if b.source == "calendar" else "block", "time": b.start_time or "",
                                "end": b.end_time or "", "label": b.title or ("Day off" if b.kind == "off" else "Busy"),
                                "who": b.title or ("Day off" if b.kind == "off" else "Busy"),
                                "sub": "From your calendar" if b.source == "calendar" else ("Day off" if b.kind == "off" else "Blocked out"),
                                "block_id": b.id})
        for h in holds:
            if h.date == iso:
                entries.append({"kind": "held", "time": "", "end": "", "label": "Held", "who": names.get(h.client_id) or h.title,
                                "sub": "Waiting for their deposit" if h.hold_stage == "awaiting_deposit" else "Date request, waiting for you",
                                "hold_id": h.id})
        order = {"held": 0}
        entries.sort(key=lambda e: (order.get(e["kind"], 1), e["time"] or "99:99"))
        days_out.append({"date": iso, "workday": _is_work(rules, day), "entries": entries})

    to_plan = []
    for bk in upcoming:
        days = plan_days(bk)
        if not days:
            continue
        svc = svc_of[bk.id]
        for si, st in enumerate((bk.job_plan or {}).get("steps") or []):
            a, b = window(days[0], st)
            for ii, se in enumerate(st.get("sessions") or []):
                if not se.get("day"):
                    to_plan.append({"job_id": bk.id, "si": si, "ii": ii, "kind": st["kind"], "name": st["name"], "who": who_of(bk, names),
                                    "service": svc["name"], "job_date": days[0], "window": [a, b]})
    to_plan.sort(key=lambda t: (t["window"][1], t["job_date"]))
    requested = db.query(Booking.id).filter(Booking.user_id == uid, Booking.date_hold == True, Booking.status == "enquiry",  # noqa: E712
                                            Booking.hold_stage == "requested", Booking.deposit_paid == False).count()  # noqa: E712
    return {"from": start.isoformat(), "to": end.isoformat(), "today": today.isoformat(), "days": days_out, "to_plan": to_plan,
            "requests": requested}


@router.get("/setup")
def get_setup(db: Session = Depends(get_db), user: User = Depends(require_active)):
    return setup_for(db, db.get(User, ws_id(user)))


@router.put("/setup")
def save_setup(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner = db.get(User, ws_id(user))
    if user.role == "staff":
        raise HTTPException(403, "Only the business owner can change how services run")
    cleaned = clean_setup(payload)
    keep = {k: v for k, v in (owner.job_setup or {}).items() if k == "preset"}
    owner.job_setup = {**keep, **cleaned}
    db.commit()
    return setup_for(db, owner)


def _job(db: Session, user: User, job_id: int) -> tuple[User, Booking]:
    uid = ws_id(user)
    bk = get_owned(db, Booking, job_id, uid)
    return db.get(User, uid), bk


@router.get("/phone-status")
def phone_status(db: Session = Depends(get_db), user: User = Depends(require_active)):
    """Both directions of the phone link: when a calendar app last collected Command's feed, and the calendars read back in."""
    from .. import calsync

    owner = db.get(User, ws_id(user))
    feed = (owner.diary_rules or {}).get("feed") or {}
    return {"feed": {"last": feed.get("last", ""), "device": feed.get("device", ""), "devices": feed.get("devices") or []},
            "other": calsync.public_cfg(owner)}


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner, bk = _job(db, user, job_id)
    out = job_detail(db, owner, bk)
    db.commit()
    return out


def _steps_copy(bk: Booking) -> dict:
    plan = dict(bk.job_plan or {})
    plan["steps"] = [{**st, "sessions": [dict(s) for s in st.get("sessions") or []]} for st in plan.get("steps") or []]
    return plan


@router.patch("/{job_id}/session")
def plan_session(job_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_active)):
    """Put a shop / prep session on a day (and optionally a time): {si, ii, day, time}. A blank day unplans it."""
    owner, bk = _job(db, user, job_id)
    ensure_plan(db, owner, bk)
    plan = _steps_copy(bk)
    si, ii = _int(payload.get("si"), 0, 99, -1), _int(payload.get("ii"), 0, 99, -1)
    try:
        st = plan["steps"][si]
        sess = st["sessions"][ii]
    except (IndexError, KeyError):
        raise HTTPException(404, "That step isn't on this job any more. Refresh and try again.")
    day = str(payload.get("day") or "").strip()[:10]
    t = str(payload.get("time") or "").strip()[:5]
    if t and not TIME_RE.match(t):
        raise HTTPException(422, "Use a time like 09:30")
    if day:
        if not _valid_day(day):
            raise HTTPException(422, "Pick a day")
        a, b = window(plan_days(bk)[0], st)
        if not (a <= day <= b):
            raise HTTPException(422, f"Pick a day between {a} and {b}")
    sess.update(day=day, time=t if day else "")
    sess.pop("sent", None)
    bk.job_plan = plan
    db.commit()
    return job_detail(db, owner, bk)


@router.post("/{job_id}/session")
def add_session(job_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_active)):
    """Another shop run / prep session for a step: {si}. Returns the job; the new session is last in that step."""
    owner, bk = _job(db, user, job_id)
    ensure_plan(db, owner, bk)
    plan = _steps_copy(bk)
    si = _int(payload.get("si"), 0, 99, -1)
    if not (0 <= si < len(plan["steps"])):
        raise HTTPException(404, "That step isn't on this job any more")
    if len(plan["steps"][si]["sessions"]) >= 10:
        raise HTTPException(422, "That's plenty for one step")
    plan["steps"][si]["sessions"].append({"day": "", "time": ""})
    bk.job_plan = plan
    db.commit()
    return job_detail(db, owner, bk)


@router.delete("/{job_id}/session")
def remove_session(job_id: int, si: int, ii: int, db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner, bk = _job(db, user, job_id)
    plan = _steps_copy(bk)
    try:
        sessions = plan["steps"][si]["sessions"]
        sessions[ii]
    except (IndexError, KeyError):
        raise HTTPException(404, "That session isn't on this job any more")
    if len(sessions) <= 1:
        sessions[0] = {"day": "", "time": ""}
    else:
        sessions.pop(ii)
    bk.job_plan = plan
    db.commit()
    return job_detail(db, owner, bk)


@router.patch("/{job_id}")
def update_job(job_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_active)):
    """Move the day ({date}, single-day jobs) and/or set the time on the day ({start}). The invoice follows."""
    owner, bk = _job(db, user, job_id)
    setup = setup_for(db, owner)
    ensure_plan(db, owner, bk, setup)
    invoices = db.query(Invoice).filter(Invoice.user_id == owner.id, Invoice.booking_id == bk.id).all()
    cleared = 0
    if "date" in payload:
        day = str(payload.get("date") or "")[:10]
        if not _valid_day(day):
            raise HTTPException(422, "Pick a day")
        if len(plan_days(bk)) > 1:
            raise HTTPException(422, "This job covers several days. Change them on its invoice.")
        if bk.event_type == "Pre-order":
            raise HTTPException(422, "Pre-order days follow the orders themselves.")
        bk.date = day
        cleared = ensure_plan(db, owner, bk, setup, days=[day])["cleared"]
        for inv in invoices:
            if inv.service_date:
                inv.service_date = day
                inv.service_days = []
    if "start" in payload:
        t = str(payload.get("start") or "").strip()[:5]
        if t and not TIME_RE.match(t):
            raise HTTPException(422, "Use a time like 16:30")
        svc = service_of(setup, bk)
        pkg = package_of(svc, (bk.job_plan or {}).get("package", ""))
        bk.start_time = t
        bk.end_time = add_hours(t, pkg["hours"]) if (t and pkg) else ("" if not t or (bk.end_time and bk.end_time <= t) else bk.end_time)
        plan = dict(bk.job_plan or {})
        plan["sent"] = []
        bk.job_plan = plan
        for inv in invoices:
            if inv.service_date:
                inv.service_time = t
    db.commit()
    return {**job_detail(db, owner, bk), "cleared": cleared}


# ───────────────────────────── phone calendar (ICS) ─────────────────────────────
def feed_events(db: Session, owner: User) -> tuple[list[dict], set[int]]:
    """Calendar-feed entries for planned jobs: each day of the job, each planned shop / prep session, and (if the chef wants)
    an all-day reminder on the last possible day of anything still unplanned. Returns (events, booking ids covered)."""
    setup = setup_for(db, owner)
    names = _names(db, owner.id)
    today = _date.today()
    rows = _jobs_between(db, owner.id, (today - timedelta(days=90)).isoformat(), (today + timedelta(days=400)).isoformat())
    out, covered = [], set()
    for bk in rows:
        ensure_plan(db, owner, bk, setup)
        days = plan_days(bk)
        if not days:
            continue
        covered.add(bk.id)
        svc = service_of(setup, bk)
        who = who_of(bk, names)
        start, end = _times(svc, bk)
        status = "CONFIRMED" if bk.status in ("confirmed", "in_prep", "completed") else "TENTATIVE"
        for n, d in enumerate(days):
            out.append({"uid": f"booking-{bk.id}" + ("" if n == 0 else f"-{d}"), "summary": f"{svc['day_label']} · {who}", "date": d,
                        "start": start, "end": end, "desc": sub_of(svc, bk), "status": status, "location": bk.venue_name or bk.venue_address or "",
                        "stamp": bk.updated_at})
        for si, st in enumerate((bk.job_plan or {}).get("steps") or []):
            a, b = window(days[0], st)
            for ii, se in enumerate(st.get("sessions") or []):
                if se.get("day"):
                    t = se.get("time", "")
                    out.append({"uid": f"step-{bk.id}-{si}-{ii}", "summary": f"{st['name']} · {who}", "date": se["day"], "start": t,
                                "end": add_hours(t, 1) if t else "", "desc": f"For {svc['name']} on {days[0]}", "status": status,
                                "location": "", "stamp": bk.updated_at})
                elif setup["remind_unplanned"] and days[0] >= today.isoformat():
                    out.append({"uid": f"plan-{bk.id}-{si}-{ii}", "summary": f"To plan: {st['name'].lower()} for {who}", "date": b,
                                "start": "", "end": "", "desc": f"Last day to {st['name'].lower()} for {svc['name']} on {days[0]}. Plan it in Command.",
                                "status": "TENTATIVE", "location": "", "stamp": bk.updated_at})
    db.commit()
    return out, covered


# ───────────────────────────── reminders (pop-up notifications) ─────────────────────────────
def _pretty_time(t: str) -> str:
    h, m = (int(x) for x in t.split(":"))
    suffix = "pm" if h >= 12 else "am"
    h12 = h % 12 or 12
    return f"{h12}:{m:02d}{suffix}" if m else f"{h12}{suffix}"


def _pretty_day(iso: str) -> str:
    d = _date.fromisoformat(iso)
    return f"{d.strftime('%A')} {d.day} {d.strftime('%B')}"


def run_reminders(db: Session, now: datetime | None = None) -> int:
    """Pop-up reminders, sent once each: before a timed shop / prep session or job (by the chef's lead time), at 8am for
    untimed ones on their day, and at 6pm the evening before the last day an unplanned step can happen."""
    from .. import push

    if not push.push_enabled():
        return 0
    tz = ZoneInfo(config.ONBOARDING_TZ)
    now = now or datetime.now(tz)
    owner_ids = {r[0] for r in db.query(PushSubscription.user_id).distinct().all()}
    if not owner_ids:
        return 0
    today = now.date()
    t_iso, tomorrow = today.isoformat(), (today + timedelta(days=1)).isoformat()
    rows = (db.query(Booking).filter(Booking.user_id.in_(owner_ids), Booking.status.in_(("quoted", "confirmed", "in_prep")),
                                     Booking.date >= (today - timedelta(days=7)).isoformat(),
                                     Booking.date <= (today + timedelta(days=MAX_BEFORE + 1)).isoformat()).all())
    owners: dict[int, User] = {}
    setups: dict[int, dict] = {}
    names: dict[int, dict] = {}
    sent = 0

    def due(day_iso: str, t: str, lead: int) -> bool:
        if day_iso != t_iso:
            return False
        if t:
            h, m = (int(x) for x in t.split(":"))
            at = datetime(today.year, today.month, today.day, h, m, tzinfo=tz)
            return at - timedelta(minutes=lead) <= now <= at + timedelta(hours=2)
        return 8 <= now.hour < 21

    for bk in rows:
        owner = owners.get(bk.user_id) or owners.setdefault(bk.user_id, db.get(User, bk.user_id))
        if not owner:
            continue
        p = notify.prefs(owner)
        if not p["reminders"]:
            continue
        lead = p["lead_minutes"]
        setup = setups.get(owner.id) or setups.setdefault(owner.id, setup_for(db, owner))
        nm = names.get(owner.id) or names.setdefault(owner.id, _names(db, owner.id))
        ensure_plan(db, owner, bk, setup)
        plan = _steps_copy(bk)
        days = plan_days(bk)
        if not days:
            continue
        svc = service_of(setup, bk)
        who = who_of(bk, nm)
        url = f"/app/calendar?job={bk.id}"
        changed = False
        for si, st in enumerate(plan.get("steps") or []):
            a, b = window(days[0], st)
            for ii, se in enumerate(st.get("sessions") or []):
                day, t = se.get("day", ""), se.get("time", "")
                if day:
                    key = f"{day} {t or 'any'}"
                    if se.get("sent") != key and due(day, t, lead):
                        if t:
                            title, body = f"{st['name']} at {_pretty_time(t)}", f"For {who} · {svc['name']} on {_pretty_day(days[0])}"
                        else:
                            title, body = f"Today: {st['name'].lower()} for {who}", f"Any time today · {svc['name']} on {_pretty_day(days[0])}"
                        sent += notify.notify(db, owner, "reminders", title, body, url=url, tag=f"step-{bk.id}-{si}-{ii}") > 0
                        se["sent"] = key
                        changed = True
                elif b == tomorrow and bk.date >= t_iso:
                    key = f"unplanned {b}"
                    if se.get("sent") != key and now.hour >= 18:
                        sent += notify.notify(db, owner, "reminders", f"Still to plan: {st['name'].lower()} for {who}",
                                              f"Tomorrow is the last day for it ({svc['name']} on {_pretty_day(days[0])}). Tap to pick a time.",
                                              url=url, tag=f"plan-{bk.id}-{si}-{ii}") > 0
                        se["sent"] = key
                        changed = True
        start, _end = _times(svc, bk)
        done = list(plan.get("sent") or [])
        for d in days:
            key = f"day {d} {start or 'any'}"
            if key not in done and due(d, start, lead):
                title = f"{svc['day_label']} at {_pretty_time(start)}" if start else f"Today: {svc['day_label'].lower()}"
                sent += notify.notify(db, owner, "reminders", title, f"{who} · {sub_of(svc, bk)}", url=url, tag=f"day-{bk.id}-{d}") > 0
                done.append(key)
                changed = True
        if changed:
            plan["sent"] = done[-20:]
            bk.job_plan = plan
    db.commit()
    return sent


_started = False


def start_reminder_loop():
    """Checks every minute for reminders that are due (the main scheduler only wakes every few hours)."""
    global _started
    if _started or not config.ENABLE_SCHEDULER:
        return
    _started = True

    def loop():
        time.sleep(30)
        while True:
            db = SessionLocal()
            try:
                run_reminders(db)
            except Exception as exc:
                log.warning("reminder sweep failed: %s", exc)
            finally:
                db.close()
            time.sleep(60)

    threading.Thread(target=loop, daemon=True, name="cc-reminders").start()
