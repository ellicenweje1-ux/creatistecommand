"""Diary — the chef's time, in one place, and a public "which days are free" calendar for their website.

A day's state is computed from the bookings (status quoted/confirmed/in_prep, with their time windows) plus
the chef's own diary blocks (a standing weekly service, prep days, days off), under the chef's diary rules:
  max_per_day   how many bookings in total a day can hold before it is full (default 1)
  prep_days     default days before each confirmed event that are kept as prep (default 1; shown as "limited")
  public        whether the website may show availability at all (default on)
  horizon_days  how far ahead the public calendar reaches (default 90)
  kinds         per booking-type rules, matched on the booking's event type / title by keywords:
                {id, label, match[], max_per_day, prep_days, blocks_day}. A kind that `blocks_day` makes the
                day full the moment one is booked (a catered event); a kind at its own cap, or any booking at
                all, makes the day limited. Unmatched bookings use the defaults above.
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
from sqlalchemy.orm import Session

from ..auth import require_active
from ..database import get_db
from ..models import Booking, DiaryBlock, User
from ..utils import crud_router, to_dict, ws_id

blocks = crud_router(DiaryBlock, required=("date",), search_fields=("title", "notes"),
                     default_order=lambda m: [m.date.asc(), m.start_time.asc()])
router = APIRouter()  # rules + the computed days (kept off the crud router so /{item_id} can't swallow them)
public_router = APIRouter(prefix="/public", tags=["public"])

ACTIVE = ("quoted", "confirmed", "in_prep")
DEFAULT_KINDS = [
    {"id": "private", "label": "Private catering", "match": ["private catering", "loaded bar", "corporate", "creatiste table", "wedding", "party"],
     "max_per_day": 1, "prep_days": 2, "blocks_day": True},
    {"id": "personal", "label": "Personal chef", "match": ["personal chef", "batchfully", "home edit", "sorted & served", "sorted and served"],
     "max_per_day": 2, "prep_days": 0, "blocks_day": False},
    {"id": "cleandream", "label": "Clean Dream", "match": ["pre-order", "clean dream"],
     "max_per_day": 1, "prep_days": 0, "blocks_day": False},
]
DEFAULT_RULES = {"max_per_day": 2, "prep_days": 1, "public": True, "horizon_days": 90, "kinds": DEFAULT_KINDS}
KINDS = ("busy", "prep", "off", "standing")


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
        try:
            mpd = max(1, min(int(k.get("max_per_day") or 1), 50))
            prep = max(0, min(int(k.get("prep_days") or 0), 14))
        except (TypeError, ValueError):
            raise HTTPException(422, f"{label}: limits must be whole numbers")
        kid = str(k.get("id") or "").strip()[:40] or f"kind{i + 1}"
        out.append({"id": kid, "label": label, "match": match, "max_per_day": mpd, "prep_days": prep, "blocks_day": bool(k.get("blocks_day"))})
    return out[:12]


def kind_of(kinds: list[dict], bk: Booking) -> dict | None:
    """The first kind whose keywords appear in the booking's event type or title."""
    hay = f"{bk.event_type or ''} {bk.title or ''}".lower()
    for k in kinds:
        if any(m and m in hay for m in k["match"]):
            return k
    return None


def rules_for(owner: User) -> dict:
    r = {**DEFAULT_RULES, **(owner.diary_rules or {})}
    r["max_per_day"] = max(1, min(int(r.get("max_per_day") or 1), 20))
    r["prep_days"] = max(0, min(int(r.get("prep_days") or 0), 14))
    r["horizon_days"] = max(14, min(int(r.get("horizon_days") or 90), 365))
    r["public"] = bool(r.get("public", True))
    r["kinds"] = _clean_kinds(r.get("kinds")) if "kinds" in (owner.diary_rules or {}) else [dict(k) for k in DEFAULT_KINDS]
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


