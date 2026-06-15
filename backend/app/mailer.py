"""Best-effort email notifications.

Sends via the Resend HTTP API when RESEND_API_KEY is set (works on hosts like Render
that block outbound SMTP ports), otherwise over STARTTLS SMTP. Disabled (no-op) until
one of those is configured."""
import json
import logging
import smtplib
import threading
import urllib.request
from email.mime.text import MIMEText

from . import config

log = logging.getLogger("mailer")


def email_enabled() -> bool:
    return bool(config.RESEND_API_KEY) or bool(config.SMTP_HOST and config.SMTP_FROM)


def _deliver_resend(to: str, subject: str, body: str):
    """Send over HTTPS via Resend's API (port 443 — never blocked by the host)."""
    data = json.dumps({
        "from": config.SMTP_FROM,
        "to": [to],
        "subject": subject,
        "text": body,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {config.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def _deliver_smtp(to: str, subject: str, body: str):
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = config.SMTP_FROM
    msg["To"] = to
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
        server.starttls()
        if config.SMTP_USER:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        server.send_message(msg)


def _deliver(to: str, subject: str, body: str):
    try:
        if config.RESEND_API_KEY:
            _deliver_resend(to, subject, body)
        else:
            _deliver_smtp(to, subject, body)
    except Exception as exc:  # never let email failures break a request
        log.warning("email to %s failed: %s", to, exc)


def send_email(to: str, subject: str, body: str):
    """Fire-and-forget: a slow mail server must not block API responses."""
    if not email_enabled() or not to:
        log.info("email skipped (not configured): %s -> %s", subject, to)
        return
    threading.Thread(target=_deliver, args=(to, subject, body), daemon=True).start()
