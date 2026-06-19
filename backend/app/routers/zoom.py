"""Zoom webhook — ingests cloud-recording transcripts for onboarding/check-in calls.

When ZOOM_WEBHOOK_SECRET_TOKEN is set, onboarding calls are cloud-recorded
(see onboarding.create_meeting). Zoom POSTs here when the recording + audio
transcript are ready; we match the meeting back to its OnboardingSession, save
the transcript and auto-generate the AI key-points summary (Admin → Onboarding).

Inert (403) until the token is set — nothing records or webhooks until Zoom is
configured, so the platform behaves exactly as before in the meantime."""
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .. import config, mailer
from ..database import get_db
from ..models import OnboardingSession, User

router = APIRouter(prefix="/zoom", tags=["zoom"])
log = logging.getLogger("zoom")


def _hmac(message: str) -> str:
    return hmac.new(config.ZOOM_WEBHOOK_SECRET_TOKEN.encode(), message.encode(), hashlib.sha256).hexdigest()


def _vtt_to_text(vtt: str) -> str:
    """WEBVTT → plain transcript: drop the header, cue numbers, timestamps and NOTE lines."""
    out = []
    for line in vtt.splitlines():
        s = line.strip()
        if not s or s == "WEBVTT" or s.startswith("NOTE") or "-->" in s or s.isdigit():
            continue
        out.append(s)
    return "\n".join(out).strip()


def _ingest_transcript(db: Session, session: OnboardingSession, obj: dict, download_token: str) -> bool:
    """Save the recording link + transcript onto the session, then auto-summarise.
    Returns True only when a transcript was actually captured."""
    if obj.get("share_url"):
        session.recording_url = obj["share_url"]
    tfile = next((f for f in (obj.get("recording_files") or []) if f.get("file_type") == "TRANSCRIPT"), None)
    if not tfile or not tfile.get("download_url"):
        db.commit()  # recording.completed often fires before the transcript is ready — keep the link, wait
        return False
    try:
        import httpx

        headers = {"Authorization": f"Bearer {download_token}"} if download_token else {}
        vtt = httpx.get(tfile["download_url"], headers=headers, timeout=30).text
    except Exception as exc:
        log.warning("transcript download failed: %s", exc)
        db.commit()
        return False
    text = _vtt_to_text(vtt)
    if not text:
        db.commit()
        return False
    session.transcript = text
    db.commit()
    # Best-effort AI summary (needs ANTHROPIC_API_KEY; a missing key just leaves the
    # transcript for the admin to summarise by hand — the webhook must never 500 here).
    try:
        from .admin import run_onboarding_summary

        run_onboarding_summary(db, session)
    except Exception as exc:
        log.warning("auto-summary skipped: %s", exc)
    return True


@router.post("/webhook")
async def zoom_webhook(request: Request, db: Session = Depends(get_db)):
    if not config.ZOOM_WEBHOOK_SECRET_TOKEN:
        return JSONResponse({"error": "Zoom webhook not configured"}, status_code=403)
    raw = (await request.body()).decode("utf-8", "replace")
    try:
        body = json.loads(raw)
    except Exception:
        return JSONResponse({"error": "invalid payload"}, status_code=400)
    event = body.get("event")
    payload = body.get("payload") or {}

    # Zoom's one-time endpoint validation handshake (echoed back, no signature to verify yet).
    if event == "endpoint.url_validation":
        plain = payload.get("plainToken", "")
        return {"plainToken": plain, "encryptedToken": _hmac(plain)}

    # Verify the HMAC signature on every real event.
    ts = request.headers.get("x-zm-request-timestamp", "")
    if not hmac.compare_digest("v0=" + _hmac(f"v0:{ts}:{raw}"), request.headers.get("x-zm-signature", "")):
        return JSONResponse({"error": "bad signature"}, status_code=401)

    if event in ("recording.completed", "recording.transcript_completed"):
        obj = payload.get("object") or {}
        meeting_id = str(obj.get("id") or "")
        session = (
            db.query(OnboardingSession).filter(OnboardingSession.meeting_id == meeting_id).first()
            if meeting_id else None
        )
        if session and _ingest_transcript(db, session, obj, body.get("download_token", "")):
            user = db.get(User, session.user_id)
            who = (user.business_name or user.name or user.email) if user else "a client"
            mailer.notify_admin(
                f"Call transcript ready — {who}",
                "A recorded onboarding call has been transcribed and summarised.\n\n"
                "Open Admin → Onboarding to read the AI key points.",
            )
    return {"received": True}
