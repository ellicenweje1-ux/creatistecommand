"""Busy times from the chef's main calendar close dates in the Diary.

The chef pastes the private ICS link of their Google / Apple / Outlook calendar once (Diary → "Your other calendar").
Command reads it on a timer and turns what is busy into Diary blocks tagged source='calendar':

  * an all-day event closes that day (kind 'off', shown as full on the website) unless the chef turns that off,
    in which case it only makes the day limited;
  * a timed event is a busy window (kind 'busy', the day shows as limited, personal chef days stay holdable);
  * events marked "free" (TRANSP:TRANSPARENT), cancelled ones, and anything Command itself exported
    (UIDs ending @creatistecommand) are ignored, so subscribing Command's own calendar link into the same
    calendar can never loop back and block every booking day.

The blocks are replaced wholesale on each sync, so removing or moving an event in the calendar reopens the date.
A failed fetch or parse keeps the previous blocks and records the error; it never wipes the diary.
Settings live in users.diary_rules["calendar"] (no new column): {links:[{id, name, url, count, last_error, last_synced}],
all_day_closes, last_synced, last_error, count}. Several calendars can be connected (an iPhone usually has Home and Work);
each block's ext_uid is "<link id>|<event uid>" so one link failing keeps its own last good blocks. An older single
{url} setting reads as one link with id "main" (its blocks carry plain uids until the next sync).
Google caches its secret ICS link for hours, so a change there can take a while to arrive; iCloud is quicker.
"""
import ipaddress
import logging
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date as _date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from . import config
from .database import SessionLocal
from .models import DiaryBlock, User

log = logging.getLogger("creatiste.calsync")

KEY = "calendar"
MAX_LINKS = 5
MAX_BYTES = 8 * 1024 * 1024
MAX_BLOCKS = 3000
SYNC_EVERY = 600  # seconds between background syncs
UA = "Mozilla/5.0 (compatible; CreatisteCommand-CalendarSync/1.0)"


class CalendarError(Exception):
    """A problem the chef can act on (bad link, private calendar...). The message is shown to them."""


# ───────────────────────────── settings ─────────────────────────────
def get_cfg(owner: User) -> dict:
    return dict((owner.diary_rules or {}).get(KEY) or {})


def _save_cfg(owner: User, cfg: dict | None) -> None:
    rules = dict(owner.diary_rules or {})
    if cfg:
        rules[KEY] = cfg
    else:
        rules.pop(KEY, None)
    owner.diary_rules = rules  # a fresh object so SQLAlchemy persists the JSON


def links_of(cfg: dict) -> list[dict]:
    links = [dict(x) for x in cfg.get("links") or [] if x.get("url")]
    if not links and cfg.get("url"):
        links = [{"id": "main", "name": "My calendar", "url": cfg["url"]}]
    return links


def public_cfg(owner: User) -> dict:
    """What the chef's screen may see: never the secret links themselves, only a hint of where each points."""
    c = get_cfg(owner)
    links = [{"id": x["id"], "name": x.get("name") or "My calendar", "host": urllib.parse.urlparse(x["url"]).hostname or "",
              "count": int(x.get("count") or 0), "last_error": x.get("last_error", ""), "last_synced": x.get("last_synced", "")}
             for x in links_of(c)]
    return {"connected": bool(links), "host": links[0]["host"] if links else "", "links": links,
            "all_day_closes": bool(c.get("all_day_closes", True)), "last_synced": c.get("last_synced", ""),
            "last_error": c.get("last_error", ""), "count": int(c.get("count") or 0)}


# ───────────────────────────── fetching ─────────────────────────────
def normalise_url(url: str) -> str:
    u = (url or "").strip()
    low = u.lower()
    if low.startswith("webcal://"):
        u = "https://" + u[9:]
    elif low.startswith("webcals://"):
        u = "https://" + u[10:]
    p = urllib.parse.urlparse(u)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise CalendarError("That doesn't look like a calendar link. It should start with https:// or webcal://")
    return u


