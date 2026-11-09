"""Diary — the chef's time, in one place, and a public "which days are free" calendar for their website.

A day is measured in shares of a day, not in counts: every booking takes a share of its day (a full day, half a
day, or a light slice) and, for shopping and prep, a share of the one or two working days before it. A day is full
at one whole day, on a day off, or on a day the chef doesn't work (Sundays by default). A half day and another half day
fill it; a full-day booking is the day's only booking. Held date requests and pencilled-in bookings count straight away.
Rules (users.diary_rules):
  work_days     the weekdays the chef works, Monday = 0 (default Monday to Saturday)
  week_max      the most days of work wanted in a week (the weekly meter turns red at it; it never blocks)
  default_load  the share of a day for a booking that matches no kind (default half)
  public        whether the website may show availability at all (default on)
  horizon_days  how far ahead the public calendar reaches (default 90)
  kinds         {id, label, match[], load, before1, before2}: matched on the booking's event type / title by keywords.
                `load` is the share of the day itself, before1 / before2 the share of the day before / two days before.
                A booking can override its own share (bookings.day_load).
Public state is only ever open | limited | full (no titles, no client names).

Chef:
  GET    /api/diary?from=&to=          every day in the range: state + bookings + blocks (titles included)
  GET    /api/diary/rules · PUT        the rules above
  GET/POST/PATCH/DELETE /api/diary/blocks[/{id}]   the chef's own blocks (crud, recycle-bin aware)
Public:
  GET    /api/public/availability/{token}?from=&to=   [{date, state}] for the chef's site
"""
from datetime import date as _date, datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from .. import calsync
from ..auth import require_active
from ..database import get_db
from ..models import Booking, DiaryBlock, User
from ..utils import crud_router, to_dict, ws_id

blocks = crud_router(DiaryBlock, required=("date",), search_fields=("title", "notes"),
                     default_order=lambda m: [m.date.asc(), m.start_time.asc()])
router = APIRouter()  # rules + the computed days (kept off the crud router so /{item_id} can't swallow them)
public_router = APIRouter(prefix="/public", tags=["public"])

ACTIVE = ("quoted", "confirmed", "in_prep")
KINDS = ("busy", "prep", "off", "standing")
# How much of a day each kind of work takes: on the day itself, and the shop / prep slices on the days before it.
# A day is full at 1. A half day and another half day fill it; a full day (an in-home cook, an event) is the only booking.
DEFAULT_KINDS = [
    {"id": "cleandream", "label": "Clean Dream", "match": ["clean dream", "pre-order"], "load": 0.5, "before1": 0, "before2": 0},
    {"id": "batch", "label": "Batch cooking & meal prep", "match": ["batchfully", "sorted & served", "sorted and served", "meal prep", "batch"],
     "load": 0.5, "before1": 0.25, "before2": 0},
    {"id": "inhome", "label": "In-home cooking", "match": ["home edit", "in-home", "in home", "house share"], "load": 1, "before1": 0.25, "before2": 0},
    {"id": "events", "label": "Private catering & events", "match": ["private catering", "loaded bar", "corporate", "creatiste table", "wedding", "party"],
     "load": 1, "before1": 0.5, "before2": 0.25},
]
DEFAULT_RULES = {"work_days": [0, 1, 2, 3, 4, 5], "week_max": 5, "default_load": 0.5, "public": True, "horizon_days": 90, "kinds": DEFAULT_KINDS}
PHRASE = {1.0: "a full day", 0.75: "three quarters of a day", 0.5: "half a day", 0.25: "a light slice"}


def _q(x, lo=0.0, hi=1.0, default=0.0) -> float:
    """A share of a day, rounded to the nearest quarter."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, round(v * 4) / 4))


def _phrase(v: float) -> str:
    return PHRASE.get(round(v * 4) / 4, f"{v:g} of a day")


def _clean_kinds(raw) -> list[dict]:
    out = []
    for i, k in enumerate(raw if isinstance(raw, list) else []):
        if not isinstance(k, dict):
            continue
        label = str(k.get("label") or "").strip()[:60]
        if not label:
            continue
        match = k.get("match")
        if isinstance(match, str):
            match = match.split(",")
        match = [str(m).strip().lower()[:60] for m in (match or []) if str(m).strip()][:20]
        if "load" in k:
            load, b1, b2 = _q(k.get("load"), 0.25, 1, 0.5), _q(k.get("before1")), _q(k.get("before2"))
        else:  # a kind saved under the old per-day rules: whole-day kinds become a full day with prep slices, the rest half a day
            old_prep = int(k.get("prep_days") or 0) if str(k.get("prep_days") or "0").lstrip("-").isdigit() else 0
            load = 1.0 if k.get("blocks_day") else 0.5
            b1, b2 = (0.5 if old_prep >= 1 else 0.0), (0.25 if old_prep >= 2 else 0.0)
        kid = str(k.get("id") or "").strip()[:40] or f"kind{i + 1}"
        out.append({"id": kid, "label": label, "match": match, "load": load, "before1": b1, "before2": b2})
    return out[:12]


def kind_of(kinds: list[dict], bk: Booking) -> dict | None:
    """The first kind whose keywords appear in the booking's event type or title."""
    hay = f"{bk.event_type or ''} {bk.title or ''}".lower()
    for k in kinds:
        if any(m and m in hay for m in k["match"]):
            return k
    return None


