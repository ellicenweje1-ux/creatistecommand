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
import shutil
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone

from . import config, mailer

log = logging.getLogger("backup")
_STAMP = config.DATA_DIR / ".last_backup"

SQLITE_MAGIC = b"SQLite format 3\x00"


def _live_db_path() -> str:
    return config.DATABASE_URL.replace("sqlite:///", "", 1)


def _restore_path() -> str:
    return _live_db_path() + ".restore"


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


# --- Restore from a backup file ------------------------------------------------------------
# A restore can't safely overwrite the DB SQLite is actively using, so it's a two-step,
# restart-applied swap: the uploaded file is validated and *staged* next to the live DB now,
# then applied on the next startup (apply_pending_restore, called first thing in bootstrap()).
# The current DB is kept as a timestamped .prerestore copy so a bad restore can be undone.

def validate_snapshot(data: bytes) -> str:
    """Cheap sanity check that `data` is one of our SQLite backups before we stage it.
    Returns '' if valid, else a human-readable reason it was rejected."""
    if not data:
        return "The file is empty."
    if not data.startswith(SQLITE_MAGIC):
        return "That isn't a SQLite database file (wrong file type)."
    fd, tmp = tempfile.mkstemp(suffix=".db", prefix="creatiste-verify-")
    os.close(fd)
    try:
        with open(tmp, "wb") as f:
            f.write(data)
        con = sqlite3.connect(tmp)
        try:
            ok = con.execute("PRAGMA integrity_check").fetchone()
            if not ok or ok[0] != "ok":
                return "The database file is corrupted (failed integrity check)."
            tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if "users" not in tables:
                return "That database doesn't look like a Creatiste Command backup (no accounts table)."
        finally:
            con.close()
    except sqlite3.DatabaseError:
        return "The database file is unreadable or corrupted."
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    return ""


def stage_restore(data: bytes) -> dict:
    """Validate an uploaded backup and stage it for the next restart. Raises ValueError
    (→ a clean 400) on a bad file. The swap itself happens in apply_pending_restore()."""
    if not config.DATABASE_URL.startswith("sqlite"):
        raise ValueError("Restore is only available for SQLite databases.")
    reason = validate_snapshot(data)
    if reason:
        raise ValueError(reason)
    target = _restore_path()
    with open(target, "wb") as f:
        f.write(data)
    log.info("restore staged (%d KB) — applies on next restart", len(data) // 1024)
    return {"staged": True, "size_kb": len(data) // 1024}


def restore_pending() -> bool:
    return os.path.exists(_restore_path())


def apply_pending_restore() -> bool:
    """If a restore was staged, swap it in now (before anything opens the DB). Keeps the
    current DB as a timestamped .prerestore-* copy so it can be rolled back by hand.
    Returns True if a restore was applied. Called first thing in bootstrap()."""
    staged = _restore_path()
    if not os.path.exists(staged):
        return False
    if validate_snapshot_file(staged):
        log.warning("staged restore failed re-validation — ignoring and removing it")
        _safe_unlink(staged)
        return False
    live = _live_db_path()
    try:
        if os.path.exists(live):
            keep = f"{live}.prerestore-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
            shutil.copy2(live, keep)
            log.info("kept pre-restore copy: %s", os.path.basename(keep))
        # Drop any SQLite sidecar files from the old DB so they can't fight the new one.
        for sidecar in (live + "-wal", live + "-shm", live + "-journal"):
            _safe_unlink(sidecar)
        os.replace(staged, live)
        log.info("restore applied — live database replaced from staged backup")
        return True
    except OSError as exc:
        log.error("restore failed to apply: %s", exc)
        return False


def validate_snapshot_file(path: str) -> str:
    try:
        with open(path, "rb") as f:
            return validate_snapshot(f.read())
    except OSError as exc:
        return f"Could not read the staged file: {exc}"


def _safe_unlink(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass
