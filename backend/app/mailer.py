"""Best-effort email notifications.

Sends via the Resend HTTP API when RESEND_API_KEY is set (works on hosts like Render
that block outbound SMTP ports), otherwise over STARTTLS SMTP. Disabled (no-op) until
one of those is configured."""
import base64
import json
import logging
import smtplib
import threading
import urllib.error
import urllib.request
from email.mime.text import MIMEText

from . import config

log = logging.getLogger("mailer")


def email_enabled() -> bool:
    return bool(config.RESEND_API_KEY) or bool(config.SMTP_HOST and config.SMTP_FROM)


def _deliver_resend(to: str, subject: str, body: str, attachment=None):
    """Send over HTTPS via Resend's API (port 443 — never blocked by the host)."""
    payload = {"from": config.SMTP_FROM, "to": [to], "subject": subject, "text": body}
    if attachment:
        fname, content = attachment
        payload["attachments"] = [{"filename": fname, "content": base64.b64encode(content).decode()}]
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {config.RESEND_API_KEY}",
            "Content-Type": "application/json",
            # Resend's API is behind Cloudflare, which 403s (error 1010) the default
            # "Python-urllib/x" User-Agent as a suspected bot. Identify ourselves properly.
            "User-Agent": "Mozilla/5.0 (compatible; TheCreatisteCommand/1.0; +https://creatistecommand.onrender.com)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        # Surface Resend's actual explanation (the response body), not just the status.
        detail = exc.read().decode("utf-8", "replace")[:600] if exc.fp else ""
        raise RuntimeError(f"Resend API {exc.code}: {detail}") from None


def _deliver_smtp(to: str, subject: str, body: str, attachment=None):
    if attachment:
        from email.mime.application import MIMEApplication
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart()
        msg.attach(MIMEText(body, "plain", "utf-8"))
        part = MIMEApplication(attachment[1])
        part.add_header("Content-Disposition", "attachment", filename=attachment[0])
        msg.attach(part)
    else:
        msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = config.SMTP_FROM
    msg["To"] = to
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
        server.starttls()
        if config.SMTP_USER:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        server.send_message(msg)


def _deliver(to: str, subject: str, body: str, attachment=None) -> bool:
    try:
        if config.RESEND_API_KEY:
            _deliver_resend(to, subject, body, attachment)
        else:
            _deliver_smtp(to, subject, body, attachment)
        return True
    except Exception as exc:  # never let email failures break a request
        log.warning("email to %s failed: %s", to, exc)
        return False


def send_email(to: str, subject: str, body: str):
    """Fire-and-forget: a slow mail server must not block API responses."""
    if not email_enabled() or not to:
        log.info("email skipped (not configured): %s -> %s", subject, to)
        return
    threading.Thread(target=_deliver, args=(to, subject, body), daemon=True).start()


def send_email_sync(to: str, subject: str, body: str, attachment=None) -> bool:
    """Synchronous send that reports success — used by the weekly backup so its 'last
    backup' timestamp only advances when the email actually went out."""
    if not email_enabled() or not to:
        log.info("email skipped (not configured): %s -> %s", subject, to)
        return False
    return _deliver(to, subject, body, attachment)


def notify_admin(subject: str, body: str):
    """Tell the platform owner (Ellice) about account events — new sign-ups, subscriptions,
    plan changes and cancellations. Goes to SUPPORT_EMAIL (the admin/support inbox); a no-op
    until email is configured. Prefixed so these are easy to filter in the inbox."""
    send_email(config.SUPPORT_EMAIL, f"[Creatiste Command] {subject}", body)