def compute_days(db: Session, owner_id: int, rules: dict, start: _date, end: _date, detail: bool) -> list[dict]:
    """One entry per day in [start, end]. `detail` adds the bookings and blocks (chef view only)."""
    span = (end - start).days + 1
    if span <= 0:
        return []
    # Bookings a little before the window too, so prep days of an event just after the window are counted.
    prep = rules["prep_days"]
    kinds = rules.get("kinds") or []
    max_prep = max([prep] + [k["prep_days"] for k in kinds])
    q_from, q_to = start.isoformat(), (end + timedelta(days=max_prep)).isoformat()
    bookings = (db.query(Booking).filter(Booking.user_id == owner_id, Booking.status.in_(ACTIVE),
                                          Booking.date >= q_from, Booking.date <= q_to).all())
    blocks = db.query(DiaryBlock).filter(DiaryBlock.user_id == owner_id).all()
    blocks = [b for b in blocks if b.repeat == "weekly" or (b.end_date or b.date or "") >= q_from and (b.date or "") <= q_to]
    by_day: dict[str, list[Booking]] = {}
    for bk in bookings:
        by_day.setdefault(bk.date, []).append(bk)
    prep_for: dict[str, list[str]] = {}  # day -> titles of events it preps for
    for bk in bookings:
        if bk.status not in ("confirmed", "in_prep"):
            continue
        d = _date.fromisoformat(bk.date)
        k = kind_of(kinds, bk)
        for n in range(1, (k["prep_days"] if k else prep) + 1):
            prep_for.setdefault((d - timedelta(days=n)).isoformat(), []).append(bk.title)

    out = []
    for i in range(span):
        day = start + timedelta(days=i)
        iso = day.isoformat()
        todays = by_day.get(iso, [])
        blk = [b for b in blocks if _block_on(b, day)]
        state, why = "open", []
        # Count today's bookings per kind; a kind that takes the whole day, or any kind over its own cap, decides.
        counts: dict[str, int] = {}
        for bk in todays:
            k = kind_of(kinds, bk)
            counts[k["id"] if k else "_other"] = counts.get(k["id"] if k else "_other", 0) + 1
        by_id = {k["id"]: k for k in kinds}
        kind_lines = [f"{by_id[kid]['label']}: {n} of {by_id[kid]['max_per_day']}" if kid in by_id else f"Other: {n}" for kid, n in counts.items()]
        blocked_by = [by_id[kid]["label"] for kid, n in counts.items() if kid in by_id and by_id[kid]["blocks_day"] and n >= 1]
        capped = [by_id[kid]["label"] for kid, n in counts.items() if kid in by_id and n >= by_id[kid]["max_per_day"]]
        if any(b.kind == "off" and not b.start_time for b in blk):
            state, why = "full", ["Day off"]
        elif blocked_by:
            state, why = "full", [f"{blocked_by[0]} takes the day"] + kind_lines
        elif len(todays) >= rules["max_per_day"]:
            state, why = "full", ["Booked"] + kind_lines
        else:
            if capped:
                why.append(f"No more {', '.join(capped).lower()} today")
            elif todays:
                why.append("Booking already on")
            why.extend(kind_lines)
            if iso in prep_for:
                why.append("Prep day")
            if any(b.kind in ("busy", "standing", "off") for b in blk):
                why.append("Part of the day committed")
            if any(b.kind == "prep" for b in blk):
                why.append("Prep day")
            if why:
                state = "limited"
        row = {"date": iso, "state": state}
        if detail:
            row["why"] = why
            row["bookings"] = [{"id": bk.id, "title": bk.title, "status": bk.status, "start_time": bk.start_time,
                                "end_time": bk.end_time, "guest_count": bk.guest_count, "event_type": bk.event_type,
                                "venue_name": bk.venue_name, "kind": (kind_of(kinds, bk) or {}).get("label", "")}
                               for bk in sorted(todays, key=lambda b: b.start_time or "")]
            row["counts"] = counts
            row["blocks"] = [to_dict(b) for b in blk]
            row["prep_for"] = prep_for.get(iso, [])
        out.append(row)
    return out


@router.get("/rules")
def get_rules(db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner = db.get(User, ws_id(user))
    return rules_for(owner)


@router.put("/rules")
def save_rules(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_active)):
    owner = db.get(User, ws_id(user))
    cur = {**DEFAULT_RULES, **(owner.diary_rules or {})}
    for k in ("max_per_day", "prep_days", "horizon_days"):
        if k in payload:
            try:
                cur[k] = int(payload[k])
            except (TypeError, ValueError):
                raise HTTPException(422, f"{k} must be a whole number")
    if "public" in payload:
        cur["public"] = bool(payload["public"])
    if "kinds" in payload:
        cur["kinds"] = _clean_kinds(payload["kinds"])
    owner.diary_rules = dict(cur)  # fresh object so SQLAlchemy persists the JSON
    db.commit()
    return rules_for(owner)


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