def _check_public_host(host: str) -> None:
    """The server must never be pointed at an internal address (SSRF): every address the host resolves to has to be public."""
    if config.CALENDAR_ALLOW_PRIVATE:
        return
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        raise CalendarError("We couldn't reach that address. Check the link and try again.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise CalendarError("That link points somewhere private, so it can't be used. Use the public calendar link from Google, Apple or Outlook.")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):  # we follow redirects ourselves so every hop is checked
        return None


def fetch_ics(url: str) -> bytes:
    url = normalise_url(url)
    opener = urllib.request.build_opener(_NoRedirect)
    for _ in range(5):
        _check_public_host(urllib.parse.urlparse(url).hostname or "")
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/calendar, */*"})
        try:
            with opener.open(req, timeout=12) as r:
                data = r.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise CalendarError("That calendar is too large to read.")
                return data
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                url = normalise_url(urllib.parse.urljoin(url, e.headers["Location"]))
                continue
            if e.code in (401, 403, 404):
                raise CalendarError("The calendar link was refused. Make sure you copied the secret / public iCal address, not the normal calendar page.")
            raise CalendarError(f"The calendar returned an error ({e.code}).")
        except (urllib.error.URLError, socket.timeout, TimeoutError, OSError):
            raise CalendarError("We couldn't reach your calendar just now. We'll try again shortly.")
    raise CalendarError("That link redirects too many times.")


# ───────────────────────────── parsing ─────────────────────────────
def _hhmm(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def parse_busy(data: bytes, start: _date, end: _date, all_day_closes: bool = True) -> list[dict]:
    """Turn ICS bytes into block dicts for [start, end]. Raises CalendarError when it isn't a calendar."""
    import icalendar
    import recurring_ical_events

    try:
        cal = icalendar.Calendar.from_ical(data)
    except Exception:
        raise CalendarError("That link didn't return a calendar. Use the iCal (.ics) address from your calendar's settings.")
    tz = ZoneInfo(config.ONBOARDING_TZ)
    try:
        events = recurring_ical_events.of(cal).between(start, end + timedelta(days=1))
    except Exception as exc:  # a malformed recurrence rule shouldn't take the whole sync down
        log.warning("recurrence expansion failed: %s", exc)
        raise CalendarError("We couldn't read some repeating events in that calendar.")
    out: list[dict] = []
    for ev in events:
        uid = str(ev.get("UID") or "")
        if uid.endswith("@creatistecommand"):
            continue  # our own exported calendar
        if str(ev.get("STATUS") or "").upper() == "CANCELLED":
            continue
        if str(ev.get("TRANSP") or "").upper() == "TRANSPARENT":
            continue  # marked "free"
        if str(ev.get("X-MICROSOFT-CDO-BUSYSTATUS") or "").upper() == "FREE":
            continue
        title = str(ev.get("SUMMARY") or "Busy")[:160]
        s, e = ev.start, ev.end
        if isinstance(s, datetime):
            s = s.astimezone(tz) if s.tzinfo else s.replace(tzinfo=tz)
            e = (e.astimezone(tz) if e.tzinfo else e.replace(tzinfo=tz)) if isinstance(e, datetime) else s
            if e <= s:
                continue
            day = s.date()
            while day <= e.date():
                if day > end:
                    break
                seg_start = s if day == s.date() else datetime.combine(day, datetime.min.time(), tz)
                if day == e.date():
                    if e.time() == datetime.min.time() and day != s.date():
                        break  # ends exactly at midnight: nothing on this day
                    seg_end_s = _hhmm(e)
                else:
                    seg_end_s = "23:59"
                if day >= start:
                    out.append({"uid": uid, "title": title, "kind": "busy", "date": day.isoformat(), "end_date": "",
                                "start_time": _hhmm(seg_start), "end_time": seg_end_s})
                day += timedelta(days=1)
        else:  # all-day: DTEND is exclusive
            first = s
            last = (e - timedelta(days=1)) if isinstance(e, _date) and e > s else s
            first, last = max(first, start), min(last, end)
            if last < first:
                continue
            out.append({"uid": uid, "title": title, "kind": "off" if all_day_closes else "busy", "date": first.isoformat(),
                        "end_date": last.isoformat() if last > first else "", "start_time": "", "end_time": ""})
        if len(out) >= MAX_BLOCKS:
            break
    return out


# ───────────────────────────── syncing ─────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z"


def _link_blocks(db: Session, owner: User, link_ids: list[str]):
    """The calendar blocks that came from these links (plain-uid blocks predate per-link tags and go with any of them)."""
    from sqlalchemy import or_

    conds = [DiaryBlock.ext_uid.like(f"{lid}|%") for lid in link_ids] + [~DiaryBlock.ext_uid.contains("|")]
    return db.query(DiaryBlock).filter(DiaryBlock.user_id == owner.id, DiaryBlock.source == "calendar", or_(*conds))


def sync_user(db: Session, owner: User, data: bytes | None = None, link_id: str | None = None) -> dict:
    """Fetch (unless `data` is given for `link_id`), parse and replace this chef's calendar-sourced blocks, link by link.
    Never raises: the outcome is recorded on the settings and returned. A link that fails keeps its last good blocks."""
    cfg = get_cfg(owner)
    links = links_of(cfg)
    if not links:
        return public_cfg(owner)
    from .routers.diary import rules_for  # local import: diary imports nothing from here

    today = _date.today()
    horizon = today + timedelta(days=rules_for(owner)["horizon_days"])
    all_day = bool(cfg.get("all_day_closes", True))
    ok, rows, errors = [], [], []
    for ln in links:
        try:
            raw = data if (data is not None and (link_id or links[0]["id"]) == ln["id"]) else fetch_ics(ln["url"])
            items = parse_busy(raw, today, horizon, all_day)
            ok.append(ln["id"])
            rows += [(ln["id"], it) for it in items]
            ln.update(last_error="", count=len(items), last_synced=_now_iso())
        except CalendarError as exc:
            ln["last_error"] = str(exc)
            errors.append(f"{ln.get('name') or 'Your calendar'}: {exc}")
        except Exception as exc:  # never let one chef's odd calendar stop the loop
            log.warning("calendar sync failed for user %s: %s", owner.id, exc)
            ln["last_error"] = "We couldn't read that calendar. Check the link and try again."
            errors.append(f"{ln.get('name') or 'Your calendar'}: {ln['last_error']}")
    try:
        if ok:
            _link_blocks(db, owner, ok).delete(synchronize_session=False)
            for lid, it in rows[:MAX_BLOCKS]:
                db.add(DiaryBlock(user_id=owner.id, source="calendar", ext_uid=f"{lid}|{it['uid']}"[:200], title=it["title"],
                                  kind=it["kind"], date=it["date"], end_date=it["end_date"], start_time=it["start_time"],
                                  end_time=it["end_time"], notes="From your calendar"))
            cfg["last_synced"] = _now_iso()
    except Exception as exc:
        log.warning("calendar blocks for user %s not saved: %s", owner.id, exc)
        db.rollback()
        errors.append("We couldn't save what we read. We'll try again shortly.")
    cfg.pop("url", None)
    cfg.update(links=links, last_error="; ".join(errors), count=sum(int(x.get("count") or 0) for x in links))
    _save_cfg(owner, cfg)
    db.commit()
    return public_cfg(owner)


def add_link(db: Session, owner: User, url: str, name: str = "", all_day_closes: bool | None = None) -> dict:
    """Check a new calendar link works, save it beside any others, and read it straight away. Raises CalendarError."""
    import secrets

    cfg = get_cfg(owner)
    links = links_of(cfg)
    url = normalise_url(url)
    if any(x["url"] == url for x in links):
        raise CalendarError("That calendar is already connected.")
    if len(links) >= MAX_LINKS:
        raise CalendarError(f"You can connect up to {MAX_LINKS} calendars. Remove one first.")
    data = fetch_ics(url)  # prove it works before saving anything
    parse_busy(data, _date.today(), _date.today() + timedelta(days=30))
    lid = secrets.token_hex(3)
    links.append({"id": lid, "name": (name or "").strip()[:40] or ("My calendar" if not links else f"Calendar {len(links) + 1}"), "url": url})
    cfg.pop("url", None)
    cfg["links"] = links
    if all_day_closes is not None:
        cfg["all_day_closes"] = bool(all_day_closes)
    _save_cfg(owner, cfg)
    db.commit()
    return sync_user(db, owner, data, lid)


def disconnect(db: Session, owner: User, link_id: str | None = None) -> None:
    """Forget one link (and the dates it closed), or every link when no id is given."""
    cfg = get_cfg(owner)
    links = links_of(cfg)
    if link_id and len(links) > 1:
        db.query(DiaryBlock).filter(DiaryBlock.user_id == owner.id, DiaryBlock.source == "calendar",
                                    DiaryBlock.ext_uid.like(f"{link_id}|%")).delete(synchronize_session=False)
        cfg.pop("url", None)
        cfg["links"] = [x for x in links if x["id"] != link_id]
        cfg["count"] = sum(int(x.get("count") or 0) for x in cfg["links"])
        _save_cfg(owner, cfg)
    else:
        db.query(DiaryBlock).filter(DiaryBlock.user_id == owner.id, DiaryBlock.source == "calendar").delete(synchronize_session=False)
        _save_cfg(owner, None)
    db.commit()


def stale(owner: User, seconds: int = 300) -> bool:
    c = get_cfg(owner)
    if not links_of(c):
        return False
    ls = c.get("last_synced") or ""
    if not ls:
        return True
    try:
        return (datetime.utcnow() - datetime.fromisoformat(ls.rstrip("Z"))).total_seconds() > seconds
    except ValueError:
        return True


def sync_all(db: Session) -> int:
    n = 0
    for owner in db.query(User).filter(User.role.in_(["chef", "admin"])).all():
        if links_of(get_cfg(owner)):
            sync_user(db, owner)
            n += 1
    return n


_started = False


def start_loop():
    global _started
    if _started or not config.ENABLE_SCHEDULER:
        return
    _started = True

    def loop():
        time.sleep(20)  # let the app finish booting
        while True:
            db = SessionLocal()
            try:
                sync_all(db)
            except Exception as exc:
                log.warning("calendar sweep failed: %s", exc)
            finally:
                db.close()
            time.sleep(SYNC_EVERY)

    threading.Thread(target=loop, daemon=True, name="cc-calsync").start()
