"""Minimal RFC 5545 iCalendar builder (stdlib only).

Just enough to emit a VCALENDAR of VEVENTs for the chef's bookings and tastings, so the
feed can be subscribed to from a phone's calendar app. Times are written as *floating*
local times (no timezone / no Z) because the app stores naive local date/time strings —
calendar apps then show them in the device's local time, which is what a UK chef expects.
"""
from datetime import date, datetime, timedelta, timezone


def _esc(text: str) -> str:
    """Escape per RFC 5545 §3.3.11 (backslash, comma, semicolon, newlines)."""
    return (
        str(text or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def _fold(line: str) -> str:
    """Fold a content line to <=75 octets, continuation lines start with a space."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    out, chunk = [], b""
    for ch in line:
        enc = ch.encode("utf-8")
        # keep multibyte chars whole; 74 leaves room for the leading space on continuations
        if len(chunk) + len(enc) > (75 if not out else 74):
            out.append(chunk.decode("utf-8"))
            chunk = enc
        else:
            chunk += enc
    out.append(chunk.decode("utf-8"))
    return "\r\n ".join(out)


def _compact(date_str: str) -> str | None:
    """YYYY-MM-DD -> YYYYMMDD (None if not a valid date)."""
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").strftime("%Y%m%d")
    except (ValueError, TypeError):
        return None


def _next_day(date_str: str) -> str:
    return (datetime.strptime(date_str[:10], "%Y-%m-%d") + timedelta(days=1)).strftime("%Y%m%d")


def _time_compact(time_str: str) -> str | None:
    """HH:MM -> HHMMSS (None if blank/invalid)."""
    try:
        return datetime.strptime((time_str or "")[:5], "%H:%M").strftime("%H%M%S")
    except (ValueError, TypeError):
        return None


def event(
    *, uid: str, summary: str, date_str: str, start_time: str = "", end_time: str = "",
    location: str = "", description: str = "", status: str = "CONFIRMED", stamp: datetime | None = None,
) -> list[str]:
    """Build one VEVENT (list of content lines). Returns [] if the date is unusable."""
    day = _compact(date_str)
    if not day:
        return []
    dtstamp = (stamp or datetime.now(timezone.utc)).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VEVENT", f"UID:{uid}", f"DTSTAMP:{dtstamp}"]
    start = _time_compact(start_time)
    if start:
        lines.append(f"DTSTART:{day}T{start}")
        end = _time_compact(end_time)
        if end and end > start:
            lines.append(f"DTEND:{day}T{end}")
    else:
        # All-day event: DTEND is exclusive, so it's the following day.
        lines.append(f"DTSTART;VALUE=DATE:{day}")
        lines.append(f"DTEND;VALUE=DATE:{_next_day(date_str)}")
    lines.append(f"SUMMARY:{_esc(summary)}")
    if location:
        lines.append(f"LOCATION:{_esc(location)}")
    if description:
        lines.append(f"DESCRIPTION:{_esc(description)}")
    if status:
        lines.append(f"STATUS:{status}")
    lines.append("END:VEVENT")
    return lines


def calendar(name: str, events: list[list[str]]) -> str:
    """Wrap VEVENTs in a VCALENDAR and return the full folded ICS text."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//The Creatiste Command//Calendar Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_esc(name)}",
        f"NAME:{_esc(name)}",
    ]
    for ev in events:
        lines.extend(ev)
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