def load_of(rules: dict, bk: Booking) -> float:
    """What share of the day this booking takes: the chef's own setting on the booking, else its kind's default."""
    own = float(getattr(bk, "day_load", 0) or 0)
    if own > 0:
        return min(own, 1.0)
    k = kind_of(rules["kinds"], bk)
    return k["load"] if k else rules["default_load"]


def rules_for(owner: User) -> dict:
    stored = owner.diary_rules or {}
    r = {**DEFAULT_RULES, **stored}
    wd = stored.get("work_days", DEFAULT_RULES["work_days"])
    r["work_days"] = sorted({int(x) for x in wd if str(x).isdigit() and 0 <= int(x) <= 6}) or [0, 1, 2, 3, 4, 5]
    try:
        r["week_max"] = max(1.0, min(7.0, round(float(r.get("week_max") or 5) * 2) / 2))
    except (TypeError, ValueError):
        r["week_max"] = 5.0
    r["default_load"] = _q(r.get("default_load"), 0.25, 1, 0.5)
    r["horizon_days"] = max(14, min(int(r.get("horizon_days") or 90), 365))
    r["public"] = bool(r.get("public", True))
    r["kinds"] = _clean_kinds(r.get("kinds")) if "kinds" in stored else [dict(k) for k in DEFAULT_KINDS]
    for gone in ("calendar", "max_per_day", "prep_days"):
        r.pop(gone, None)  # the calendar link is a secret (own endpoint); the old per-day counts no longer exist
    return r


def _parse(s: str, fallback: _date) -> _date:
    try:
        return _date.fromisoformat((s or "")[:10])
    except ValueError:
        return fallback


def _block_on(b: DiaryBlock, day: _date) -> bool:
    """Does this block apply on `day`?"""
    iso = day.isoformat()
    if b.repeat == "weekly":
        if b.date and iso < b.date:
            return False
        if b.until and iso > b.until:
            return False
        return day.weekday() in [int(x) for x in (b.weekdays or []) if str(x).isdigit() or isinstance(x, int)]
    if b.end_date and b.end_date >= (b.date or ""):
        return (b.date or "") <= iso <= b.end_date
    return b.date == iso


def _is_work(rules: dict, day: _date) -> bool:
    return day.weekday() in rules["work_days"]


def _shift_back(rules: dict, day: _date) -> _date:
    """Shopping and prep never land on a day off: they move to the working day before."""
    for _ in range(7):
        if _is_work(rules, day):
            return day
        day -= timedelta(days=1)
    return day


def compute_days(db: Session, owner_id: int, rules: dict, start: _date, end: _date, detail: bool) -> list[dict]:
    """One entry per day in [start, end]. `detail` adds the bookings, blocks and the day's load (chef view only).

    Every booking takes a share of its day (see DEFAULT_KINDS) and, for the work that comes before it, a share of the
    one or two working days before. A day is full at one whole day, on a day off, or on a non-working day."""
    span = (end - start).days + 1
    if span <= 0:
        return []
    q_from, q_to = start.isoformat(), (end + timedelta(days=8)).isoformat()  # later bookings can put shopping / prep inside the window
    # A date request that is still held (waiting for the chef, or for its deposit) counts like a booking.
    now_iso = datetime.utcnow().replace(microsecond=0).isoformat()
    live_hold = and_(Booking.date_hold == True, Booking.status == "enquiry", Booking.deposit_paid == False,  # noqa: E712
                     or_(Booking.hold_stage == "requested", Booking.hold_expires_at > now_iso))
    bookings = (db.query(Booking).filter(Booking.user_id == owner_id, or_(Booking.status.in_(ACTIVE), live_hold),
                                          Booking.date >= q_from, Booking.date <= q_to).all())
    blocks = db.query(DiaryBlock).filter(DiaryBlock.user_id == owner_id).all()
    blocks = [b for b in blocks if b.repeat == "weekly" or (b.end_date or b.date or "") >= q_from and (b.date or "") <= q_to]
    kinds = rules["kinds"]
    by_day: dict[str, list[Booking]] = {}
    load: dict[str, float] = {}
    slices: dict[str, list[tuple[str, float]]] = {}   # day -> [(title of the booking it is for, share)]
    for bk in bookings:
        try:
            d0 = _date.fromisoformat(bk.date)
        except ValueError:
            continue
        by_day.setdefault(bk.date, []).append(bk)
        load[bk.date] = load.get(bk.date, 0.0) + load_of(rules, bk)
        k = kind_of(kinds, bk)
        for n, share in ((1, k["before1"]), (2, k["before2"])) if k else ():
            if share > 0:
                dd = _shift_back(rules, d0 - timedelta(days=n)).isoformat()
                load[dd] = load.get(dd, 0.0) + share
                slices.setdefault(dd, []).append((bk.title or "a booking", share))

    out = []
    by_id = {k["id"]: k for k in kinds}
    for i in range(span):
        day = start + timedelta(days=i)
        iso = day.isoformat()
        todays = by_day.get(iso, [])
        blk = [b for b in blocks if _block_on(b, day)]
        ld = round(load.get(iso, 0.0), 2)
        workday = _is_work(rules, day)
        why: list[str] = []
        if any(b.kind == "off" and not b.start_time for b in blk):
            state, why = "full", ["Day off"]
        elif not workday:
            state, why = "full", ["Not a working day"]
        elif ld >= 0.999:
            state, why = "full", ["The day is full"]
        else:
            state = "open"
        counts: dict[str, int] = {}
        for bk in todays:
            k = kind_of(kinds, bk)
            counts[k["id"] if k else "_other"] = counts.get(k["id"] if k else "_other", 0) + 1
            why.append(f"{(k or {}).get('label', 'Booking')}: {_phrase(load_of(rules, bk))}")
        for title, share in slices.get(iso, []):
            why.append(f"Shopping / prep for {title}: {_phrase(share)}")
        if any(b.kind in ("busy", "standing", "off") for b in blk) and state == "open":
            why.append("Part of the day committed")
        if any(b.kind == "prep" for b in blk) and state == "open":
            why.append("Prep day")
        if state == "open" and (ld > 0 or why):
            state = "limited"
        row = {"date": iso, "state": state}
        if detail:
            row["why"] = why
            row["load"] = ld
            row["free"] = round(max(0.0, 1.0 - ld), 2) if workday else 0.0
            row["workday"] = workday
            row["bookings"] = [{"id": bk.id, "title": bk.title, "status": bk.status, "start_time": bk.start_time,
                                "end_time": bk.end_time, "guest_count": bk.guest_count, "event_type": bk.event_type,
                                "venue_name": bk.venue_name, "kind": (kind_of(kinds, bk) or {}).get("label", ""),
                                "load": load_of(rules, bk), "held": bool(bk.date_hold and not bk.deposit_paid)}
                               for bk in sorted(todays, key=lambda b: b.start_time or "")]
            row["counts"] = counts
            row["blocks"] = [to_dict(b) for b in blk]
            row["prep_for"] = [t for t, _ in slices.get(iso, [])]
        out.append(row)
    return out


