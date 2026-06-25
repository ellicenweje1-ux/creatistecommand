"""Trial-ending reminder email + a tiny in-process scheduler that sends it.

Single uvicorn worker, so an in-process daemon thread is enough (same pattern as the
in-memory rate limiter). On Render's free tier the instance sleeps, so the loop is
best-effort — it also sweeps once on every startup (i.e. on wake). For guaranteed daily
sends, point an external uptime/cron service at POST /api/cron/trial-reminders with the
CRON_SECRET header (see routers/cron.py)."""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from . import config, mailer
from .database import SessionLocal
from .models import PushSubscription, Task, User

log = logging.getLogger("scheduler")
_started = False


def run_trial_reminders(db: Session) -> dict:
    """Email trialing chefs whose trial ends within TRIAL_REMINDER_DAYS_BEFORE days and who
    haven't been reminded yet. Idempotent via the trial_reminder_sent flag. No-op unless
    email is configured, so a reminder is never 'spent' silently before email works."""
    if not mailer.email_enabled():
        return {"sent": 0, "reason": "email_not_configured"}
    today = datetime.now(timezone.utc).date()
    cutoff = (today + timedelta(days=config.TRIAL_REMINDER_DAYS_BEFORE)).isoformat()
    candidates = (
        db.query(User)
        .filter(
            User.role == "chef",
            User.subscription_status == "trialing",
            User.trial_reminder_sent == False,  # noqa: E712
            User.trial_ends_at != "",
            User.trial_ends_at <= cutoff,
            User.trial_ends_at >= today.isoformat(),
        )
        .all()
    )
    sent = 0
    for u in candidates:
        # Subscribed mid-trial already (card on file): nothing to chase — just flag it.
        if u.stripe_subscription_id:
            u.trial_reminder_sent = True
            continue
        try:
            days_left = (datetime.strptime(u.trial_ends_at, "%Y-%m-%d").date() - today).days
        except ValueError:
            continue
        when = "today" if days_left <= 0 else "tomorrow" if days_left == 1 else f"in {days_left} days"
        rate_line = (
            "Your founders rate is waiting at activation — your lifetime price, locked in."
            if u.is_founder
            else "Activation is your one-time onboarding fee plus your first month — then it renews monthly."
        )
        mailer.send_email(
            u.email,
            f"Your Creatiste Command free trial ends {when}",
            f"Hi {u.name or 'chef'},\n\n"
            f"Your free trial ends {when} ({u.trial_ends_at}). To keep your kitchen — every "
            f"booking, recipe, list and client you've added stays exactly as it is — activate "
            f"your membership before then.\n\n{rate_line}\n\n"
            f"Activate here: {config.APP_URL.rstrip('/')}/onboarding\n\n"
            f"Any questions before you decide? Just reply — we're happy to help.\n\n"
            f"— Ellice, The Creatiste Command",
        )
        u.trial_reminder_sent = True
        sent += 1
    db.commit()
    return {"sent": sent}


def run_task_reminders(db: Session) -> dict:
    """Push a heads-up to the chef's phone for tasks whose deadline is within the lead
    window (and not done). Idempotent via Task.due_reminder_for (keyed to the exact
    deadline, so rescheduling a task re-arms it). No-op unless push is configured.
    Times are read in the business timezone (Europe/London), matching what the chef sees."""
    from zoneinfo import ZoneInfo

    from . import push

    if not config.ENABLE_TASK_REMINDERS or not push.push_enabled():
        return {"sent": 0, "reason": "disabled_or_unconfigured"}
    sub_user_ids = {s.user_id for s in db.query(PushSubscription.user_id).distinct().all()}
    if not sub_user_ids:
        return {"sent": 0}
    tz = ZoneInfo(config.ONBOARDING_TZ)
    now = datetime.now(tz)
    lead = timedelta(hours=config.TASK_REMINDER_LEAD_HOURS)
    candidates = db.query(Task).filter(Task.status != "done", Task.due_date != "").all()
    sent = 0
    for t in candidates:
        if t.user_id not in sub_user_ids:
            continue
        try:
            d = datetime.strptime(t.due_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        hh, mm = 23, 59  # no time set → treat as end of the due day
        if t.due_time:
            try:
                parts = t.due_time.split(":")
                hh, mm = int(parts[0]), int(parts[1])
            except (ValueError, IndexError):
                hh, mm = 23, 59
        due_dt = datetime(d.year, d.month, d.day, hh, mm, tzinfo=tz)
        key = due_dt.strftime("%Y-%m-%dT%H:%M")
        if t.due_reminder_for == key or now < due_dt - lead:
            continue  # already nudged for this deadline, or still too far out
        delta = due_dt - now
        if delta.total_seconds() < 0:
            when = "is overdue"
        elif delta < timedelta(hours=1):
            when = "is due within the hour"
        elif due_dt.date() == now.date():
            when = f"is due today{(' at ' + t.due_time) if t.due_time else ''}"
        elif due_dt.date() == now.date() + timedelta(days=1):
            when = f"is due tomorrow{(' at ' + t.due_time) if t.due_time else ''}"
        else:
            when = f"is due {due_dt.strftime('%a %d %b')}"
        push.notify_user(db, t.user_id, f"Task {when}", t.title, url="/app/tasks", tag=f"task-{t.id}")
        t.due_reminder_for = key
        sent += 1
    db.commit()
    return {"sent": sent}


def _sweep():
    db = SessionLocal()
    try:
        run_trial_reminders(db)
    except Exception as exc:  # a failed sweep must never crash the worker
        log.warning("trial-reminder sweep failed: %s", exc)
    try:
        run_task_reminders(db)
    except Exception as exc:
        log.warning("task-reminder sweep failed: %s", exc)
    try:
        from .recycle import purge_expired

        purge_expired(db)  # drop recycle-bin items past their retention window
    except Exception as exc:
        log.warning("recycle purge failed: %s", exc)
    finally:
        db.close()
    try:
        from .backup import run_weekly_backup

        run_weekly_backup()  # emails an off-site DB snapshot if one is due (weekly)
    except Exception as exc:
        log.warning("backup sweep failed: %s", exc)


def start_scheduler():
    """Launch the background loop once. Daemon thread, so it dies with the process."""
    global _started
    if _started or not config.ENABLE_SCHEDULER:
        return
    _started = True

    def loop():
        while True:
            _sweep()
            time.sleep(max(0.5, config.SCHEDULER_INTERVAL_HOURS) * 3600)

    threading.Thread(target=loop, daemon=True, name="cc-scheduler").start()
    log.info("scheduler started (every %.1fh)", config.SCHEDULER_INTERVAL_HOURS)
