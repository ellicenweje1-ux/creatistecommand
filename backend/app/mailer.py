"""Best-effort email notifications. Disabled (no-op) until SMTP_* env vars are set."""
import logging
import smtplib
import threading
from email.mime.text import MIMEText

from . import config

log = logging.getLogger("mailer")


def email_enabled() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_FROM)


def _deliver(to: str, subject: str, body: str):
    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = config.SMTP_FROM
        msg["To"] = to
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
            server.starttls()
            if config.SMTP_USER:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:  # never let email failures break a request
        log.warning("email to %s failed: %s", to, exc)


def send_email(to: str, subject: str, body: str):
    """Fire-and-forget: a slow SMTP server must not block API responses."""
    if not email_enabled() or not to:
        log.info("email skipped (smtp not configured): %s -> %s", subject, to)
        return
    threading.Thread(target=_deliver, args=(to, subject, body), daemon=True).start()
