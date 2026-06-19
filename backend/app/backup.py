"""Off-site backup: a weekly emailed snapshot of the SQLite database.

The persistent disk protects against deploy-wipes; this protects against the disk itself
(or the whole Render account) failing, by emailing a full DB snapshot off-site every
BACKUP_INTERVAL_DAYS. Driven by the in-process scheduler (app/scheduler.py).

The snapshot is ALL platform data — every chef account plus everything each chef (and
their own clients) has entered — so BACKUP_EMAIL must be a secure inbox. Planned upgrade:
push to encrypted cloud storage (Backblaze B2 / S3) instead of email.

make_snapshot() is also used by the admin Download-backup endpoint."""
import logging
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone

from . import config, mailer

log = logging.getLogger("backup")
_STAMP = config.DATA_DIR / ".last_backup"


def make_snapshot() -> tuple[str, str]:
    """Write a consistent copy of the live SQLite DB to a temp file (online-backup API —
    safe while running). Returns (temp_path, suggested_filename); the caller deletes the file."""
    if not config.DATABASE_URL.startswith("sqlite"):
        raise RuntimeError("Backups are only available for SQLite databases.")
    src_path = config.DATABASE_URL.replace("sqlite:///", "", 1)
    if not os.path.exists(src_path):
        raise RuntimeError("Database file not found.")
    fd, tmp_path = tempfile.mkstemp(suffix=".db", prefix="creatiste-backup-")
    os.close(fd)
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(tmp_path)
    try:
        with dst:
            src.backup(dst)
    finally:
        src.close()
        dst.close()
    filename = f"creatiste-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.db"
    return tmp_path, filename


def _due() -> bool:
    try:
        last = datetime.fromisoformat(_STAMP.read_text().strip())
    except Exception:
        return True  # never backed up (or unreadable stamp) -> due now
    return datetime.now(timezone.utc) - last >= timedelta(days=config.BACKUP_INTERVAL_DAYS)


def run_weekly_backup(force: bool = False) -> dict:
    """Email an off-site DB snapshot when one is due (every BACKUP_INTERVAL_DAYS). No-op
    until email is configured — a backup is never silently 'spent' before it can send."""
    if not config.ENABLE_BACKUP or not config.DATABASE_URL.startswith("sqlite"):
        return {"backed_up": False, "reason": "disabled"}
    if not mailer.email_enabled():
        return {"backed_up": False, "reason": "email_not_configured"}
    if not force and not _due():
        return {"backed_up": False, "reason": "not_due"}
    tmp_path, filename = make_snapshot()
    blob = b""
    ok = False
    try:
        with open(tmp_path, "rb") as f:
            blob = f.read()
        ok = mailer.send_email_sync(
            config.BACKUP_EMAIL,
            f"[Creatiste Command] Weekly database backup — {datetime.now(timezone.utc):%d %b %Y}",
            "Attached is this week's full database snapshot — every account plus everything your "
            "chefs (and their clients) have entered. Keep it somewhere secure.\n\n"
            "To restore: stop the app and replace the live creatiste.db with this file.\n\n"
            "— automated weekly backup, The Creatiste Command",
            attachment=(filename, blob),
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    if ok:
        _STAMP.write_text(datetime.now(timezone.utc).isoformat())
        log.info("weekly backup emailed (%d KB)", len(blob) // 1024)
    return {"backed_up": bool(ok), "size_kb": len(blob) // 1024}