@router.get("/rules")
def get_rules(db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner = db.get(User, ws_id(user))
    return rules_for(owner)


@router.put("/rules")
def save_rules(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner = db.get(User, ws_id(user))
    cur = dict(owner.diary_rules or {})
    if "horizon_days" in payload:
        try:
            cur["horizon_days"] = int(payload["horizon_days"])
        except (TypeError, ValueError):
            raise HTTPException(422, "How far ahead must be a whole number of days")
    if "work_days" in payload:
        days = sorted({int(x) for x in (payload["work_days"] or []) if str(x).isdigit() and 0 <= int(x) <= 6})
        if not days:
            raise HTTPException(422, "Choose at least one day you work")
        cur["work_days"] = days
    if "week_max" in payload:
        try:
            cur["week_max"] = float(payload["week_max"])
        except (TypeError, ValueError):
            raise HTTPException(422, "Days of work in a week must be a number")
    if "default_load" in payload:
        cur["default_load"] = _q(payload["default_load"], 0.25, 1, 0.5)
    if "public" in payload:
        cur["public"] = bool(payload["public"])
    if "kinds" in payload:
        cur["kinds"] = _clean_kinds(payload["kinds"])
    owner.diary_rules = dict(cur)  # fresh object so SQLAlchemy persists the JSON
    db.commit()
    return rules_for(owner)


@router.get("/check")
def check_slot(date: str, service: str = "", load: float = 0, db: Session = Depends(get_db), user: User = Depends(require_active)):
    """Would this fit? Used by the quick "pencil in" box: tells the chef straight away if the day can take it."""
    owner = db.get(User, ws_id(user))
    rules = rules_for(owner)
    day = _parse(date, _date.today())
    probe = Booking(event_type=service, title="", day_load=load)
    add = load_of(rules, probe)
    row = compute_days(db, owner.id, rules, day, day, detail=True)[0]
    fits = row["state"] != "full" and row["load"] + add <= 1.0001
    if fits:
        msg = f"Fits. {_phrase(row['free'])} is free that day." if row["load"] else "Fits. The day is clear."
    elif not row["workday"]:
        msg = "That is not one of your working days."
    elif "Day off" in row["why"]:
        msg = "You have that day off."
    else:
        msg = f"That would overfill the day. It already has {_phrase(row['load'])} booked, and this takes {_phrase(add)}."
    return {"date": row["date"], "fits": fits, "state": row["state"], "load": row["load"], "adds": add, "message": msg, "why": row["why"]}


@router.get("/calendar")
def get_calendar(db: Session = Depends(get_db), user: User = Depends(require_active)):
    return calsync.public_cfg(db.get(User, ws_id(user)))


@router.put("/calendar")
def save_calendar(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_active)):
    """{url} connects (or replaces) the link and reads it straight away; {url: ""} disconnects; {all_day_closes} alone changes the setting."""
    owner = db.get(User, ws_id(user))
    cfg = calsync.get_cfg(owner)
    if "url" in payload:
        url = (payload.get("url") or "").strip()
        if not url:
            calsync.disconnect(db, owner)
            return calsync.public_cfg(owner)
        try:
            url = calsync.normalise_url(url)
            data = calsync.fetch_ics(url)  # prove it works before saving anything
            calsync.parse_busy(data, _date.today(), _date.today() + timedelta(days=30))
        except calsync.CalendarError as exc:
            raise HTTPException(422, str(exc))
        cfg = {"url": url, "all_day_closes": bool(payload.get("all_day_closes", cfg.get("all_day_closes", True)))}
        calsync._save_cfg(owner, cfg)
        db.commit()
        return calsync.sync_user(db, owner, data)
    if not cfg.get("url"):
        raise HTTPException(422, "Connect a calendar first.")
    if "all_day_closes" in payload:
        cfg["all_day_closes"] = bool(payload["all_day_closes"])
        calsync._save_cfg(owner, cfg)
        db.commit()
        return calsync.sync_user(db, owner)
    return calsync.public_cfg(owner)


@router.post("/calendar/sync")
def sync_calendar(db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner = db.get(User, ws_id(user))
    if not calsync.get_cfg(owner).get("url"):
        raise HTTPException(422, "Connect a calendar first.")
    return calsync.sync_user(db, owner)


@router.get("/days")
def diary_days(from_date: str = "", to_date: str = "", db: Session = Depends(get_db), user: User = Depends(require_active)):
    today = _date.today()
    start = _parse(from_date, today - timedelta(days=today.weekday()))
    end = _parse(to_date, start + timedelta(days=27))
    if (end - start).days > 120:
        end = start + timedelta(days=120)
    owner = db.get(User, ws_id(user))
    return {"rules": rules_for(owner), "from": start.isoformat(), "to": end.isoformat(),
            "days": compute_days(db, owner.id, rules_for(owner), start, end, detail=True)}


@public_router.get("/availability/{token}")
def public_availability(token: str, from_date: str = "", to_date: str = "", db: Session = Depends(get_db)):
    owner = db.query(User).filter(User.enquiry_token == token, User.role.in_(["chef", "admin"])).first() if token else None
    if not owner:
        raise HTTPException(404, "Availability is not available here.")
    rules = rules_for(owner)
    if not rules["public"]:
        return {"public": False, "days": []}
    today = _date.today()
    start = max(_parse(from_date, today), today)
    horizon = today + timedelta(days=rules["horizon_days"])
    end = min(_parse(to_date, horizon), horizon)
    return {"public": True, "from": start.isoformat(), "to": end.isoformat(), "horizon": horizon.isoformat(),
            "days": compute_days(db, owner.id, rules, start, end, detail=False)}
